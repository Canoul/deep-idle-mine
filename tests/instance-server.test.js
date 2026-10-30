/* Instances (serveur) : lancement par le groupe avec une clé chacun (vérifiée au lancement), partie en direct jusqu'au
   bout, pas d'XP, départ. 27/10 (Geoffrey) : roi vaincu → un Coffre du Roi Gobelin par joueur encore présent.
   30/10 (Geoffrey) : la clé n'est prise qu'à la victoire, chez les joueurs encore présents ; échec ou départ = clé gardée. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createInlineRunner } from '../server/game/live.js';
import { GAME, INSTANCE, MINE_MODES, ITEMS } from '../src/config.js';
import { fakeLive } from './helpers.js';
import { countOf, createInventory, addItem, serialize, deserialize } from '../src/meta/inventory.js';
import { instanceDurationMs, isInstanceMode } from '../src/shared/instances.js';

const KEY = INSTANCE.list[0].key;
const A = { id: 'AAAA1111', name: 'Zoe' }, B = { id: 'BBBB2222', name: 'Max' };
const P = [{ account: A.id, name: 'Zoe' }, { account: B.id, name: 'Max' }];

async function setup(keys = { [A.id]: 1, [B.id]: 1 }){
  const store = createMemoryGameStore(), t = { now: Date.UTC(2026, 9, 27, 12, 0) };
  for(const [id, n] of Object.entries(keys)) if(n){ const inv = createInventory(); addItem(inv, KEY, n); await store.putInventory(id, JSON.parse(serialize(inv))); }
  const game = createGameService({ store, liveRunner: createInlineRunner, clock: () => t.now, randomSeed: () => 4242 });
  return { store, game, t };
}
const keysOf = async (store, id) => countOf(deserialize(JSON.stringify(await store.getInventory(id) ?? { v: 1, slots: [] })), KEY);

test('mode Instance I : listé, à part, une clé par instance', () => {
  const m = MINE_MODES.find(x => x.id === 'instance_1');
  assert.ok(m?.instance); assert.ok(isInstanceMode('instance_1')); assert.ok(!isInstanceMode('mine'));
  assert.equal(INSTANCE.list.filter(i => i.ready).length, 1);
});

test('lancement : refusé si un joueur n\'a pas sa clé, sans rien consommer', async () => {
  const { store, game } = await setup({ [A.id]: 1, [B.id]: 0 });
  await assert.rejects(game.start(A, { mode: 'instance_1' }, P), e => e.code === 'no_key' && /Max/.test(e.message));
  assert.equal(await keysOf(store, A.id), 1, 'la clé de Zoe est gardée');
  assert.equal(await game.activeSessionId(A.id), null);
});

test('lancement : la clé est vérifiée mais pas prise (30/10 : prise seulement à la victoire)', async () => {
  const { store, game } = await setup({ [A.id]: 2, [B.id]: 1 });
  const r = await game.start(A, { mode: 'instance_1' }, P);
  assert.equal(r.session.mode, 'instance_1');
  assert.equal(await keysOf(store, A.id), 2); assert.equal(await keysOf(store, B.id), 1);
  const rec = await store.getGameSession(r.session.id);
  assert.equal(rec.finishAt - rec.startedAt, instanceDurationMs(GAME.speed));
  await assert.rejects(game.start(A, { mode: 'instance_1' }), { code: 'session_running' });
  assert.equal(await keysOf(store, A.id), 2, 'refusé : rien de consommé');
});

test('lancements simultanés : une seule session, aucune clé prise au lancement', async () => {
  const { store, game } = await setup({ [A.id]: 3 });
  const res = await Promise.allSettled([1, 2, 3].map(() => game.start(A, { mode: 'instance_1' })));
  assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await keysOf(store, A.id), 3);
});

test('la partie tourne jusqu\'au bout ; pas d\'XP ; échec : la clé est rendue', async () => {
  const { store, game, t } = await setup({ [A.id]: 1 });
  const r = await game.start(A, { mode: 'instance_1' });
  t.now += instanceDurationMs(GAME.speed) + 1000;
  for(let i = 0; i < 40 && (await store.getGameSession(r.session.id)).status !== 'done'; i++) await game.pump();
  const rec = await store.getGameSession(r.session.id);
  assert.equal(rec.status, 'done');
  assert.equal(rec.result.mode, 'instance');
  assert.equal(rec.result.success, false, 'seul et sans stuff : temps écoulé');
  assert.equal((await store.getProgress(A.id))?.xp ?? 0, 0, 'pas d\'XP');
  assert.equal(await keysOf(store, A.id), 1, 'échec : la clé est gardée (30/10)');
});

test('quitter : comme une tour, le mineur sort ; il garde sa clé (30/10)', async () => {
  const { store, game, t } = await setup();
  const r = await game.start(A, { mode: 'instance_1' }, P);
  t.now += 20e3; await game.pump();
  await game.leave(B);
  assert.equal(await game.activeSessionId(B.id), null);
  assert.ok(await game.activeSessionId(A.id));
  assert.equal(await keysOf(store, B.id), 1, 'parti : sa clé n\'est pas prise');
  await assert.rejects(game.focus?.(A, { area: 0 }) ?? Promise.reject({ code: 'bad_request' }), e => e.code === 'bad_request' || e.status === 400);
});

/* fin fabriquée (fakeLive) : résultat de la partie au choix */
async function ended({ success, leftB = false, level }){
  const store = createMemoryGameStore(), t = { now: Date.UTC(2026, 9, 27, 12, 0) };
  for(const id of [A.id, B.id]){ const inv = createInventory(); addItem(inv, KEY, 1); await store.putInventory(id, JSON.parse(serialize(inv))); }
  const summary = rec => ({ id: rec.id, mode: 'instance', instance: rec.mode, success,
    shares: rec.players.map(p => ({ account: p.account, left: leftB && p.account === B.id, bag: { 'Charbon': 99 } })) });
  /* mode dev : la partie se termine sur demande (settle) ; fakeLive renvoie le résultat voulu */
  const game = createGameService({ store, liveRunner: fakeLive(summary), clock: () => t.now, randomSeed: () => 7, dev: true });
  const r = await game.start(A, { mode: 'instance_1', ...(level ? { level } : {}) }, P);
  if(leftB){ t.now += 5e3; await game.leave(B); }
  await game.settle(r.session.id);
  const inv = async id => deserialize(JSON.stringify(await store.getInventory(id)));
  return { store, game, rec: await store.getGameSession(r.session.id), inv };
}
const chests = inv => inv.slots.filter(s => s && ITEMS[s.item]?.chest?.side === 'goblin');

test('roi vaincu : un Coffre du Roi Gobelin (R1 à R7) par joueur encore présent, sa clé prise ; parti : ni coffre ni clé prise', async () => {
  const { rec, inv } = await ended({ success: true, leftB: true });
  assert.equal(rec.status, 'done');
  const a = await inv(A.id), b = await inv(B.id);
  assert.equal(chests(a).length, 1); assert.match(chests(a)[0].item, /^Coffre du Roi Gobelin R[1-7]$/);
  assert.equal(countOf(a, 'Charbon'), 0, 'le butin de la partie ne compte pas : seul le coffre est donné');
  assert.equal(chests(b).length, 0, 'parti avant la fin : rien');
  assert.equal(countOf(a, KEY), 0, 'victoire : la clé du présent est prise');
  assert.equal(countOf(b, KEY), 1, 'parti avant la fin : il garde sa clé');
});

test('échec : tout le monde garde sa clé (partis compris), pas de coffre ; une fin rejouée ne change rien', async () => {
  const { rec, inv, game } = await ended({ success: false, leftB: true });
  assert.equal(rec.result.success, false);
  assert.equal(countOf(await inv(A.id), KEY), 1); assert.equal(countOf(await inv(B.id), KEY), 1);
  assert.equal(chests(await inv(A.id)).length, 0);
  await game.settle(rec.id);
  assert.equal(countOf(await inv(A.id), KEY), 1, 'idempotent');
});

test("niveau 2 (29/10) : même clé, niveau gardé dans la session, roi vaincu = Coffre du Roi Gobelin II ; niveau absent = 1", async () => {
  const { rec, inv } = await ended({ success: true, level: 2 });
  assert.equal(rec.level, 2);
  const a = await inv(A.id);
  assert.equal(chests(a).length, 1); assert.match(chests(a)[0].item, /^Coffre du Roi Gobelin II R[1-7]$/);
  assert.equal(countOf(a, KEY), 0, 'une clé, comme au niveau 1');
  const one = await ended({ success: true });
  assert.equal(one.rec.level, 1);
  assert.match(chests(await one.inv(A.id))[0].item, /^Coffre du Roi Gobelin R[1-7]$/);
});

test("niveau d'instance inventé : refusé, sans rien consommer", async () => {
  for(const level of [0, 3, -1, 1.5, '2', Infinity, NaN, {}]){   // null ou absent : niveau 1 (comme la tour)
    const { store, game } = await setup({ [A.id]: 1 });
    await assert.rejects(game.start(A, { mode: 'instance_1', level }), e => e.code === 'bad_request', String(level));
    assert.equal(await keysOf(store, A.id), 1, String(level));
  }
  const { game } = await setup({ [A.id]: 1 });
  const r = await game.start(A, { mode: 'instance_1', level: 2 });
  assert.equal(r.session.level, 2, 'le navigateur voit le niveau');
});

test('victoire rejouée : une seule clé prise, un seul coffre ; plus de clé à la victoire = pas de coffre', async () => {
  const { rec, inv, game } = await ended({ success: true });
  await game.settle(rec.id);
  const a = await inv(A.id);
  assert.equal(chests(a).length, 1); assert.equal(countOf(a, KEY), 0);
  /* clé retirée de l'inventaire pendant la partie (cas impossible en jeu normal) : pas de coffre pour lui */
  const store = createMemoryGameStore(), t = { now: Date.UTC(2026, 9, 27, 12, 0) };
  for(const id of [A.id, B.id]){ const i = createInventory(); addItem(i, KEY, 1); await store.putInventory(id, JSON.parse(serialize(i))); }
  const summary = r => ({ id: r.id, mode: 'instance', instance: r.mode, success: true, shares: r.players.map(p => ({ account: p.account, left: false, bag: {} })) });
  const g = createGameService({ store, liveRunner: fakeLive(summary), clock: () => t.now, randomSeed: () => 7, dev: true });
  const r = await g.start(A, { mode: 'instance_1' }, P);
  await store.putInventory(B.id, JSON.parse(serialize(createInventory())));
  await g.settle(r.session.id);
  const b = deserialize(JSON.stringify(await store.getInventory(B.id)));
  assert.equal(chests(b).length, 0, 'sans clé : pas de coffre');
  assert.equal(chests(deserialize(JSON.stringify(await store.getInventory(A.id)))).length, 1);
});
