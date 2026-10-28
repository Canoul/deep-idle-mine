/* Couche appli (src/app/) : détection de l'appli (pont natif ou ?app), et rien du tout sur le site. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeStatus, isAppMode } from '../src/app/mode.js';
import { bootApp } from '../src/app/boot.js';

/* faux document : note les classes posées et les éléments ajoutés */
function fakeDoc(){
  const added = [], classes = [];
  return {
    added, classes,
    createElement: tag => ({ tag, id: '', textContent: '', style: {} }),
    body: { classList: { add: c => classes.push(c) }, append: el => added.push(el) },
  };
}
const web = search => ({ location: { search } });

test('appli : pont natif présent', () => {
  assert.equal(nativeStatus({ Capacitor: { isNativePlatform: () => true } }), 'ok');
});

test('appli : pont Android sans Capacitor = bloqué', () => {
  assert.equal(nativeStatus({ androidBridge: {} }), 'blocked');
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

test('appli : ?app dans un navigateur → classe app, pas de badge', () => {
  const doc = fakeDoc();
  assert.deepEqual(bootApp({ doc, win: web('?app') }), { status: 'web', app: true });
  assert.deepEqual(doc.classes, ['app']);
  assert.equal(doc.added.length, 0);
});

test('appli : pont ok → classe app et badge « APPLI ✓ »', () => {
  const doc = fakeDoc();
  bootApp({ doc, win: { ...web(''), Capacitor: { isNativePlatform: () => true } } });
  assert.deepEqual(doc.classes, ['app']);
  assert.equal(doc.added.length, 1);
  assert.equal(doc.added[0].id, 'appBadge');
  assert.equal(doc.added[0].textContent, 'APPLI ✓');
});

test('appli : pont bloqué → badge « APPLI ⚠ pont bloqué »', () => {
  const doc = fakeDoc();
  assert.deepEqual(bootApp({ doc, win: { ...web(''), androidBridge: {} } }), { status: 'blocked', app: true });
  assert.equal(doc.added[0].textContent, 'APPLI ⚠ pont bloqué');
});
