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

test('recycler : seulement le stuff qui a une recette, et les runes (pas le four, pas un anneau ni un minerai)', () => {
  assert.equal(recyclable('Épée en fer'), true);
  assert.equal(recyclable('Rune'), true);                       // 29/10 : rend de la Poudre de rêve (tests/rune-recycle.test.js)
  for(const item of ['Four en fer', 'Poudre de rêve', 'Fer', 'Treasure T1', 'Blueprint parts', 'inconnu', undefined]) assert.equal(recyclable(item), false, String(item));
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

/* 05/11/2026 (Geoffrey) : pièces uniques du Golbute et du Roi Gobelin, recyclables en quantités fixes ; l'Arc de l'Admin
   et les anneaux restent non recyclables */
test('pièces uniques : recyclage en quantités fixes (Golbute, Roi Gobelin)', () => {
  const want = {
    'Némésis du Golbute':      { 'Thorium ingot':10, 'Cobalt ingot':10 },
    'Torse de Gollex':         { 'Mithril ingot':20 },
    'Jambières du Golbute':    { 'Mithril ingot':18 },
    'Âme du Golbute':          { 'Orbe supérieur':2 },
    'Couronne du Roi Gobelin': { 'Rubis inférieur':1, 'Jade inférieur':1, 'Saphir inférieur':1, 'Steel ingot':10 },
    'Masse du Roi Gobelin':    { 'Steel ingot':10, 'Orbe':3 },
    'Cape royale du Gobelin':  { 'Shiny gold':20, 'Cuir de minotaure':25 },
  };
  for(const [item, r] of Object.entries(want)){
    assert.equal(recyclable(item), true, item);
    assert.deepEqual(recycleRefund(item), r, item);
    const inv = createInventory();
    const [slot] = addItem(inv, item, 1);
    const res = recycleStuff(inv, inv.slots[slot].uid);
    assert.ok(res.ok, item + ' ' + JSON.stringify(res));
    assert.equal(countOf(inv, item), 0);
    for(const [k, n] of Object.entries(r)) assert.equal(countOf(inv, k), n, `${item} → ${k}`);
  }
  for(const item of ['Arc de l\'Admin', 'Anneau du tigre', 'Anneau en pierre']) assert.equal(recyclable(item), false, item);
});
