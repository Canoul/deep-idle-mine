/* Mule (skill Logisticien, étage 4) : le sac posé à côté du bas du treuil.
   Spec : docs/superpowers/specs/2026-10-23-mule-design.md */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WINCH, MULE, IDS, W, ITEMS, SKILLS } from '../src/config.js';
import { worldFrom, run } from './helpers.js';
import { finishAction } from '../src/sim/actions.js';
import { muleCap, muleFits, depositToMule, emptyMule, itemW, muleSpot } from '../src/sim/mule.js';
import { leaveSession, endSession } from '../src/sim/session.js';
import { blockedReason, createSkills, skillOp } from '../src/meta/skills.js';

const X = WINCH.x;
const BRICK = 11;   // Brique de donjon (incassable)

/* puits du treuil creusé de la ligne 1 à `bottom`, dans la pierre ; une galerie sur la ligne du bas, à droite */
function shaft(bottom, { miners = 1, gallery = 0, depth = bottom + 4 } = {}){
  const G = worldFrom(['', ...Array.from({ length:depth }, () => '#'.repeat(W))], { miners });
  for(let y = 1; y <= bottom; y++) G.tiles[y][X] = 0;
  for(let x = X + 1; x <= X + gallery; x++) G.tiles[bottom][x] = 0;
  G.winch = { x:X, bottom };
  return G;
}
/* logisticien avec Mule (et Treuil) */
const mule = m => { m.skill.winch = 1; m.skill.mule = 1; m.skillTree = 'logisticien'; return m; };
/* sac posé (x, y), contenu inv déposé par le mineur by */
function bag(G, carrier, x, y, inv = {}, by = carrier){
  const load = Object.entries(inv).reduce((s, [k, n]) => s + n*itemW(k), 0);
  G.mule = { carrier:carrier.id, placed:true, x, y, inv:{ ...inv }, by:{ [by.id]:{ ...inv } }, load };
  return G.mule;
}
const give = (m, inv) => { m.inv = { ...inv }; m.load = Object.entries(inv).reduce((s, [k, n]) => s + n*itemW(k), 0); };

test('config : Mule 0/1 au 4e étage du Logisticien ; Navette exige Échelle de 2 ET Treuil', () => {
  const n = SKILLS.trees.find(t => t.id === 'logisticien').nodes.find(x => x.id === 'mule');
  assert.deepEqual([n.row, n.max, n.per], [4, 1, 1]);
  assert.equal(MULE.capacityPct, 2);
  const st = createSkills(), learn = id => skillOp(st, { action:'learn', node:id, opId:Math.random().toString(36) }, 20);
  for(const id of ['build_time', 'build_time', 'build_time', 'winch', 'travel_rush']) learn(id);
  assert.equal(st.ranks.travel_rush ?? 0, 0, 'Treuil seul : pas de Navette');
  for(const id of ['tall_ladder', 'travel_rush', 'travel_rush', 'travel_rush', 'travel_rush', 'travel_rush']) learn(id);
  assert.equal(blockedReason(st, 'mule', 20), null, 'Navette 5/5 ouvre Mule');
  assert.ok(learn('mule').ok); assert.equal(st.ranks.winch, 1, 'qui a Mule a le Treuil');
});

test('capacité : 200 % de la somme des pods des logisticiens présents qui ont Mule', () => {
  const G = shaft(10, { miners:3 }), [a, b, c] = G.miners;
  assert.equal(muleCap(G), 0, 'personne n\'a Mule');
  mule(a); assert.equal(muleCap(G), 2*a.carac.pods);
  a.carac.pods = 250; assert.equal(muleCap(G), 500, 'pods réels (stuff compris)');
  mule(b); assert.equal(muleCap(G), 500 + 2*b.carac.pods, 'deux logisticiens : la somme');
  c.skill.winch = 1; assert.equal(muleCap(G), 500 + 2*b.carac.pods, 'le Treuil sans Mule ne compte pas');
  bag(G, a, X + 1, 10);
  leaveSession(G, b);
  assert.equal(muleCap(G), 500, 'un logisticien parti ne compte plus');
});

test('pose : au bout du chantier, le logisticien mine la case à droite du bas du treuil et y pose son sac', () => {
  const G = worldFrom(['', ...Array.from({ length:20 }, () => '#'.repeat(W))]), m = mule(G.miners[0]);
  m.x = X; m.y = 0; m.winchJob = { bottom:14 }; m.mode = 'surface';
  for(let i = 0; i < 3000 && !G.mule?.placed; i++) run(G, 1);
  assert.deepEqual(G.winch, { x:X, bottom:14 });
  assert.deepEqual([G.mule.placed, G.mule.x, G.mule.y, G.mule.carrier], [true, X + 1, 14, m.id]);
  assert.equal(G.tiles[14][X + 1], 0, 'la case a été minée');
  assert.equal(m.muleJob, null);
});

test('pose : à droite incassable → à gauche ; des deux côtés → pas de sac (il reste transporté)', () => {
  const G = shaft(10);
  G.tiles[10][X + 1] = BRICK;
  assert.deepEqual(muleSpot(G), { x:X - 1, y:10 });
  G.tiles[10][X - 1] = BRICK;
  assert.equal(muleSpot(G), null);
});

test('sans Mule : le treuil est posé, pas de sac', () => {
  const G = worldFrom(['', ...Array.from({ length:20 }, () => '#'.repeat(W))]), m = G.miners[0];
  m.skill.winch = 1; m.x = X; m.y = 0; m.winchJob = { bottom:14 }; m.mode = 'surface';
  for(let i = 0; i < 3000 && m.winchJob; i++) run(G, 1);
  assert.deepEqual(G.winch, { x:X, bottom:14 });
  assert.equal(G.mule ?? null, null);
});

test('dépôt partiel : il met ce qui tient, garde le reste ; rien ne se perd ni ne se crée', () => {
  const G = shaft(10, { miners:2 }), [lg, m] = G.miners;
  mule(lg); lg.carac.pods = 10;                          // capacité 20
  bag(G, lg, X + 1, 10, { 'Charbon':5 });               // 5 × poids du charbon
  const cw = itemW('Charbon'), iw = itemW('Fer');
  give(m, { 'Charbon':4, 'Fer':10 });
  const before = m.load + G.mule.load;
  depositToMule(G, m);
  assert.ok(G.mule.load <= muleCap(G) + 1e-9, 'jamais plus que la capacité');
  assert.equal((G.mule.inv['Charbon'] ?? 0) + (m.inv['Charbon'] ?? 0), 9);
  assert.equal((G.mule.inv['Fer'] ?? 0) + (m.inv['Fer'] ?? 0), 10);
  assert.ok(Math.abs(m.load + G.mule.load - before) < 1e-9, 'poids conservé');
  assert.ok(m.load > 0, 'il garde ce qui ne tient pas');
  assert.equal(G.mule.by[m.id]['Charbon'], 4, 'le sac retient qui a déposé quoi');
  assert.ok(cw > 0 && iw > 0);
});

test('place insuffisante pour ce qu\'il porte (un résidu pèse 6, 3 pods libres) : le sac ne l\'attire pas', () => {
  const G = shaft(10, { miners:2 }), [lg, m] = G.miners;
  mule(lg); lg.carac.pods = 5;                           // capacité 10
  bag(G, lg, X + 1, 10, { 'Charbon':2, 'Fer':1 });      // 2 × 2 + 3 = 7 : 3 pods libres
  const res = Object.keys(ITEMS).find(k => ITEMS[k].cat === 'residu' || /Résidu/.test(k));
  give(m, { [res]:2 });
  assert.equal(itemW(res), 6);
  assert.equal(muleFits(G, m), false);
  give(m, { 'Charbon':1 });
  assert.equal(muleFits(G, m), true);
});

test('pods pleins : le sac (à 2 cases) passe avant la surface (40 couches) ; il dépose puis reprend le travail', () => {
  const G = shaft(40, { miners:2, gallery:6 }), [lg, m] = G.miners;
  mule(lg); lg.x = X + 6; lg.y = 40; lg.mode = 'work';
  bag(G, lg, X + 1, 40);
  m.x = X + 3; m.y = 40; m.mode = 'work';
  give(m, { 'Fer':Math.ceil(m.carac.pods / itemW('Fer')) });
  for(let i = 0; i < 200 && G.mule.load === 0; i++) run(G, 1);
  assert.ok(G.mule.load > 0, 'déposé dans le sac');
  assert.ok(m.y >= 30, 'il n\'est pas remonté');
  assert.ok(m.load < m.carac.pods - 2, 'il a de la place');
  assert.equal(G.chest['Fer'] ?? 0, 0, 'rien au coffre');
});

test('sac plein : il remonte au coffre comme d\'habitude', () => {
  const G = shaft(40, { miners:2, gallery:6 }), [lg, m] = G.miners;
  mule(lg); lg.carac.pods = 9; lg.x = X + 6; lg.y = 40;
  bag(G, lg, X + 1, 40, { 'Fer':6 });                   // 6 × 3 = 18 / 18 : plein
  m.x = X + 3; m.y = 40; m.mode = 'work';
  give(m, { 'Fer':Math.ceil(m.carac.pods / itemW('Fer')) });
  run(G, 5);
  assert.equal(m.mode, 'return');
  assert.equal(m.reason, 'pods pleins');
});

test('coffre : le logisticien qui rapporte son sac le vide ; chaque objet compte pour celui qui l\'a déposé', () => {
  const G = shaft(10, { miners:2 }), [lg, m] = G.miners;
  mule(lg); bag(G, lg, X + 1, 10, { 'Or':3 }, m);
  G.mule.placed = false;                                // transporté
  lg.x = 22; lg.y = 0; give(lg, { 'Fer':2 });
  finishAction(G, lg, { type:'deposit', data:{} });
  assert.equal(G.chest['Or'], 3); assert.equal(G.chest['Fer'], 2);
  assert.equal(G.chestBy[m.id]['Or'], 3, 'crédité au déposant');
  assert.equal(G.chestBy[lg.id]['Or'] ?? 0, 0);
  assert.deepEqual([G.mule.load, Object.keys(G.mule.inv).length], [0, 0]);
  finishAction(G, lg, { type:'deposit', data:{} });
  assert.equal(G.chest['Or'], 3, 'un second passage ne double rien');
});

test('prolongation : il repasse par son sac (sur son chemin), le vide au coffre, et le reposera en bas du nouveau treuil', () => {
  const G = shaft(20, { miners:1, depth:30 }), lg = mule(G.miners[0]);
  bag(G, lg, X + 1, 20, { 'Or':4 });
  lg.x = X; lg.y = 20; lg.mode = 'work'; lg.winchJob = { bottom:26 };
  for(let i = 0; i < 4000 && !(G.chest['Or'] > 0); i++) run(G, 1);
  assert.equal(G.chest['Or'], 4, 'vidé au coffre');
  for(let i = 0; i < 6000 && !G.mule.placed; i++) run(G, 1);
  assert.deepEqual([G.winch.bottom, G.mule.placed, G.mule.x, G.mule.y], [26, true, X + 1, 26]);
});

test('départ du porteur : le sac part au coffre AVANT la photo du partage, et disparaît', () => {
  const G = shaft(10, { miners:2 }), [lg, m] = G.miners;
  mule(lg); bag(G, lg, X + 1, 10, { 'Or':5 }, m);
  assert.ok(leaveSession(G, lg));
  assert.equal(G.chest['Or'], 5);
  assert.equal(G.shareMarks[0].chest['Or'], 5, 'compté dans la tranche où le porteur était là');
  assert.equal(G.mule, null);
});

test('départ d\'un autre : le sac reste', () => {
  const G = shaft(10, { miners:2 }), [lg, m] = G.miners;
  mule(lg); bag(G, lg, X + 1, 10, { 'Or':5 });
  leaveSession(G, m);
  assert.equal(G.mule.inv['Or'], 5);
});

test('fin de session : un sac pas rapporté est perdu (bilan), rien n\'arrive au coffre', () => {
  const G = shaft(10, { miners:1 }), lg = mule(G.miners[0]);
  bag(G, lg, X + 1, 10, { 'Or':5 });
  endSession(G);
  assert.equal(G.summary.chest['Or'] ?? 0, 0);
  assert.ok(G.summary.lostBags.some(b => /^Sac de/.test(b.name) && b.items['Or'] === 5));
});

test('un mineur qui croise le sac sans en avoir besoin ne le touche pas ; un mob ne le prend pas', () => {
  const G = shaft(20, { miners:2, gallery:6 }), [lg, m] = G.miners;
  mule(lg); lg.x = X + 6; lg.y = 20;
  bag(G, lg, X + 1, 20, { 'Or':5 });
  m.x = X + 3; m.y = 20; give(m, { 'Fer':1 });
  run(G, 50);
  assert.equal(G.mule.inv['Or'], 5);
  assert.equal(G.mule.inv['Fer'] ?? 0, 0, 'pods pas pleins : pas de dépôt');
});

test('vidage idempotent : vider deux fois ne double pas le coffre', () => {
  const G = shaft(10, { miners:1 }), lg = mule(G.miners[0]);
  bag(G, lg, X + 1, 10, { 'Or':5 });
  emptyMule(G, lg.name); emptyMule(G, lg.name);
  assert.equal(G.chest['Or'], 5);
});

test('affichage : le navigateur reçoit le sac posé (case, remplissage, capacité), rien quand il est transporté', async () => {
  const { createViewer, emptyView, applyView } = await import('../src/shared/view.js');
  const G = shaft(10, { miners:1 }), lg = mule(G.miners[0]);
  bag(G, lg, X + 1, 10, { 'Or':5 });
  const view = createViewer(G);
  let M = applyView(emptyView(), view(null), 0);
  assert.deepEqual(M.mule, { x:X + 1, y:10, load:20, cap:2*lg.carac.pods });
  G.mule.placed = false;
  M = applyView(M, view(M.ticks), 0);
  assert.equal(M.mule, null);
});
