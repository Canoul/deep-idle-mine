/* Couronne du Roi Gobelin (27/10/2026, Geoffrey) : un gobelin qui naît à 10 cases ou moins d'un porteur est asservi
   (src/sim/thrall.js) : il ne se bat pas, mine les minerais autour de lui pendant 30 s à la vitesse d'un mineur de base,
   ce qu'il mine va directement au coffre commun (et à la part « gobelins »), puis il disparaît. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOBLIN_KING, STATS, BLOCKS, IDS, DT, TREASURE_BLOCK } from '../src/config.js';
import { thrallOwner, enslave, updateThralls } from '../src/sim/thrall.js';
import { worldFrom, run } from './helpers.js';

const busy = m => { m.action = { type: 'wait', dur: 1e9, t: 0, data: {} }; m.ox = 1e6; };
const crown = m => { m.carac.goblinThrall = GOBLIN_KING.thrall.radius; };
const BRICK = 11;   // Brique de donjon : incassable

test('config : rayon 10, 30 s, minerais à 6 cases ; stat goblinThrall à 0 sans couronne', () => {
  assert.deepEqual(GOBLIN_KING.thrall, { radius:10, life:30, reach:6 });
  assert.equal(STATS.goblinThrall, 0);
});

test('porteur : seulement un mineur sous terre qui porte la couronne, à 10 cases ou moins (cercle) ; le plus proche', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#@' + ' '.repeat(40) + '#', '#'.repeat(50)], { miners: 2 });
  const [a, b] = G.miners;
  assert.equal(thrallOwner(G, 5, 2), null, 'personne ne porte la couronne');
  crown(a);
  assert.equal(thrallOwner(G, a.x + 10, 2), a); assert.equal(thrallOwner(G, a.x + 11, 2), null);
  assert.equal(thrallOwner(G, a.x + 6, 2 + 8), a, 'cercle : 6 et 8 → 10');
  assert.equal(thrallOwner(G, a.x + 8, 2 + 8), null, '8 et 8 → 11,3');
  crown(b); b.x = 20;
  assert.equal(thrallOwner(G, 18, 2), b, 'le plus proche');
  a.y = 0; b.y = 0;
  assert.equal(thrallOwner(G, 1, 2), null, 'à la surface : non');
});

/* une galerie, le mineur à gauche (occupé), du charbon à droite dans la roche */
const gallery = () => worldFrom(['', 'd'.repeat(50), '#@       cc  #', '#        cc  #', '#'.repeat(50)]);

test('il mine les minerais autour de lui à la vitesse d\'un mineur de base ; tout va au coffre commun et à la part des gobelins', () => {
  const G = gallery(), m = G.miners[0]; busy(m); crown(m);
  const inv = JSON.stringify(m.inv);
  enslave(G, 99, 6, 2, m);
  assert.equal(G.mobs.length, 0, 'pas un mob'); assert.equal(G.thralls.length, 1);
  run(G, Math.round(5 / DT));
  assert.ok((G.chest.Charbon || 0) >= 1, 'déjà du charbon au coffre');
  run(G, Math.round(20 / DT));
  assert.equal(G.chest.Charbon, 4, 'les 4 charbons');
  assert.deepEqual(G.goblinChest, G.chest, 'tout vient des gobelins');
  assert.equal(JSON.stringify(m.inv), inv, 'rien dans le sac du mineur');
  assert.equal(G.stats.mined, 0, 'aucun bloc miné par un mineur');
  assert.equal(G.areas[0].oreMined, 4, 'les minerais comptent pour le déblocage');
  for(const [x, y] of [[9, 2], [10, 2], [9, 3], [10, 3]]) assert.equal(G.tiles[y][x], 0);
});

test('temps de minage : dureté / vitesse de minage de base (charbon 1,6 s)', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#@   c#', '#'.repeat(50)]), m = G.miners[0]; busy(m); crown(m);
  enslave(G, 99, 4, 2, m);                      // juste à côté du charbon (x = 5)
  const need = BLOCKS[IDS.coal].hard / STATS.mineSpeed;
  run(G, Math.round(need / DT) - 2);
  assert.equal(G.tiles[2][5], IDS.coal, 'pas encore');
  run(G, 3);
  assert.equal(G.tiles[2][5], 0);
});

test('il creuse droit vers un minerai : la pierre cassée en chemin va aussi au coffre', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#@   ##c#', '#'.repeat(50)]), m = G.miners[0]; busy(m); crown(m);
  enslave(G, 99, 4, 2, m);
  run(G, Math.round(15 / DT));
  assert.equal(G.tiles[2][7], 0, 'charbon atteint');
  assert.equal(G.chest.Charbon, 1); assert.ok(G.chest.Pierre >= 2, 'les 2 pierres du chemin');
});

test('il ne prend pas le minerai qu\'un mineur vise', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#@   c#', '#'.repeat(50)]), m = G.miners[0]; busy(m); crown(m);
  m.target = { x: 5, y: 2 };
  enslave(G, 99, 4, 2, m);
  run(G, Math.round(10 / DT));
  assert.equal(G.tiles[2][5], IDS.coal);
});

test('au bout de 30 s il disparaît (journal) ; sans rien à casser autour, il attend', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#@' + ' '.repeat(30) + '#', '#'.repeat(50)]), m = G.miners[0]; busy(m); crown(m);
  for(const row of G.tiles.slice(1)) row.forEach((v, x) => { if(v) row[x] = BRICK; });
  enslave(G, 99, 20, 2, m);
  run(G, Math.round(29.5 / DT));
  assert.equal(G.thralls.length, 1); assert.deepEqual(G.chest, {}, 'rien à casser');
  run(G, Math.round(1 / DT));
  assert.equal(G.thralls.length, 0);
  assert.ok(G.log.some(l => /asservi a fini/.test(l.msg)));
  assert.equal(G.stats.thralls, 1);
});

/* 31/10/2026 (Geoffrey) : « il focus minerai, mais s'il n'y en a pas alors il mine » */
const rock = () => worldFrom(['', 'd'.repeat(50), ...Array.from({ length: 12 }, () => '#'.repeat(50))]);

test('sans minerai à portée, il mine la roche pendant ses 30 s, tout droit, et ça va au coffre', () => {
  const G = rock(), m = G.miners[0]; busy(m); crown(m);
  G.tiles[6][5] = 0; enslave(G, 99, 5, 6, m);
  run(G, Math.round(10 / DT));
  assert.ok(G.chest.Pierre >= 5, `${G.chest.Pierre} pierres`);
  assert.equal(G.goblinChest.Pierre, G.chest.Pierre);
  assert.equal(G.thralls[0].y, 6, 'même ligne');
  assert.ok(G.thralls[0].x >= 9, `colonne ${G.thralls[0].x}`);
});

test('un minerai qui entre dans sa portée pendant qu\'il creuse passe avant la roche', () => {
  const G = rock(), m = G.miners[0]; busy(m); crown(m);
  G.tiles[6][5] = 0; G.tiles[6][17] = IDS.coal; enslave(G, 99, 5, 6, m);
  assert.equal(G.tiles[6][17], IDS.coal);
  run(G, Math.round(29 / DT));
  assert.equal(G.chest.Charbon, 1);
});

test('avec un minerai à portée, il y va sans s\'arrêter à la roche d\'à côté', () => {
  const G = rock(), m = G.miners[0]; busy(m); crown(m);
  G.tiles[6][5] = 0; G.tiles[6][9] = IDS.coal; enslave(G, 99, 5, 6, m);
  run(G, Math.round(1 / DT));
  assert.deepEqual(G.thralls[0].target, { x: 9, y: 6 });
});

test('il ne casse ni un treasure ni une brique incassable', () => {
  const G = rock(), m = G.miners[0]; busy(m); crown(m);
  G.tiles[6][5] = 0; G.tiles[6][6] = TREASURE_BLOCK; G.tiles[5][5] = BRICK; enslave(G, 99, 5, 6, m);
  run(G, Math.round(29 / DT));
  assert.equal(G.tiles[6][6], TREASURE_BLOCK); assert.equal(G.tiles[5][5], BRICK);
});

test('sans prise, il tombe ; il ne monte pas dans le vide', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#@' + ' '.repeat(30) + '#', '#' + ' '.repeat(30) + ' #', '#'.repeat(50)]), m = G.miners[0]; busy(m); crown(m);
  G.thralls = []; enslave(G, 99, 15, 2, m);
  run(G, 20);
  assert.ok(G.thralls[0].y >= 3, 'tombé sur le sol');
  updateThralls(G);
});

test('onglet Stuff : « Gobelins asservis » n\'est pas affichée, même couronne portée (27/10)', async () => {
  const { STUFF } = await import('../src/config.js');
  const { minerStats } = await import('../src/meta/stuff.js');
  assert.ok(!STUFF.shownStats.includes('goblinThrall'));
  assert.ok(!minerStats({ casque:{ item:'Couronne du Roi Gobelin', uid:1 } }).some(s => s.key === 'goblinThrall'));
});
