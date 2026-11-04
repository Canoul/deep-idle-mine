/* Raid : exploration du noir par zones, treuil au lancement, départ réparti, coup qui repousse sans fatigue
   (04/11/2026 soir, Geoffrey, après la partie seed 262283490) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RAID, STATS, W, AREA_Y0, AREA_H, IDS, TEAM } from '../src/config.js';
import { newSession, tick } from '../src/sim/session.js';
import { areaTop } from '../src/sim/world.js';
import { zoneOf, zoneCount, zoneOpen, markScouted, pickZone, unseenShare } from '../src/sim/raid/scout.js';
import { newCerbere, tickCerbere } from '../src/sim/raid/cerbere.js';
import { minerSpecs } from '../src/shared/game.js';
import './helpers.js';

const spec = (i, o = {}) => ({ name: 'M' + i, account: 'A' + i, carac: { ...STATS, damage: 20, mineSpeed: 2, ...(o.carac || {}) },
                               skills: o.skills || {}, skillTree: o.tree ?? 'mineur', spells: [], x: o.x, home: o.x });
const fill = (n, v) => new Float64Array(n).fill(v);

test('zones : elles couvrent les lignes à Indices (sous clueMinDepth), sans déborder', () => {
  const y0 = AREA_Y0 + RAID.mine.clueMinDepth, y1 = AREA_Y0 + RAID.mine.areas * AREA_H - 1;
  const zs = Array.from({ length: zoneCount() }, (_, id) => zoneOf(id));
  assert.equal(Math.min(...zs.map(z => z.y0)), y0);
  assert.equal(Math.max(...zs.map(z => z.y1)), y1);
  assert.equal(Math.max(...zs.map(z => z.x1)), W - 1);
  const cells = zs.reduce((s, z) => s + (z.x1 - z.x0 + 1) * (z.y1 - z.y0 + 1), 0);
  assert.equal(cells, W * (y1 - y0 + 1), 'chaque case dans une seule zone');
});

test('zones : faite une fois visitée ou vue ; une zone visée par un autre est laissée', () => {
  const G = newSession(3, { miners: [spec(0), spec(1)], raid: true });
  const [a, b] = G.miners;
  const dist = fill(G.tiles.length * W, 0);
  for(let id = 0; id < zoneCount(); id++){ const z = zoneOf(id); dist[z.cy * W + z.cx] = 10 + id; }   // la zone 0 est la plus proche
  assert.equal(pickZone(G, a, dist), 0);
  b.scout = 0;
  assert.equal(pickZone(G, a, dist), 1, 'zone 0 visée par b : a prend la suivante');
  markScouted(G, 1); assert.ok(!zoneOpen(G, 1));
  assert.equal(pickZone(G, a, dist), 2);
  const z = zoneOf(2);
  for(let y = z.y0; y <= z.y1; y++) for(let x = z.x0; x <= z.x1; x++) G.seen[y][x] = 1;
  assert.equal(unseenShare(G, z), 0); assert.ok(!zoneOpen(G, 2), 'zone déjà vue');
  assert.equal(pickZone(G, a, dist), 3);
});

test('IA : sans Indice en vue, ils explorent le noir chacun dans sa zone, au lieu de creuser jusqu\'au fond', () => {
  const G = newSession(11, { miners: [spec(0, { x: 10 }), spec(1, { x: 12 }), spec(2, { x: 40 })], raid: true });
  for(let y = 0; y < G.tiles.length; y++) for(let x = 0; x < W; x++) if(G.tiles[y][x] === IDS.clue) G.tiles[y][x] = IDS.stone;   // aucun Indice à trouver
  const zones = new Set();
  let maxY = 0, sawScout = false;
  for(let t = 0; t < 120 / 0.1; t++){
    tick(G);
    for(const m of G.miners){ maxY = Math.max(maxY, m.y); if(m.status === 'Explore le noir') sawScout = true; }
    const ids = G.miners.map(m => m.scout).filter(s => s != null);
    if(ids.length >= 2) assert.equal(new Set(ids).size, ids.length, 'jamais deux mineurs sur la même zone');
    ids.forEach(s => zones.add(s));
  }
  assert.ok(sawScout, 'statut « Explore le noir »');
  assert.ok(zones.size >= 3, `plusieurs zones explorées (${zones.size})`);
  assert.ok(G.raid.scouted?.size >= 1, 'zones faites');
  assert.ok(maxY < AREA_Y0 + RAID.mine.areas * AREA_H - 1, `pas tout droit au fond en 2 min (au plus bas ${maxY})`);
});

test('treuil : au lancement du raid, le logisticien qui a le skill part le poser jusqu\'en haut de la dernière area', () => {
  const G = newSession(4, { miners: [spec(0), spec(1, { tree: 'logisticien', skills: { winch: 1 } })], raid: true });
  assert.equal(G.miners[0].winchJob ?? null, null);
  assert.deepEqual(G.miners[1].winchJob, { bottom: areaTop(RAID.mine.areas - 1) });
  const L = newSession(4, { miners: [spec(0, { tree: 'logisticien', skills: { winch: 1, glyph_winch: 1 } })], raid: true });
  assert.deepEqual(L.miners[0].winchJob, { bottom: areaTop(RAID.mine.areas - 1), lift: true }, 'glyphe : l\'ascenseur');
  const M = newSession(4, { miners: [spec(0, { tree: 'logisticien', skills: { winch: 1 } })] });
  assert.equal(M.miners[0].winchJob ?? null, null, 'mine normale : seulement au déblocage');
});

test('départ : à plus de 3 joueurs (raid), tous répartis sur la largeur ; à 3, les places habituelles', () => {
  const xs = minerSpecs({ mode: 'mine', players: [], bots: 10 }).map(s => s.x);
  assert.equal(xs.length, 10);
  for(let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= Math.floor(W / 10), `écart régulier (${xs})`);
  assert.deepEqual(minerSpecs({ mode: 'mine', players: [], bots: 3 }).map(s => s.x), TEAM.map(t => t.x));
});

test('Cerbère : esquiver le coup qui repousse ne fatigue pas (la Morsure garde sa chance)', () => {
  const G = newCerbere(5, { miners: [spec(0, { carac: { tenacity: 1e6 } })] });
  const m = G.miners[0];
  G.next.bite = G.next.magma = 1e9;
  m.x = G.boss.x - 1; m.y = G.floorY;
  const x0 = m.x;
  G.next.sweep = G.t; tickCerbere(G);
  assert.equal(m.x, x0, 'esquivé (ténacité au max)');
  assert.ok(!m.tenTired, 'pas fatigué');
  m.tenTired = true; G.next.sweep = G.t; tickCerbere(G);
  assert.ok(m.tenTired, 'une fatigue d\'avant reste pour la mécanique suivante');
});
