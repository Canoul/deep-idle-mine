/* Couche appli (src/app/) : détection de l'appli (pont natif ou ?app), et rien du tout sur le site. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeStatus, isAppMode } from '../src/app/mode.js';
import { readFileSync } from 'node:fs';
import { bootApp, dropApp } from '../src/app/boot.js';

/* faux document : note les classes posées et les éléments ajoutés */
function fakeDoc(){
  const added = [], classes = [], links = [], viewport = { content: 'width=device-width,initial-scale=1' };
  return {
    added, classes, links, viewport,
    createElement: tag => ({ tag, id: '', textContent: '', style: {} }),
    querySelector: sel => sel === 'meta[name="viewport"]' ? viewport : null,
    head: { append: el => links.push(el) },
    body: { classList: { add: c => classes.push(c) }, append: el => added.push(el) },
  };
}
const web = search => ({ location: { search } });
/* WebView de NOTRE appli : la coque ajoute sa marque à l'agent utilisateur (mobile/capacitor.config.json) */
const ourWebView = { navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) Chrome/140 Mobile DeepMineIdleApp' } };

test('appli : pont natif présent', () => {
  assert.equal(nativeStatus({ Capacitor: { isNativePlatform: () => true } }), 'ok');
});

test('appli : notre appli Android sans Capacitor = pont bloqué', () => {
  assert.equal(nativeStatus({ ...ourWebView, androidBridge: {} }), 'blocked');
});

test('appli : navigateur intégré d’une AUTRE appli (androidBridge sans notre marque) = le site', () => {
  assert.equal(nativeStatus({ androidBridge: {}, navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14; wv) Chrome/140' } }), 'web');
  assert.equal(nativeStatus({ androidBridge: {} }), 'web');
});

test('appli : navigateur', () => {
  assert.equal(nativeStatus({}), 'web');
  assert.equal(nativeStatus({ Capacitor: { isNativePlatform: () => false } }), 'web');
});

test('appli : ?app force la couche dans un navigateur, sinon rien', () => {
  assert.equal(isAppMode({ status: 'web', search: '?app' }), true);
  assert.equal(isAppMode({ status: 'web', search: '?app=1' }), true);
  assert.equal(isAppMode({ status: 'web', search: '' }), false);
  assert.equal(isAppMode({ status: 'web', search: '?seed=3' }), false);
  assert.equal(isAppMode({ status: 'ok', search: '' }), true);
  assert.equal(isAppMode({ status: 'blocked', search: '' }), true);
});

test('appli : site sans ?app → aucun appel au document', () => {
  const doc = new Proxy({}, { get(){ throw new Error('le site ne doit pas être touché'); } });
  assert.deepEqual(bootApp({ doc, win: web('') }), { status: 'web', app: false });
});

test('appli : ?app dans un navigateur → classe app, CSS de l’appli, écran bord à bord, pas de badge', () => {
  const doc = fakeDoc();
  assert.deepEqual(bootApp({ doc, win: web('?app') }), { status: 'web', app: true });
  assert.deepEqual(doc.classes, ['app']);
  assert.equal(doc.added.length, 0);
  assert.equal(doc.links.length, 1);
  assert.equal(doc.links[0].rel, 'stylesheet');
  assert.equal(doc.links[0].href, 'src/app/app.css');
  assert.equal(doc.viewport.content, 'width=device-width,initial-scale=1,viewport-fit=cover');
});

test('appli : pont ok → classe app, plus de badge', () => {
  const doc = fakeDoc();
  bootApp({ doc, win: { ...web(''), Capacitor: { isNativePlatform: () => true } } });
  assert.deepEqual(doc.classes, ['app']);
  assert.equal(doc.added.length, 0);
});

test('appli : pont bloqué → badge « APPLI ⚠ pont bloqué »', () => {
  const doc = fakeDoc();
  assert.deepEqual(bootApp({ doc, win: { ...web(''), ...ourWebView, androidBridge: {} } }), { status: 'blocked', app: true });
  assert.equal(doc.added[0].textContent, 'APPLI ⚠ pont bloqué');
});

test('appli : couche impossible à charger → retour à l’interface du site', () => {
  const removed = [];
  dropApp({ body: { classList: { remove: c => removed.push(c) } } });
  assert.deepEqual(removed, ['app']);
});

test('appli : le Carreau ne tourne pas dans l’appli (ni dessin ni appels au serveur)', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /town\.frame\(dtr, \{ show: !appBoot\.app &&/);
});

test('appli : pas de transition entre les onglets', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /if\(!appBoot\.app && backdrop\.switchTab\(/);
});

test('appli : Mon compte montre les réglages des notifications, transmis à la couche appli', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /appLayer\?\.notifOptions\(\) \?\? \[\]/);
  assert.match(main, /key\.startsWith\('notif_'\)\) appLayer\?\.setNotif\(key\.slice\(6\), v\)/);
  assert.match(main, /notifData: \(\) =>/);
});

test("appli : hors session, l'horloge se cale sur l'heure du serveur reçue avec les fours", () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /const syncClock = /);
  assert.match(main, /setClock\(st\.furnaces\?\.now\)/);
  assert.match(main, /setClock\(r\.furnaces\?\.now\)/);
});
