/* Option « Afficher les pseudos » (02/11/2026) : décochée, ni pseudo ni guilde au-dessus des mineurs ; le choix est gardé
   dans ce navigateur. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) } });
const { namesShown, setNamesShown } = await import('../src/render/names.js');
const { createMinerSprite } = await import('../src/render/miner-sprite.js');

/* faux contexte canvas : on ne retient que les textes écrits */
const fakeCtx = texts => new Proxy({}, { get: (o, k) => k === 'fillText' ? t => texts.push(t) : k in o ? o[k] : () => {}, set: (o, k, v) => (o[k] = v, true) });

test('pseudos affichés par défaut, cachés quand on décoche, choix gardé', () => {
  assert.equal(namesShown(), true);
  setNamesShown(false);
  assert.equal(namesShown(), false);
  assert.equal(localStorage.getItem('dim.showNames'), '0');
  setNamesShown(true);
  assert.equal(localStorage.getItem('dim.showNames'), '1');
});

test('le mineur : pseudo et guilde écrits, ou rien quand les pseudos sont cachés', () => {
  const texts = [], label = createMinerSprite(fakeCtx(texts), {}, 16).label;
  setNamesShown(true);
  label('Canoul', 0, 0, false, 'VI république');
  assert.deepEqual(texts, ['Canoul', '< VI république >']);
  texts.length = 0;
  setNamesShown(false);
  label('Canoul', 0, 0, false, 'VI république');
  assert.deepEqual(texts, []);
  setNamesShown(true);
});
