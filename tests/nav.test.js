/* Navigation : liste des onglets et choix de l'onglet ouvert au chargement. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TABS, pickTab } from '../src/ui/nav.js';

test('les onglets sont dans l\'ordre voulu, Lobby puis Session en premier', () => {
  assert.deepEqual(TABS.map(t => t.label), ['Lobby','Session','Inventaire','Stuff','Craft','Four','Concasseur','Amélioration','Recherche','Skills','Sorts','Historique','Social']);
  assert.equal(new Set(TABS.map(t => t.id)).size, TABS.length, 'identifiants uniques');
});

test('onglet par défaut : Lobby', () => {
  assert.equal(pickTab('', null), 'lobby');
});

test('ancienne adresse #mine → Session ; ancien onglet « mine » mémorisé → Lobby (par défaut)', () => {
  assert.equal(pickTab('#mine', 'four'), 'session');
  assert.equal(pickTab('', 'mine'), 'lobby');
});

test('l\'adresse (#craft) passe avant le dernier onglet ouvert', () => {
  assert.equal(pickTab('#craft', 'inventaire'), 'craft');
  assert.equal(pickTab('#CRAFT', null), 'craft');
});

test('sans adresse, on rouvre le dernier onglet', () => {
  assert.equal(pickTab('', 'skills'), 'skills');
});

test('le bilan de fin de session ne bloque que l\'onglet Session, pas tout le site', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css  = readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8');
  const sess = html.match(/<section class="view" data-view="session"[^>]*>([\s\S]*?)<\/section>/);
  assert.ok(sess, 'section Session trouvée');
  assert.match(sess[1], /id="end"/, 'le bilan est DANS l\'onglet Session');
  assert.match(sess[1], /id="run"/, 'la mine est dans l\'onglet Session');
  assert.match(sess[1], /id="noSession"/, 'message « pas en session »');
  const lob = html.match(/<section class="view" data-view="lobby"[^>]*>([\s\S]*?)<\/section>/);
  assert.ok(lob, 'section Lobby trouvée');
  assert.match(lob[1], /id="lobby"/);
  assert.doesNotMatch(lob[1], /id="run"/, 'la mine n\'est plus dans le lobby');
  assert.equal(html.match(/id="end"/g).length, 1, 'un seul bilan dans la page');
  const rule = css.match(/#end\{([^}]*)\}/)[1];
  assert.doesNotMatch(rule, /position:fixed/, 'pas de calque sur toute la fenêtre');
  assert.match(rule, /position:absolute/);
  assert.match(css, /\.view\[data-view="session"\]\{[^}]*position:relative/, 'calque limité à la section Session');
});

test('valeurs inconnues ignorées', () => {
  assert.equal(pickTab('#nimportequoi', 'pasunonglet'), 'lobby');
  assert.equal(pickTab('#seed=12', 'four'), 'four');
});

test('lien d\'invitation à un groupe (#rejoindre=…) : ouvre le Lobby', () => {
  assert.equal(pickTab('#rejoindre=K7Q4P2', 'inventaire'), 'lobby');
});

test('onglet Historique : présent ; carte d\'une session = seed, date, part (ou « rien reçu » si parti)', async () => {
  const { TABS } = await import('../src/ui/nav.js');
  assert.ok(TABS.some(t => t.id === 'historique' && t.ready));
  const { sessionCard } = await import('../src/ui/history.js');
  const base = { seed:4242, startedAt:Date.UTC(2026, 9, 21, 12, 0), endedAt:Date.UTC(2026, 9, 21, 12, 30), players:['Zoe', 'Max'], areas:2, depth:120, xp:7 };
  const h = sessionCard({ ...base, left:false, bag:{ Charbon:12, Fer:3 } });
  assert.match(h, /4242/); assert.match(h, /30 min/); assert.match(h, /Zoe, Max/); assert.match(h, /12/); assert.match(h, /Charbon/);
  assert.match(sessionCard({ ...base, left:true, bag:{} }), /rien reçu/);
});

test('Jugement : plus un onglet de la barre, mais dans le Lobby (#jugement → Lobby) ; une touche par onglet', async () => {
  const { TAB_KEYS } = await import('../src/ui/nav.js');
  assert.ok(!TABS.some(t => t.id === 'jugement'));
  assert.equal(pickTab('#jugement', 'four'), 'lobby');
  assert.equal(pickTab('', 'jugement'), 'lobby', 'ancien onglet mémorisé');
  assert.ok(TABS.filter(t => t.ready).length <= TAB_KEYS.length, 'chaque onglet a sa touche');
});
