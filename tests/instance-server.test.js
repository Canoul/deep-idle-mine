/* Instances (serveur) : lancement par le groupe avec une clé chacun (vérifiée et consommée au lancement, en une seule
   écriture), partie en direct jusqu'au bout, fin sans récompense ni XP, départ. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createInlineRunner } from '../server/game/live.js';
import { GAME, INSTANCE, MINE_MODES } from '../src/config.js';
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

test('lancement : une clé consommée par joueur, avec la création de la session', async () => {
  const { store, game } = await setup({ [A.id]: 2, [B.id]: 1 });
  const r = await game.start(A, { mode: 'instance_1' }, P);
  assert.equal(r.session.mode, 'instance_1');
  assert.equal(await keysOf(store, A.id), 1); assert.equal(await keysOf(store, B.id), 0);
  const rec = await store.getGameSession(r.session.id);
  assert.equal(rec.finishAt - rec.startedAt, instanceDurationMs(GAME.speed));
  await assert.rejects(game.start(A, { mode: 'instance_1' }), { code: 'session_running' });
  assert.equal(await keysOf(store, A.id), 1, 'refusé : rien de consommé');
});

test('lancements simultanés : une seule session, une seule clé consommée', async () => {
  const { store, game } = await setup({ [A.id]: 3 });
  const res = await Promise.allSettled([1, 2, 3].map(() => game.start(A, { mode: 'instance_1' })));
  assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await keysOf(store, A.id), 2);
});

test('la partie tourne jusqu\'au bout ; fin sans récompense ni XP', async () => {
  const { store, game, t } = await setup({ [A.id]: 1 });
  const r = await game.start(A, { mode: 'instance_1' });
  t.now += instanceDurationMs(GAME.speed) + 1000;
  for(let i = 0; i < 40 && (await store.getGameSession(r.session.id)).status !== 'done'; i++) await game.pump();
  const rec = await store.getGameSession(r.session.id);
  assert.equal(rec.status, 'done');
  assert.equal(rec.result.mode, 'instance');
  assert.equal(rec.result.success, false, 'seul et sans stuff : temps écoulé');
  assert.equal((await store.getProgress(A.id))?.xp ?? 0, 0, 'pas d\'XP');
  assert.equal(await keysOf(store, A.id), 0, 'la clé est perdue');
});

test('quitter : comme une tour, le mineur sort ; la clé reste consommée', async () => {
  const { store, game, t } = await setup();
  const r = await game.start(A, { mode: 'instance_1' }, P);
  t.now += 20e3; await game.pump();
  await game.leave(B);
  assert.equal(await game.activeSessionId(B.id), null);
  assert.ok(await game.activeSessionId(A.id));
  assert.equal(await keysOf(store, B.id), 0);
  await assert.rejects(game.focus?.(A, { area: 0 }) ?? Promise.reject({ code: 'bad_request' }), e => e.code === 'bad_request' || e.status === 400);
});
