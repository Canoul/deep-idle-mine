import fs from 'node:fs';
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

test('« Où miner » : Mine choisie par défaut, Mine instantanée choisissable ; pendant une session, seuls la MI et le Bloc géant restent choisissables', async () => {
  const { mineModes } = await import('../src/ui/lobby.js');
  const m = mineModes('mine');
  assert.deepEqual(m.map(x => [x.id, x.on, x.disabled, x.soon]), [['prison', false, false, false], ['mine', true, false, false], ['mi', false, false, false], ['instance_1', false, false, false], ['giant', false, false, false]]);
  assert.deepEqual(mineModes('mi').map(x => x.on), [false, false, true, false, false]);
  const ins = mineModes('instance_1').find(x => x.id === 'instance_1');
  assert.equal(ins.label, '🗝 Instances', 'un seul bouton pour toutes les instances (27/10)'); assert.equal(ins.on, true);
  const locked = mineModes('mine', true);
  assert.ok(locked.find(x => x.id === 'mine').disabled, 'lecture seule pendant la session');
  assert.equal(locked.find(x => x.id === 'mi').disabled, false, 'mais la mine instantanée reste choisissable (inscription en session, 22/10)');
  assert.equal(locked.find(x => x.id === 'giant').disabled, false, 'Bloc géant : on regarde sa carte en session (Entrer y est grisé, 26/10)');
  assert.equal(locked.find(x => x.id === 'instance_1').disabled, false, 'instances : on regarde la carte en session (27/10 ; Lancer reste grisé)');
  assert.equal(locked.find(x => x.id === 'prison').disabled, true, 'prison : pas pendant une session');
});

test('« Où miner » : les tours du Jugement seulement quand elles sont ouvertes ; grisées si déjà faites', async () => {
  const { mineModes } = await import('../src/ui/lobby.js');
  const ids = j => mineModes('mine', false, j).map(m => m.id);
  assert.deepEqual(ids(null), ['prison', 'mine', 'mi', 'instance_1', 'giant'], 'fermées : absentes (prison en premier, 30/10)');
  const j = { sides: { angel: { open: true, done: false }, demon: { open: false, done: false } } };
  assert.deepEqual(ids(j), ['prison', 'mine', 'mi', 'instance_1', 'giant', 'tower_angel']);
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

test('« Prêt tout le temps » (31/10) : visible partout pour un compte connecté, seul, chef ou en prison, cochée selon le serveur', () => {
  assert.deepEqual(alwaysReadyState({ account:me, alwaysReady:true }), { show:true, checked:true });
  assert.deepEqual(alwaysReadyState({ account:me, alwaysReady:false }), { show:true, checked:false });
  assert.deepEqual(alwaysReadyState({ account:me }), { show:true, checked:false });
  assert.equal(alwaysReadyState({ account:me, alwaysReady:true, offline:true }).show, false);
  assert.equal(alwaysReadyState({ account:null, alwaysReady:true }).show, false);
});

test('prêt tout le temps (23/10) : le bouton principal ne permet pas de l\'annuler (seule la case)', () => {
  const p = { leader:'AAAA1111', members:[{ account:'AAAA1111', name:'Zoe' }, { account:'BBBB2222', name:'Max', ready:true, always:true }] };
  assert.deepEqual(launchState({ account:{ id:'BBBB2222' }, party:p }), { can:true, label:'✔ Prêt (annuler)', action:'ready', ready:false });
});


test('Jugement (25/10) : jauges à gauche ET équipe à droite, comme pour la Mine ; sans Lancer ni préférences', async () => {
  const { lobbyCards } = await import('../src/ui/lobby.js');
  const j = lobbyCards({ view:'jugement', mode:'mine' });
  assert.deepEqual(j, { judgment:true, mi:false, giant:false, inst:false, prison:false, team:true, launch:false, prefs:false, dev:false });
  const m = lobbyCards({ view:null, mode:'mine', dev:true });
  assert.deepEqual(m, { judgment:false, mi:false, giant:false, inst:false, prison:false, team:true, launch:true, prefs:true, dev:true });
  const g = lobbyCards({ view:null, mode:'giant', dev:true });
  assert.deepEqual(g, { judgment:false, mi:false, giant:true, inst:false, prison:false, team:false, launch:false, prefs:false, dev:false }, 'Bloc géant : sa carte seule (26/10)');
  const i = lobbyCards({ view:null, mode:'instance_1', dev:true });
  assert.deepEqual(i, { judgment:false, mi:false, giant:false, inst:true, prison:false, team:true, launch:true, prefs:false, dev:true }, 'instance : sa carte, l\'équipe et Lancer (27/10)');
  const mi = lobbyCards({ view:null, mode:'mi' });
  assert.equal(mi.mi, true); assert.equal(mi.team, false);
  const pr = lobbyCards({ view:null, mode:'prison', dev:true });
  assert.deepEqual(pr, { judgment:false, mi:false, giant:false, inst:false, prison:true, team:true, launch:true, prefs:true, dev:false }, 'prison : soi, Lancer, préférences ; pas de réglages dev (29/10)');
});

test('chef (25/10) : il peut nommer un autre chef même pendant une session ; retirer, seulement hors session', async () => {
  const { slotButtons } = await import('../src/ui/lobby.js');
  const party = { leader:'AAAA1111' }, account = { id:'AAAA1111' }, other = { kind:'member' }, me = { kind:'member', me:true };
  assert.deepEqual(slotButtons({ account, party, session:{ id:'s1' } }, other), { promote:true, kick:false });
  assert.deepEqual(slotButtons({ account, party, session:null }, other), { promote:true, kick:true });
  assert.deepEqual(slotButtons({ account, party, session:null }, me), { promote:false, kick:false });
  assert.deepEqual(slotButtons({ account, party, session:null }, { kind:'invited' }), { promote:false, kick:true });
  assert.deepEqual(slotButtons({ account:{ id:'BBBB2222' }, party, session:null }, other), { promote:false, kick:false }, 'pas chef');
});

test('démarrage : le lobby reçoit le compte tout de suite, même si la page s\'ouvre pendant une session (27/10)', async () => {
  /* bug : page ouverte pendant une session → le lobby restait sans compte après la fin (Lancer et Inviter grisés tant
     que le bilan n'était pas fermé). main.js n'est pas testable sans navigateur : on vérifie l'ordre dans le source. */
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const boot = src.indexOf('Object.assign(acct, await bootAccount'), give = src.indexOf('lobby.update({ account:acct.account, offline:acct.offline })', boot);
  assert.ok(boot > 0 && give > boot && give < src.indexOf('await refresh()', boot));
});

test('chef, tout le monde prêt (dont « prêt tout le temps » absent) : on peut lancer', () => {
  const p = party([M(me.id, 'Zoe', { leader:true, me:true }), M('B', 'Max', { ready:true, always:true }), M('C', 'Lou', { ready:true, always:true, away:true })]);
  assert.deepEqual(launchState({ account:me, party:p }), { can:true, label:'▶ Lancer à 3' });
  assert.equal(launchState({ account:null, party:p }).can, false, 'sans compte dans le lobby : grisé (le bug)');
});

test("niveau d'instance (29/10) : choisi par celui qui lance (seul ou chef), niveaux 1 et 2 ouverts, niveau gardé", async () => {
  const { instanceLevelState } = await import('../src/ui/lobby.js');
  const me = { id: 'A' };
  const solo = instanceLevelState({ instance: true, locked: false, party: null, account: me, cur: 2 });
  assert.equal(solo.show, true); assert.deepEqual(solo.levels.map(l => [l.level, l.done]), [[1, false], [2, false]]); assert.equal(solo.level, 2);
  assert.equal(instanceLevelState({ instance: true, locked: false, party: null, account: me, cur: 7 }).level, 1, 'niveau inconnu : 1');
  const party = { leader: 'B', members: [{ account: 'A' }, { account: 'B' }] };
  assert.equal(instanceLevelState({ instance: true, locked: false, party, account: me }).show, false, 'pas le chef : caché');
  assert.equal(instanceLevelState({ instance: false, locked: false, party: null, account: me }).show, false);
  assert.equal(instanceLevelState({ instance: true, locked: true, party: null, account: me }).show, false, 'session en cours');
  const two = instanceLevelState({ instance: true, locked: false, party: null, account: me, cur: 2, mode: 'instance_2' });
  assert.equal(two.show, false, 'Instance II (30/10) : un seul niveau, pas de rangée'); assert.equal(two.level, 1);
});

test('menu du Lobby : les 6 activités dans l\'ordre, une description chacune, sans les tours', async () => {
  const { mineModes, activityMenu } = await import('../src/ui/lobby.js');
  const j = { sides: { angel: { open: true }, demon: { open: false } } };
  const menu = activityMenu(mineModes('mine', false, j), { towerOpen: true });
  assert.deepEqual(menu.map(a => a.title), ['Prison', 'Mine', 'Mine instantanée', 'Bloc géant', 'Jugement', 'Instances']);
  assert.ok(menu.every(a => a.desc));
  assert.equal(menu[4].kind, 'view'); assert.equal(menu[4].note, 'tour ouverte');
  assert.equal(menu[5].mode, 'instance_1');
  assert.equal(activityMenu(mineModes('instance_2'))[5].mode, 'instance_2', 'l\'instance choisie reste choisie');
});

test('menu du Lobby : en session, la Mine reste ouverte pour voir son groupe ; prison grisée en groupe, repère si elle tourne', async () => {
  const { mineModes, activityMenu } = await import('../src/ui/lobby.js');
  const locked = activityMenu(mineModes('mine', true));
  assert.equal(locked.find(a => a.id === 'mine').disabled, false);
  assert.equal(locked.find(a => a.id === 'prison').disabled, true);
  const group = activityMenu(mineModes('mine', false, null, false, 2), { prisonOn: true }).find(a => a.id === 'prison');
  assert.equal(group.disabled, true); assert.ok(group.hint); assert.equal(group.note, 'en cours');
});

test('Instance et Jugement : leur carte en haut de la colonne de gauche, les sets juste dessous', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const col = html.indexOf('class="lobbyCol"'), jug = html.indexOf('id="judgmentCard"'), inst = html.indexOf('id="instCard"'), sets = html.indexOf('lobbySets"');
  assert.ok(col < jug && col < inst && jug < sets && inst < sets);
});

test('menu du Lobby : équipe toujours là ; bouton principal seulement pour un membre de groupe', async () => {
  const { menuCards } = await import('../src/ui/lobby.js');
  const account = { id:'a' };
  assert.deepEqual(menuCards({ party:null, account }), { team:true, launch:false });
  assert.deepEqual(menuCards({ party:{ leader:'a', members:[{}, {}] }, account }), { team:true, launch:false });
  assert.deepEqual(menuCards({ party:{ leader:'b', members:[{}, {}] }, account }), { team:true, launch:true });
});
