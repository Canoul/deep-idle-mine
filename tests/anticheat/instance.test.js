/* Anti-triche des instances : une clé n'est consommée qu'avec une session créée, jamais deux fois ; deux lancements
   croisés en même temps (Zoe avec Max, et Max seul) ne créent qu'une session par joueur et ne consomment qu'une clé
   chacun ; sans clé, rien ne bouge. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { createInlineRunner } from '../../server/game/live.js';
import { INSTANCE } from '../../src/config.js';
import { countOf, createInventory, addItem, serialize, deserialize } from '../../src/meta/inventory.js';

const KEY = INSTANCE.list[0].key;
const A = { id: 'AAAA1111', name: 'Zoe' }, B = { id: 'BBBB2222', name: 'Max' };
const P = [{ account: A.id, name: 'Zoe' }, { account: B.id, name: 'Max' }];
async function setup(keys){
  const store = createMemoryGameStore(), t = { now: Date.UTC(2026, 9, 27, 12, 0) };
  for(const [id, n] of Object.entries(keys)){ const inv = createInventory(); addItem(inv, KEY, n); await store.putInventory(id, JSON.parse(serialize(inv))); }
  return { store, game: createGameService({ store, liveRunner: createInlineRunner, clock: () => t.now, randomSeed: () => 7 }) };
}
const keys = async (store, id) => countOf(deserialize(JSON.stringify(await store.getInventory(id) ?? { v: 1, slots: [] })), KEY);

test('lancements croisés en même temps : une session par joueur au plus, une clé chacun', async () => {
  const { store, game } = await setup({ [A.id]: 2, [B.id]: 2 });
  const res = await Promise.allSettled([game.start(A, { mode: 'instance_1' }, P), game.start(B, { mode: 'instance_1' })]);
  const ok = res.filter(r => r.status === 'fulfilled');
  assert.equal(ok.length, 1, 'Max ne peut pas être dans deux sessions');
  const withMax = ok[0].value.session.players.length === 2;
  assert.equal(await keys(store, B.id), 1);
  assert.equal(await keys(store, A.id), withMax ? 1 : 2);
});

test('sans clé : refusé, aucune session, aucune clé retirée aux autres ; une clé ne se consomme jamais en négatif', async () => {
  const { store, game } = await setup({ [A.id]: 1, [B.id]: 0 });
  for(let i = 0; i < 3; i++) await assert.rejects(game.start(A, { mode: 'instance_1' }, P), { code: 'no_key' });
  assert.equal(await keys(store, A.id), 1);
  assert.equal(await keys(store, B.id), 0);
  assert.equal((await store.sessionsWithStatus('running')).length, 0);
});

test('une instance pas encore prête (Instance II) est refusée', async () => {
  const { game } = await setup({ [A.id]: 1 });
  await assert.rejects(game.start(A, { mode: 'instance_2' }), e => e.status === 400);
});
