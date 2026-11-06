/* Traducteur de la page (06/11/2026, src/i18n/dom.js) : textes exacts, modèles {x}, garde-fous */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator } from '../src/i18n/dom.js';
import UI from '../src/i18n/en/ui.js';
import NAMES from '../src/i18n/en/names.js';

const tr = createTranslator(UI, NAMES);

test('texte exact, espaces du bord gardés, ligne par ligne (data-tip)', () => {
  assert.equal(tr('  Lancer la session '), '  Launch the session ');
  assert.equal(tr('Inventaire\nPioche en fer'), 'Inventory\nIron Pickaxe');
});

test('modèles : nombres, valeur vide (pluriel), noms traduits dans la valeur, début collé (R3)', () => {
  assert.equal(tr('12 points à dépenser'), '12 points to spend');
  assert.equal(tr('0 point à dépenser'), '0 point to spend');
  assert.equal(tr('R3 Haute qualité'), 'R3 High Quality');
  assert.equal(tr("5 Pépite d'argent"), '5 Silver Nugget');
  assert.equal(tr('Mineur test 1'), 'Mineur test 1', '{#n} : un nombre seulement');
});

test('garde-fou : un modèle court ne traduit jamais un mot au milieu d\'une phrase française', () => {
  const s = 'apprends encore 10 recettes du Tier 1 et 4 recettes du Tier 2';
  assert.equal(tr(s), s);
  assert.equal(tr('Une phrase inconnue sur la mine'), 'Une phrase inconnue sur la mine');
});

test('sans lettre ou inconnu : inchangé ; relevé des manquants', () => {
  const seen = [];
  const t2 = createTranslator(UI, NAMES, { onMissing: (t, fr) => seen.push([t, fr]) });
  assert.equal(t2('42'), '42');
  assert.equal(t2('Texte jamais vu dans le jeu'), 'Texte jamais vu dans le jeu');
  assert.deepEqual(seen, [['Texte jamais vu dans le jeu', true]]);
});

test('ligne en morceaux « a · b » et valeur « nombre + mot » traduites ; un modèle sans mot fixe n\'invente rien', () => {
  assert.equal(tr('0 run · 1 s de jeu · +0 XP · +0 ⚡ · 0 objet'), '0 run · 1 s of play · +0 XP · +0 ⚡ · 0 item');
  assert.equal(tr(': 10 énergie à gagner ! Tirage dans 2 min'), ': 10 energy to win! Draw in 2 min');
  assert.equal(tr('3 Truc inconnu'), '3 Truc inconnu');
});

test('pseudos et messages des joueurs : protégés par pn() (data-noi18n)', async () => {
  const { pn } = await import('../src/i18n/index.js');
  assert.equal(pn('Mineur <b>'), '<bdi data-noi18n>Mineur &lt;b&gt;</bdi>');
});
