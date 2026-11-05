/* Couche appli (src/app/) : les 5 familles d'onglets, logique pure. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { TABS, CHAT_TAB } from '../src/ui/nav.js';
import { FAMILIES, familyOf, tabsOf, targetTab, familyMarks, sessionRedirect } from '../src/app/families.js';

test('familles : les 5 de la spec, dans l\'ordre', () => {
  assert.deepEqual(FAMILIES.map(f => [f.id, f.tabs]), [
    ['accueil', ['lobby']],
    ['session', ['session', 'historique']],
    ['sac', ['inventaire', 'craft', 'four', 'concasseur', 'recherche', 'boutique']],   // ordre de Jules, 03/11 ; Boutique au bout (05/11)
    ['perso', ['stuff', 'amelioration', 'skills', 'sorts']],
    ['social', ['classement', 'guilde', 'social', 'chat']],
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

test('Session sans rien à montrer : Historique', () => {
  assert.equal(sessionRedirect({ tab:'session', shown:false, wasShown:false }), 'historique');
});

test('bilan affiché : on reste sur Session', () => {
  assert.equal(sessionRedirect({ tab:'session', shown:true, wasShown:true }), null);
});

test('session retrouvée après rechargement : retour à la mine depuis l\'Historique', () => {
  assert.equal(sessionRedirect({ tab:'historique', shown:true, wasShown:false }), 'session');
});

test('Historique ouvert exprès pendant une session : on y reste', () => {
  assert.equal(sessionRedirect({ tab:'historique', shown:true, wasShown:true }), null);
});

test('session démarrée pendant qu\'on est dans le Sac : on ne bouge pas', () => {
  assert.equal(sessionRedirect({ tab:'craft', shown:true, wasShown:false }), null);
});
