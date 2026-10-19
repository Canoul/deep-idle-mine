/* Comptes côté jeu : vérification des formulaires (mêmes règles que le serveur).
   L'inventaire n'est plus dans le navigateur : il est sur le serveur (tests/game-*.test.js). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkForm } from '../src/ui/account.js';

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
