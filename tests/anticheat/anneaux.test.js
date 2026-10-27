/* Anti-triche des anneaux (RINGS) côté serveur : un trésor rouvert (double clic) ne donne pas un second anneau, le même
   anneau ne se porte pas deux fois, un anneau ne s'identifie ni ne s'enchante ; il s'améliore avec un doublon (27/10).
   Boussole et torche : ni identification, ni amélioration, ni enchantement (27/10). */
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

test('identifier un anneau : refusé ; l\'améliorer coûte un doublon, pas de plumes ni de cristaux (27/10)', async () => {
  const { game } = await setup({ [TIGRE]:2, 'Plume d\'ange':100, 'Cristal de pleine lune':20 });
  const [a, b] = rings((await game.state(ME)).inventory).map(s => s.uid);
  await assert.rejects(game.upgrade(ME, { action:'identify', uid:a, sacrifice:b, opId:'op-ring-up-1' }), { code:'ring' });
  assert.equal(rings((await game.state(ME)).inventory).length, 2, 'identification refusée : rien consommé');
  const op = { action:'upgrade', uid:a, opId:'op-ring-up-2' };
  const [r1, r2] = await Promise.all([game.upgrade(ME, op), game.upgrade(ME, op)]);   // double clic
  assert.equal(r1.piece.plus, 1); assert.equal(r2.piece.plus, 1);
  const inv = (await game.state(ME)).inventory;
  assert.deepEqual(rings(inv).map(s => [s.uid, s.plus]), [[a, 1]], 'un seul doublon consommé');
  assert.equal(inv.slots.find(s => s?.item === 'Plume d\'ange').qty, 100);
  assert.equal(inv.slots.find(s => s?.item === 'Cristal de pleine lune').qty, 20);
  await assert.rejects(game.upgrade(ME, { action:'upgrade', uid:a, opId:'op-ring-up-3' }), { code:'not_enough' });
  assert.equal(rings((await game.state(ME)).inventory).length, 1, 'sans doublon : rien ne change');
});

test('anneau : un doublon porté ne compte pas ; le doublon sacrifié est celui de plus bas niveau', async () => {
  const { game } = await setup({ [TIGRE]:4 });
  const [a, b, c, d] = rings((await game.state(ME)).inventory).map(s => s.uid);
  await game.upgrade(ME, { action:'upgrade', uid:b, opId:'op-ring-lv-1' });          // b +1 (sacrifie a)
  await game.stuff(ME, { action:'equip', slot:'anneau1', uid:c, opId:'op-ring-lv-eq' });
  let inv = (await game.state(ME)).inventory;
  assert.deepEqual(rings(inv).map(s => s.uid).sort(), [b, d].sort());
  await game.upgrade(ME, { action:'upgrade', uid:b, opId:'op-ring-lv-2' });          // sacrifie d (pas c, porté)
  inv = (await game.state(ME)).inventory;
  assert.deepEqual(rings(inv).map(s => [s.uid, s.plus]), [[b, 2]]);
  assert.equal((await game.state(ME)).stuff.anneau1.uid, c, 'l\'anneau porté est intact');
  await assert.rejects(game.upgrade(ME, { action:'upgrade', uid:b, opId:'op-ring-lv-3' }), { code:'not_enough' });
});

test('boussole et torche : ni identification, ni amélioration, ni enchantement ; rien n\'est consommé (27/10)', async () => {
  for(const item of ['Boussole en or', 'Lampe à incandescence']){
    const { game } = await setup({ [item]:2, 'Plume d\'ange':100, 'Cristal de pleine lune':20 });
    const [a, b] = (await game.state(ME)).inventory.slots.filter(s => s?.item === item).map(s => s.uid);
    await assert.rejects(game.upgrade(ME, { action:'identify', uid:a, sacrifice:b, opId:'op-plain-1' }), { code:'plain' });
    await assert.rejects(game.upgrade(ME, { action:'upgrade', uid:a, opId:'op-plain-2' }), { code:'plain' });
    const inv = (await game.state(ME)).inventory;
    assert.equal(inv.slots.filter(s => s?.item === item).length, 2, item);
    assert.equal(inv.slots.find(s => s?.item === 'Plume d\'ange').qty, 100, item);
  }
});
