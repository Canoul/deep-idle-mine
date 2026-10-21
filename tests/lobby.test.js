/* Lobby : places affichées et bouton Lancer, depuis l'état du groupe envoyé par le serveur (logique pure). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lobbySlots, launchState } from '../src/ui/lobby.js';

const me = { id:'AAAA1111', displayId:'AAAA-1111', displayName:'Zoe' };
const party = (members, extra = {}) => ({ code:'K7Q4P2', leader:members[0].account, members, invited:[], ...extra });
const M = (account, name, more = {}) => ({ account, displayId:account, name, ...more });

test('seul : soi puis deux places libres', () => {
  assert.deepEqual(lobbySlots(me, null).map(s => s.kind), ['member', 'free', 'free']);
  assert.equal(lobbySlots(me, null)[0].me, true);
});

test('en groupe : membres, puis invités en attente, puis places libres (3 places au total)', () => {
  const p = party([M('AAAA1111', 'Zoe', { me:true, leader:true }), M('BBBB2222', 'Max')], { invited:[M('CCCC3333', 'Lou'), M('DDDD4444', 'Kim')] });
  assert.deepEqual(lobbySlots(me, p).map(s => [s.kind, s.name]), [['member', 'Zoe'], ['member', 'Max'], ['invited', 'Lou']]);
  assert.deepEqual(lobbySlots(me, party([M('AAAA1111', 'Zoe')])).map(s => s.kind), ['member', 'free', 'free']);
});

test('Lancer : seul ou chef → oui (« Lancer à 2 ») si les autres sont prêts ; membre → se dire prêt ; hors ligne → non', () => {
  assert.deepEqual(launchState({ account:me, party:null }), { can:true, label:'▶ Lancer la session' });
  const p = party([M('AAAA1111', 'Zoe'), M('BBBB2222', 'Max', { ready:true })]);
  assert.deepEqual(launchState({ account:me, party:p }), { can:true, label:'▶ Lancer à 2' });
  assert.deepEqual(launchState({ account:{ id:'BBBB2222' }, party:p }), { can:true, label:'✔ Prêt (annuler)', action:'ready', ready:false });
  const q = party([M('AAAA1111', 'Zoe'), M('BBBB2222', 'Max'), M('CCCC3333', 'Lou', { ready:true })]);
  assert.deepEqual(launchState({ account:me, party:q }), { can:false, label:'⏳ Pas prêt : Max' }, 'le chef attend Max');
  assert.deepEqual(launchState({ account:{ id:'BBBB2222' }, party:q }), { can:true, label:'✋ Je suis prêt', action:'ready', ready:true });
  assert.equal(launchState({ account:me, party:{ ...p, launching:true } }).can, false);
  assert.equal(launchState({ account:me, party:null, offline:true }).can, false);
  assert.equal(launchState({ account:me, party:null, busy:true }).label, '… Lancement');
});

test('lancer : un membre encore dans la session précédente → le chef attend la fin', () => {
  const account = { id:'AAAA1111' };
  const party = { leader:'AAAA1111', members:[{ account:'AAAA1111', me:true }, { account:'BBBB2222', playing:true, ready:true }] };
  assert.deepEqual(launchState({ account, party }), { can:false, label:'⏳ Le groupe finit sa session…' });
  party.members[1].playing = false;
  assert.equal(launchState({ account, party }).can, true);
});

test('lobby : spécialisation de chaque joueur (arbre de skills), « Sans spécialisation » sinon', async () => {
  const { specLabel, lobbySlots } = await import('../src/ui/lobby.js');
  assert.equal(specLabel('logisticien'), '🪜 Logisticien');
  assert.equal(specLabel('mineur'), '⛏ Mineur');
  assert.equal(specLabel('barbare'), '🪓 Barbare');
  assert.equal(specLabel(null), 'Sans spécialisation');
  const solo = lobbySlots({ id:'A', displayId:'A', displayName:'Zoe' }, null, 3, 'barbare');
  assert.equal(solo[0].tree, 'barbare');
});
