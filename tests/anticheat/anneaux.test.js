/* Anti-triche des anneaux (RINGS) côté serveur : un trésor rouvert (double clic) ne donne pas un second anneau, le même
   anneau ne se porte pas deux fois, un anneau ne s'identifie, ne s'améliore ni ne s'enchante. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RINGS, treasureItem } from '../../src/config.js';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { createInventory, addItem, serialize } from '../../src/meta/inventory.js';
import { fakeLive } from '../helpers.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };
const TREASURE = treasureItem('demon', 2), TIGRE = 'Anneau du tigre';

/* random () => 0 : le trésor donne toujours le premier anneau de sa table (Anneau du tigre) */
async function setup(extra = {}){
  const store = createMemoryGameStore();
  const inv = createInventory(); addItem(inv, TREASURE, 2);
  for(const [item, q] of Object.entries(extra)) addItem(inv, item, q);
  await store.putInventory(ME.id, JSON.parse(serialize(inv)));
  const game = createGameService({ store, liveRunner: fakeLive(() => ({ shares:[] })), clock: () => 1e6, dev:false,
                                   config:{ startsPerHour:1000, keepEnded:1e12 }, random: () => 0 });
  return { game };
}
const rings = inv => inv.slots.filter(s => s && RINGS.items[s.item]);

test('trésor ouvert deux fois avec la même demande : un seul anneau, une seule rune', async () => {
  const { game } = await setup();
  const op = { item:TREASURE, opId:'op-ring-open-1' };
  const [a, b] = await Promise.all([game.open(ME, op), game.open(ME, op)]);
  assert.deepEqual(a.loot, b.loot); assert.equal(a.loot[TIGRE], 1);
  const inv = (await game.state(ME)).inventory;
  assert.equal(rings(inv).length, 1);
  assert.equal(inv.slots.filter(s => s?.item === TREASURE).length, 1, 'un seul trésor consommé');
});

test('le même anneau dans les deux cases : refusé par le serveur', async () => {
  const { game } = await setup({ [TIGRE]:2 });
  const [a, b] = rings((await game.state(ME)).inventory).map(s => s.uid);
  await game.stuff(ME, { action:'equip', slot:'anneau1', uid:a, opId:'op-ring-eq-1' });
  await assert.rejects(game.stuff(ME, { action:'equip', slot:'anneau2', uid:b, opId:'op-ring-eq-2' }), { code:'same_ring' });
  const st = await game.state(ME);
  assert.equal(st.stuff.anneau2, null); assert.equal(rings(st.inventory).length, 1);
});

test('identifier, améliorer ou enchanter un anneau : refusé, rien n\'est consommé', async () => {
  const { game } = await setup({ [TIGRE]:2, 'Plume d\'ange':100, 'Cristal de pleine lune':20 });
  const [a, b] = rings((await game.state(ME)).inventory).map(s => s.uid);
  await assert.rejects(game.upgrade(ME, { action:'identify', uid:a, sacrifice:b, opId:'op-ring-up-1' }), { code:'ring' });
  await assert.rejects(game.upgrade(ME, { action:'upgrade', uid:a, opId:'op-ring-up-2' }), { code:'ring' });
  const inv = (await game.state(ME)).inventory;
  assert.equal(rings(inv).length, 2);
  assert.equal(inv.slots.find(s => s?.item === 'Plume d\'ange').qty, 100);
});
