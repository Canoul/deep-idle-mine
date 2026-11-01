/* Suppression d'un compte (01/11/2026, exigence de Google Play et de l'App Store) : on remplit toutes les sortes de données
   d'un compte, on le supprime, et on cherche son identifiant et son pseudo dans TOUT ce qui reste enregistré. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { RULES } from '../src/config.js';
import { nameKey, formatAccountId } from '../src/shared/account.js';
import { createApp } from '../server/app.js';
import { createMemoryStore, createPgStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { createAccountEraser, DELETED_NAME } from '../server/accounts/erase.js';
import { createMemoryGameStore, createPgGameStore, ACCOUNT_NS, SHARED_NS, KEPT_NS, FREE_NS, GAME_NS } from '../server/game/store.js';
import { openDatabase } from '../server/db/postgres.js';
import { createGameService } from '../server/game/service.js';
import { createPartyService } from '../server/party/service.js';
import { createSocialService } from '../server/social/service.js';
import { createGuildService } from '../server/guild/service.js';
import { createInstantService } from '../server/instant/service.js';
import { createTownService } from '../server/town/service.js';
import { createModerationService } from '../server/moderation/service.js';
import { createReportService } from '../server/moderation/reports.js';
import { ROOT, SERVER, LIMITS } from '../server/config.js';
import { dialogHtml } from '../src/ui/dialog.js';
import { deleteWarning, deleteFields, profileDanger } from '../src/ui/account.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const PASS = 'motdepasse-solide', rules = { acceptRules: true };
async function setup(){
  const t = { now: 2_000_000 }, clock = () => t.now;
  const accounts = createMemoryStore(), store = createMemoryGameStore();
  const service = createAccountService({ store: accounts, clock, scrypt: FAST_SCRYPT, limits: { ...LIMITS, createPerIp: { max: 999, window: 1e3 } } });
  const moderation = createModerationService({ store, clock });
  let social = null, guild = null;
  const game = createGameService({ store, liveRunner: fakeLive(rec => ({ id: rec.id, success: true, shares: rec.players.map(p => ({ account: p.account, left: false, bag: { Charbon: 1 } })) })), clock, randomSeed: () => 7, moderation, blockedOf: id => social.blockedOf(id) });
  const party = createPartyService({ game, clock, store, getAccount: id => accounts.getAccount(id) });
  social = createSocialService({ store, accounts, party, game, clock, moderation, guildMembers: id => guild.membersOf(id) });
  guild = createGuildService({ store, accounts, statusOf: async () => ({ status: 'offline' }), clock });
  const instant = createInstantService({ game, party, store, clock });
  const town = createTownService({ accounts, game, party, clock, recentChat: ms => social.recentChat(ms) });
  const reports = createReportService({ store, accounts, social, game, clock });
  const eraser = createAccountEraser({ accounts, gameStore: store, game, party, instant, social, guild, town, clock });
  const reg = async name => { const r = await service.register({ name, password: PASS, ...rules }); return { ...await accounts.getAccount(r.account.id), rulesVersion: RULES.version }; };
  return { t, accounts, store, service, moderation, game, party, social, guild, instant, town, reports, eraser, reg,
           say: async (who, text, extra = {}) => { t.now += 4000; return (await social.chatPost(who, { text, ...extra })).message; } };
}
/* tout ce qui reste, sans les deux sortes gardées exprès */
const leftovers = (ctx) => { const { reports: _r, modLogs: _l, ...rest } = ctx.store.snapshot(); return JSON.stringify([rest, ctx.accounts.snapshot()]); };
function nothingLeft(ctx, acc){
  const json = leftovers(ctx);
  assert.ok(!json.includes(acc.id), `identifiant retrouvé : …${json.slice(Math.max(0, json.indexOf(acc.id) - 120), json.indexOf(acc.id) + 40)}…`);
  assert.ok(!json.includes(acc.name), `pseudo retrouvé : …${json.slice(Math.max(0, json.indexOf(acc.name) - 120), json.indexOf(acc.name) + 40)}…`);
}

/* un compte avec une ligne dans chaque sorte de données */
async function fill(ctx, z, m){
  const { store } = ctx, id = z.id;
  await store.putInventoryAndFurnaces(id, { slots: [{ item: 'Charbon', qty: 3 }] }, { a: 1 });
  await store.putInventoryAndCrusher(id, { slots: [] }, { a: 1 });
  await store.putInventoryAndStuff(id, { slots: [] }, { worn: {} });
  await store.putProgress(id, { xp: 50 }); await store.putPrefs(id, { a: 1 }); await store.putSkills(id, { tree: null });
  await store.putSpells(id, { learned: [] }); await store.putSets(id, { list: [] }); await store.putShrines(id, { list: [] });
  await store.putEnergy(id, { value: 3 }); await store.putPrison(id, { state: 'done', specs: { name: z.name } }); await store.putPrisonCompo(id, { cur: [] });
  await store.putChatPrefs(id, { tabs: [] }); await store.setAlwaysReady(id, true);
  await store.putGiantDayAndPlayer({ day: '2026-11-01', total: 9, scores: { [id]: { points: 4, visits: 1, name: z.name }, [m.id]: { points: 5, visits: 1, name: m.name } } }, id, { claimed: [] });
  await store.putHcDayAndPlayer({ day: '2026-11-01', total: 4, scores: { [id]: { points: 4, visits: 1, name: z.name } } }, id, { claimed: [] });
  /* records : les siens (niveaux 1 et 2), et celui d'un coéquipier qui le cite */
  await store.putTowerRecords([[id, { t: 9, at: 1, side: 'angel', team: [z.name], session: 's' }], [`${id}#2`, { t: 9, at: 1, side: 'angel', level: 2, team: [z.name], session: 's' }],
                               [m.id, { t: 8, at: 1, side: 'angel', team: [z.name, m.name], session: 's' }]]);
  await store.putInstanceRecords([[id, { t: 9, fight: 3, at: 1, instance: 'instance_1', team: [z.name], session: 's' }],
                                  [m.id, { t: 8, fight: 3, at: 1, instance: 'instance_1', team: [m.name, z.name], session: 's' }]]);
  /* statistiques du tableau de bord */
  await store.putSessionStats([{ key: `s1:${id}`, value: { session: 's1', account: id, name: z.name, at: 1, mined: 12 } }, { key: `s2:${id}`, value: { session: 's2', account: id, name: z.name, at: 2, mined: 7 } },
                               { key: `s1:${m.id}`, value: { session: 's1', account: m.id, name: m.name, at: 1, mined: 9 } }]);
  /* historique : une session seul, une avec un coéquipier */
  await store.putGameSession({ id: 'solo', mode: 'mine', players: [{ account: id, name: z.name }], leaves: [], seen: [id], status: 'done', endedAt: 1, startedAt: 1, result: { shares: [{ account: id, bag: {} }] } });
  await store.putGameSession({ id: 'duo', mode: 'mine', players: [{ account: id, name: z.name }, { account: m.id, name: m.name }], leaves: [{ account: id, tick: 3 }], seen: [id, m.id], status: 'done', endedAt: 1, startedAt: 1,
                               looks: { [id]: {}, [m.id]: {} }, statsAt: { [id]: { level: 1 } }, result: { shares: [{ account: id, bag: {} }, { account: m.id, bag: {} }], miners: [{ account: id, name: z.name, stats: {} }] } });
  /* jugement : tour déjà faite */
  await store.putJudgment({ angel: { count: 0, openUntil: 0, opening: 1 }, demon: { count: 0, openUntil: 0, opening: 0 }, done: { angel: { opening: 1, accounts: [id, `${id}#2`, m.id] }, demon: { opening: 0, accounts: [] } } });
  /* modération : sa fiche, et une fiche d'un autre qui le cite */
  await store.putModeration(id, { warnings: [{ at: 1, text: 'x' }], bans: [] });
  await store.putModeration(m.id, { warnings: [{ at: 1, text: 'x', with: [{ account: id, name: z.name }] }], bans: [] });
}

test('classement des données : toute sorte de données du jeu dit ce qu\'elle devient à la suppression d\'un compte', () => {
  const known = new Set([...ACCOUNT_NS, ...SHARED_NS, ...KEPT_NS, ...FREE_NS]);
  for(const ns of GAME_NS) assert.ok(known.has(ns), `ns « ${ns} » : à classer dans server/game/store.js (ACCOUNT_NS, SHARED_NS, KEPT_NS ou FREE_NS)`);
  assert.deepEqual([...KEPT_NS].sort(), ['mod_log', 'report']);
});

test('suppression : il ne reste ni son identifiant ni son pseudo, nulle part', async () => {
  const ctx = await setup(), { social, party, guild, town, instant, game, store, accounts, eraser, say, moderation } = ctx;
  const z = await ctx.reg('Zorglub'), m = await ctx.reg('Maxence'), l = await ctx.reg('Louison');
  await fill(ctx, z, m);
  /* amis, demandes, blocage, des deux côtés */
  await social.request(z, 'Maxence'); await social.answer(m, z.id, true);
  await social.request(z, 'Louison');
  await social.block(l, z.id).catch(() => {}); await social.request(m, 'Louison');
  await social.block(m, l.id);
  /* blocage : l bloque z (et perd la demande), z bloque quelqu'un */
  await social.block(z, l.id);
  /* groupe et guilde dont il est le chef */
  await party.create(z); await party.join(m, (await party.state(z)).party.code);
  await guild.create(z, 'Les Mineurs');
  /* chat : public, MP reçu d'un autre, bulle du Carreau */
  await say(z, 'bonjour'); await say(m, 'coucou toi', { channel: 'mp', to: 'Zorglub' }); await say(m, 'message de Max');
  await town.ping(z, { spot: 'lobby' });
  /* mine instantanée */
  await store.putInstantSignup(z.id, { account: z.id, name: z.name, at: 1 });
  await instant.load?.();

  const r = await eraser.deleteAccount(z.id, { by: 'joueur' });
  assert.equal(r.deleted, true);
  nothingLeft(ctx, z);
  assert.equal(await accounts.getAccount(z.id), null);
  assert.equal(await accounts.findAccountByName(nameKey('Zorglub')), null);

  /* les autres continuent */
  assert.equal((await party.state(m)).party.leader, m.id, 'le suivant devient chef');
  assert.equal((await party.state(m)).party.members.length, 1);
  assert.equal((await social.state(m)).friends.length, 0);
  assert.deepEqual((await social.chatGet(m, 0)).messages.map(x => x.text), ['message de Max'], 'ses messages et les MP qu\'il a reçus sont partis');
  assert.ok((await social.chatGet(m, 0)).removed.length >= 2, 'les pages ouvertes l\'apprennent');
  assert.equal((await town.ping(m, { spot: 'lobby' })).players.length, 0, 'plus de présence, donc plus de bulle');
  assert.equal(await guild.nameOf(z.id), null);
  assert.deepEqual((await store.getTowerRecord(m.id)).team, [DELETED_NAME, 'Maxence']);
  assert.deepEqual((await store.getInstanceRecord(m.id)).team, ['Maxence', DELETED_NAME]);
  assert.equal(await store.getTowerRecord(z.id), null); assert.equal(await store.getTowerRecord(`${z.id}#2`), null);
  assert.equal((await store.getGiantDay('2026-11-01')).scores[z.id], undefined);
  assert.equal((await store.getGiantDay('2026-11-01')).total, 9, 'le total du jour ne bouge pas : les récompenses des autres non plus');
  /* statistiques : gardées, sans lien avec le compte, toujours regroupées */
  const stats = await store.allSessionStats();
  assert.equal(stats.length, 3);
  const anon = stats.filter(s => s.name === DELETED_NAME);
  assert.deepEqual(anon.map(s => s.mined).sort(), [12, 7]);
  assert.equal(new Set(anon.map(s => s.account)).size, 1, 'un même joueur anonyme pour le tableau de bord');
  /* historique : la session seul est partie, le coéquipier garde la sienne */
  assert.equal(await store.getGameSession('solo'), null);
  const duo = await store.getGameSession('duo');
  assert.equal(duo.players[0].name, DELETED_NAME); assert.equal(duo.players[1].account, m.id);
  assert.deepEqual((await game.history(m)).sessions[0].players, [DELETED_NAME, 'Maxence'], 'l\'historique du coéquipier marche encore');
  /* journal : une ligne, sans autre donnée */
  const line = (await moderation.logList()).find(x => x.action === 'account-delete');
  assert.equal(line.target, formatAccountId(z.id)); assert.match(line.detail, new RegExp(`^compte ${formatAccountId(z.id)} supprimé le `));
  /* le pseudo redevient libre */
  assert.ok((await ctx.reg('Zorglub')).id !== z.id);
});

test('en session à plusieurs : il la quitte, les autres continuent, rien n\'est versé à son compte, tout est nettoyé à la fin', async () => {
  const ctx = await setup(), { game, store, eraser, t } = ctx;
  const z = await ctx.reg('Zorglub'), m = await ctx.reg('Maxence');
  const { session } = await game.start(z, {}, [{ account: z.id, name: z.name }, { account: m.id, name: m.name }]);
  await eraser.deleteAccount(z.id);
  assert.equal(await game.activeSessionId(z.id), null);
  assert.equal(await game.activeSessionId(m.id), session.id, 'les autres continuent');
  t.now += 4 * 3600e3; await game.pump(); await game.settle(session.id);
  assert.equal((await store.getGameSession(session.id)).status, 'done');
  assert.equal(await store.getInventory(z.id), null, 'aucun versement ne recrée son inventaire');
  assert.equal(await store.getProgress(z.id), null);
  nothingLeft(ctx, z);
  assert.ok(await store.getInventory(m.id), 'le coéquipier est payé');
});

test('seul en session : la session s\'arrête ; prison arrêtée ; inscriptions annulées', async () => {
  const ctx = await setup(), { game, instant, party, eraser, store } = ctx;
  const z = await ctx.reg('Zorglub');
  const { session } = await game.start(z, {});
  await instant.join?.(z).catch(() => {});
  await party.lfg(z, {}).catch(() => {});
  await eraser.deleteAccount(z.id);
  assert.equal(await store.getGameSession(session.id), null);
  assert.equal(party.lfgCount(), 0);
  assert.equal(instant.count(), 0);
  nothingLeft(ctx, z);
});

test('signalements gardés avec le texte ; son nom de signaleur retiré ; son journal admin anonymisé', async () => {
  const ctx = await setup(), { reports, say, eraser, store, moderation } = ctx;
  const z = await ctx.reg('Zorglub'), m = await ctx.reg('Maxence');
  const a = await say(z, 'vilain message'), b = await say(m, 'autre');
  await reports.report(m, { source: 'global', message: a.id, reason: 'spam' });   // il est visé
  await reports.report(z, { source: 'global', message: b.id, reason: 'spam' });   // il signale
  await moderation.log({ by: 'geoffrey', action: 'mute', target: 'Zorglub', detail: '2 h' });
  await eraser.deleteAccount(z.id);
  const [visé, signaleur] = await store.listReports();
  assert.equal(visé.message.text, 'vilain message'); assert.equal(visé.target, z.id, 'gardé : sécurité des joueurs');
  assert.equal(signaleur.byName, DELETED_NAME); assert.ok(!JSON.stringify(signaleur).includes(z.id));
  const log = await store.listModLog();
  assert.ok(!log.some(l => l.target === 'Zorglub'));
});

test('invité : même suppression ; compte inconnu ou déjà supprimé : rien', async () => {
  const ctx = await setup(), { service, accounts, eraser, say, social } = ctx;
  const g = await accounts.getAccount((await service.createGuest({ ip: '1.1.1.1', ...rules })).account.id);
  await say(g, 'je suis invité');
  await eraser.deleteAccount(g.id);
  assert.equal(await accounts.getAccount(g.id), null);
  assert.ok(!leftovers(ctx).includes(g.id)); assert.ok(!leftovers(ctx).includes(formatAccountId(g.id)));
  assert.equal((await eraser.deleteAccount(g.id)).deleted, false);
  assert.equal((await social.chatGet({ id: 'AAAA1111' }, 0)).messages.length, 0);
});

test('PostgreSQL : le compte et ses données partent en une seule écriture', async () => {
  const lines = new Map(), writes = [];
  const pool = { async query(sql, p = []){ const s = sql.trim(); if(/^SELECT/.test(s)) return { rows: [] }; if(!/^CREATE/.test(s)) writes.push(s.split(/\s+/)[0]); return { rows: [] }; }, async end(){},
                 connect: async () => ({ query: async sql => { writes.push(sql.trim().split(/\s+/)[0]); return { rows: [] }; }, release(){} }) };
  const db = await openDatabase('', { pool, log: { warn(){}, error(){} } });
  const accounts = await createPgStore(db), store = await createPgGameStore(db);
  await accounts.insertAccount({ id: 'AAAA1111', name: 'Zoe', nameKey: 'zoe', guest: false });
  await store.putInventory('AAAA1111', { slots: [] });
  await db.flush(); writes.length = 0;
  const noop = { eraseAccount: async () => {} };
  const eraser = createAccountEraser({ accounts, gameStore: store, game: noop, party: noop, instant: noop, social: noop, guild: noop, town: noop });
  await eraser.deleteAccount('AAAA1111');
  await db.flush();
  assert.equal(writes.filter(w => w === 'BEGIN').length, 1); assert.equal(writes.at(-1), 'COMMIT');
  assert.ok(lines);
});

/* ---------- par HTTP ---------- */
async function httpSetup(){
  const ctx = await setup();
  const server = http.createServer(createApp({ store: ctx.accounts, service: ctx.service, game: ctx.game, party: ctx.party, social: ctx.social, moderation: ctx.moderation, eraser: ctx.eraser,
    root: ROOT, config: { ...SERVER, logProxyCheck: false, adminToken: 'k'.repeat(40) } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (route, body, cookie, headers = {}) => fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: JSON.stringify(body ?? {}) })
    .then(async r => ({ status: r.status, data: await r.json().catch(() => null), cookie: r.headers.get('set-cookie')?.split(';')[0] }));
  return { ...ctx, server, base, call };
}

test('route du joueur : pseudo et mot de passe exigés, invité : SUPPRIMER ; connexion coupée', async () => {
  const c = await httpSetup();
  try {
    const r = await c.call('/api/account/register', { name: 'Zorglub', password: PASS, ...rules }), cookie = r.cookie, id = r.data.account.id;
    assert.equal((await c.call('/api/account/delete', {})).status, 401);
    for(const body of [{}, { name: 'Zorglub' }, { name: 'Zorglub', password: 'mauvais-mot' }, { name: 'Autre', password: PASS }, { confirm: 'SUPPRIMER' }])
      assert.ok([400, 401].includes((await c.call('/api/account/delete', body, cookie)).status), JSON.stringify(body));
    assert.ok(await c.accounts.getAccount(id), 'rien de supprimé');
    const ok = await c.call('/api/account/delete', { name: 'zorglub', password: PASS }, cookie);
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.match(ok.cookie ?? '', /=$|=;|^dim_session=$/);
    const me = await fetch(c.base + '/api/account/me', { headers: { cookie } }).then(x => x.json());
    assert.equal(me.account, null);
    assert.equal((await c.call('/api/account/login', { name: 'Zorglub', password: PASS })).status, 401);

    const g = await c.call('/api/account/guest', rules);
    assert.equal((await c.call('/api/account/delete', { confirm: 'supprimer' }, g.cookie)).status, 400);
    assert.equal((await c.call('/api/account/delete', { confirm: 'SUPPRIMER' }, g.cookie)).status, 200);
  } finally { c.server.close(); }
});

test('trop d\'essais de mot de passe : limité', async () => {
  const c = await httpSetup();
  try {
    const r = await c.call('/api/account/register', { name: 'Zorglub', password: PASS, ...rules });
    let last;
    for(let i = 0; i < LIMITS.loginPerName.max + 1; i++) last = await c.call('/api/account/delete', { name: 'Zorglub', password: 'mauvais-mot' }, r.cookie);
    assert.equal(last.status, 429);
  } finally { c.server.close(); }
});

test('route admin : fermée sans la clé, aperçu sans rien supprimer, par pseudo ou par ID', async () => {
  const c = await httpSetup();
  const admin = body => c.call('/api/admin/delete-account', body, null, { authorization: `Bearer ${'k'.repeat(40)}` });
  try {
    const r = await c.call('/api/account/register', { name: 'Zorglub', password: PASS, ...rules }), id = r.data.account.id;
    assert.equal((await c.call('/api/admin/delete-account', { name: 'Zorglub' })).status, 404);
    assert.equal((await admin({ name: 'Inconnu', confirm: true })).status, 404);
    const look = await admin({ name: 'Zorglub' });
    assert.equal(look.data.deleted, false); assert.equal(look.data.account, 'Zorglub');
    assert.ok(await c.accounts.getAccount(id));
    assert.equal((await admin({ name: formatAccountId(id), confirm: true, by: 'geoffrey' })).data.deleted, true);
    assert.equal(await c.accounts.getAccount(id), null);
    assert.equal((await c.moderation.logList()).find(x => x.action === 'account-delete').by, 'geoffrey');
  } finally { c.server.close(); }
});

test('page web : servie à /suppression-compte, sans script, avec les deux listes et l\'adresse de contact', async () => {
  const c = await httpSetup();
  try {
    const res = await fetch(c.base + '/suppression-compte');
    assert.equal(res.status, 200); assert.match(res.headers.get('content-type'), /text\/html/);
    const html = await res.text();
    assert.ok(html.includes('contact@deepmineidle.fr')); assert.match(html, /Mon compte/); assert.match(html, /Supprimer mon compte/);
    assert.doesNotMatch(html, /<script/);
    assert.equal((await fetch(c.base + '/suppression-compte.html')).status, 200);
  } finally { c.server.close(); }
});

test('interface : fenêtre à champs, bouton dans une zone à part, textes clairs', () => {
  const h = dialogHtml({ kind:'fields', text:'<Confirmer>', ok:'Supprimer', danger:true, fields:[{ name:'name', label:'Pseudo' }, { name:'password', label:'Mot de passe', type:'password' }] });
  assert.ok(h.includes('&lt;Confirmer&gt;')); assert.match(h, /data-field="name"/); assert.match(h, /type="password"/); assert.match(h, /class="danger" data-dlg="yes"/); assert.match(h, /data-dlg="no"/);
  assert.match(deleteWarning({ guest:false }), /irréversible/i);
  for(const word of ['progression', 'inventaire', 'amis', 'records']) assert.match(deleteWarning({ guest:false }), new RegExp(word, 'i'));
  assert.deepEqual(deleteFields({ guest:true }).map(f => f.name), ['confirm']);
  assert.deepEqual(deleteFields({ guest:false }).map(f => f.name), ['name', 'password']);
  assert.match(profileDanger(), /data-act="deleteAccount"/); assert.match(profileDanger(), /Supprimer mon compte/);
});
