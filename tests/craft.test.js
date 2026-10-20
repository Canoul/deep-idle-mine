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

test('pièces en chitine : recettes (lingots de fer + chitine), débloquées de base, une par case', () => {
  const expect = {
    'Casque en chitine':   [{ 'Lingot de fer':5, Chitine:70 }, 'casque'],
    'Plastron en chitine': [{ 'Lingot de fer':8, Chitine:30 }, 'torse'],
    'Jambes en chitine':   [{ 'Lingot de fer':7, Chitine:30 }, 'jambes'],
    'Bottes en chitine':   [{ 'Lingot de fer':4, Chitine:70 }, 'pieds'],
  };
  for(const [name, [cost, slot]] of Object.entries(expect)){
    assert.deepEqual(RECIPES[name].cost, cost, name);
    assert.ok(craftable().includes(name), name);
    assert.equal(ITEMS[name].cat, 'stuff'); assert.equal(ITEMS[name].slot, slot);
  }
  const inv = invWith({ 'Lingot de fer':5, Chitine:70 });
  assert.equal(craft(inv, 'Casque en chitine', 'op-chitin-1').ok, true);
  assert.equal(countOf(inv, 'Casque en chitine'), 1);
  assert.equal(countOf(inv, 'Chitine'), 0); assert.equal(countOf(inv, 'Lingot de fer'), 0);
});
