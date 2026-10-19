/* Comptes côté jeu : vérification des formulaires et inventaire rangé par compte (avec reprise de l'existant). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkForm } from '../src/ui/account.js';
import { loadInventory, saveInventory, inventoryKey } from '../src/ui/storage.js';
import { createInventory, addItem, countOf, serialize } from '../src/meta/inventory.js';

/* localStorage de test */
function fakeStorage(init = {}){
  const m = new Map(Object.entries(init));
  return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), keys: () => [...m.keys()] };
}
const invWith = (item, qty) => { const i = createInventory(); addItem(i, item, qty); return i; };

test('formulaires : erreurs avant envoi, mêmes règles que le serveur', () => {
  assert.equal(checkForm('login', { name: 'Zoé', password: 'x' }), null);
  assert.match(checkForm('login', { name: ' ', password: 'x' }), /requis/);
  assert.equal(checkForm('register', { name: 'Zoé', password: 'motdepasse', confirm: 'motdepasse' }), null);
  assert.match(checkForm('register', { name: 'Zoé', password: 'motdepasse', confirm: 'motdepasso' }), /identiques/);
  assert.match(checkForm('claim', { name: 'a b', password: 'motdepasse', confirm: 'motdepasse' }), /lettres/);
  assert.match(checkForm('recover', { name: 'Zoé', code: 'ABCD', password: 'motdepasse', confirm: 'motdepasse' }), /16 caractères/);
  assert.equal(checkForm('recover', { name: 'Zoé', code: 'abcd-efgh-jkmn-pqrs', password: 'motdepasse', confirm: 'motdepasse' }), null);
  assert.match(checkForm('password', { old: '', password: 'motdepasse', confirm: 'motdepasse' }), /actuel/);
});

test('chaque compte a son propre inventaire dans le navigateur', () => {
  const st = fakeStorage();
  saveInventory(invWith('Charbon', 10), 'AAAA1111', st);
  saveInventory(invWith('Fer', 3), 'BBBB2222', st);
  assert.equal(countOf(loadInventory('AAAA1111', st), 'Charbon'), 10);
  assert.equal(countOf(loadInventory('AAAA1111', st), 'Fer'), 0);
  assert.equal(countOf(loadInventory('BBBB2222', st), 'Fer'), 3);
  assert.equal(inventoryKey('AAAA1111'), 'deepIdleMine.inventory.AAAA1111');
});

test('l\'inventaire d\'avant les comptes est repris par le premier compte connecté, une seule fois', () => {
  const st = fakeStorage({ 'deepIdleMine.inventory': serialize(invWith('Or', 7)) });
  assert.equal(countOf(loadInventory('AAAA1111', st), 'Or'), 7, 'repris');
  assert.equal(countOf(loadInventory('BBBB2222', st), 'Or'), 0, 'pas dupliqué sur un 2e compte');
  assert.equal(countOf(loadInventory('AAAA1111', st), 'Or'), 7, 'toujours là au rechargement');
  assert.ok(!st.keys().includes('deepIdleMine.inventory'));
});

test('le très ancien format { nom: quantité } est aussi repris', () => {
  const st = fakeStorage({ 'deepIdleMine.global': JSON.stringify({ Charbon: 5 }) });
  assert.equal(countOf(loadInventory('AAAA1111', st), 'Charbon'), 5);
  assert.equal(countOf(loadInventory('BBBB2222', st), 'Charbon'), 0);
});

test('hors ligne (sans compte) : comme avant, une seule sauvegarde pour le navigateur', () => {
  const st = fakeStorage();
  saveInventory(invWith('Pierre', 2), null, st);
  assert.equal(countOf(loadInventory(null, st), 'Pierre'), 2);
  assert.deepEqual(st.keys(), ['deepIdleMine.inventory']);
});

test('sans localStorage : inventaire vide, pas de plantage', () => {
  assert.equal(loadInventory('AAAA1111', null).slots.length, 0);
  assert.doesNotThrow(() => saveInventory(createInventory(), 'AAAA1111', null));
});
