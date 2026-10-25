/* Lobby : places affichées et bouton Lancer, depuis l'état du groupe envoyé par le serveur (logique pure). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lobbySlots, launchState, lfgState, alwaysReadyState } from '../src/ui/lobby.js';

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
  assert.equal(specLabel('logisticien', 3), '🪜 Logisticien (SP lvl : 3)', 'niveau de spécialisation entre parenthèses');
  assert.equal(specLabel(null, 3), 'Sans spécialisation');
  const solo = lobbySlots({ id:'A', displayId:'A', displayName:'Zoe' }, null, 3, 'barbare');
  assert.equal(solo[0].tree, 'barbare');
});

test('lobby : skin de chaque joueur ; le sien en direct, celui des autres vient du serveur (revérifié)', async () => {
  const { portraitLook } = await import('../src/ui/lobby.js');
  const mine = { casque:'Casque en chitine' };
  assert.deepEqual(portraitLook({ me:true, look:{} }, mine), mine, 'le sien : son stuff actuel');
  assert.deepEqual(portraitLook({ me:false, look:{ pioche:'Pioche en pierre' } }, mine), { pioche:'Pioche en pierre' });
  assert.deepEqual(portraitLook({ me:false, look:{ pioche:'Casque en chitine', bottes:'<img>' } }, mine), {}, 'pièce dans la mauvaise case, inconnue : ignorée');
  assert.deepEqual(portraitLook({ me:false }, mine), {}, 'serveur ancien (pas de look) : tenue de base');
});

test('pendant une session : Lancer impossible (« Session en cours »), même pour le chef', () => {
  assert.deepEqual(launchState({ account:me, party:null, session:{ id:'s1' } }), { can:false, label:'⛏ Session en cours' });
  const p = party([M('AAAA1111', 'Zoe'), M('BBBB2222', 'Max', { ready:true })]);
  assert.equal(launchState({ account:me, party:p, session:{ id:'s1' } }).can, false);
  assert.equal(launchState({ account:me, party:p, session:null }).can, true, 'session finie : on peut relancer');
});

test('« Où miner » : Mine choisie par défaut, Mine instantanée choisissable ; pendant une session, seule la MI reste choisissable', async () => {
  const { mineModes } = await import('../src/ui/lobby.js');
  const m = mineModes('mine');
  assert.deepEqual(m.map(x => [x.id, x.on, x.disabled, x.soon]), [['mine', true, false, false], ['mi', false, false, false]]);
  assert.deepEqual(mineModes('mi').map(x => x.on), [false, true]);
  const locked = mineModes('mine', true);
  assert.ok(locked.find(x => x.id === 'mine').disabled, 'lecture seule pendant la session');
  assert.equal(locked.find(x => x.id === 'mi').disabled, false, 'mais la mine instantanée reste choisissable (inscription en session, 22/10)');
});

test('« Où miner » : les tours du Jugement seulement quand elles sont ouvertes ; grisées si déjà faites', async () => {
  const { mineModes } = await import('../src/ui/lobby.js');
  const ids = j => mineModes('mine', false, j).map(m => m.id);
  assert.deepEqual(ids(null), ['mine', 'mi'], 'fermées : absentes');
  const j = { sides: { angel: { open: true, done: false }, demon: { open: false, done: false } } };
  assert.deepEqual(ids(j), ['mine', 'mi', 'tower_angel']);
  const done = mineModes('tower_angel', false, { sides: { angel: { open: true, done: true }, demon: { open: true, done: false } } });
  assert.equal(done.find(m => m.id === 'tower_angel').disabled, true);
  assert.equal(done.find(m => m.id === 'tower_demon').disabled, false);
});

test('recherche de groupe : bouton pour un solo ou le chef d\'un groupe de 2, mine classique seulement', () => {
  const two = party([M('AAAA1111', 'Zoe'), M('BBBB2222', 'Max')]);
  assert.deepEqual(lfgState({ account:me, party:null, mode:'mine' }), { show:true, searching:false });
  assert.equal(lfgState({ account:me, party:two, mode:'mine' }).show, true, 'chef d\'un groupe de 2');
  assert.equal(lfgState({ account:{ id:'BBBB2222' }, party:two, mode:'mine' }).show, false, 'membre : pas de bouton');
  assert.equal(lfgState({ account:me, party:party([M('AAAA1111', 'Zoe'), M('B', 'B'), M('C', 'C')]), mode:'mine' }).show, false, 'complet');
  assert.equal(lfgState({ account:me, party:null, mode:'mi' }).show, false, 'mine instantanée');
  assert.equal(lfgState({ account:me, party:null, mode:'tower_angel' }).show, false);
  assert.equal(lfgState({ account:me, party:null, mode:'mine', session:{ id:'x' } }).show, false);
  assert.equal(lfgState({ account:me, party:null, mode:'mine', offline:true }).show, false);
});

test('recherche en cours : celui qui l\'a lancée peut annuler, le membre voit seulement le timer', () => {
  const two = party([M('AAAA1111', 'Zoe'), M('BBBB2222', 'Max')]);
  assert.deepEqual(lfgState({ account:me, party:two, mode:'mine', lfg:{ search:{ mine:true, auto:true, waited:0 } } }),
                   { show:true, searching:true, cancel:true, auto:true });
  assert.equal(lfgState({ account:{ id:'BBBB2222' }, party:two, mode:'mine', lfg:{ search:{ mine:false, auto:false } } }).cancel, false);
});

test('« Prêt tout le temps » : seulement pour un membre (pas le chef, pas seul), cochée selon le serveur, aussi en session', () => {
  const p = party([M('AAAA1111', 'Zoe'), M('BBBB2222', 'Max', { ready:true, always:true })]);
  assert.deepEqual(alwaysReadyState({ account:{ id:'BBBB2222' }, party:p }), { show:true, checked:true });
  assert.deepEqual(alwaysReadyState({ account:{ id:'BBBB2222' }, party:p, session:{ id:'s1' } }), { show:true, checked:true });
  assert.equal(alwaysReadyState({ account:me, party:p }).show, false, 'le chef');
  assert.equal(alwaysReadyState({ account:me, party:null }).show, false, 'seul');
  assert.equal(alwaysReadyState({ account:{ id:'BBBB2222' }, party:p, offline:true }).show, false);
  const q = party([M('AAAA1111', 'Zoe'), M('BBBB2222', 'Max')]);
  assert.deepEqual(alwaysReadyState({ account:{ id:'BBBB2222' }, party:q }), { show:true, checked:false });
});

test('prêt tout le temps (23/10) : le bouton principal ne permet pas de l\'annuler (seule la case)', () => {
  const p = { leader:'AAAA1111', members:[{ account:'AAAA1111', name:'Zoe' }, { account:'BBBB2222', name:'Max', ready:true, always:true }] };
  assert.deepEqual(launchState({ account:{ id:'BBBB2222' }, party:p }), { can:false, label:'✔ Prêt tout le temps' });
});


test('Jugement (25/10) : jauges à gauche ET équipe à droite, comme pour la Mine ; sans Lancer ni préférences', async () => {
  const { lobbyCards } = await import('../src/ui/lobby.js');
  const j = lobbyCards({ view:'jugement', mode:'mine' });
  assert.deepEqual(j, { judgment:true, mi:false, team:true, launch:false, prefs:false, dev:false });
  const m = lobbyCards({ view:null, mode:'mine', dev:true });
  assert.deepEqual(m, { judgment:false, mi:false, team:true, launch:true, prefs:true, dev:true });
  const mi = lobbyCards({ view:null, mode:'mi' });
  assert.equal(mi.mi, true); assert.equal(mi.team, false);
});
