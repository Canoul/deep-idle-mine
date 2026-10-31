/* Shrine héroïque (31/10/2026, Geoffrey) : remplace le niveau 2 des tours. 30 Orbes, une charge prise à la victoire, les deux
   tours, cumulable avec une stèle ; 25 % de chance d'une 2e boîte par joueur ; une seule victoire par ouverture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SHRINES, TOWER, JUDGMENT, GAME } from '../src/config.js';
import { createShrines, sanitizeShrines, give, consume, steleFor, heroicFor, setStele } from '../src/meta/shrines.js';
import { createInventory, addItem, countOf } from '../src/meta/inventory.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { realDurationMs } from '../src/shared/game.js';
import { fakeLive } from './helpers.js';

const A = { id: 'AAAA1111', name: 'Zoe' }, B = { id: 'BBBB2222', name: 'Max' };
const team = [{ account: A.id, name: 'Zoe' }, { account: B.id, name: 'Max' }];

test('config et paiement : 30 Orbes, une charge ; ni la mine classique ni la stèle du camp ne le prennent pour elles', () => {
  const def = SHRINES.list.heroique;
  assert.deepEqual(def.price, { Orbe: 30 }); assert.equal(def.sessions, 1); assert.equal(def.tower, 'any');
  assert.equal(def.effect.extraBox, 0.25); assert.equal(TOWER.levels[def.effect.level].hp, 2.5);
  const st = createShrines(), inv = createInventory();
  addItem(inv, 'Orbe', 35);
  assert.equal(give(st, inv, { shrine: 'heroique', item: 'Orbe', qty: 35, opId: 'a' }).given, 30);
  assert.equal(countOf(inv, 'Orbe'), 5);
  assert.deepEqual(consume(st), [], 'pas une mine classique');
  assert.equal(st.active.heroique, 1);
  assert.equal(heroicFor(st), 'heroique');
  assert.equal(steleFor(st, 'angel'), null); assert.equal(steleFor(st, 'demon'), null);
  assert.deepEqual(setStele(st, { shrine: 'heroique', on: false }), { ok: true });
  assert.equal(heroicFor(sanitizeShrines(st)), null, 'désactivé par le chef');
});

/* serveur : une mine ouvre les jauges ; rolls : valeurs de random() (ensuite 0,99) */
function setupServer(rolls = []){
  let now = 5_000_000, win = true;
  const store = createMemoryGameStore();
  const summary = rec => rec.mode === 'tower_angel' || rec.mode === 'tower_demon'
    ? { id: rec.id, mode: 'tower', side: rec.mode === 'tower_angel' ? 'angel' : 'demon', success: win, t: 400, loot: {}, shares: rec.players.map(p => ({ account: p.account, left: false, bag: {} })) }
    : { id: rec.id, shares: rec.players.map(p => ({ account: p.account, left: false, bag: { [JUDGMENT.sides.angel.item]: JUDGMENT.cap }, xp: 0 })) };
  const game = createGameService({ store, liveRunner: fakeLive(summary), clock: () => now, randomSeed: () => 7, random: () => rolls.shift() ?? 0.99 });
  const open = async () => { await game.start(A, {}); now += realDurationMs(); await game.pump(); };
  const tower = async (ok, body = {}, players) => { win = ok; const { session } = await game.start(A, { mode: 'tower_angel', ...body }, players);
    now += TOWER.duration / GAME.speed * 1000; await game.pump(); return store.getGameSession(session.id); };
  return { store, game, open, tower };
}
const boxes = bag => Object.entries(bag).filter(([k]) => /^(Antique )?Trésor/.test(k)).reduce((n, [, q]) => n + q, 0);

test('niveau 2 : seulement avec le shrine ; le navigateur ne peut pas le demander', async () => {
  const { open, tower } = setupServer();
  await open();
  const r = await tower(true, { level: 2, heroic: true });
  assert.equal(r.level, 1); assert.equal(r.heroic, undefined);
  assert.equal(boxes(r.result.shares[0].bag), 1);
});

test('défaite : charge gardée, victoire : charge prise, se cumule avec la stèle (les deux partent, trésor béni)', async () => {
  const { store, open, tower } = setupServer();
  await store.putShrines(A.id, { active: { heroique: 1, pacte: 1 } });
  await open();
  const lost = await tower(false);
  assert.equal(lost.level, 2); assert.equal(lost.heroic, 'heroique'); assert.equal(lost.stele, 'pacte');
  assert.deepEqual(sanitizeShrines(await store.getShrines(A.id)).active, { heroique: 1, pacte: 1 });
  const won = await tower(true);
  assert.equal(won.level, 2); assert.equal(won.stele, 'pacte');
  assert.deepEqual(sanitizeShrines(await store.getShrines(A.id)).active, {});
  assert.ok(Object.keys(won.result.shares[0].bag).every(k => / béni$/.test(k)), 'trésor béni');
});

test('2e boîte : tirée par joueur, à 25 % ; même boîte que la 1re', async () => {
  const rolls = [];
  const { store, open, tower } = setupServer(rolls);
  await store.putShrines(A.id, { active: { heroique: 1 } });
  await open();
  rolls.push(0.2, 0.5, 0.5, 0.3, 0.5);   // A : 0,2 → 2 boîtes (2 qualités) ; B : 0,3 → 1 boîte
  const r = await tower(true, {}, team);
  const [a, b] = r.result.shares.map(s => boxes(s.bag));
  assert.equal(a, 2); assert.equal(b, 1);
});

test('juste au seuil, et sans shrine : pas de 2e boîte', async () => {
  const rolls = [];
  const s = setupServer(rolls);
  await s.store.putShrines(A.id, { active: { heroique: 1 } });
  await s.open();
  rolls.push(0.25, 0.5);
  assert.equal(boxes((await s.tower(true)).result.shares[0].bag), 1);
  const none = [];
  const n = setupServer(none);
  await n.open();
  none.push(0.01, 0.5);
  assert.equal(boxes((await n.tower(true)).result.shares[0].bag), 1);
});

test('une seule victoire par ouverture, avec ou sans shrine', async () => {
  const { store, game, open, tower } = setupServer();
  await open();
  await tower(true);
  await store.putShrines(A.id, { active: { heroique: 1 } });
  await assert.rejects(game.start(A, { mode: 'tower_angel' }), { code: 'tower_done' });
  assert.equal(sanitizeShrines(await store.getShrines(A.id)).active.heroique, 1, 'charge gardée');
});

test('fin de partie rejouée : la charge et la 2e boîte ne comptent qu\'une fois', async () => {
  const rolls = [];
  const { store, game, open, tower } = setupServer(rolls);
  await store.putShrines(A.id, { active: { heroique: 1 } });
  await open();
  rolls.push(0.1);
  const r = await tower(true);
  await game.pump();
  const inv = (await game.state(A)).inventory;
  assert.equal(inv.slots.filter(s => /^Trésor/.test(s?.item ?? '')).reduce((n, s) => n + s.qty, 0), boxes(r.result.shares[0].bag));
});
