/* K hole (src/sim/khole.js) : placement dans les areas, découverte → aspiration du groupe dans la dimension, mine figée,
   retour de chacun à sa place, fin de session et départ pendant le k hole, déterminisme, envoi au navigateur. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W, AREA_H, TOP_DIRT_ROWS, KHOLE, KHOLE_BLOCK, DT, DUNGEON } from '../src/config.js';
import { newSession, tick, leaveSession, endSession } from '../src/sim/session.js';
import { genArea, tryUnlock, areaTop } from '../src/sim/world.js';
import { createViewer } from '../src/shared/view.js';

/* lance fn avec KHOLE.chance = c (remis ensuite) */
function withChance(c, fn){
  const old = KHOLE.chance; KHOLE.chance = c;
  try { return fn(); } finally { KHOLE.chance = old; }
}
const run = (G, seconds) => { for(let i=0; i<Math.round(seconds/DT) && !G.over; i++) tick(G); };
/* session à 2 mineurs avec un k hole dans l'area 0, découvert tout de suite (case vue) */
function opened(seed = 42){
  const G = withChance(1, () => newSession(seed, { miners: 2 }));
  const h = G.kholes[0];
  G.seen[h.y][h.x] = 1;
  return { G, h };
}
const kholeCells = G => G.tiles.flatMap((row, y) => [...row].map((t, x) => t === KHOLE_BLOCK ? { x, y } : null)).filter(Boolean);

/* ---------- placement ---------- */

test('placement : chance 0 → aucun k hole ; chance 1 → un par area, à la place d\'un bloc de terrain, comptes exacts', () => {
  const none = withChance(0, () => newSession(7));
  assert.equal(kholeCells(none).length, 0);
  assert.equal(none.kholes, undefined);
  const deep = (c, G = withChance(c, () => newSession(7))) => withChance(c, () => { for(let k=1; k<6; k++){ genArea(G, k); G.unlockedAreas++; } return G; });
  const G = deep(1), ref = deep(0);
  assert.equal(G.kholes.length, 6);
  assert.deepEqual(kholeCells(G), G.kholes.map(h => ({ x: h.x, y: h.y })));
  const sum = a => Object.values(a.counts).reduce((s, n) => s + n, 0);
  for(const h of G.kholes){
    assert.ok(h.y >= areaTop(h.k) && h.y < areaTop(h.k) + AREA_H, 'dans son area');
    assert.equal(sum(G.areas[h.k]), sum(ref.areas[h.k]) - 1, 'un bloc de terrain de moins, le k hole ne compte pas');
    for(const d of G.dungeons) assert.ok(!(h.x >= d.x0-1 && h.x <= d.x0+DUNGEON.size && h.y >= d.y0-1 && h.y <= d.y0+DUNGEON.size), 'hors du donjon');
  }
});

test('placement : tirage à part (le reste de l\'area ne change pas) et déterministe (même seed, même case)', () => {
  const a = withChance(0, () => newSession(99)), b = withChance(1, () => newSession(99)), c = withChance(1, () => newSession(99));
  const h = b.kholes[0];
  assert.deepEqual(c.kholes, b.kholes);
  let diff = 0;
  for(let y=0; y<a.tiles.length; y++) for(let x=0; x<W; x++) if(a.tiles[y][x] !== b.tiles[y][x]) diff++;
  assert.equal(diff, 1);
  assert.notEqual(a.tiles[h.y][h.x], 0, 'il remplace un bloc, pas une case vide');
});

/* ---------- aller et retour ---------- */

test('découvert : il s\'ouvre, KHOLE.warn s plus tard tout le groupe est dans la dimension', () => {
  const { G } = opened();
  run(G, KHOLE.warn - 0.5);
  assert.equal(G.khole ?? null, null, 'pas encore');
  run(G, 1);
  assert.ok(G.khole);
  assert.equal(G.tiles.length, 1 + TOP_DIRT_ROWS + AREA_H, 'la carte est celle de la dimension');
  assert.equal(G.unlockedAreas, 1); assert.equal(G.mobs.length, 0);
  assert.ok(G.miners.every(m => m.y <= 1), 'tout le groupe arrive à la surface de la dimension');
  assert.ok(G.log.some(l => /aspiré par le k hole/.test(l.msg)));
});

test('retour : chacun à sa place, mine figée (blocs, mobs, areas), le portail a disparu ; ce qu\'il porte est gardé', () => {
  const { G, h } = opened();
  run(G, KHOLE.warn + DT);
  const K = G.khole; assert.ok(K);
  /* photo de la mine et des mineurs au départ (ce qui est mis de côté) */
  const tiles = K.world.tiles.map(r => r.slice()), mobs = JSON.stringify(K.world.mobs), areas = JSON.stringify(K.world.areas);
  const spots = G.miners.map(m => ({ ...K.spots.get(m.id) }));
  run(G, KHOLE.duration / 2);
  const mined = G.stats.mined;
  assert.ok(mined > 0, 'ils minent dans la dimension');
  G.miners[0].inv.Pierre = (G.miners[0].inv.Pierre || 0) + 1;   // ce qu'il porte revient avec lui
  run(G, KHOLE.duration / 2 + DT);
  assert.equal(G.khole, null);
  G.miners.forEach((m, i) => { assert.equal(m.x, spots[i].x); assert.equal(m.y, spots[i].y); });
  assert.equal(JSON.stringify(G.areas), areas, 'rien n\'a été débloqué ni compté dans la mine');
  assert.ok(G.miners[0].inv.Pierre >= 1);
  assert.equal(G.tiles[h.y][h.x], 0, 'le portail a disparu');
  tiles[h.y][h.x] = 0;
  /* la mine reprend au tick du retour : seules ses propres actions du tick ont pu changer quelques cases */
  let diff = 0;
  for(let y=0; y<tiles.length; y++) for(let x=0; x<W; x++) if(tiles[y][x] !== G.tiles[y][x]) diff++;
  assert.ok(diff <= G.miners.length, `mine figée (${diff} cases changées)`);
  assert.ok(JSON.parse(mobs).every(o => G.mobs.some(q => q.id === o.id)), 'les mobs de la mine sont toujours là');
});

test('dans la dimension : rien à débloquer, pas de mobs, la profondeur ne compte pas', () => {
  const { G } = opened();
  run(G, KHOLE.warn + DT);
  const depth = G.stats.maxDepth;
  G.areas[0].oreMined = G.areas[0].oreTotal;
  assert.equal(tryUnlock(G), false);
  run(G, KHOLE.duration - 1);
  assert.equal(G.mobs.length, 0);
  assert.equal(G.stats.maxDepth, depth);
});

test('fin de session pendant le k hole : retour dans la mine d\'abord, bilan de la mine', () => {
  const { G } = opened();
  run(G, KHOLE.warn + DT);
  const areas = G.khole.world.unlockedAreas;
  endSession(G);
  assert.equal(G.khole, null);
  assert.equal(G.summary.areasUnlocked, areas - 1);
  assert.ok(G.tiles.length > 1 + TOP_DIRT_ROWS + AREA_H || areas === 1);
});

test('un joueur part pendant le k hole : les autres reviennent normalement ; le dernier qui part termine la session', () => {
  const { G } = opened();
  run(G, KHOLE.warn + DT);
  const stay = G.miners[1], spot = { ...G.khole.spots.get(stay.id) };
  assert.equal(leaveSession(G, G.miners[0]), true);
  run(G, KHOLE.duration);
  assert.equal(G.khole, null);
  assert.deepEqual([stay.x, stay.y], [spot.x, spot.y]);
  assert.equal(leaveSession(G, stay), true);
  assert.equal(G.over, true);
});

test('déterministe : même seed, même partie (aller, dimension, retour)', () => {
  const play = () => { const { G } = opened(); run(G, KHOLE.warn + KHOLE.duration + 20);
    return JSON.stringify({ chest: G.chest, stats: G.stats, miners: G.miners.map(m => [m.x, m.y, m.inv]), log: G.log }); };
  assert.equal(play(), play());
});

test('envoi au navigateur : au changement de carte, la carte entière (à l\'aller et au retour)', () => {
  const { G } = opened();
  const view = createViewer(G);
  let v = view();
  run(G, 1); v = view(v.tick);
  assert.ok(!v.full);
  run(G, KHOLE.warn + DT);
  v = view(v.tick);
  assert.equal(v.full, true); assert.equal(v.rows.tiles.length, G.tiles.length);
  assert.ok(v.khole && v.khole.until > G.t);
  run(G, 1); v = view(v.tick); assert.ok(!v.full);
  run(G, KHOLE.duration);
  v = view(v.tick);
  assert.equal(v.full, true); assert.equal(v.khole, null);
});
