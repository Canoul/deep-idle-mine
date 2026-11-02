/* Outils admin (01/11/2026) : signalements, suppression d'un message, mute, suspension, pseudo forcé, journal ; et
   acceptation des règles (création de compte, premier message). Par le vrai serveur HTTP. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { RULES } from '../src/config.js';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createPartyService } from '../server/party/service.js';
import { createSocialService } from '../server/social/service.js';
import { createModerationService } from '../server/moderation/service.js';
import { createReportService } from '../server/moderation/reports.js';
import { ROOT, SERVER, LIMITS } from '../server/config.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const TOKEN = 'k'.repeat(40), PASS = 'motdepasse-solide';
let base, server, store, seq = 0;
before(async () => {
  store = createMemoryStore();
  const service = createAccountService({ store, scrypt: FAST_SCRYPT, limits: { ...LIMITS, createPerIp: { max: 999, window: 1e3 } } });
  const gameStore = createMemoryGameStore();
  const moderation = createModerationService({ store: gameStore });
  const game = createGameService({ store: gameStore, liveRunner: fakeLive(() => ({ shares: [] })), dev: false, moderation });
  const party = createPartyService({ game, getAccount: id => store.getAccount(id) });
  const social = createSocialService({ store: gameStore, accounts: store, party, game, moderation });
  const reports = createReportService({ store: gameStore, accounts: store, social, game });
  server = http.createServer(createApp({ store, service, game, party, social, moderation, reports, root: ROOT, config: { ...SERVER, logProxyCheck: false, adminToken: TOKEN } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const call = (route, body, cookie, headers = {}) => fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: JSON.stringify(body ?? {}) })
  .then(async r => ({ status: r.status, data: await r.json().catch(() => null), cookie: r.headers.get('set-cookie')?.split(';')[0] }));
const get = (route, cookie) => fetch(base + route, { headers: { cookie } }).then(async r => ({ status: r.status, data: await r.json() }));
const admin = (route, body) => call('/api/admin/' + route, { by: 'geoffrey', ...body }, null, { authorization: `Bearer ${TOKEN}` });
async function player(){
  const name = 'Joueur' + (++seq);
  const r = await call('/api/account/register', { name, password: PASS, acceptRules: true });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return { name, cookie: r.cookie, id: r.data.account.id };
}
const say = (p, text) => call('/api/social/chat', { text, channel: 'general' }, p.cookie);

test('routes fermées sans la clé', async () => {
  for(const r of ['reports', 'chat-delete', 'chat-recent', 'mute', 'ban', 'rename', 'mod-log'])
    assert.equal((await call('/api/admin/' + r, {})).status, 404, r);
});

test('règles : pas de compte sans la case, invité compris ; version et date gardées', async () => {
  for(const body of [{}, { acceptRules: false }, { acceptRules: 'true' }]){
    assert.equal((await call('/api/account/guest', body)).data.error.code, 'rules_required');
    assert.equal((await call('/api/account/register', { name: 'SansCase', password: PASS, ...body })).status, 400);
  }
  assert.equal(await store.findAccountByName('sanscase'), null);
  const g = await call('/api/account/guest', { acceptRules: true });
  assert.equal(g.status, 201);
  const acc = await store.getAccount(g.data.account.id);
  assert.equal(acc.rulesVersion, RULES.version); assert.ok(acc.rulesAt > 0);
});

test('compte existant : refusé au premier message, accepte, écrit ; conditions changées : redemandé', async () => {
  const p = await player();
  const acc = await store.getAccount(p.id);
  delete acc.rulesVersion; delete acc.rulesAt; await store.updateAccount(acc);
  const no = await say(p, 'bonjour');
  assert.equal(no.status, 403); assert.equal(no.data.error.code, 'rules_required');
  assert.equal((await call('/api/account/rules', {}, p.cookie)).status, 400);
  assert.equal((await call('/api/account/rules', { accept: true }, p.cookie)).status, 200);
  assert.equal((await say(p, 'bonjour')).status, 200);
  const again = await store.getAccount(p.id);
  again.rulesVersion = RULES.version - 1; await store.updateAccount(again);
  assert.equal((await say(p, 'encore')).data.error.code, 'rules_required', 'refusé avant la cadence');
});

test('mute : plus de chat avec un message clair, le jeu continue ; --off le lève ; durée vérifiée', async () => {
  const p = await player();
  for(const hours of [0, -1, 1.5, 'x', null, 1e9]) assert.equal((await admin('mute', { name: p.name, hours })).status, 400, String(hours));
  assert.equal((await admin('mute', { name: p.name, hours: 2 })).status, 200);
  const r = await say(p, 'coucou');
  assert.equal(r.status, 403); assert.equal(r.data.error.code, 'muted'); assert.match(r.data.error.message, /jusqu'au/);
  assert.equal((await call('/api/party/create', {}, p.cookie)).status, 200, 'le reste du jeu marche');
  assert.equal((await admin('mute', { name: p.name, off: true })).status, 200);
  assert.equal((await say(p, 'coucou')).status, 200);
});

test('suspension : connexion refusée avec un message, session en cours coupée ; définitive ou datée ; --off la lève', async () => {
  const p = await player();
  assert.equal((await admin('ban', { name: p.name, days: -2 })).status, 400);
  assert.equal((await admin('ban', { name: p.name })).status, 200);
  const login = await call('/api/account/login', { name: p.name, password: PASS });
  assert.equal(login.status, 403); assert.equal(login.data.error.code, 'suspended'); assert.match(login.data.error.message, /définitive/);
  assert.equal(login.cookie, undefined);
  const me = await get('/api/account/me', p.cookie);
  assert.equal(me.data.account, null); assert.match(me.data.suspended, /suspendu/);
  assert.equal((await say(p, 'x')).data.error.code, 'suspended');
  assert.equal((await get('/api/social', p.cookie)).status, 403);
  assert.equal((await call('/api/account/guest', { acceptRules: true }, p.cookie)).status, 201, 'une autre partie reste possible sur ce navigateur');
  assert.equal((await admin('ban', { name: p.name, days: 3 })).status, 200);
  assert.match((await call('/api/account/login', { name: p.name, password: PASS })).data.error.message, /jusqu'au/);
  assert.equal((await admin('ban', { name: p.name, off: true })).status, 200);
  assert.equal((await call('/api/account/login', { name: p.name, password: PASS })).status, 200);
});

test('compte invité : les outils le trouvent par son ID (il écrit dans le chat, il n\'a pas de pseudo)', async () => {
  const g = await call('/api/account/guest', { acceptRules: true });
  assert.equal((await admin('mute', { name: g.data.account.displayId, hours: 1 })).status, 200);
  assert.equal((await call('/api/social/chat', { text: 'x', channel: 'general' }, g.cookie)).data.error.code, 'muted');
});

test('pseudo forcé : mêmes règles qu\'un pseudo choisi, il garde son ID, invité refusé', async () => {
  const p = await player(), q = await player();
  assert.equal((await admin('rename', { name: p.name, to: 'c0nnard' })).status, 400);
  assert.equal((await admin('rename', { name: p.name, to: q.name })).data.error.code, 'name_taken');
  assert.equal((await admin('rename', { name: p.name, to: 'NouveauNom' })).status, 200);
  assert.equal((await store.getAccount(p.id)).name, 'NouveauNom');
  const g = await call('/api/account/guest', { acceptRules: true });
  assert.equal((await admin('rename', { name: g.data.account.displayId, to: 'PasInvite' })).status, 409);
});

test('supprimer un message : il disparaît pour tous, les navigateurs ouverts l\'apprennent', async () => {
  const p = await player(), q = await player();
  const id = (await say(p, 'à supprimer')).data.message.id;
  const recent = await admin('chat-recent', { name: p.name });
  assert.equal(recent.data.rows.at(-1).id, id); assert.equal(recent.data.rows.at(-1).text, 'à supprimer');
  assert.equal((await admin('chat-delete', { id: 999999 })).status, 404);
  assert.equal((await admin('chat-delete', { id: 'x' })).status, 400);
  assert.equal((await admin('chat-delete', { id })).status, 200);
  assert.ok((await get(`/api/social/chat?after=${id}`, q.cookie)).data.removed.includes(id));
  assert.ok(!(await get('/api/social/chat?after=0', q.cookie)).data.messages.some(m => m.id === id));
});

test('signalement par HTTP, liste, clôture, et journal de chaque action admin', async () => {
  const p = await player(), q = await player();
  const m = (await say(p, 'vilain message')).data.message;
  const r = await call('/api/moderation/report', { source: 'global', message: m.id, reason: 'harassment', comment: 'merci' }, q.cookie);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal((await call('/api/moderation/report', { source: 'player', target: p.id, reason: 'spam' })).status, 401);
  const open = await admin('reports', { name: p.name, open: true });
  assert.equal(open.data.rows[0].message.text, 'vilain message'); assert.equal(open.data.rows[0].targetName, p.name);
  assert.equal((await admin('reports', { action: 'close', id: open.data.rows[0].id })).data.report.open, false);
  assert.equal((await admin('reports', { name: p.name, open: true })).data.rows.length, 0);
  await admin('mute', { name: p.name, hours: 1 });
  const log = (await admin('mod-log', {})).data.rows;
  assert.ok(log.some(l => l.action === 'mute' && l.target === p.name && l.by === 'geoffrey' && l.at > 0));
  assert.ok(log.some(l => l.action === 'report-close' && l.by === 'geoffrey'));
});
