/* Anti-triche : coffre du Roi Gobelin et recette Chitine au four (27/10/2026). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goblinChestItem } from '../../src/config.js';
import { createInventory, addAll, addItem, countOf } from '../../src/meta/inventory.js';
import { openTreasure } from '../../src/meta/loot.js';
import { createFurnaces, furnaceOp } from '../../src/meta/furnace.js';

const CHEST = goblinChestItem(5);

test('coffre du Roi Gobelin : sans coffre rien ne s\'ouvre ; la même demande ne donne qu\'une fois ; la qualité vient du coffre', () => {
  const inv = createInventory();
  assert.equal(openTreasure(inv, CHEST, 'a', () => 0), null, 'pas de coffre : rien');
  addItem(inv, CHEST, 1);
  const r = openTreasure(inv, CHEST, 'a', () => 0);
  for(let k = 0; k < 5; k++) assert.equal(openTreasure(inv, CHEST, 'a', () => 0).repeated, true);
  assert.equal(countOf(inv, 'Couronne du Roi Gobelin'), 1, 'une seule couronne');
  assert.equal(countOf(inv, 'Peau de gobelin'), r.loot['Peau de gobelin']);
  assert.equal(inv.slots.find(s => s?.item === 'Couronne du Roi Gobelin').q, 5);
  assert.equal(openTreasure(inv, 'Coffre du Roi Gobelin R9', 'b', () => 0), null, 'qualité inconnue : refusé');
  assert.equal(openTreasure(inv, 'Coffre du Roi Gobelin', 'c', () => 0), null);
});

test('four : la recette Chitine fermée est refusée par le serveur même si le navigateur l\'envoie ; quantités invalides refusées', () => {
  const inv = createInventory(), st = createFurnaces(); addAll(inv, { 'Peau de gobelin':100, 'Charbon':100 });
  assert.equal(furnaceOp(st, inv, { furnace:0, action:'load', slot:'ore', item:'Peau de gobelin', qty:10, opId:'x' }, 0).error, 'bad_item');
  inv.unlocked.push('Four : Chitine');
  for(const qty of [-10, 0, 2.5, Infinity, NaN, '10', 101])
    assert.ok(furnaceOp(st, inv, { furnace:0, action:'load', slot:'ore', item:'Peau de gobelin', qty, opId:'q' + String(qty) }, 0).error, String(qty));
  assert.equal(countOf(inv, 'Peau de gobelin'), 100, 'rien retiré');
});
