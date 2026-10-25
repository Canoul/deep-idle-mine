/* Recycler une pièce de stuff fabriquée (inventaire, 25/10/2026) : 60 % de la recette, arrondi vers le bas */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInventory, addItem, countOf } from '../src/meta/inventory.js';
import { recyclable, recycleRefund, recycleStuff } from '../src/meta/craft.js';
import { inSomeSet } from '../src/meta/sets.js';
import { RECIPES } from '../src/recipes.js';

test('recycler : rend 60 % de chaque ingrédient, arrondi vers le bas ; un ingrédient à 1 ne rend rien', () => {
  assert.deepEqual(recycleRefund('Bottes en fer'), { 'Tainted iron':2, 'Peau de gobelin':12 });       // 4, 20, 1 lingot d'or
  assert.deepEqual(recycleRefund('Pioche en pierre'), { 'Lingot de fer':18 });                       // 30
  assert.deepEqual(recycleRefund('Cape de Naingui'), { 'Tissu sombre':12 });                         // 20, gemmes à 1
  for(const [item, r] of Object.entries(RECIPES)) if(recyclable(item))
    for(const [k, n] of Object.entries(recycleRefund(item))) assert.ok(n < r.cost[k], `${item} : jamais plus que la recette`);
});

test('recycler : seulement le stuff qui a une recette (pas le four, pas un anneau, pas une rune ni un minerai)', () => {
  assert.equal(recyclable('Épée en fer'), true);
  for(const item of ['Four en fer', 'Rune', 'Fer', 'Treasure T1', 'Blueprint parts', 'inconnu', undefined]) assert.equal(recyclable(item), false, String(item));
});

test('recycler : la pièce disparaît (amélioration comprise), les ingrédients arrivent ; renvoyer la demande ne rend rien de plus', () => {
  const inv = createInventory();
  addItem(inv, 'Pioche en pierre', 1); addItem(inv, 'Lingot de fer', 2);
  const s = inv.slots[0]; s.q = 5; s.plus = 2;
  const r = recycleStuff(inv, s.uid);
  assert.deepEqual(r, { ok:true, item:'Pioche en pierre', refund:{ 'Lingot de fer':18 } });
  assert.equal(countOf(inv, 'Pioche en pierre'), 0);
  assert.equal(countOf(inv, 'Lingot de fer'), 20);
  assert.equal(recycleStuff(inv, s.uid).error, 'not_owned');
  assert.equal(countOf(inv, 'Lingot de fer'), 20);
});

test('recycler : refusé pour une pièce d\'un set, un objet non recyclable, un uid invalide', () => {
  const inv = createInventory();
  addItem(inv, 'Épée en fer', 1); addItem(inv, 'Four en fer', 1);
  const uid = inv.slots[0].uid, sets = { list:[{ id:1, name:'A', stuff:{ epee:uid }, skills:{}, spells:[] }] };
  assert.equal(recycleStuff(inv, uid, u => inSomeSet(sets, u)).error, 'in_set');
  assert.equal(recycleStuff(inv, inv.slots[1].uid ?? -1).error, inv.slots[1].uid == null ? 'not_owned' : 'not_recyclable');
  for(const bad of ['1', 1.5, NaN, Infinity, null, undefined, {}]) assert.equal(recycleStuff(inv, bad).error, 'bad_request');
  assert.equal(countOf(inv, 'Épée en fer'), 1);
});
