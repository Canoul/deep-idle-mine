/* Mine géante (5 joueurs) (06/11/2026) : règles partagées, génération (minerais, mobs), lobby, serveur. La carte de 70 colonnes
   et les 2 h se vérifient dans tests/geante-world.test.js (son propre processus, comme le fil de la partie). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GEANTE, GAME, W, SESSION_LEN, DT, MOBS, BLOCKS, IDS } from '../src/config.js';
import { isGeante, maxPlayersOf, geanteToday, geanteLeft } from '../src/shared/geante.js';
import { realDurationMs, totalTicksOf, TOTAL_TICKS, buildSession } from '../src/shared/game.js';
import { newSession } from '../src/sim/session.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { fakeLive } from './helpers.js';

test('réglages : 70 colonnes, 2 h, 5 joueurs, 2 par jour, minerais × 2,7, mobs × 1,5', () => {
  assert.deepEqual(GEANTE, { mode:'geante', w:70, len:7200, players:5, perDay:2, oreMul:2.7, mobMul:1.5 });
  assert.equal(W, 50); assert.equal(SESSION_LEN, 3600);                       // ce processus : la mine classique ne change pas
  assert.equal(maxPlayersOf('geante'), 5); assert.equal(maxPlayersOf('mine'), GAME.maxPlayers); assert.equal(maxPlayersOf(undefined), GAME.maxPlayers);
  assert.equal(realDurationMs(2, 'geante'), 2 * realDurationMs(2)); assert.equal(realDurationMs(2, 'geante'), 3600e3);
  assert.equal(totalTicksOf('geante'), 72000); assert.equal(totalTicksOf('mine'), TOTAL_TICKS);
});

test('2 par jour (jour de Paris), les autres modes ne comptent pas', () => {
  const day = Date.UTC(2026, 10, 6, 10), s = (mode, t) => ({ mode, startedAt: t });
  const list = [s('geante', day - 3600e3), s('mine', day), s('geante', Date.UTC(2026, 10, 5, 10))];
  assert.equal(geanteToday(list, day), 1); assert.equal(geanteLeft(list, day), 1);
  assert.equal(geanteLeft([...list, s('geante', day)], day), 0);
  assert.equal(geanteToday([s('geante', Date.UTC(2026, 10, 5, 23, 30))], day), 1, '00 h 30 à Paris : déjà le 6');
  assert.equal(geanteLeft(null, day), 2);
});

test('génération : plus de minerais (× 2,7, pris sur le terrain), même seed sinon ; mobs plus souvent', () => {
  const ores = G => { let n = 0; for(let y = 2; y < 52; y++) for(let x = 0; x < W; x++) if(BLOCKS[G.tiles[y][x]]?.type === 'ore') n++; return n; };
  let a = 0, b = 0;
  for(const seed of [11, 22, 33, 44]){ a += ores(newSession(seed, { miners: 3 })); b += ores(newSession(seed, { miners: 3, geante: true })); }
  assert.ok(b / a > 2.3 && b / a < 3.1, `minerais × ${(b / a).toFixed(2)}`);
  assert.equal(newSession(1, { geante: true }).geante, true); assert.equal(newSession(1).geante, false);
  assert.equal(buildSession({ seed: 5, mode: 'geante', players: [] }).geante, true);
  assert.equal(buildSession({ seed: 5, mode: 'mine', players: [] }).geante, false);
});

test('lobby : activité au menu, 5 places pour le chef, Lancer seulement à 5', async () => {
  const { launchFor, slotsMax, activityMenu, mineModes } = await import('../src/ui/lobby.js');
  assert.ok(activityMenu(mineModes('mine')).some(a => a.id === 'geante' && a.title === 'Mine géante (5 joueurs)'));
  const me = { id: 'A' }, mk = n => ({ leader: 'A', max: 5, members: Array.from({ length: n }, (_, i) => ({ account: i ? 'P' + i : 'A', name: 'p' + i, ready: true })) });
  assert.equal(slotsMax({ screen: 'stage', mode: 'geante', account: me, party: mk(1) }), 5);
  assert.equal(slotsMax({ screen: 'stage', mode: 'mine', account: me, party: mk(1) }), 3);
  assert.equal(slotsMax({ screen: 'menu', mode: 'geante', account: me, party: { ...mk(2), leader: 'X' } }), 5, 'membre : places du serveur');
  assert.deepEqual(launchFor({ mode: 'geante', account: me, party: mk(3), info: {} }), { can: false, label: '⛰ Il faut 5 joueurs (3/5)' });
  assert.equal(launchFor({ mode: 'geante', account: me, party: mk(5), info: {} }).label, '▶ Lancer la Mine géante');
  assert.equal(launchFor({ mode: 'geante', account: me, party: mk(2), info: { dev: true } }).can, true, 'mode dev : mineurs de test');
});

const P = Array.from({ length: 6 }, (_, i) => ({ id: `AAAA000${i}`, name: `J${i}` }));
const team = n => P.slice(0, n).map(p => ({ account: p.id, name: p.name }));
function setup(){
  let now = Date.UTC(2026, 10, 6, 9);
  const store = createMemoryGameStore(), seen = [];
  const base = fakeLive(() => ({ shares: [] })), liveRunner = o => { const live = base(o); seen.push(o); return live; };
  const game = createGameService({ store, liveRunner, clock: () => now, randomSeed: () => 7 });
  return { store, game, advance: ms => { now += ms; } };
}

test('serveur : 5 joueurs exactement, 2 h, énergie débitée comme la mine, 2 par jour et par joueur', async () => {
  const { store, game } = setup();
  for(const p of P) await store.putEnergy(p.id, { value: 100, max: 100 });
  await assert.rejects(game.start(P[0], { mode: 'geante' }, team(3)), { code: 'geante_players' });
  await assert.rejects(game.start(P[0], { mode: 'geante' }, team(6)), { code: 'bad_request' });
  await assert.rejects(game.start(P[0], { mode: 'mine' }, team(5)), { code: 'bad_request' }, 'mine classique : 3 au plus');
  /* J3 a déjà fait ses 2 Mines géantes aujourd'hui : refusé, en le nommant */
  const today = Date.UTC(2026, 10, 6, 7);
  for(const k of [1, 2]) await store.putGameSession({ id: `old-${k}`, mode: 'geante', status: 'done', startedAt: today + k, players: [{ account: P[3].id, name: 'J3' }], leaves: [] });
  await assert.rejects(game.start(P[0], { mode: 'geante' }, team(5)), e => e.code === 'geante_daily' && /J3/.test(e.message));
  await store.deleteGameSession('old-2');
  await game.start(P[0], { mode: 'geante' }, team(5));
  const rec = (await store.sessionsOf(P[0].id)).find(s => s.status === 'running');
  assert.equal(rec.mode, 'geante'); assert.equal(rec.players.length, 5);
  assert.equal(rec.finishAt - rec.startedAt, realDurationMs(GAME.speed, 'geante'));
  for(const p of P.slice(0, 5)) assert.ok((await store.getEnergy(p.id)).value < 100, `${p.name} a payé l'énergie`);
  assert.equal((await store.getEnergy(P[5].id)).value, 100);
});
