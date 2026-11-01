/* Couche appli : programmation sur le téléphone, avec un faux plugin. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { notifPlugin, askPermission, clearPending, syncNotifs, onNotifTap, startNotifs } from '../src/app/native.js';

const FUTURE = Date.now() + 3600e3;
const note = (id, at = FUTURE) => ({ id, kind:'four', at, title:'T', body:'B', tab:'four' });
const store = () => { const m = new Map(); return { getItem:k => m.get(k) ?? null, setItem:(k, v) => m.set(k, v) }; };

function fakePlugin({ display = 'granted', answer = 'granted', pending = [] } = {}){
  const p = { calls:[], display, pending, fail:null, tap:null };
  const call = (name, v) => { p.calls.push([name, v]); if(p.fail === name) return Promise.reject(new Error('plugin')); return Promise.resolve(); };
  p.checkPermissions = async () => { p.calls.push(['check']); return { display:p.display }; };
  p.requestPermissions = async () => { p.calls.push(['request']); p.display = answer; return { display:answer }; };
  p.schedule = v => call('schedule', v);
  p.cancel = v => call('cancel', v);
  p.getPending = async () => ({ notifications:p.pending });
  p.addListener = (name, fn) => { p.tap = { name, fn }; };
  p.named = name => p.calls.filter(c => c[0] === name);
  return p;
}

test('sans plugin : null, aucune erreur', () => {
  assert.equal(notifPlugin({}), null);
  assert.equal(notifPlugin({ Capacitor:{ Plugins:{} } }), null);
  const p = fakePlugin();
  assert.equal(notifPlugin({ Capacitor:{ Plugins:{ LocalNotifications:p } } }), p);
});

test('autorisation accordée : vrai, et une seule demande', async () => {
  const p = fakePlugin({ display:'prompt' }), s = store();
  assert.equal(await askPermission(p, s), true);
  assert.equal(await askPermission(p, s), true);
  assert.equal(p.named('request').length, 1);
});

test('autorisation refusée : faux, pas de nouvelle demande à l\'ouverture suivante', async () => {
  const p = fakePlugin({ display:'prompt', answer:'denied' }), s = store();
  assert.equal(await askPermission(p, s), false);
  p.display = 'prompt';
  assert.equal(await askPermission(p, s), false);
  assert.equal(p.named('request').length, 1);
});

test('autorisation : le joueur qui recoche une option peut redemander', async () => {
  const p = fakePlugin({ display:'prompt', answer:'denied' }), s = store();
  await askPermission(p, s);
  await askPermission(p, s, { force:true });
  assert.equal(p.named('request').length, 2);
});

test('stockage indisponible : aucune erreur', async () => {
  const broken = { getItem(){ throw new Error('non'); }, setItem(){ throw new Error('non'); } };
  assert.equal(await askPermission(fakePlugin({ display:'prompt' }), broken), true);
});

test('plugin en erreur pendant la demande : faux, pas de crash', async () => {
  const p = fakePlugin({ display:'prompt' });
  p.requestPermissions = async () => { throw new Error('plugin'); };
  assert.equal(await askPermission(p, store()), false);
});

test('nouvelle notification programmée avec allowWhileIdle, sans alarme exacte', async () => {
  const p = fakePlugin(), prev = await syncNotifs(p, [note(2)], new Map());
  const [n] = p.named('schedule')[0][1].notifications;
  assert.equal(n.id, 2);
  assert.equal(n.schedule.at.getTime(), FUTURE);
  assert.equal(n.schedule.allowWhileIdle, true);
  assert.equal(n.isExactNotification, false, 'sinon Android ouvre l\'écran des alarmes à chaque programmation');
  assert.equal(n.extra.tab, 'four');
  assert.equal(prev.get(2), FUTURE);
});

test('session quittée : notification annulée', async () => {
  const p = fakePlugin(), prev = await syncNotifs(p, [], new Map([[1, FUTURE]]));
  assert.deepEqual(p.named('cancel')[0][1], { notifications:[{ id:1 }] });
  assert.equal(p.named('schedule').length, 0);
  assert.equal(prev.size, 0);
});

test('heure changée : annulée puis reprogrammée', async () => {
  const p = fakePlugin();
  await syncNotifs(p, [note(1, FUTURE + 1000)], new Map([[1, FUTURE]]));
  assert.deepEqual(p.calls.map(c => c[0]), ['cancel', 'schedule']);
});

test('rien de changé : aucun appel', async () => {
  const p = fakePlugin();
  await syncNotifs(p, [note(1)], new Map([[1, FUTURE]]));
  assert.deepEqual(p.calls, []);
});

test('heure passée sur le téléphone : jamais programmée (elle sonnerait tout de suite)', async () => {
  const p = fakePlugin();
  await syncNotifs(p, [note(1, Date.now() - 1000)], new Map());
  assert.equal(p.named('schedule').length, 0);
});

test('erreur du plugin : pas de crash, l\'état précédent reste', async () => {
  const p = fakePlugin(); p.fail = 'cancel';
  const prev = new Map([[1, FUTURE]]);
  assert.deepEqual(await syncNotifs(p, [], prev), prev);
  const q = fakePlugin(); q.fail = 'schedule';
  assert.equal((await syncNotifs(q, [note(2)], new Map())).has(2), false, 'sera retentée');
});

test('annulée mais pas reprogrammée : la prochaine synchro la reprogramme', async () => {
  const p = fakePlugin(); p.fail = 'schedule';
  const prev = await syncNotifs(p, [note(1, FUTURE + 1000)], new Map([[1, FUTURE]]));
  assert.equal(prev.has(1), false);
});

test('ouverture de l\'appli : les notifications restées programmées sont retirées', async () => {
  const p = fakePlugin({ pending:[{ id:1 }, { id:1040 }] });
  await clearPending(p);
  assert.deepEqual(p.named('cancel')[0][1], { notifications:[{ id:1 }, { id:1040 }] });
  const q = fakePlugin(); await clearPending(q);
  assert.equal(q.named('cancel').length, 0);
});

test('toucher : ouvre l\'onglet de la notification', () => {
  const p = fakePlugin(), tabs = [];
  onNotifTap(p, t => tabs.push(t));
  assert.equal(p.tap.name, 'localNotificationActionPerformed');
  p.tap.fn({ notification:{ extra:{ tab:'four' } } });
  p.tap.fn({ notification:{} });
  assert.deepEqual(tabs, ['four']);
});

/* ---------- assemblage ---------- */

const NOW = Date.now();
function run(p, over = {}){
  const d = { now:NOW, offset:0, sessionEnd:NOW + 600e3, furnaces:[], giantNext:null, account:'a1', ...over };
  const win = { Capacitor:{ Plugins:{ LocalNotifications:p } }, localStorage:store(), setInterval(fn){ win.tick = fn; }, addEventListener(){} };
  const doc = { addEventListener(n, fn){ win.visible = fn; } };
  return { d, win, app:startNotifs({ win, doc, data:() => d, open:() => {} }) };
}
const settle = () => new Promise(r => setTimeout(r, 5));
const scheduledIds = p => p.named('schedule').flatMap(c => c[1].notifications.map(n => n.id));

test('ancienne appli sans plugin : pas de réglage, aucune erreur', async () => {
  const app = startNotifs({ win:{ setInterval(){} }, doc:{ addEventListener(){} }, data:() => ({}), open(){} });
  assert.deepEqual(app.options(), []);
  app.set('mi', false); await app.refresh();
});

test('autorisation refusée : rien n\'est programmé (schedule redemanderait l\'autorisation)', async () => {
  const p = fakePlugin({ display:'prompt', answer:'denied' });
  const { app } = run(p); await app.refresh();
  assert.equal(p.named('schedule').length, 0);
});

test('compte changé ou déconnecté : les notifications du compte précédent disparaissent', async () => {
  const p = fakePlugin(), { d, app } = run(p);
  await app.refresh();
  assert.ok(scheduledIds(p).includes(1));
  d.account = null; p.calls.length = 0;
  await app.refresh();
  assert.ok(p.named('cancel')[0][1].notifications.some(n => n.id === 1));
  assert.deepEqual(app.options(), []);
});

test('réglages : un interrupteur général et un par type ; tout couper annule', async () => {
  const p = fakePlugin(), { app } = run(p);
  await app.refresh();
  assert.deepEqual(app.options().map(o => o.key), ['notif_all', 'notif_session', 'notif_mi', 'notif_giant', 'notif_four']);
  assert.ok(app.options().every(o => o.on));
  p.calls.length = 0;
  app.set('all', false); await settle();
  assert.ok(p.named('cancel')[0][1].notifications.some(n => n.id === 1));
  assert.equal(app.options()[0].on, false);
});

test('rallumer une option redemande l\'autorisation si elle manque', async () => {
  const p = fakePlugin({ display:'prompt', answer:'denied' }), { app } = run(p);
  await app.refresh();
  app.set('mi', true); await settle();
  assert.equal(p.named('request').length, 2);
});

test('retour dans l\'appli : recalcul, sans deux calculs en même temps', async () => {
  const p = fakePlugin(), { d, win, app } = run(p);
  await app.refresh(); p.calls.length = 0;
  d.sessionEnd += 60e3;
  win.visible(); win.visible(); await settle();
  assert.equal(p.named('schedule').length, 1);
});

test('session lancée puis synchro à la minute : même programmation, aucun appel', async () => {
  const p = fakePlugin(), { win, app } = run(p);
  await app.refresh(); p.calls.length = 0;
  await win.tick(); await settle();
  assert.equal(p.named('schedule').length + p.named('cancel').length, 0);
});
