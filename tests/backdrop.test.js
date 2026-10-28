/* Fond de page : la session en cours derrière les onglets (src/ui/backdrop.js), option dans « Mon compte ». */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optionsHtml } from '../src/ui/account.js';

/* navigateur minimal : localStorage et une boîte de fond (aucun canvas créé tant qu'il n'y a rien à dessiner) */
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
const { createBackdrop } = await import('../src/ui/backdrop.js');
const box = () => ({ hidden: true, appendChild(){ throw new Error('aucun canvas attendu'); } });

test('option activée par défaut ; désactivée, elle est gardée dans ce navigateur', () => {
  store.clear();
  assert.equal(createBackdrop(box()).on, true);
  createBackdrop(box()).set(false);
  assert.equal(store.get('dim.bgSession'), '0');
  assert.equal(createBackdrop(box()).on, false, 'relue au rechargement');
  createBackdrop(box()).set(true);
  assert.equal(createBackdrop(box()).on, true);
});

test('rien en fond sans session, sur l\'onglet Session, ou option coupée', () => {
  store.clear();
  const root = box(), b = createBackdrop(root);
  const G = { mode: 'classic', miners: [] };
  b.draw(null, true); assert.equal(root.hidden, true);
  b.draw(G, false);   assert.equal(root.hidden, true, 'onglet Session : la mine y est déjà');
  b.set(false);
  b.draw(G, true);    assert.equal(root.hidden, true, 'option coupée');
});

test('stockage du navigateur bloqué : l\'option marche quand même (activée)', () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem(){ throw new Error('bloqué'); }, setItem(){ throw new Error('bloqué'); } };
  try { const b = createBackdrop(box()); assert.equal(b.on, true); b.set(false); assert.equal(b.on, false); }
  finally { globalThis.localStorage = saved; }
});

test('« Mon compte » : une case par option, cochée selon son état ; rien sans option', () => {
  assert.equal(optionsHtml([]), '');
  const html = optionsHtml([{ key: 'bgSession', label: 'Session en cours en fond d\'écran', on: true }, { key: 'x', label: '<b>', on: false }]);
  assert.match(html, /<h4>Options<\/h4>/);
  assert.match(html, /data-opt="bgSession" checked/);
  assert.match(html, /data-opt="x">/);
  assert.ok(!html.includes('<b>'), 'texte échappé');
});
