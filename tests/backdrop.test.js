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

/* même place et même échelle qu'en session (28/10) : la mesure de l'onglet Session est gardée avec la taille de la fenêtre */
const fakeCv = (left, top, width, height) => ({ getBoundingClientRect: () => ({ left, top, width, height }) });
/* fond « dessiné » sans vrai canvas : un faux élément qui retient sa classe et son style */
function drawRoot(){
  const cvs = [];
  const root = { hidden: true, cvs, appendChild: c => cvs.push(c) };
  globalThis.document = { createElement: () => { const c = { hidden: false, style: {}, classes: new Set(), width: 300, height: 300,
    getContext: () => new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop(){} }), set: (t, k, v) => (t[k] = v, true) }) };
    c.classList = { toggle: (n, v) => v ? c.classes.add(n) : c.classes.delete(n) }; return c; } };
  return root;
}

test('mesure de la session : gardée dans le navigateur (position, taille, lignes, fenêtre)', () => {
  store.clear(); globalThis.innerWidth = 1400; globalThis.innerHeight = 900;
  const b = createBackdrop(box());
  b.measure('mine', fakeCv(300.4, 80, 640, 720), 30);
  assert.deepEqual(JSON.parse(store.get('dim.bgPlace')).mine, { x:300, y:80, w:640, h:720, rows:30, vw:1400, vh:900 });
  b.measure('mine', fakeCv(0, 0, 0, 0), 30);                                  // onglet caché : rien relevé
  assert.equal(JSON.parse(store.get('dim.bgPlace')).mine.w, 640);
  b.measure('hack', fakeCv(0, 0, 10, 10), 1);
  assert.equal(JSON.parse(store.get('dim.bgPlace')).hack, undefined, 'mode inconnu ignoré');
});

test('le fond reprend la place mesurée ; autre taille de fenêtre ou mesure abîmée : il couvre l\'écran', async () => {
  globalThis.Image = class { set src(v){} };
  store.clear(); globalThis.innerWidth = 1400; globalThis.innerHeight = 900;
  const G = { mode:'classic', miners:[], world:null };
  const placed = () => { const root = drawRoot(), b = createBackdrop(root); try { b.draw(G, true, 'me', null); } catch(e){} return root.cvs[0]; };
  createBackdrop(box()).measure('mine', fakeCv(300, 80, 640, 720), 30);
  let cv = placed();
  assert.deepEqual([cv.style.left, cv.style.top, cv.style.width, cv.style.height], ['300px', '80px', '640px', '720px']);
  assert.ok(!cv.classes.has('cover'));
  globalThis.innerWidth = 1000;                                               // fenêtre redimensionnée : mesure périmée
  assert.ok(placed().classes.has('cover'));
  globalThis.innerWidth = 1400;
  store.set('dim.bgPlace', '{"mine":{"x":"1","y":0,"w":640,"h":720,"rows":30,"vw":1400,"vh":900}}');   // abîmée
  assert.ok(placed().classes.has('cover'));
  store.set('dim.bgPlace', 'pas du json');
  assert.ok(placed().classes.has('cover'));
});
