/* K hole (src/sim/khole.js) : placement dans les areas, découverte → aspiration du groupe dans la dimension (contenu,
   règles : oxygène, pods, pas de remontée), mine figée, retour à la surface, fin de session et départ pendant le k hole, déterminisme, envoi au navigateur. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W, AREA_H, KHOLE, KHOLE_BLOCK, DT, DUNGEON, TRAP, BARRIER, TREASURE_BLOCK, SPAWN_X } from '../src/config.js';
import { newSession, tick, leaveSession, endSession } from '../src/sim/session.js';
import { genArea, tryUnlock, areaTop, treasureItem } from '../src/sim/world.js';
import { buildDimension } from '../src/sim/khole.js';
import { mobHp } from '../src/config.js';
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

test('découvert : il s\'ouvre, KHOLE.warn s plus tard tout le groupe est en bas à gauche de la dimension', () => {
  const { G, h } = opened();
  run(G, KHOLE.warn - 0.5);
  assert.equal(G.khole ?? null, null, 'pas encore');
  run(G, 1);
  assert.ok(G.khole);
  const bottom = areaTop(h.k) + KHOLE.h - 1;
  assert.equal(G.tiles.length, bottom + 1, 'la carte est celle de la dimension, à la profondeur de l\'area du k hole');
  assert.ok(G.miners.every(m => m.x < KHOLE.spawnCols && m.y === bottom), 'arrivée en bas des colonnes vides de gauche');
  assert.ok(G.log.some(l => /aspiré par le k hole/.test(l.msg)));
});

test('la dimension : 25 × 25 au fond de la mine, arrivée vide, composition, 1 donjon, 5 pièges et treasures de l\'area', () => {
  const G = newSession(5, { miners: 1 }), k = 4;
  const bottom = buildDimension(G, 0, k), top = areaTop(k);
  assert.equal(bottom, top + KHOLE.h - 1);
  for(let y=0; y<G.tiles.length; y++) for(let x=0; x<W; x++){
    const inside = y >= top && x < KHOLE.w;
    if(!inside) assert.equal(G.tiles[y][x], BARRIER, `barrière autour (${x},${y})`);
    else if(x < KHOLE.spawnCols) assert.equal(G.tiles[y][x], 0, 'colonnes d\'arrivée vides');
  }
  assert.equal(G.dungeons.length, KHOLE.dungeons); assert.equal(G.traps.length, KHOLE.traps);
  assert.ok(G.mobs.some(o => o.type === DUNGEON.boss.type));
  for(const t of G.traps) for(const o of t.mobs) assert.equal(o.hp, Math.round(mobHp(o.type, k)*TRAP.hpMul), 'PV des mobs de l\'area');
  const zone = (KHOLE.w - KHOLE.spawnCols) * KHOLE.h;
  assert.equal(G.treasures.size, Math.round(zone * KHOLE.treasurePct / 100));
  for(const t of G.treasures.values()){ assert.equal(t.item, treasureItem(k)); assert.equal(G.tiles[t.y][t.x], TREASURE_BLOCK); }
  const c = G.areas[k].counts;
  /* le donjon et l'intérieur des pièges prennent des cases : les % se retrouvent parmi les blocs restants */
  const blocks = Object.keys(KHOLE.comp).reduce((s, key) => s + (c[key] || 0), 0);
  for(const ore of ['iron', 'gold', 'graphite', 'diamond'])
    assert.ok(Math.abs(100*c[ore]/blocks - KHOLE.comp[ore]) <= 5, `${ore} : ${c[ore]} sur ${blocks} (≈ ${KHOLE.comp[ore]} %)`);
  assert.equal(G.unlockedAreas, k + 1);
});

test('dans la dimension : pas d\'oxygène consommé, pods sans limite (il ne remonte jamais), rien à débloquer, pas d\'autres mobs', () => {
  const { G } = opened();
  run(G, KHOLE.warn + DT);
  const m = G.miners[0], ox = m.ox, depth = G.stats.maxDepth, k = G.khole.k, since = G.t;
  m.load = m.carac.pods + 50;                       // pods pleins (et plus)
  G.areas[k].oreMined = G.areas[k].oreTotal;
  assert.equal(tryUnlock(G), false);
  run(G, 60);
  assert.equal(m.ox, ox);
  assert.ok(G.miners.every(q => q.mode !== 'return' && q.mode !== 'surface'), 'personne ne remonte');
  assert.ok(!G.log.some(l => /remonte/.test(l.msg) && l.t > since));
  assert.ok(G.stats.mined > 0, 'ils minent');
  assert.ok(G.mobs.every(o => o.dungeon != null || o.trap != null), 'seulement le boss et les mobs des pièges');
  assert.equal(G.stats.maxDepth, depth, 'la profondeur de la dimension ne compte pas');
});

test('retour : tout le groupe à la surface de la mine, mine figée, le portail a disparu ; ce qu\'il porte est gardé', () => {
  const { G, h } = opened();
  run(G, KHOLE.warn + DT);
  const K = G.khole; assert.ok(K);
  const tiles = K.world.tiles.map(r => r.slice()), mobs = JSON.stringify(K.world.mobs), areas = JSON.stringify(K.world.areas);
  run(G, KHOLE.duration - 1);
  const carried = G.miners.map(m => ({ ...m.inv }));
  assert.ok(carried.some(inv => Object.keys(inv).length > 0), 'ils portent ce qu\'ils ont miné');
  run(G, 1 + DT);
  assert.equal(G.khole, null);
  assert.ok(G.miners.every(m => m.y === 0 && Math.abs(m.x - SPAWN_X) <= 1), 'à la surface');
  G.miners.forEach((m, i) => assert.deepEqual(m.inv, carried[i], 'ce qu\'il porte est gardé'));
  assert.equal(JSON.stringify(G.areas), areas, 'rien n\'a été débloqué ni compté dans la mine');
  assert.equal(G.tiles[h.y][h.x], 0, 'le portail a disparu');
  tiles[h.y][h.x] = 0;
  let diff = 0;
  for(let y=0; y<tiles.length; y++) for(let x=0; x<W; x++) if(tiles[y][x] !== G.tiles[y][x]) diff++;
  assert.equal(diff, 0, 'mine figée');
  assert.ok(JSON.parse(mobs).every(o => G.mobs.some(q => q.id === o.id)), 'les mobs de la mine sont toujours là');
});

test('fin de session pendant le k hole : retour dans la mine d\'abord, bilan de la mine', () => {
  const { G } = opened();
  run(G, KHOLE.warn + DT);
  const areas = G.khole.world.unlockedAreas;
  endSession(G);
  assert.equal(G.khole, null);
  assert.equal(G.summary.areasUnlocked, areas - 1);
});

test('un joueur part pendant le k hole : les autres reviennent à la surface ; le dernier qui part termine la session', () => {
  const { G } = opened();
  run(G, KHOLE.warn + DT);
  const stay = G.miners[1];
  assert.equal(leaveSession(G, G.miners[0]), true);
  run(G, KHOLE.duration);
  assert.equal(G.khole, null);
  assert.equal(stay.y, 0);
  assert.equal(leaveSession(G, stay), true);
  assert.equal(G.over, true);
});

test('déterministe : même seed, même partie (aller, dimension, retour)', () => {
  const play = () => { const { G } = opened(); run(G, KHOLE.warn + 60);
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
