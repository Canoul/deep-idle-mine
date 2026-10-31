/* Ranger l'inventaire (25/10/2026) : bouton « Trier » et glisser un objet dans un autre slot */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInventory, addItem, sortInventory, moveSlot, countOf } from '../src/meta/inventory.js';

const names = inv => inv.slots.map(s => s?.item ?? null);

test('trier : par type (blocs, minerais, matériaux, stuff), puis rareté du catalogue (la plus rare d\'abord), sans trous', () => {
  const inv = createInventory();
  addItem(inv, 'Épée en fer', 1); addItem(inv, 'Fer', 10); addItem(inv, 'Terre', 50); addItem(inv, 'Cape de Naingui', 1);
  addItem(inv, 'Tissu sombre', 3); addItem(inv, 'Treasure T1', 1); addItem(inv, 'Charbon', 5); addItem(inv, 'Résidu angélique', 2);
  inv.slots.splice(2, 0, null);                                            // un trou au milieu
  sortInventory(inv);
  assert.deepEqual(names(inv), ['Terre', 'Résidu angélique', 'Charbon', 'Fer', 'Tissu sombre', 'Cape de Naingui', 'Épée en fer', 'Treasure T1']);
  const again = names(inv); sortInventory(inv);
  assert.deepEqual(names(inv), again, 'rejouer le tri ne change rien');
});

test('trier : la qualité d\'identification ne compte pas ; deux pièces du même objet gardent leur ordre', () => {
  const inv = createInventory();
  addItem(inv, 'Épée en fer', 2);
  inv.slots[0].q = 1; inv.slots[1].q = 7;
  const [a, b] = inv.slots.map(s => s.uid);
  addItem(inv, 'Pierre', 1);
  sortInventory(inv);
  assert.deepEqual(inv.slots.map(s => s.uid ?? s.item), ['Pierre', a, b]);
});

test('trier : runes et fragments de la meilleure qualité à la moins bonne (R7 d\'abord) ; à qualité égale, ordre gardé', () => {
  const inv = createInventory();
  addItem(inv, 'Fragment de rune', 2); addItem(inv, 'Rune', 4);
  [2, 6, 7, 2, 1, 5].forEach((q, i) => { inv.slots[i].q = q; });
  const [low, high, r7, r2, r1, r5] = inv.slots.map(s => s.uid);
  sortInventory(inv);
  assert.deepEqual(inv.slots.map(s => s.uid), [r7, r5, r2, r1, high, low]);
  const again = inv.slots.map(s => s.uid); sortInventory(inv);
  assert.deepEqual(inv.slots.map(s => s.uid), again, 'rejouer le tri ne change rien');
});

test('trier : rien n\'est créé ni perdu', () => {
  const inv = createInventory();
  addItem(inv, 'Fer', 7); addItem(inv, 'Épée en fer', 3); addItem(inv, 'Terre', 2);
  sortInventory(inv);
  assert.equal(countOf(inv, 'Fer'), 7); assert.equal(countOf(inv, 'Épée en fer'), 3); assert.equal(countOf(inv, 'Terre'), 2);
  assert.equal(new Set(inv.slots.filter(s => s.uid).map(s => s.uid)).size, 3);
});

test('déplacer : vers un slot vide, ou échange avec l\'objet qui y est', () => {
  const inv = createInventory();
  addItem(inv, 'Fer', 10); addItem(inv, 'Terre', 5);
  assert.ok(moveSlot(inv, { from:0, to:20, item:'Fer' }).ok);
  assert.deepEqual(names(inv).slice(0, 2), [null, 'Terre']); assert.equal(inv.slots[20].item, 'Fer');
  assert.ok(moveSlot(inv, { from:1, to:20, item:'Terre' }).ok);
  assert.equal(inv.slots[20].item, 'Terre'); assert.equal(inv.slots[1].item, 'Fer');
  assert.equal(countOf(inv, 'Fer'), 10); assert.equal(countOf(inv, 'Terre'), 5);
});

test('déplacer : une demande renvoyée ne ré-échange pas (l\'objet attendu n\'est plus là)', () => {
  const inv = createInventory();
  addItem(inv, 'Fer', 10); addItem(inv, 'Terre', 5);
  assert.ok(moveSlot(inv, { from:0, to:1, item:'Fer' }).ok);
  assert.equal(moveSlot(inv, { from:0, to:1, item:'Fer' }).error, 'not_owned');
  assert.deepEqual(names(inv), ['Terre', 'Fer']);
});

test('déplacer : pièce de stuff vérifiée par son uid ; demandes invalides refusées', () => {
  const inv = createInventory();
  addItem(inv, 'Épée en fer', 2);
  const uid = inv.slots[1].uid;
  assert.equal(moveSlot(inv, { from:0, to:5, item:'Épée en fer', uid }).error, 'not_owned');
  assert.ok(moveSlot(inv, { from:1, to:5, item:'Épée en fer', uid }).ok);
  for(const bad of [{ from:-1, to:2, item:'Épée en fer' }, { from:0, to:1.5, item:'Épée en fer' }, { from:0, to:Infinity, item:'Épée en fer' },
                    { from:'0', to:2, item:'Épée en fer' }, { from:0, to:1e6, item:'Épée en fer' }, { from:0, to:2 }, undefined])
    assert.equal(moveSlot(inv, bad).error, 'bad_request', JSON.stringify(bad));
  assert.equal(moveSlot(inv, { from:3, to:2, item:'Fer' }).error, 'not_owned', 'slot vide');
  assert.equal(inv.slots.filter(Boolean).length, 2);
});
