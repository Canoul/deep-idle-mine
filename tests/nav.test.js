/* Navigation : liste des onglets et choix de l'onglet ouvert au chargement. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TABS, pickTab } from '../src/ui/nav.js';

test('les 7 onglets sont dans l\'ordre voulu, Mine en premier', () => {
  assert.deepEqual(TABS.map(t => t.label), ['Mine','Inventaire','Stuff','Craft','Four','Recherche','Talents','Social']);
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

test('le bilan de fin de session ne bloque que l\'onglet Mine, pas tout le site', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css  = readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8');
  const mine = html.match(/<section class="view" data-view="mine">([\s\S]*?)<\/section>/);
  assert.ok(mine, 'section Mine trouvée');
  assert.match(mine[1], /id="end"/, 'le bilan est DANS l\'onglet Mine');
  assert.equal(html.match(/id="end"/g).length, 1, 'un seul bilan dans la page');
  const rule = css.match(/#end\{([^}]*)\}/)[1];
  assert.doesNotMatch(rule, /position:fixed/, 'pas de calque sur toute la fenêtre');
  assert.match(rule, /position:absolute/);
  assert.match(css, /\.view\[data-view="mine"\]\{[^}]*position:relative/, 'calque limité à la section Mine');
});

test('valeurs inconnues ignorées', () => {
  assert.equal(pickTab('#nimportequoi', 'pasunonglet'), 'mine');
  assert.equal(pickTab('#seed=12', 'four'), 'four');
});

test('lien d\'invitation à un groupe (#rejoindre=…) : ouvre Mine, où est le lobby', () => {
  assert.equal(pickTab('#rejoindre=K7Q4P2', 'inventaire'), 'mine');
});
