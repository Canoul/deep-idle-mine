/* Modération du chat (30/10/2026) : avertissements avec motif, ban de 24 h au 3e, mot coupé entre deux joueurs, joueur
   banni bloqué par le serveur, outils des créateurs (fiche, lever le ban, retirer un avertissement). */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { MODERATION } from '../src/config.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createPartyService } from '../server/party/service.js';
import { createSocialService } from '../server/social/service.js';
import { createModerationService } from '../server/moderation/service.js';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { ROOT } from '../server/config.js';
import { warningText, banBarText } from '../src/shared/moderation-text.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false }, OTHER = { id:'BBBB2222', name:'Max', guest:false };
const ACCOUNTS = { [ME.id]: ME, [OTHER.id]: OTHER };
function setup(){
  const t = { now: 2_000_000 }, clock = () => t.now, store = createMemoryGameStore(), banned = [];
  const moderation = createModerationService({ store, clock, onBan: id => banned.push(id) });
  const game = createGameService({ store, liveRunner: fakeLive(rec => ({ id: rec.id, shares: [] })), clock, randomSeed: () => 7, moderation });
  const party = createPartyService({ game, clock, getAccount: async id => ACCOUNTS[id] ?? null });
  const social = createSocialService({ store, game, party, clock, moderation,
    accounts: { getAccount: async id => ACCOUNTS[id] ?? null, findAccountByName: async () => null } });
  return { t, store, moderation, social, banned, say: async (who, text) => { t.now += 4000; return social.chatPost(who, { text }); } };
}

test('message propre : publié tel quel, pas d\'avertissement', async () => {
  const { say, moderation } = setup();
  const r = await say(ME, 'salut tout le monde, gg !');
  assert.equal(r.message.text, 'salut tout le monde, gg !'); assert.equal(r.warning, undefined);
  assert.equal((await moderation.status(ME.id)).warnings, 0);
});

test('mot interdit : masqué pour tous, avertissement avec motif, texte d\'origine gardé dans la fiche', async () => {
  const { say, social, moderation } = setup();
  const r = await say(ME, 'ferme-la connard');
  assert.equal(r.message.text, 'ferme-la *******');
  assert.deepEqual({ ...r.warning, bannedUntil: 0 }, { warnings: 1, max: 3, bannedUntil: 0, banned: false, motif: 'Insulte' });
  assert.equal((await social.chatGet(OTHER, 0)).messages.at(-1).text, 'ferme-la *******', 'les autres voient le texte masqué');
  const f = await moderation.show(ME.id);
  assert.equal(f.warnings[0].text, 'ferme-la connard'); assert.equal(f.warnings[0].channel, 'global');
  assert.deepEqual(f.warnings[0].words, ['connard']);
  assert.match(warningText(r.warning), /Avertissement 1\/3 : Insulte/);
});

test('mot coupé entre deux joueurs : celui qui complète est averti, le motif dit avec qui', async () => {
  const { say, moderation } = setup();
  await say(OTHER, 'ni');
  const r = await say(ME, 'gger');
  assert.equal(r.message.text, '****');
  assert.equal(r.warning.motif, 'Injure raciste');
  assert.equal((await moderation.status(OTHER.id)).warnings, 0, 'le premier morceau seul n\'est pas averti');
  assert.deepEqual((await moderation.show(ME.id)).warnings[0].with, [{ account: OTHER.id, name: 'Max' }]);
});

test('3e avertissement : ban de 24 h, sa prison arrêtée (onBan) ; le compteur repart après le ban', async () => {
  const { say, moderation, banned, t } = setup();
  await say(ME, 'fdp'); await say(ME, 'salope');
  const r = await say(ME, 'kys');
  assert.equal(r.warning.banned, true); assert.equal(r.warning.warnings, 3);
  assert.equal(r.warning.bannedUntil, t.now + MODERATION.banMs);
  await new Promise(res => setImmediate(res));
  assert.deepEqual(banned, [ME.id]);
  assert.equal(await moderation.bannedUntil(ME.id), t.now + MODERATION.banMs);
  assert.match(banBarText(await moderation.status(ME.id)), /banni du jeu jusqu'au/);
  t.now += MODERATION.banMs + 1;
  assert.equal(await moderation.bannedUntil(ME.id), 0, 'fini au bout de 24 h');
  assert.equal((await moderation.status(ME.id)).warnings, 0, 'compteur remis à zéro par le ban');
});

test('créateurs : retirer un avertissement (il ne compte plus), lever un ban, derniers avertissements de tous', async () => {
  const { say, moderation } = setup();
  await say(ME, 'connard'); await say(ME, 'salope');
  assert.deepEqual(await moderation.forgive(ME.id, 1), { ok: true, counted: 1 });
  assert.equal((await moderation.forgive(ME.id, 9)).ok, false);
  await say(ME, 'pute');
  assert.equal(await moderation.bannedUntil(ME.id), 0, 'l\'avertissement retiré ne compte pas : 2 sur 3');
  await say(ME, 'fdp');
  assert.ok(await moderation.bannedUntil(ME.id) > 0);
  await moderation.unban(ME.id);
  assert.equal(await moderation.bannedUntil(ME.id), 0);
  const recent = await moderation.recent(10);
  assert.equal(recent.length, 4); assert.equal(recent[0].text, 'fdp');
});

/* ---------- serveur HTTP : un joueur banni ne peut plus agir ---------- */
let server;
after(() => server?.close());
test('banni : toute action (POST) refusée avec le motif, lire et son compte restent permis', async () => {
  const store = createMemoryStore(), service = createAccountService({ store, scrypt: FAST_SCRYPT });
  const gameStore = createMemoryGameStore();
  const moderation = createModerationService({ store: gameStore });
  const game = createGameService({ store: gameStore, liveRunner: fakeLive(rec => ({ shares: [] })), moderation });
  server = http.createServer(createApp({ store, service, game, moderation, root: ROOT }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const call = async (method, p, body) => {
    const res = await fetch(base + p, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined });
    for(const c of res.headers.getSetCookie()){ const v = c.split(';')[0]; cookie = v.endsWith('=') ? '' : v; }
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  };
  const me = (await call('POST', '/api/account/guest', {})).data.account;
  assert.equal((await call('GET', '/api/moderation/me')).data.bannedUntil, 0);
  for(const text of ['connard', 'salope', 'fdp']) await moderation.warn(me.id, { channel: 'global', text, masked: '***', hits: [{ word: text, motif: 'Insulte' }] });
  const r = await call('POST', '/api/game/start', {});
  assert.equal(r.status, 403); assert.equal(r.data.error.code, 'banned'); assert.match(r.data.error.message, /banni du jeu jusqu'au/);
  assert.equal((await call('GET', '/api/game/state')).status, 200, 'lire reste permis');
  assert.ok((await call('GET', '/api/moderation/me')).data.bannedUntil > 0);
  assert.equal((await call('POST', '/api/account/logout', {})).status, 204, 'se déconnecter reste permis');
});
