/* Couche appli, clavier du téléphone (src/app/keyboard.js, 03/11/2026 : sur un Galaxy S24, le champ du pseudo était caché
   par le clavier à la connexion). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyboardHeight, isField } from '../src/app/keyboard.js';

test('hauteur du clavier : celle du plugin d\'abord, sinon ce que la fenêtre visible ne montre plus', () => {
  assert.equal(keyboardHeight({ plugin: 312.4, inner: 900, vvHeight: 900 }), 312);
  assert.equal(keyboardHeight({ inner: 900, vvHeight: 560, vvTop: 0 }), 340);
  assert.equal(keyboardHeight({ inner: 900, vvHeight: 560, vvTop: 40 }), 300, 'page décalée vers le haut');
  assert.equal(keyboardHeight({ inner: 900, vvHeight: 860 }), 0, 'barre d\'adresse, pas un clavier');
  assert.equal(keyboardHeight({ inner: 900 }), 0, 'sans visualViewport');
  assert.equal(keyboardHeight({ plugin: 0, inner: 900, vvHeight: 900 }), 0, 'plugin : clavier fermé');
  assert.equal(keyboardHeight(), 0);
});

test('champ où l\'on tape : texte, mot de passe, recherche, zone de texte ; pas une case à cocher ni un bouton', () => {
  for(const type of ['text', 'password', 'search', 'number', undefined]) assert.ok(isField({ tagName: 'INPUT', type }), String(type));
  assert.ok(isField({ tagName: 'TEXTAREA' }));
  for(const type of ['checkbox', 'radio', 'submit', 'range']) assert.ok(!isField({ tagName: 'INPUT', type }), type);
  assert.ok(!isField({ tagName: 'BUTTON' })); assert.ok(!isField(null));
});
