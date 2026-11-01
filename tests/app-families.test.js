/* Couche appli (src/app/) : les 5 familles d'onglets, logique pure. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { TABS, CHAT_TAB } from '../src/ui/nav.js';
import { FAMILIES, familyOf, tabsOf, targetTab, familyMarks } from '../src/app/families.js';

test('familles : les 5 de la spec, dans l\'ordre', () => {
  assert.deepEqual(FAMILIES.map(f => [f.id, f.tabs]), [
    ['accueil', ['lobby']],
    ['session', ['session', 'historique']],
    ['sac', ['inventaire', 'four', 'concasseur', 'craft', 'recherche']],
    ['perso', ['stuff', 'amelioration', 'skills', 'sorts']],
    ['social', ['social', 'guilde', 'chat']],
  ]);
});

test('garde-fou : chaque onglet du jeu est dans une seule famille', () => {
  for(const t of [...TABS, CHAT_TAB])
    assert.equal(FAMILIES.filter(f => f.tabs.includes(t.id)).length, 1, t.id);
});

test('adresses : #craft ouvre Sac, onglet inconnu : aucune famille', () => {
  assert.equal(familyOf('craft'), 'sac');
  assert.equal(familyOf('nimporte'), null);
});

test('hors session, la famille Session ne garde que l\'Historique', () => {
  assert.deepEqual(tabsOf('session', { inSession: false }), ['historique']);
  assert.equal(targetTab('session', 'session', { inSession: false }), 'historique');
  assert.equal(targetTab('session', 'historique', { inSession: true }), 'historique');
  assert.equal(targetTab('session', null, { inSession: true }), 'session');
});

test('sous-onglet retenu périmé : le premier de la famille', () => {
  assert.equal(targetTab('sac', 'ancien-onglet', { inSession: false }), 'inventaire');
  assert.equal(targetTab('sac', 'stuff', { inSession: false }), 'inventaire');
  assert.equal(targetTab('sac', 'four', { inSession: false }), 'four');
});

test('une pastille d\'onglet marque sa famille', () => {
  assert.deepEqual([...familyMarks(new Set(['guilde', 'craft', 'inconnu']))].sort(), ['sac', 'social']);
});
