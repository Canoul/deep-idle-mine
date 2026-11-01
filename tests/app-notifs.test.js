/* Couche appli : calcul des notifications à programmer sur le téléphone (logique pure) et réglages par compte. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_NOTIFS, FURNACE } from '../src/config.js';
import { nextSlot } from '../src/shared/instant.js';
import { newFurnace, ingotMs } from '../src/meta/furnace.js';
import { planNotifs, furnaceEnd, NOTIF_KINDS, notifPrefs, setNotifPref, ALL_OFF } from '../src/app/notifs.js';

const NOW = Date.UTC(2026, 10, 2, 10, 30);   // 2 novembre, 11 h 30 à Paris
const ON = { all:true, session:true, mi:true, giant:true, four:true };
const midday = () => 12;
const plan = o => planNotifs({ now:NOW, offset:0, sessionEnd:null, furnaces:[], giantNext:null, prefs:ON, hourOf:midday, ...o });
const only = (list, kind) => list.filter(n => n.kind === kind);
const ore = Object.keys(FURNACE.recipes)[0], need = FURNACE.recipes[ore].ore ?? FURNACE.orePerIngot;
const running = (count, since = NOW) => ({ ...newFurnace(), ore:{ item:ore, qty:need * count }, fuel:{ item:'Charbon', qty:FURNACE.fuelPerIngot * count }, since });
const store = () => { const m = new Map(); return { getItem:k => m.get(k) ?? null, setItem:(k, v) => m.set(k, v) }; };

test('session : une notification à la fin, qui ouvre Session', () => {
  const [n] = only(plan({ sessionEnd:NOW + 60e3 }), 'session');
  assert.equal(n.at, NOW + 60e3);
  assert.equal(n.tab, 'session');
  assert.equal(n.title, 'Session terminée');
});

test('session : aucune si elle est finie ou absente', () => {
  assert.equal(only(plan({ sessionEnd:NOW - 1 }), 'session').length, 0);
  assert.equal(only(plan({ sessionEnd:null }), 'session').length, 0);
});

test('four : à la fin du dernier four en marche, pas une par four', () => {
  const a = running(2), b = running(5), dur = ingotMs(a);
  assert.equal(furnaceEnd([a, b], NOW), NOW + 5 * dur);
  const list = only(plan({ furnaces:[a, b] }), 'four');
  assert.equal(list.length, 1);
  assert.equal(list[0].at, NOW + 5 * dur);
  assert.equal(list[0].tab, 'four');
});

test('four : une fournée déjà faite depuis le dernier passage du serveur ne décale pas la fin', () => {
  const dur = ingotMs(running(1));
  assert.equal(furnaceEnd([running(3, NOW - dur)], NOW), NOW + 2 * dur);
});

test('four : aucune si tout est à l\'arrêt', () => {
  assert.equal(furnaceEnd([newFurnace()], NOW), null);
  assert.equal(furnaceEnd([running(1, NOW - 1e12)], NOW), null);
  assert.equal(furnaceEnd(undefined, NOW), null);
  assert.equal(only(plan({ furnaces:[newFurnace()] }), 'four').length, 0);
});

test('Bloc géant : à nextEntry, aucune s\'il est déjà accessible', () => {
  const [n] = only(plan({ giantNext:NOW + 3600e3 }), 'giant');
  assert.equal(n.at, NOW + 3600e3);
  assert.equal(n.tab, 'lobby');
  assert.equal(only(plan({ giantNext:NOW - 1 }), 'giant').length, 0);
  assert.equal(only(plan({ giantNext:0 }), 'giant').length, 0);
});

test('mine instantanée : 5 min avant, pour les 24 prochains créneaux', () => {
  const list = only(plan({}), 'mi');
  assert.equal(list.length, APP_NOTIFS.miAhead);
  assert.equal(list[0].at, nextSlot(NOW) - 300e3);
  assert.equal(list[1].at, nextSlot(nextSlot(NOW)) - 300e3);
  assert.equal(list[0].tab, 'lobby');
});

test('mine instantanée : un créneau déjà dans les 5 min n\'est pas programmé dans le passé', () => {
  const late = nextSlot(NOW) - 60e3, list = only(plan({ now:late }), 'mi');
  assert.ok(list.every(n => n.at > late));
  assert.equal(list[0].at, nextSlot(nextSlot(NOW)) - 300e3);
});

test('mine instantanée : rien de 23 h à 8 h, heure du téléphone', () => {
  for(const h of [23, 0, 3, 7]) assert.equal(only(plan({ hourOf:() => h }), 'mi').length, 0, `${h} h`);
});

test('mine instantanée : les bornes, 22 h 59 gardée, 8 h gardée', () => {
  for(const h of [22, 8]) assert.equal(only(plan({ hourOf:() => h }), 'mi').length, APP_NOTIFS.miAhead, `${h} h`);
});

test('type coupé dans les réglages : aucune notification de ce type', () => {
  const o = { sessionEnd:NOW + 1e3, giantNext:NOW + 1e3, furnaces:[running(1)] };
  for(const { id } of NOTIF_KINDS){
    const list = plan({ ...o, prefs:{ ...ON, [id]:false } });
    assert.equal(only(list, id).length, 0, id);
    assert.ok(list.length > 0, id);
  }
});

test('tout couper : aucune notification, même si chaque type reste coché', () => {
  assert.deepEqual(plan({ sessionEnd:NOW + 1e3, giantNext:NOW + 1e3, furnaces:[running(1)], prefs:{ ...ON, all:false } }), []);
});

test('décalage d\'horloge : at = heure serveur - offset, et rien dans le passé', () => {
  const offset = 120e3;
  assert.equal(only(plan({ sessionEnd:NOW + 300e3, offset }), 'session')[0].at, NOW + 300e3 - offset);
  assert.equal(only(plan({ sessionEnd:NOW + 60e3, offset:-300e3 }), 'session')[0].at, NOW + 360e3);
  assert.equal(only(plan({ sessionEnd:NOW - 1, offset:-300e3 }), 'session').length, 0, 'finie côté serveur, même si le téléphone est en retard');
});

test('identifiants uniques, entiers, et stables quand un créneau passe', () => {
  const list = plan({ sessionEnd:NOW + 1e3, giantNext:NOW + 1e3, furnaces:[running(1)] });
  assert.equal(new Set(list.map(n => n.id)).size, list.length);
  assert.ok(list.every(n => Number.isSafeInteger(n.id) && n.id > 0 && n.id < 2 ** 31));
  const later = only(plan({ now:nextSlot(NOW) + 1 }), 'mi'), before = only(plan({}), 'mi');
  assert.equal(later[0].id, before[1].id);
});

test('réglages : tout activé par défaut', () => {
  assert.deepEqual(notifPrefs(store(), 'a1'), ON);
});

test('réglages : un type coupé reste coupé pour ce compte, pas pour un autre', () => {
  const s = store();
  setNotifPref(s, 'a1', 'mi', false);
  assert.equal(notifPrefs(s, 'a1').mi, false);
  assert.equal(notifPrefs(s, 'a1').four, true);
  assert.equal(notifPrefs(s, 'a2').mi, true);
});

test('réglages : l\'interrupteur général est gardé à part des types', () => {
  const s = store();
  setNotifPref(s, 'a1', 'mi', false);
  setNotifPref(s, 'a1', 'all', false);
  setNotifPref(s, 'a1', 'all', true);
  assert.equal(notifPrefs(s, 'a1').mi, false, 'tout rallumer ne rallume pas un type coupé à la main');
});

test('compte absent : prefs toutes fausses, donc aucune notification', () => {
  assert.deepEqual(notifPrefs(store(), null), ALL_OFF);
  assert.deepEqual(plan({ sessionEnd:NOW + 1e3, prefs:notifPrefs(store(), null) }), []);
});

test('réglages : stockage indisponible ou abîmé, clé inconnue refusée', () => {
  const broken = { getItem(){ throw new Error('non'); }, setItem(){ throw new Error('non'); } };
  assert.deepEqual(notifPrefs(broken, 'a1'), ON);
  setNotifPref(broken, 'a1', 'mi', false);
  const s = store();
  s.setItem('deepIdleMine.appNotifs.a1', '{pas du json');
  assert.deepEqual(notifPrefs(s, 'a1'), ON);
  setNotifPref(s, 'a1', 'pirate', false);
  assert.equal(notifPrefs(s, 'a1').pirate, undefined);
});
