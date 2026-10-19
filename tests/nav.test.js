/* Navigation : liste des onglets et choix de l'onglet ouvert au chargement. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABS, pickTab } from '../src/ui/nav.js';

test('les 7 onglets sont dans l\'ordre voulu, Mine en premier', () => {
  assert.deepEqual(TABS.map(t => t.label), ['Mine','Inventaire','Stuff','Craft','Four','Talents','Social']);
  assert.equal(new Set(TABS.map(t => t.id)).size, TABS.length, 'identifiants uniques');
});

test('onglet par défaut : Mine', () => {
  assert.equal(pickTab('', null), 'mine');
});

test('l\'adresse (#craft) passe avant le dernier onglet ouvert', () => {
  assert.equal(pickTab('#craft', 'inventaire'), 'craft');
  assert.equal(pickTab('#CRAFT', null), 'craft');
});

test('sans adresse, on rouvre le dernier onglet', () => {
  assert.equal(pickTab('', 'talents'), 'talents');
});

test('valeurs inconnues ignorées', () => {
  assert.equal(pickTab('#nimportequoi', 'pasunonglet'), 'mine');
  assert.equal(pickTab('#seed=12', 'four'), 'four');
});
