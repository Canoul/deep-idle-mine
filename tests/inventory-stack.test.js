/* Pièces simples empilées à l'affichage (04/11/2026, Geoffrey) : non identifiées, sans amélioration ni rune, toutes
   celles d'un même objet dans une case ; chacune garde son uid (src/ui/inventory.js isPlainPiece, inventoryCells). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPlainPiece, inventoryCells } from '../src/ui/inventory.js';

const P = (uid, item = 'Casque en fer', extra = {}) => ({ item, qty:1, uid, ...extra });

test('pièce simple : stuff non identifié, +0, sans rune ; pas une ressource, ni une pièce identifiée / améliorée / enchantée', () => {
  assert.ok(isPlainPiece(P(1)));
  assert.ok(!isPlainPiece({ item:'Fer', qty:30 }));
  assert.ok(!isPlainPiece(P(2, 'Casque en fer', { q:3, lines:[{ stat:'speed', pct:10 }] })));
  assert.ok(!isPlainPiece(P(3, 'Casque en fer', { plus:1 })));
  assert.ok(!isPlainPiece(P(4, 'Casque en fer', { rune:{ q:2, lines:[] } })));
  assert.ok(!isPlainPiece(null));
});

test('cases : les pièces simples d\'un même objet sur la première ; les autres à leur place ; la grille « Tout » garde sa taille', () => {
  const inv = { slots:[P(1), { item:'Fer', qty:5 }, P(2), P(3, 'Bottes en fer'), P(4, 'Casque en fer', { q:2 }), null, P(5)] };
  const all = inventoryCells(inv, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(all.filter(c => inv.slots[c.i]).map(c => [c.i, c.uids ?? null]), [[0, [1, 2, 5]], [1, null], [3, [3]], [4, null]]);
  assert.equal(all.length, 8, 'deux cases libérées, rendues en fin de grille');
  assert.ok(all.slice(-2).every(c => !inv.slots[c.i]), 'cases libres de fin : au-delà de l\'inventaire');
  /* un onglet (indices sans trou) : pas de cases ajoutées */
  const tab = inventoryCells(inv, [0, 2, 3, 4, 6]);
  assert.deepEqual(tab.map(c => c.i), [0, 3, 4]);
});
