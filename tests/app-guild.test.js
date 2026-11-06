/* Appli (04/11/2026) : sa guilde en 4 onglets — Maison, Membres, Bâtiments, Journal (src/ui/guild.js, mineAppHTML).
   Spec docs/superpowers/specs/2026-11-04-appli-guilde-design.md */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mineAppHTML } from '../src/ui/guild.js';

const NONE = { kick:false, promote:false, demote:false, transfer:false };
const row = (o = {}) => ({ id:'AAAAAAAA', name:'Zoe', rank:'member', status:'online', activity:'online', xp:1234, actions:NONE, ...o });
const B = (id, o = {}) => ({ id, level:0, max:1, ready:false, materials:[{ item:'Diamant', need:5000, have:10 }], ...o });
const mine = (o = {}) => ({ id:'g1', name:'Les Rois', level:3, into:750, need:2250, xp:3250, rank:'chief', max:30, members:[row(), row({ id:'BBBBBBBB', name:'Max' })],
  requests:[], buildings:[B('armurerie'), B('tresorerie'), B('forge')], owned:{ Diamant:14 }, canBuild:false, log:{ rows:[], next:0 }, ...o });
const count = (h, re) => (h.match(re) || []).length;

test('quatre onglets, celui choisi marqué ; Maison : la maison et le niveau', () => {
  const h = mineAppHTML(mine(), {});
  assert.equal(count(h, /data-gsub=/g), 4); assert.match(h, /data-gsub="house" class="on"/);
  assert.match(h, /class="ghouse"/); assert.match(h, /Niveau 3/);
});

test('demandes reçues : visibles dans Maison et dans Membres', () => {
  const g = mine({ requests:[{ id:'CCCCCCCC', name:'Lou' }] });
  assert.match(mineAppHTML(g, {}, { sub:'house' }), /Demandes reçues[^]*Lou/);
  assert.match(mineAppHTML(g, {}, { sub:'members' }), /Demandes reçues[^]*Lou/);
});

test('Membres : une ligne par joueur, « Quitter » tout en bas et à part ; pas d\'invitation pour un simple membre', () => {
  const h = mineAppHTML(mine({ rank:'member' }), {}, { sub:'members' });
  assert.equal(count(h, /class="frow gmem"/g), 2);
  assert.match(h, /frow gmem[^]*class="gLeave"[^>]*>[^]*data-g="leave"/);
  assert.doesNotMatch(h, /Inviter un joueur/);
  assert.match(mineAppHTML(mine(), {}, { sub:'members' }), /Inviter un joueur/, 'le chef invite');
});

test('Bâtiments : trois boutons, un seul bâtiment affiché (le premier si le choix est inconnu) ; au maximum, sans matières', () => {
  const h = mineAppHTML(mine(), {}, { sub:'buildings', building:'forge' });
  assert.equal(count(h, /data-gb=/g), 3); assert.match(h, /data-gb="forge" class="on"/);
  assert.equal(count(h, /class="gbuilding"/g), 1);
  assert.match(mineAppHTML(mine(), {}, { sub:'buildings', building:'inconnu' }), /data-gb="armurerie" class="on"/);
  const maxed = mineAppHTML(mine({ buildings:[B('armurerie', { level:1 }), B('tresorerie'), B('forge')] }), {}, { sub:'buildings' });
  assert.doesNotMatch(maxed, /class="gmat"/);
});

test('Journal : les dons, ou « Aucun don »', () => {
  assert.match(mineAppHTML(mine(), {}, { sub:'log' }), /Journal des dons[^]*Aucun don/);
});
