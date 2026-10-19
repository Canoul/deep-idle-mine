/* Inventaire global : piles, slots, ordre d'arrivée, objets non empilables, sauvegarde. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, TREASURE, MOBS } from '../src/config.js';
import { createInventory, addItem, addAll, removeItem, countOf, usedSlots, gridSize, isStackable,
         serialize, deserialize, fromLegacy } from '../src/meta/inventory.js';
import { fmtQty } from '../src/ui/inventory.js';

/* un objet de stuff fictif pour tester les objets non empilables */
ITEMS['Épée test'] = { cat:'stuff', tex:null, w:0, stack:false };

test('un nouvel objet prend un nouveau slot, un objet déjà présent s\'empile dessus', () => {
  const inv = createInventory();
  addItem(inv, 'Charbon', 100);
  addItem(inv, 'Fer', 5);
  addItem(inv, 'Charbon', 30);
  assert.deepEqual(inv.slots, [ {item:'Charbon', qty:130}, {item:'Fer', qty:5} ]);
});

test('pas de taille maximum de pile', () => {
  const inv = createInventory();
  addItem(inv, 'Pierre', 1e9); addItem(inv, 'Pierre', 1);
  assert.equal(usedSlots(inv), 1);
  assert.equal(countOf(inv, 'Pierre'), 1e9 + 1);
});

test('ordre d\'arrivée : un objet garde son slot', () => {
  const inv = createInventory();
  addAll(inv, { Terre:10, Charbon:3 });
  addAll(inv, { Or:1, Terre:5 });
  assert.deepEqual(inv.slots.map(s => s.item), ['Terre', 'Charbon', 'Or']);
});

test('les objets non empilables (stuff) prennent un slot chacun', () => {
  const inv = createInventory();
  addItem(inv, 'Charbon', 4);
  const touched = addItem(inv, 'Épée test', 3);
  assert.deepEqual(touched, [1, 2, 3]);
  assert.equal(usedSlots(inv), 4);
  assert.ok(inv.slots.slice(1).every(s => s.item === 'Épée test' && s.qty === 1));
  assert.equal(new Set(inv.slots.slice(1).map(s => s.uid)).size, 3, 'chaque pièce a son identifiant');
  assert.equal(isStackable('Épée test'), false);
});

test('tous les objets ramenés par la simulation sont au catalogue et empilables', () => {
  for(const n of ['Terre','Pierre','Pierre dure','Charbon','Fer','Or','Diamant', TREASURE.item, MOBS.bugItem]){
    assert.ok(ITEMS[n], n+' au catalogue');
    assert.equal(isStackable(n), true, n);
  }
  for(const n of ['Barrière','Passerelle','Coffre au trésor']) assert.equal(ITEMS[n], undefined, n+' ne se ramasse pas');
});

test('un objet inconnu s\'empile par défaut', () => {
  const inv = createInventory();
  addItem(inv, 'Truc', 2); addItem(inv, 'Truc', 2);
  assert.deepEqual(inv.slots, [{ item:'Truc', qty:4 }]);
});

test('quantités nulles ou invalides ignorées', () => {
  const inv = createInventory();
  assert.deepEqual(addItem(inv, 'Fer', 0), []);
  assert.deepEqual(addItem(inv, 'Fer', -3), []);
  assert.deepEqual(addItem(inv, 'Fer', NaN), []);
  assert.equal(usedSlots(inv), 0);
});

test('retirer : tout ou rien, un slot vidé laisse un trou réutilisé par le prochain nouvel objet', () => {
  const inv = createInventory();
  addAll(inv, { Terre:10, Charbon:3, Fer:2 });
  assert.equal(removeItem(inv, 'Charbon', 5), false, 'pas assez');
  assert.equal(countOf(inv, 'Charbon'), 3);
  assert.equal(removeItem(inv, 'Charbon', 3), true);
  assert.deepEqual(inv.slots.map(s => s && s.item), ['Terre', null, 'Fer'], 'Fer garde sa place');
  addItem(inv, 'Or', 1);
  assert.equal(inv.slots[1].item, 'Or');
});

test('grille : au moins 48 cases, lignes complètes, toujours une case libre', () => {
  const inv = createInventory();
  assert.equal(gridSize(inv, 8, 48), 48);
  for(let i=0; i<47; i++) addItem(inv, 'Objet '+i, 1);
  assert.equal(gridSize(inv, 8, 48), 48);
  addItem(inv, 'Objet 47', 1);                       // grille pleine : une ligne s'ajoute
  assert.equal(gridSize(inv, 8, 48), 56);
});

test('sauvegarde : aller-retour identique, et les identifiants de stuff continuent', () => {
  const inv = createInventory();
  addAll(inv, { Charbon:12, Trésor:1 }); addItem(inv, 'Épée test', 2);
  const back = deserialize(serialize(inv));
  assert.deepEqual(back.slots, inv.slots);
  addItem(back, 'Épée test', 1);
  assert.equal(back.slots.at(-1).uid, 3);
});

test('sauvegarde corrompue : inventaire vide plutôt qu\'un plantage', () => {
  assert.equal(usedSlots(deserialize('pas du json')), 0);
  assert.equal(usedSlots(deserialize('{"v":1}')), 0);
  assert.deepEqual(deserialize('{"v":1,"slots":[{"item":"Fer","qty":2},{"bad":1},null]}').slots,
    [{item:'Fer', qty:2}, null, null]);
});

test('reprise de l\'ancien inventaire { nom: quantité }', () => {
  const inv = fromLegacy({ Terre:117, Charbon:133, Fer:2 });
  assert.deepEqual(inv.slots, [{item:'Terre',qty:117},{item:'Charbon',qty:133},{item:'Fer',qty:2}]);
});

test('affichage compact des quantités', () => {
  assert.equal(fmtQty(7), '7');
  assert.equal(fmtQty(9999), '9 999');
  assert.equal(fmtQty(12340), '12,3k');
  assert.equal(fmtQty(20000), '20k');
  assert.equal(fmtQty(456789), '456k');
  assert.equal(fmtQty(1234567), '1,2M');
});
