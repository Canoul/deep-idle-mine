/* Pop-ups (src/ui/notify.js) : elles se ferment seules au bout de NOTIFY.popupMs et ne reviennent pas tant que le
   serveur envoie la même ; une nouvelle (autre clé) réapparaît. Faux DOM minimal, minuteries simulées. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTIFY, INSTANT_MINE as MI } from '../src/config.js';
import { noticeTtl } from '../src/ui/instant-lobby.js';

function fakeDom(){
  const root = { children: [], appendChild(c){ c.parent = this; this.children.push(c); } };
  globalThis.document = { createElement: () => {
    const cls = new Set();
    return { innerHTML: '', classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) },
             querySelector: () => ({ hidden: true }),
             remove(){ this.parent.children.splice(this.parent.children.indexOf(this), 1); } };
  } };
  return root;
}
const item = key => ({ key, icon: '', text: key, actions: [{ label: 'OK', run: async () => {} }] });

test('pop-up : se ferme seule au bout de popupMs, ne revient pas tant que le serveur l\'envoie', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const root = fakeDom();
  const { setupNotify } = await import('../src/ui/notify.js');
  const n = setupNotify(root);
  n.sync([item('p:A:1'), item('f:7')]);
  assert.equal(root.children.length, 2);
  t.mock.timers.tick(NOTIFY.popupMs - 1);
  assert.equal(root.children.length, 2, 'encore là juste avant');
  t.mock.timers.tick(1);
  assert.equal(root.children.length, 0, 'fermées toutes seules');
  n.sync([item('p:A:1'), item('f:7')]);
  assert.equal(root.children.length, 0, 'le serveur les envoie encore : elles ne reviennent pas');
  n.sync([item('p:A:2'), item('f:7')]);
  assert.equal(root.children.length, 1, 'invitation renouvelée (nouvelle heure) : elle réapparaît');
  n.sync([]); n.sync([item('f:7')]);
  assert.equal(root.children.length, 1, 'oubliée par le serveur puis renvoyée : elle réapparaît');
  delete globalThis.document;
});

test('pop-up : une action en cours repousse la fermeture', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const root = fakeDom();
  const { setupNotify } = await import('../src/ui/notify.js');
  const n = setupNotify(root, 1000);
  n.sync([item('lfg:1')]);
  root.children[0].classList.add('busy');
  t.mock.timers.tick(1000);
  assert.equal(root.children.length, 1, 'bouton cliqué, réponse pas encore arrivée : elle reste');
  root.children[0].classList.remove('busy');
  t.mock.timers.tick(1000);
  assert.equal(root.children.length, 0);
  delete globalThis.document;
});

test('rappel MI : se ferme au bout de noticeMs ; Rejoindre / Décliner jusqu\'à l\'ouverture de la mine', () => {
  assert.equal(noticeTtl(5 * 60, false), NOTIFY.noticeMs);
  assert.equal(noticeTtl(MI.inviteAt, true), MI.inviteAt * 1000);
});

test('pop-up flash : texte échappé, sans bouton, fermée au bout de flashMs, même si sync passe entre-temps', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const root = fakeDom();
  const { setupNotify } = await import('../src/ui/notify.js');
  const n = setupNotify(root);
  n.flash('Set « <b>x</b> » bien équipé');
  assert.match(root.children[0].innerHTML, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.doesNotMatch(root.children[0].innerHTML, /<button/);
  n.sync([]);
  assert.equal(root.children.length, 1, 'sync ne la retire pas');
  t.mock.timers.tick(NOTIFY.flashMs);
  assert.equal(root.children.length, 0);
  delete globalThis.document;
});

test('pop-up : une durée propre à une bulle (it.ttl, raffle 30 s) ; les autres gardent popupMs', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const root = fakeDom();
  const { setupNotify } = await import('../src/ui/notify.js');
  const { RAFFLE } = await import('../src/config.js');
  const n = setupNotify(root);
  n.sync([{ ...item('r:raffle:1'), ttl: RAFFLE.popupMs }, item('f:7')]);
  assert.equal(RAFFLE.popupMs, 30_000);
  t.mock.timers.tick(NOTIFY.popupMs);
  assert.equal(root.children.length, 1, 'la bulle du raffle reste après popupMs');
  t.mock.timers.tick(RAFFLE.popupMs - NOTIFY.popupMs);
  assert.equal(root.children.length, 0, 'fermée au bout de 30 s');
  n.sync([{ ...item('r:raffle:1'), ttl: RAFFLE.popupMs }]);
  assert.equal(root.children.length, 0, 'ne revient pas');
});
