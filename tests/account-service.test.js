/* Comptes : logique du serveur (sans HTTP) avec un stockage en mémoire et une horloge simulée. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAccountService, AccountError } from '../server/accounts/service.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createLimiter } from '../server/accounts/ratelimit.js';
import { hashSecret, verifySecret, tokenHash } from '../server/accounts/secrets.js';
import { SESSIONS, LIMITS } from '../server/config.js';
import { parseAccountId, parseRecoveryCode } from '../src/shared/account.js';
import { FAST_SCRYPT } from './helpers.js';

const DAY = 86400e3;

function setup(opts = {}){
  const clock = { now: Date.UTC(2026, 9, 19) };
  const store = createMemoryStore();
  const svc = createAccountService({ store, clock: () => clock.now, scrypt: FAST_SCRYPT, ...opts });
  return { svc, store, clock };
}
const rejects = (p, code) => assert.rejects(p, e => e instanceof AccountError && e.code === code, `attendu : ${code}`);

test('mot de passe haché (scrypt, sel aléatoire), vérifié', async () => {
  const h1 = await hashSecret('motdepasse', FAST_SCRYPT), h2 = await hashSecret('motdepasse', FAST_SCRYPT);
  assert.match(h1, /^scrypt\$1024\$8\$1\$/);
  assert.notEqual(h1, h2, 'deux hachages du même mot de passe diffèrent');
  assert.ok(await verifySecret('motdepasse', h1));
  assert.ok(!await verifySecret('motdepassE', h1));
  assert.ok(!await verifySecret('motdepasse', 'nimportequoi'));
});

test('inscription : ID de compte, code de secours, connexion ouverte, rien de secret renvoyé', async () => {
  const { svc, store } = setup();
  const r = await svc.register({ name: '  Zoé ', password: 'motdepasse' });
  assert.equal(r.account.name, 'Zoé');
  assert.ok(parseAccountId(r.account.displayId), 'ID au bon format');
  assert.ok(parseRecoveryCode(r.recoveryCode), 'code de secours au bon format');
  assert.equal(r.account.guest, false);
  assert.ok(!('passHash' in r.account) && !('recoveryHash' in r.account));
  const saved = await store.getAccount(r.account.id);
  assert.ok(!JSON.stringify(saved).includes('motdepasse'), 'le mot de passe n\'est jamais stocké en clair');
  assert.equal((await svc.authenticate(r.token)).account.id, r.account.id);
});

test('un pseudo est unique, sans tenir compte des majuscules ni des accents', async () => {
  const { svc } = setup();
  await svc.register({ name: 'Zoé', password: 'motdepasse' });
  await rejects(svc.register({ name: 'ZOE', password: 'motdepasse' }), 'name_taken');
});

test('inscription refusée si pseudo ou mot de passe invalide', async () => {
  const { svc } = setup();
  await rejects(svc.register({ name: 'ab', password: 'motdepasse' }), 'invalid_name');
  await rejects(svc.register({ name: 'Zoé', password: 'court' }), 'invalid_password');
  await rejects(svc.register({}), 'invalid_name');
});

test('connexion : bon mot de passe ok, mauvais refusé, pseudo inconnu = même message', async () => {
  const { svc } = setup();
  const { account } = await svc.register({ name: 'Zoé', password: 'motdepasse' });
  const r = await svc.login({ name: 'zoe', password: 'motdepasse' });
  assert.equal(r.account.id, account.id);
  const bad = await svc.login({ name: 'Zoé', password: 'mauvais!!' }).catch(e => e);
  const unknown = await svc.login({ name: 'Personne', password: 'mauvais!!' }).catch(e => e);
  assert.equal(bad.code, 'bad_credentials');
  assert.equal(unknown.message, bad.message, 'on ne révèle pas quels pseudos existent');
});

test('plusieurs appareils : chaque connexion a son propre jeton ; se déconnecter n\'en coupe qu\'un', async () => {
  const { svc } = setup();
  const a = await svc.register({ name: 'Zoé', password: 'motdepasse' });
  const b = await svc.login({ name: 'Zoé', password: 'motdepasse' });
  assert.notEqual(a.token, b.token);
  await svc.logout(a.token);
  assert.equal(await svc.authenticate(a.token), null);
  assert.ok(await svc.authenticate(b.token));
});

test('le serveur ne garde que l\'empreinte du jeton', async () => {
  const { svc, store } = setup();
  const r = await svc.register({ name: 'Zoé', password: 'motdepasse' });
  assert.ok(await store.getSession(tokenHash(r.token)));
  assert.ok(!JSON.stringify(store.snapshot()).includes(r.token));
});

test('une connexion expire après 30 jours sans venir, et se prolonge quand le joueur revient', async () => {
  const { svc, clock } = setup();
  const r = await svc.register({ name: 'Zoé', password: 'motdepasse' });
  clock.now += 20 * DAY;
  const auth = await svc.authenticate(r.token);
  assert.equal(auth.renewed, SESSIONS.ttl, 'prolongée');
  clock.now += 20 * DAY;                                  // 40 jours après la création, 20 après la dernière visite
  assert.ok(await svc.authenticate(r.token));
  clock.now += 31 * DAY;
  assert.equal(await svc.authenticate(r.token), null, 'expirée');
});

test('prolongation au plus une fois par heure (pas d\'écriture à chaque requête)', async () => {
  const { svc, clock } = setup();
  const r = await svc.register({ name: 'Zoé', password: 'motdepasse' });
  clock.now += 10 * 60e3;
  assert.equal((await svc.authenticate(r.token)).renewed, null);
});

test('jeton inconnu ou absent : pas connecté', async () => {
  const { svc } = setup();
  assert.equal(await svc.authenticate('nimportequoi'), null);
  assert.equal(await svc.authenticate(undefined), null);
});

test('invité : compte sans pseudo, connexion d\'un an', async () => {
  const { svc, clock } = setup();
  const g = await svc.createGuest();
  assert.equal(g.account.guest, true);
  assert.equal(g.account.name, null);
  assert.match(g.account.displayName, /^Invité /);
  assert.equal(g.maxAge, SESSIONS.guestTtl);
  clock.now += 200 * DAY;
  assert.ok(await svc.authenticate(g.token));
});

test('sécuriser un invité : il garde son ID, gagne pseudo + mot de passe + code de secours', async () => {
  const { svc } = setup();
  const g = await svc.createGuest();
  const c = await svc.claim(g.account.id, { name: 'Zoé', password: 'motdepasse' });
  assert.equal(c.account.id, g.account.id, 'même ID : rien n\'est perdu');
  assert.equal(c.account.guest, false);
  assert.ok(parseRecoveryCode(c.recoveryCode));
  assert.equal(await svc.authenticate(g.token), null, 'l\'ancien jeton d\'invité est remplacé');
  assert.ok(await svc.authenticate(c.token));
  assert.equal((await svc.login({ name: 'Zoé', password: 'motdepasse' })).account.id, g.account.id);
  await rejects(svc.claim(g.account.id, { name: 'Autre', password: 'motdepasse' }), 'not_guest');
});

test('sécuriser un invité avec un pseudo déjà pris : refusé, l\'invité reste intact', async () => {
  const { svc } = setup();
  await svc.register({ name: 'Zoé', password: 'motdepasse' });
  const g = await svc.createGuest();
  await rejects(svc.claim(g.account.id, { name: 'zoe', password: 'motdepasse' }), 'name_taken');
  const still = await svc.authenticate(g.token);
  assert.equal(still.account.guest, true);
});

test('mot de passe oublié : pseudo + code de secours → nouveau mot de passe, nouveau code, autres appareils déconnectés', async () => {
  const { svc } = setup();
  const r = await svc.register({ name: 'Zoé', password: 'motdepasse' });
  const code = r.recoveryCode.toLowerCase();               // tapé en minuscules : accepté
  const rec = await svc.recover({ name: 'Zoé', recoveryCode: code, newPassword: 'nouveaumdp' });
  assert.notEqual(rec.recoveryCode, r.recoveryCode);
  assert.equal(await svc.authenticate(r.token), null);
  assert.ok(await svc.authenticate(rec.token));
  await rejects(svc.login({ name: 'Zoé', password: 'motdepasse' }), 'bad_credentials');
  assert.ok(await svc.login({ name: 'Zoé', password: 'nouveaumdp' }));
  await rejects(svc.recover({ name: 'Zoé', recoveryCode: code, newPassword: 'encoreunautre' }), 'bad_recovery');
});

test('mot de passe oublié : mauvais code refusé', async () => {
  const { svc } = setup();
  await svc.register({ name: 'Zoé', password: 'motdepasse' });
  await rejects(svc.recover({ name: 'Zoé', recoveryCode: 'AAAA-AAAA-AAAA-AAAA', newPassword: 'nouveaumdp' }), 'bad_recovery');
  await rejects(svc.recover({ name: 'Zoé', recoveryCode: 'pas un code', newPassword: 'nouveaumdp' }), 'bad_recovery');
});

test('changer de mot de passe : l\'ancien est demandé, les autres appareils sont déconnectés', async () => {
  const { svc } = setup();
  const a = await svc.register({ name: 'Zoé', password: 'motdepasse' });
  const b = await svc.login({ name: 'Zoé', password: 'motdepasse' });
  await rejects(svc.changePassword(a.account.id, { oldPassword: 'mauvais!!', newPassword: 'nouveaumdp' }), 'bad_credentials');
  const c = await svc.changePassword(a.account.id, { oldPassword: 'motdepasse', newPassword: 'nouveaumdp' });
  assert.equal(await svc.authenticate(b.token), null);
  assert.ok(await svc.authenticate(c.token));
  assert.ok(await svc.login({ name: 'Zoé', password: 'nouveaumdp' }));
});

test('force brute : après 10 échecs sur un pseudo, même le bon mot de passe attend', async () => {
  const { svc, clock } = setup();
  await svc.register({ name: 'Zoé', password: 'motdepasse' });
  for(let i = 0; i < LIMITS.loginPerName.max; i++) await rejects(svc.login({ name: 'Zoé', password: 'mauvais!!', ip: `ip${i}` }), 'bad_credentials');
  const e = await svc.login({ name: 'Zoé', password: 'motdepasse', ip: 'autre' }).catch(e => e);
  assert.equal(e.code, 'rate_limited');
  assert.ok(e.retryAfter > 0);
  clock.now += LIMITS.loginPerName.window;
  assert.ok(await svc.login({ name: 'Zoé', password: 'motdepasse' }), 'débloqué après la fenêtre');
});

test('spam : création de comptes limitée par adresse', async () => {
  const { svc } = setup();
  for(let i = 0; i < LIMITS.createPerIp.max; i++) await svc.createGuest({ ip: '1.2.3.4' });
  await rejects(svc.createGuest({ ip: '1.2.3.4' }), 'rate_limited');
  assert.ok(await svc.createGuest({ ip: '5.6.7.8' }), 'une autre adresse n\'est pas bloquée');
});

test('limiteur : fenêtre glissante', () => {
  let now = 0;
  const l = createLimiter({ max: 2, window: 1000 }, () => now);
  l.hit('k'); now = 500; l.hit('k');
  assert.equal(l.check('k').ok, false);
  assert.equal(l.check('k').retryAfter, 1);
  now = 1001;
  assert.equal(l.check('k').ok, true, 'le premier coup est sorti de la fenêtre');
});

test('ménage : les connexions expirées sont supprimées', async () => {
  const { svc, store, clock } = setup();
  const r = await svc.register({ name: 'Zoé', password: 'motdepasse' });
  clock.now += 31 * DAY;
  assert.equal(await svc.purgeExpired(), 1);
  assert.equal(await store.getSession(tokenHash(r.token)), null);
});
