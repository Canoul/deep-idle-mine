/* Guilde : affichage (src/ui/guild.js), textes échappés, cases d'actions, barre d'onglets. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { guildTabs, holdsPanel, mineHTML, listHTML, boardHTML, invitesHTML, sendInvite } from '../src/ui/guild.js';
import { TABS } from '../src/ui/nav.js';

const NONE = { kick:false, promote:false, demote:false, transfer:false };
const row = (o = {}) => ({ id:'AAAAAAAA', name:'Zoe', rank:'member', status:'online', activity:'online', xp:1234, actions:NONE, ...o });
const mine = (o = {}) => ({ id:'g1', name:'Les Rois', level:3, into:750, need:2250, xp:3250, rank:'chief', max:30, members:[row()], requests:[], buildings:[], owned:{}, canBuild:false, log:{ rows:[], next:0 }, ...o });

test('pas de guilde : pas de sous-onglet à son nom', () => {
  assert.deepEqual(guildTabs({ mine:null }).map(t => t.id), ['search', 'board']);
});

test('avec guilde : sous-onglet au nom de la guilde, échappé', () => {
  const t = guildTabs({ mine:mine({ name:'<script>x' }) });
  assert.deepEqual(t.map(x => x.id), ['mine', 'raid', 'search', 'board']);
  assert.equal(t[0].label, '&lt;script&gt;x');
});

test('ligne d\'un membre : grade, activité, XP rapportée', () => {
  const h = mineHTML(mine({ members:[row({ rank:'officer', status:'session', leftMs:600_000 }), row({ status:'offline', name:'Max' })] }));
  assert.match(h, /Officier/); assert.match(h, /En session mine · reste 10 min/); assert.match(h, /Hors ligne/);
  assert.match(h, /1\s234 XP/);
  assert.match(mineHTML(mine()), /En ligne/);
  assert.match(mineHTML(mine({ members:[row({ status:'lobby', size:2, max:3 })] })), /Dans le lobby \(2\/3\)/);
  assert.match(mineHTML(mine({ members:[row({ status:'session', mode:'prison', online:true })] })), /fdot on.*En ligne - Prison/);
});

test('bouton Inviter : actif si le serveur le permet, grisé sinon, absent sur sa propre ligne', () => {
  const on = mineHTML(mine({ members:[row({ canInvite:true, id:'BBBBBBBB', name:'Max' })] }));
  assert.match(on, /<button data-g="lobbyInvite" data-id="BBBBBBBB" data-name="Max">/);
  assert.match(mineHTML(mine({ members:[row({ status:'offline' })] })), /data-g="lobbyInvite"[^>]* disabled title="Hors ligne"/);
  assert.ok(!mineHTML(mine({ members:[row({ me:true })] })).includes('lobbyInvite'));
  assert.ok(!mineHTML(mine({ members:[row({ canInvite:true, name:'"><img src=x>' })] })).includes('<img src=x'));
});

test('niveau et barre', () => {
  const h = mineHTML(mine());
  assert.match(h, /Niveau 3/); assert.match(h, /width:33(\.\d+)?%/);
});

test('case d\'actions : présente seulement si au moins une action est possible', () => {
  assert.ok(!mineHTML(mine()).includes('data-gact'));
  const h = mineHTML(mine({ members:[row({ actions:{ ...NONE, kick:true, promote:true } })] }));
  assert.match(h, /data-gact/); assert.match(h, /value="kick"/); assert.match(h, /value="promote"/); assert.ok(!h.includes('value="transfer"'));
});

test('inviter et demandes : chef et officier seulement', () => {
  assert.ok(mineHTML(mine()).includes('data-g="invite"'));
  assert.ok(!mineHTML(mine({ rank:'member' })).includes('data-g="invite"'));
  const h = mineHTML(mine({ requests:[{ id:'BBBBBBBB', name:'<b>Max' }] }));
  assert.ok(h.includes('&lt;b&gt;Max')); assert.ok(h.includes('data-g="acceptRequest"'));
});

test('sans bâtiment ni don : textes d\'attente', () => {
  const h = mineHTML(mine());
  assert.match(h, /Aucun bonus pour l'instant/); assert.match(h, /Aucun don pour l'instant/);
});

test('pseudos et noms échappés partout', () => {
  assert.ok(!mineHTML(mine({ name:'<i>', members:[row({ name:'<i>' })] })).includes('<i>x'));
  assert.ok(!mineHTML(mine({ members:[row({ name:'<img src=x>' })] })).includes('<img src=x'));   // la maison de guilde a ses propres <img>
  const g = { id:'"g', name:'<img src=x>', level:1, members:1, max:30, chief:'<img src=x>', xp:0 };
  for(const h of [listHTML([g], { mine:false, requests:[] }), boardHTML([{ ...g, rank:1 }]), invitesHTML([g])]) assert.ok(!h.includes('<img'));
});

test('liste : demander à rejoindre, demande envoyée, guilde pleine, déjà en guilde', () => {
  const g = { id:'g1', name:'Rois', level:2, members:3, max:30, chief:'Zoe', xp:0 };
  assert.ok(listHTML([g], { mine:false, requests:[] }).includes('data-g="request"'));
  assert.ok(listHTML([g], { mine:false, requests:['g1'] }).includes('data-g="cancelRequest"'));
  assert.ok(!listHTML([{ ...g, members:30 }], { mine:false, requests:[] }).includes('data-g="request"'));
  assert.ok(!listHTML([g], { mine:true, requests:[] }).includes('data-g="request"'));
  assert.match(listHTML([], { mine:false, requests:[] }), /Aucune guilde/);
});

test('Guilde dans la barre', () => {
  assert.ok(TABS.some(t => t.id === 'guilde' && t.ready));
});

test("relecture : seule une case ouverte retient le panneau, pas un bouton qui garde le focus", () => {
  const el = sel => ({ matches:q => q === sel });
  assert.equal(holdsPanel(el('[data-gact]')), true);
  assert.equal(holdsPanel(el('button')), false);
  assert.equal(holdsPanel(null), false);
});

test('liste : cliquer une guilde déplie ses membres, échappés', () => {
  const g = { id:'g1', name:'Rois', level:2, members:1, max:30, chief:'Zoe', xp:0 }, base = { mine:false, requests:[] };
  const closed = listHTML([g], base);
  assert.ok(closed.includes('data-gopen="g1"')); assert.ok(closed.includes('aria-expanded="false"')); assert.ok(!closed.includes('gfold'));
  assert.match(listHTML([g], { ...base, open:'g1' }), /Chargement/);
  const h = listHTML([g], { ...base, open:'g1', members:[{ name:'<img src=x>', rank:'chief', xp:1234 }] });
  assert.ok(h.includes('aria-expanded="true"')); assert.match(h, /Chef de guilde/); assert.match(h, /1\s234 XP/); assert.ok(!h.includes('<img'));
  assert.ok(h.includes('data-g="request"'), 'le bouton reste là');
});


test('inviter : la fenêtre confirme avec le pseudo, après la relecture de l\'onglet', async () => {
  const log = [], h = { invite:async n => log.push('invite ' + n), done:async () => log.push('done'), tell:async t => log.push(t) };
  await sendInvite('  Zoe ', h);
  assert.deepEqual(log, ['invite Zoe', 'done', 'Invitation envoyée à Zoe.']);
});

test('inviter : pseudo inconnu, la fenêtre donne le refus du serveur', async () => {
  const told = [];
  await sendInvite('Personne', { invite:async () => { throw new Error('Ce pseudo n\'existe pas.'); }, done:async () => { throw new Error('pas de relecture'); }, tell:async t => told.push(t) });
  assert.deepEqual(told, ['Ce pseudo n\'existe pas.']);
});

test('message de guilde : échappé, lignes gardées, bouton pour qui peut écrire', () => {
  const h = mineHTML(mine({ message:{ text:'<b>Salut', name:'Zoe', at:0 }, canMessage:true }));
  assert.match(h, /Message de guilde/); assert.ok(h.includes('&lt;b&gt;Salut')); assert.match(h, /Zoe · /);
  assert.match(h, /data-g="message">Modifier/);
  assert.ok(!mineHTML(mine({ message:{ text:'Salut', name:'Zoe', at:0 } })).includes('data-g="message"'));
  assert.match(mineHTML(mine()), /Aucun message/);
  assert.match(mineHTML(mine({ canMessage:true })), /data-g="message">Écrire/);
});
