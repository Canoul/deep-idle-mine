/* K hole imposé par l'administration (scripts/force-khole.js) : il s'ouvre dans la partie en direct sous les pieds d'un
   mineur, s'enregistre avec son tick et se rejoue à l'identique ; le service le refuse hors d'une mine classique en
   cours ; la route est fermée sans la clé, comme les autres routes d'administration. */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { KHOLE, DT } from '../src/config.js';
import { createLiveGame } from '../server/game/live-game.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { ROOT, SERVER } from '../server/config.js';
import { forceKhole } from '../src/sim/khole.js';
import { newSession, tick } from '../src/sim/session.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const ME = { id: 'AAAA1111', name: 'Zoe', guest: false };
const record = (extra = {}) => ({ id: 'S1', seed: 4242, players: [{ account: ME.id, name: 'Zoe' }], prefs: {}, leaves: [], focus: [], ...extra });
const ticks = s => Math.round(s / DT);
const snap = G => JSON.stringify({ t: G.ticks, miners: G.miners.map(m => [m.x, m.y, m.inv]), log: G.log, khole: !!G.khole, chest: G.chest });

test('imposé : « Un k hole s\'ouvre… » puis, KHOLE.warn s plus tard, le groupe est dans la carte demandée', () => {
  const live = createLiveGame(record());
  live.advance(ticks(60));
  const r = live.khole(2);
  assert.equal(r.ok, true); assert.equal(r.tick, live.tick);
  assert.ok(live.G.log.some(l => /Un k hole s'ouvre/.test(l.msg)));
  live.advance(live.tick + ticks(KHOLE.warn) + 1);
  assert.equal(live.G.khole?.map.id, KHOLE.maps[1].id);
  assert.equal(live.khole(1).ok, false, 'déjà dans un k hole : refusé');
});

test('rejeu : la même seed et le k hole enregistré (son tick) redonnent exactement la même partie', () => {
  const live = createLiveGame(record());
  live.advance(ticks(90));
  const { tick: at } = live.khole(3);
  live.advance(at + ticks(40));
  const again = createLiveGame(record({ kholes: [{ tick: at, map: 3 }] }));
  again.advance(at + ticks(40));
  assert.equal(snap(again.G), snap(live.G));
});

test('refusé trop près de la fin de session ; carte invalide → tirée comme d\'habitude', () => {
  const G = newSession(1);
  G.ticks = ticks(3600 - KHOLE.endMargin); G.t = G.ticks * DT;
  assert.equal(forceKhole(G, 1), false);
  const H = newSession(1);
  for(let i=0; i<10; i++) tick(H);
  assert.equal(forceKhole(H, 99), true);
  assert.equal(H.kholes.at(-1).map, 0);
});

test('service : enregistré dans la session (tick, carte) ; refusé sans session, hors mine classique ou carte invalide', async () => {
  let now = 1_000_000;
  const store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner: fakeLive(() => ({ shares: [] })), clock: () => now, dev: false });
  await assert.rejects(game.adminKhole(ME.id, 1), { code: 'no_session' });
  const { session } = await game.start(ME, {});
  for(const bad of [-1, KHOLE.maps.length + 1, 1.5, '2', null]) await assert.rejects(game.adminKhole(ME.id, bad), { code: 'bad_request' }, String(bad));
  const r = await game.adminKhole(ME.id, 4);
  assert.equal(r.session, session.id); assert.equal(r.map, KHOLE.maps[3].label); assert.deepEqual(r.players, ['Zoe']);
  const rec = await store.getGameSession(session.id);
  assert.deepEqual(rec.kholes.map(k => k.map), [4]);
  assert.ok(Number.isSafeInteger(rec.kholes[0].tick));
  for(const mode of ['mi', 'tower_angel']){
    await store.putGameSession({ ...(await store.getGameSession(session.id)), mode });
    await assert.rejects(game.adminKhole(ME.id, 1), /mine classique/, mode);
  }
});

/* route : fermée sans la clé ; pseudo inconnu → 404 */
const TOKEN = 'k'.repeat(40);
let server;
after(() => server?.close());
test('route /api/admin/khole : 404 sans la bonne clé (comme si elle n\'existait pas) ; pseudo inconnu, pas de session', async () => {
  const accounts = createMemoryStore();
  await accounts.insertAccount({ id: 'C1', name: 'Crousti', nameKey: 'crousti', guest: false });
  const game = createGameService({ store: createMemoryGameStore(), liveRunner: fakeLive(() => ({ shares: [] })), dev: false });
  server = http.createServer(createApp({ store: accounts, service: createAccountService({ store: accounts, scrypt: FAST_SCRYPT }), game, root: ROOT,
    config: { ...SERVER, logProxyCheck: false, adminToken: TOKEN } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const post = (body, token = TOKEN) => fetch(`http://127.0.0.1:${server.address().port}/api/admin/khole`, { method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
    .then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));
  assert.equal((await post({ name: 'crousti', map: 1 }, 'x'.repeat(40))).status, 404);
  assert.equal((await post({ name: 'personne', map: 1 })).status, 404);
  const r = await post({ name: 'crousti', map: 1 });
  assert.equal(r.status, 404); assert.equal(r.data.error.code, 'no_session');
});
