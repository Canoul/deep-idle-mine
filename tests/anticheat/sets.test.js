/* Anti-triche des sets côté serveur : équiper en boucle ou en parallèle ne crée ni ne perd aucune pièce ; un set
   trafiqué (uid d'une pièce qu'on n'a pas, d'un objet en tas, case inconnue) ne donne rien ; jamais deux fois le même
   anneau ; des skills trafiqués ne dépassent pas les points du niveau. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { createInventory, addItem, serialize } from '../../src/meta/inventory.js';
import { fakeLive } from '../helpers.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };
const PICK = 'Pioche en fer', RING = 'Anneau du tigre';

async function setup(items){
  const store = createMemoryGameStore();
  const inv = createInventory();
  for(const [item, q] of Object.entries(items)) addItem(inv, item, q);
  await store.putInventory(ME.id, JSON.parse(serialize(inv)));
  const game = createGameService({ store, liveRunner: fakeLive(() => ({ shares:[] })), clock: () => 1e6, dev:false,
                                   config:{ startsPerHour:1000, keepEnded:1e12 } });
  return { game, store };
}
/* toutes les pièces du compte (inventaire + stuff porté), par uid */
async function pieces(game){
  const st = await game.state(ME);
  return [...st.inventory.slots.filter(s => s && s.uid != null).map(s => s.uid),
          ...Object.values(st.stuff).filter(Boolean).map(p => p.uid)].sort((a, b) => a - b);
}

test('deux sets équipés en boucle et en parallèle : toujours les mêmes pièces, aucune en double', async () => {
  const { game } = await setup({ [PICK]:2, Charbon:10 });
  const before = await pieces(game);
  const [p1, p2] = (await game.state(ME)).inventory.slots.filter(s => s?.item === PICK).map(s => s.uid);
  await game.stuff(ME, { action:'equip', slot:'pioche', uid:p1, opId:'op-ac-w1' });
  await game.sets(ME, { action:'create', opId:'op-ac-c1' });
  await game.stuff(ME, { action:'equip', slot:'pioche', uid:p2, opId:'op-ac-w2' });
  await game.sets(ME, { action:'create', opId:'op-ac-c2' });
  await Promise.all(Array.from({ length:10 }, (_, i) => game.sets(ME, { action:'equip', id:1 + (i % 2), opId:'op-ac-e' + i })));
  const after = await pieces(game);
  assert.deepEqual(after, before);
  assert.equal(new Set(after).size, after.length);
  const st = await game.state(ME);
  assert.equal(st.inventory.slots.find(s => s?.item === 'Charbon').qty, 10);
});

test('set trafiqué : uid inconnu, objet en tas, case inconnue, même anneau deux fois, trop de rangs → rien de plus', async () => {
  const { game, store } = await setup({ [RING]:1, Charbon:5 });
  const inv = (await game.state(ME)).inventory;
  const ring = inv.slots.find(s => s?.item === RING).uid, coal = inv.slots.find(s => s?.item === 'Charbon');
  await store.putSets(ME.id, { nextId:2, ops:[], list:[{ id:1, name:'triche',
    stuff:{ pioche:999, casque:coal.uid ?? 0, anneau1:ring, anneau2:ring, inconnu:ring },
    skills:{ tree:'barbare', ranks:{ damage:3, taunt:1, loot:5 } }, spells:['dash', 'dynamite'] }] });
  const before = await pieces(game);
  const r = await game.sets(ME, { action:'equip', id:1, opId:'op-ac-t1' });
  assert.deepEqual(Object.entries(r.stuff).filter(([, p]) => p).map(([k, p]) => [k, p.uid]), [['anneau1', ring]]);
  assert.deepEqual(await pieces(game), before);
  assert.deepEqual(r.skills.ranks, {}, 'niveau 1 : aucun point, aucun rang');
  assert.deepEqual(r.spells.slots, [null, null]);
  assert.equal(r.inventory.slots.find(s => s?.item === 'Charbon').qty, 5);
});
