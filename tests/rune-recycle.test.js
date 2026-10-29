/* Recyclage des runes en Poudre de rêve et recette « Rune » (29/10/2026, Geoffrey) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInventory, addItem, countOf } from '../src/meta/inventory.js';
import { recyclable, recycleRange, recycleRefund, recycleStuff, craft, craftable } from '../src/meta/craft.js';
import { rollRune, rollCraftedRuneQuality } from '../src/meta/piece.js';
import { mulberry32 } from '../src/core/rng.js';
import { RUNE, ITEMS, RARITY } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';

const DUST = RUNE.dust.item;
const withRune = (item, q = 7, rng = mulberry32(1)) => {
  const inv = createInventory();
  const [i] = addItem(inv, item, 1);
  Object.assign(inv.slots[i], rollRune(q, rng));
  return { inv, uid: inv.slots[i].uid };
};

test('Poudre de rêve : un matériau empilable, rareté rare, rangé avec les runes', () => {
  assert.equal(DUST, 'Poudre de rêve');
  assert.equal(ITEMS[DUST].stack, true);
  assert.equal(RARITY.items[DUST], 'rare');
});

test('recycler une rune : 8 à 12 Poudre de rêve quelle que soit sa qualité ; un fragment : 1 à 6', () => {
  assert.deepEqual(recycleRange('Rune'), { item:DUST, min:8, max:12 });
  assert.deepEqual(recycleRange('Fragment de rune'), { item:DUST, min:1, max:6 });
  assert.equal(recycleRange('Épée en fer'), null);
  assert.equal(recyclable('Fragment de rune'), true);
  for(const [item, lo, hi] of [['Rune', 8, 12], ['Fragment de rune', 1, 6]]){
    const seen = new Set(), rng = mulberry32(42);
    for(let k = 0; k < 2000; k++){ const n = recycleRefund(item, rng)[DUST]; assert.ok(Number.isInteger(n) && n >= lo && n <= hi); seen.add(n); }
    assert.equal(seen.size, hi - lo + 1, `${item} : toutes les valeurs sortent`);
  }
  for(const q of [1, 4, 7]){
    const { inv, uid } = withRune('Rune', q);
    const r = recycleStuff(inv, uid, () => false, () => 0.999999);
    assert.deepEqual(r, { ok:true, item:'Rune', refund:{ [DUST]:12 } }, `R${q}`);
  }
});

test('recycler une rune : elle disparaît, la poudre arrive ; renvoyer la demande ne rend rien de plus', () => {
  const { inv, uid } = withRune('Fragment de rune', 5);
  const r = recycleStuff(inv, uid, () => false, () => 0);
  assert.deepEqual(r.refund, { [DUST]:1 });
  assert.equal(countOf(inv, 'Fragment de rune'), 0);
  assert.equal(countOf(inv, DUST), 1);
  assert.equal(recycleStuff(inv, uid, () => false, () => 0).error, 'not_owned');
  assert.equal(countOf(inv, DUST), 1);
});

test('recycler une rune sans le hasard du serveur : refusé, rien ne bouge', () => {
  const { inv, uid } = withRune('Rune');
  assert.equal(recycleStuff(inv, uid).error, 'not_recyclable');
  assert.equal(countOf(inv, 'Rune'), 1);
  assert.equal(countOf(inv, DUST), 0);
});

test('recette Rune : de base, 100 Poudre de rêve', () => {
  assert.deepEqual(RECIPES.Rune, { cost:{ [DUST]:100 }, qty:1, unlock:null });
  assert.ok(craftable(createInventory()).includes('Rune'));
});

test('chances de qualité de la rune fabriquée : 15 / 25 / 30 / 18 / 6 / 4,5 / 1,5 %', () => {
  const sum = Object.values(RUNE.craftChances).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `somme ${sum}`);
  /* bornes : juste sous 15 % → R1, à 15 % → R2, … ; tout en haut → R7 (un cheveu au-dessus des autres bornes : arrondis) */
  const at = r => rollCraftedRuneQuality(() => r);
  assert.equal(at(0), 1); assert.equal(at(0.1499), 1); assert.equal(at(0.15), 2); assert.equal(at(0.3999), 2);
  assert.equal(at(0.4001), 3); assert.equal(at(0.7001), 4); assert.equal(at(0.8801), 5); assert.equal(at(0.9401), 6);
  assert.equal(at(0.9849), 6); assert.equal(at(0.9851), 7); assert.equal(at(0.999999), 7);
  const rng = mulberry32(7), n = 100000, counts = {};
  for(let k = 0; k < n; k++){ const q = rollCraftedRuneQuality(rng); counts[q] = (counts[q] || 0) + 1; }
  for(const [q, c] of Object.entries(RUNE.craftChances)) assert.ok(Math.abs(counts[q] / n - c) < 0.006, `R${q} : ${counts[q] / n}`);
});

test('fabriquer une rune : 100 poudre retirées, une rune avec qualité et lignes ; même demande = rien de plus', () => {
  const inv = createInventory();
  addItem(inv, DUST, 250);
  const r = craft(inv, 'Rune', 'op-rune-0001', mulberry32(3));
  assert.equal(r.ok, true);
  assert.equal(countOf(inv, DUST), 150);
  assert.equal(countOf(inv, 'Rune'), 1);
  const s = inv.slots.find(x => x?.item === 'Rune');
  assert.equal(r.pieces.length, 1);
  assert.equal(r.pieces[0].uid, s.uid);
  assert.ok(s.q >= 1 && s.q <= 7 && Array.isArray(s.lines) && s.lines.length >= 1);
  assert.deepEqual(r.pieces[0].lines, s.lines);
  assert.equal(craft(inv, 'Rune', 'op-rune-0001', mulberry32(3)).repeated, true);
  assert.equal(countOf(inv, DUST), 150);
  assert.equal(countOf(inv, 'Rune'), 1);
});

test('fabriquer une rune : pas assez de poudre, ou pas de hasard serveur → refusé, rien de retiré', () => {
  const inv = createInventory();
  addItem(inv, DUST, 99);
  assert.equal(craft(inv, 'Rune', 'op-rune-0002', mulberry32(1)).error, 'not_enough');
  addItem(inv, DUST, 1);
  assert.equal(craft(inv, 'Rune', 'op-rune-0003').error, 'unknown');
  assert.equal(countOf(inv, DUST), 100);
  assert.equal(countOf(inv, 'Rune'), 0);
});

test('boucle fermée : recycler une rune fabriquée ne rend jamais les 100 poudres', () => {
  const inv = createInventory();
  addItem(inv, DUST, 100);
  craft(inv, 'Rune', 'op-rune-0004', mulberry32(9));
  const uid = inv.slots.find(x => x?.item === 'Rune').uid;
  const r = recycleStuff(inv, uid, () => false, () => 0.999999);
  assert.ok(r.refund[DUST] < 100);
});
