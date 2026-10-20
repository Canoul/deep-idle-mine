/* Craft : recettes (src/recipes.js), ingrédients x/besoin, fabrication tout ou rien, demande rejouée sans effet. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, FURNACE } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { createInventory, addAll, countOf } from '../src/meta/inventory.js';
import { craft, canCraft, needs, craftable, recipeOf } from '../src/meta/craft.js';

const invWith = bag => { const inv = createInventory(); addAll(inv, bag); return inv; };

test('recettes : fichier séparé, objets et ingrédients connus du catalogue', () => {
  for(const [name, r] of Object.entries(RECIPES)){
    assert.ok(ITEMS[name], `${name} : objet inconnu`);
    assert.ok(Number.isSafeInteger(r.qty) && r.qty > 0);
    for(const [k, n] of Object.entries(r.cost)){ assert.ok(ITEMS[k], `${k} : ingrédient inconnu`); assert.ok(Number.isSafeInteger(n) && n > 0); }
  }
});

test('pioche en pierre : 30 lingots de fer, débloquée de base ; le lingot de fer sort bien du four', () => {
  assert.deepEqual(RECIPES['Pioche en pierre'].cost, { 'Lingot de fer':30 });
  assert.ok(craftable().includes('Pioche en pierre'));
  assert.equal(ITEMS['Pioche en pierre'].cat, 'stuff'); assert.equal(ITEMS['Pioche en pierre'].slot, 'pioche');
  assert.equal(FURNACE.recipes.Fer.out, 'Lingot de fer');
});

test('ingrédients affichés x/30 ; craft possible seulement avec tout', () => {
  const inv = invWith({ 'Lingot de fer':12 });
  assert.deepEqual(needs(inv, 'Pioche en pierre'), [{ item:'Lingot de fer', need:30, have:12 }]);
  assert.equal(canCraft(inv, 'Pioche en pierre'), false);
  assert.equal(craft(inv, 'Pioche en pierre', 'op-craft-1').error, 'not_enough');
  assert.equal(countOf(inv, 'Lingot de fer'), 12, 'rien retiré');
});

test('craft : retire 30 lingots, donne une pioche (pièce unique, avec uid)', () => {
  const inv = invWith({ 'Lingot de fer':45 });
  assert.equal(craft(inv, 'Pioche en pierre', 'op-craft-2').ok, true);
  assert.equal(countOf(inv, 'Lingot de fer'), 15);
  const p = inv.slots.find(s => s?.item === 'Pioche en pierre');
  assert.ok(p && Number.isSafeInteger(p.uid) && p.qty === 1);
});

test('demande rejouée : une seule pioche ; recette inconnue refusée', () => {
  const inv = invWith({ 'Lingot de fer':90 });
  craft(inv, 'Pioche en pierre', 'double-clic');
  assert.equal(craft(inv, 'Pioche en pierre', 'double-clic').repeated, true);
  assert.equal(countOf(inv, 'Pioche en pierre'), 1); assert.equal(countOf(inv, 'Lingot de fer'), 60);
  for(const bad of ['Inconnu', '__proto__', 'constructor', 42, null]) assert.equal(craft(inv, bad, 'op-' + bad).error, 'unknown');
  assert.equal(recipeOf('toString'), null);
});
