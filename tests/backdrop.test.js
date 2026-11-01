/* Fond de page : la session en cours derrière les onglets (src/ui/backdrop.js), option dans « Mon compte », transition
   avec l'onglet Session (la mine rétrécit linéairement jusqu'à sa place). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optionsHtml } from '../src/ui/account.js';

/* navigateur minimal : localStorage, fenêtre, et de faux canvas qui retiennent leur style */
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
globalThis.Image = class { set src(v){} };
globalThis.innerWidth = 1400; globalThis.innerHeight = 900;
const ctx = () => new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop(){} }), set: (t, k, v) => (t[k] = v, true) });
globalThis.document = { createElement: () => ({ hidden: false, style: {}, width: 300, height: 300, getContext: ctx }) };
const { createBackdrop, coverRect, lerpRect, BACKDROP, enterPanels, leavePanels } = await import('../src/ui/backdrop.js');

const box = () => { const cvs = []; return { hidden: true, cvs, appendChild: c => cvs.push(c) }; };
const fakeCv = (left, top, width, height) => ({ style: {}, getBoundingClientRect: () => ({ left, top, width, height }) });
const G = { mode: 'classic', miners: [] };
/* dessine une image ; le vrai dessin de la mine peut échouer (faux canvas) : seule la place nous intéresse */
const frame = (b, visible) => { try { b.draw(G, visible, 'me', null); } catch(e){} };
const px = v => Math.round(parseFloat(v));
const rectOf = cv => [cv.style.left, cv.style.top, cv.style.width, cv.style.height].map(px);

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
  b.draw(null, true); assert.equal(root.hidden, true);
  frame(b, false);    assert.equal(root.hidden, true, 'onglet Session : la mine y est déjà');
  b.set(false);
  frame(b, true);     assert.equal(root.hidden, true, 'option coupée');
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

test('plein écran : le canvas couvre la fenêtre, centré, proportions gardées ; interpolation linéaire', () => {
  assert.deepEqual(coverRect(100, 50, 1400, 900), { x: -200, y: 0, w: 1800, h: 900 });
  assert.deepEqual(coverRect(100, 100, 1400, 900), { x: 0, y: -250, w: 1400, h: 1400 });
  assert.deepEqual(lerpRect({ x: 0, y: 0, w: 100, h: 100 }, { x: 100, y: 50, w: 50, h: 50 }, 0.5), { x: 50, y: 25, w: 75, h: 75 });
});

test('mesure de la session : gardée dans le navigateur (position, taille, lignes, fenêtre) ; abîmée = ignorée', () => {
  store.clear();
  const b = createBackdrop(box());
  b.measure('mine', fakeCv(300.4, 80, 640, 720), 30);
  assert.deepEqual(JSON.parse(store.get('dim.bgPlace')).mine, { x:300, y:80, w:640, h:720, rows:30, vw:1400, vh:900 });
  b.measure('mine', fakeCv(0, 0, 0, 0), 30);                                  // onglet caché : rien relevé
  assert.equal(JSON.parse(store.get('dim.bgPlace')).mine.w, 640);
  b.measure('hack', fakeCv(0, 0, 10, 10), 1);
  assert.equal(JSON.parse(store.get('dim.bgPlace')).hack, undefined, 'mode inconnu ignoré');
  store.set('dim.bgPlace', '{"mine":{"x":"1","y":0,"w":640,"h":720,"rows":30,"vw":1400,"vh":900}}');
  assert.equal(createBackdrop(box()).switchTab('lobby', 'session', G), false, 'mesure abîmée : pas de transition');
  store.set('dim.bgPlace', 'pas du json');
  assert.equal(createBackdrop(box()).switchTab('lobby', 'session', G), false);
});

test('transition vers la session : plein écran → place de la session, linéaire ; la mine de la session est cachée puis rendue', () => {
  store.clear();
  let t = 1000;
  const sessCv = fakeCv(300, 80, 640, 720), root = box();
  const b = createBackdrop(root, { sessionCanvas: () => sessCv, now: () => t });
  b.measure('mine', sessCv, 30);
  frame(b, true);                                                             // autre onglet : plein écran, assombri
  const cv = root.cvs[0], cover = coverRect(cv.width, cv.height, innerWidth, innerHeight);
  assert.deepEqual(rectOf(cv), [cover.x, cover.y, cover.w, cover.h].map(Math.round));
  assert.match(cv.style.filter, new RegExp(`brightness\\(${BACKDROP.dim}\\)`));
  assert.equal(b.switchTab('lobby', 'session', G), true);
  assert.equal(sessCv.style.visibility, 'hidden', 'la vraie mine attend la fin du zoom');
  t += BACKDROP.transitionMs / 2; frame(b, false);
  assert.deepEqual(rectOf(cv), [lerpRect(cover, { x:300, y:80, w:640, h:720 }, 0.5)].map(r => [r.x, r.y, r.w, r.h].map(Math.round))[0], 'à mi-chemin');
  assert.equal(root.hidden, false, 'le fond reste visible pendant le zoom');
  t += BACKDROP.transitionMs; frame(b, false);
  assert.equal(root.hidden, true, 'fini : la vraie mine prend le relais');
  assert.equal(sessCv.style.visibility, '');
  assert.equal(b.animating, false);
});

test('transition depuis la session : place de la session → plein écran ; pas de transition entre deux autres onglets', () => {
  store.clear();
  let t = 0;
  const sessCv = fakeCv(300, 80, 640, 720), root = box();
  const b = createBackdrop(root, { sessionCanvas: () => sessCv, now: () => t });
  b.measure('mine', sessCv, 30);
  assert.equal(b.switchTab('session', 'stuff', G), true);
  frame(b, true);
  assert.deepEqual(rectOf(root.cvs[0]), [300, 80, 640, 720], 'départ : la place de la session');
  assert.equal(root.cvs[0].style.filter, '', 'pleine luminosité au départ');
  assert.equal(sessCv.style.visibility, 'hidden', 'la vraie mine reste cachée : le fond fait le zoom');
  t += BACKDROP.transitionMs; frame(b, true);
  assert.equal(sessCv.style.visibility, '', 'rendue à la fin');
  assert.equal(b.switchTab('stuff', 'craft', G), false);
  assert.equal(b.switchTab('lobby', 'session', null), false, 'pas de session : rien');
  b.set(false);
  assert.equal(b.switchTab('lobby', 'session', G), false, 'option coupée : rien');
});

/* fausse vue : classes, style, hidden */
function fakeView(){
  const cls = new Set();
  return { hidden: true, offsetWidth: 1, cls, style: { setProperty(){} },
           classList: { add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)) } };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

test('panneaux : sortie = l\'onglet Session reste affiché par-dessus, fixé à sa place, puis se cache ; revenu entre-temps, il reste', async () => {
  const saved = BACKDROP.transitionMs; BACKDROP.transitionMs = 20;
  try {
    const v = fakeView(), zone = { getBoundingClientRect: () => ({ left: 10, top: 60, width: 1200 }) };
    leavePanels(v, zone, () => false);
    assert.equal(v.hidden, false); assert.ok(v.cls.has('bgLeave'));
    assert.deepEqual([v.style.position, v.style.left, v.style.top, v.style.width], ['fixed', '10px', '60px', '1200px']);
    await sleep(40);
    assert.equal(v.hidden, true, 'caché à la fin'); assert.ok(!v.cls.has('bgLeave')); assert.equal(v.style.position, '');
    leavePanels(v, zone, () => true);
    enterPanels(v);                                                            // revenu sur Session pendant la sortie
    assert.ok(v.cls.has('bgEnter') && !v.cls.has('bgLeave'));
    await sleep(80);
    assert.equal(v.hidden, false, 'la sortie annulée ne le cache pas');
    assert.ok(!v.cls.has('bgEnter'));
  } finally { BACKDROP.transitionMs = saved; }
});
