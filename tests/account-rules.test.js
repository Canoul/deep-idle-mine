/* Comptes : règles partagées par le jeu et le serveur (pseudo, mot de passe, ID de compte, code de secours). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkName, nameKey, cleanName, checkPassword, formatAccountId, parseAccountId, parseRecoveryCode,
         displayName, CODE_ALPHABET } from '../src/shared/account.js';

test('pseudos valables : lettres (accents compris), chiffres, - et _', () => {
  for(const n of ['Geoffrey', 'Éloïse_42', 'mine-ur', 'abc', 'Zoé', 'a'.repeat(16)]) assert.equal(checkName(n), null, n);
});

test('pseudos refusés, avec un message lisible', () => {
  assert.match(checkName('ab'), /au moins 3/);
  assert.match(checkName('a'.repeat(17)), /au plus 16/);
  assert.match(checkName('jean pierre'), /lettres, des chiffres/);
  assert.match(checkName('<script>'), /lettres, des chiffres/);
  assert.match(checkName('12345'), /au moins une lettre/);
  assert.match(checkName('Admin'), /réservé/);
  assert.match(checkName('Invité'), /réservé/, 'comparé sans accent');
  assert.match(checkName(undefined), /au moins 3/);
});

test('les espaces autour sont retirés, la clé ignore majuscules et accents', () => {
  assert.equal(cleanName('  Zoé '), 'Zoé');
  assert.equal(nameKey('ÉRIC'), nameKey('eric'));
  assert.equal(nameKey('Zoé'), 'zoe');
  assert.equal(nameKey('Zélie'), nameKey('Zélie'), 'deux façons d\'écrire un accent');
});

test('mot de passe : longueur, jamais rogné, différent du pseudo', () => {
  assert.equal(checkPassword('motdepasse'), null);
  assert.match(checkPassword('court'), /au moins 8/);
  assert.match(checkPassword('x'.repeat(129)), /au plus 128/);
  assert.match(checkPassword('Geoffrey', 'geoffrey'), /pseudo/);
  assert.equal(checkPassword('   espaces   '), null, 'les espaces comptent');
  assert.match(checkPassword(undefined), /au moins 8/);
});

test('ID de compte : affiché en 2 groupes de 4, retrouvé même mal tapé', () => {
  assert.equal(formatAccountId('7K3Q9XHP'), '7K3Q-9XHP');
  assert.equal(parseAccountId('7k3q-9xhp'), '7K3Q9XHP');
  assert.equal(parseAccountId(' 7K3Q 9XHP '), '7K3Q9XHP');
  assert.equal(parseAccountId('7K3O-9XHI'), '7K309XH1', 'O → 0, I → 1');
  assert.equal(parseAccountId('7K3Q-9XH'), null, 'trop court');
  assert.equal(parseAccountId('7K3Q-9XHU'), null, 'U n\'existe pas dans l\'alphabet');
});

test('code de secours : 16 caractères', () => {
  assert.equal(parseRecoveryCode('abcd-efgh-jkmn-pqrs'), 'ABCDEFGHJKMNPQRS');
  assert.equal(parseRecoveryCode('ABCD-EFGH'), null);
});

test('alphabet de Crockford : 32 caractères, sans I, L, O, U', () => {
  assert.equal(new Set(CODE_ALPHABET).size, 32);
  for(const c of 'ILOU') assert.ok(!CODE_ALPHABET.includes(c));
});

test('nom affiché : pseudo, ou « Invité » + début de l\'ID', () => {
  assert.equal(displayName({ id:'7K3Q9XHP', name:'Zoé' }), 'Zoé');
  assert.equal(displayName({ id:'7K3Q9XHP', name:null }), 'Invité 7K3Q');
});
