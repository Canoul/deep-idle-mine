/* Guilde : affichage (src/ui/guild.js), textes échappés, cases d'actions, barre d'onglets. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { guildTabs, holdsPanel, mineHTML, listHTML, boardHTML, invitesHTML } from '../src/ui/guild.js';
import { TABS } from '../src/ui/nav.js';

const NONE = { kick:false, promote:false, demote:false, transfer:false };
const row = (o = {}) => ({ id:'AAAAAAAA', name:'Zoe', rank:'member', activity:'online', xp:1234, actions:NONE, ...o });
const mine = (o = {}) => ({ id:'g1', name:'Les Rois', level:3, into:750, need:2250, xp:3250, rank:'chief', max:30, members:[row()], requests:[], ...o });

test('pas de guilde : pas de sous-onglet à son nom', () => {
  assert.deepEqual(guildTabs({ mine:null }).map(t => t.id), ['search', 'board']);
});

test('avec guilde : sous-onglet au nom de la guilde, échappé', () => {
  const t = guildTabs({ mine:mine({ name:'<script>x' }) });
  assert.deepEqual(t.map(x => x.id), ['mine', 'search', 'board']);
  assert.equal(t[0].label, '&lt;script&gt;x');
});

test('ligne d\'un membre : grade, activité, XP rapportée', () => {
  const h = mineHTML(mine({ members:[row({ rank:'officer', activity:'session' }), row({ activity:'offline', name:'Max' })] }));
  assert.match(h, /Officier/); assert.match(h, /En session/); assert.match(h, /Absent/);
  assert.match(h, /1\s234 XP/);
  assert.match(mineHTML(mine()), /Connecté/);
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

test('bonus et bâtiments : textes d\'attente', () => {
  const h = mineHTML(mine());
  assert.match(h, /Aucun bonus pour l'instant/); assert.match(h, /Bientôt/);
});

test('pseudos et noms échappés partout', () => {
  assert.ok(!mineHTML(mine({ name:'<i>', members:[row({ name:'<i>' })] })).includes('<i>x'));
  assert.ok(!mineHTML(mine({ members:[row({ name:'<img src=x>' })] })).includes('<img'));
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
