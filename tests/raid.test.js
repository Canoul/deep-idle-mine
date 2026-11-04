/* Raid 1 : Cerbère (04/11/2026, Geoffrey ; spec docs/superpowers/specs/2026-11-04-raid-cerbere-design.md) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RAID, BLOCKS, IDS, AREA_Y0, AREA_H, W, STATS, DT } from '../src/config.js';
import { newSession, tick } from '../src/sim/session.js';
import { newCerbere, tickCerbere, pickTargets, bitten } from '../src/sim/raid/cerbere.js';
import { newRaid, tickRaid, terrainLeft, leaveRaid } from '../src/sim/raid/session.js';
import './helpers.js';

const C = RAID.cerbere;
const spec = (i, o = {}) => ({ name: 'M' + i, account: 'A' + i, carac: { ...STATS, damage: 20, mineSpeed: 2, ...(o.carac || {}) }, skills: o.skills || {}, skillTree: o.tree ?? 'mineur', spells: [] });

test('minage : 2 areas pleines, que du terrain en bandes (terre, pierre, pierre dure, pierre des enfers), tout connu, pas de mobs', () => {
  const G = newSession(5, { miners: [spec(0)], raid: true });
  assert.equal(G.unlockedAreas, 2);
  assert.equal(BLOCKS[IDS.hellstone].hard, 2 * BLOCKS[IDS.hardstone].hard);
  const at = ry => G.tiles[AREA_Y0 + ry];
  for(let ry = 0; ry < 2 * AREA_H; ry++) for(let x = 0; x < W; x++){
    const t = at(ry)[x]; assert.equal(BLOCKS[t].type, 'terrain', `${x},${ry}`); assert.equal(G.seen[AREA_Y0 + ry][x], 1);
  }
  assert.equal(at(5)[10], IDS.dirt); assert.equal(at(30)[10], IDS.stone); assert.equal(at(60)[10], IDS.hardstone); assert.equal(at(90)[10], IDS.hellstone);
  assert.equal(terrainLeft(G), 2 * W * AREA_H);
  for(let i = 0; i < 3000; i++) tick(G);
  assert.equal(G.mobs.length, 0, 'pas de mobs');
  assert.ok(terrainLeft(G) < 2 * W * AREA_H, 'il mine');
});

test('Cerbère : ses 3 cibles d\'abord parmi ceux qui le provoquent ; toutes déjà mordues → elles meurent', () => {
  const G = newCerbere(1, { miners: Array.from({ length: 6 }, (_, i) => spec(i)) });
  G.boss.taunts.add(0); G.boss.taunts.add(1);
  for(let k = 0; k < 20; k++){ const ts = pickTargets(G).map(m => m.id); assert.equal(ts.length, 3); assert.ok(ts.includes(0) && ts.includes(1)); }
  const [a, b] = G.miners; const c = G.miners[2];
  G.boss.taunts.add(2);
  for(const m of [a, b, c]) m.bitUntil = G.t + 100;
  G.next.bite = 0; tickCerbere(G);
  assert.ok(a.dead && b.dead && c.dead, 'les 3 cibles déjà mordues meurent');
  assert.ok(!G.miners[3].dead);
});

test('Cerbère : une morsure dure bite.last s ; la ténacité peut l\'éviter', () => {
  const G = newCerbere(2, { miners: Array.from({ length: 3 }, (_, i) => spec(i)) });
  G.next.bite = 0; G.next.sweep = G.next.magma = 1e9; tickCerbere(G);
  for(const m of G.miners) assert.ok(bitten(G, m));
  G.next.bite = 1e9;
  while(!G.over && G.t < C.bite.last + 0.5) tickCerbere(G);
  assert.ok(G.miners.every(m => !bitten(G, m) && !m.dead), 'la morsure est passée');
  const T = newCerbere(3, { miners: Array.from({ length: 3 }, (_, i) => spec(i, { carac: { tenacity: 100 } })) });
  T.next.bite = 0; tickCerbere(T);
  assert.ok(T.miners.every(m => !bitten(T, m)), 'ténacité 100 % (linéaire dans les tests) : aucune morsure');
});

test('Magma : Durci (intouchable), libéré quand les autres le minent ; la ténacité ne joue que pour la spé Mineur', () => {
  const G = newCerbere(4, { miners: [spec(0, { tree: 'barbare', carac: { tenacity: 100 } }), spec(1, { tree: 'mineur', carac: { tenacity: 100 } }), spec(2, { tree: 'logisticien' })] });
  C.magma.chance = 1;
  try { G.next.magma = 0; G.next.bite = G.next.sweep = 1e9; tickCerbere(G); } finally { C.magma.chance = 0.5; }
  const [bar, min, log] = G.miners;
  assert.ok(bar.stone, 'barbare : la ténacité ne joue pas'); assert.ok(!min.stone, 'mineur : la ténacité joue'); assert.ok(log.stone);
  assert.ok(!pickTargets(G).includes(bar), 'en pierre : pas ciblé');
  G.next.magma = 1e9;
  for(let i = 0; i < 2000 && (bar.stone || log.stone); i++) tickCerbere(G);
  assert.ok(!bar.stone && !log.stone, 'libérés par le mineur');
  assert.ok(G.stats.freed >= 2 && min.stats.mined > 0);
});

test('enragé sous 33 % : autoattaque toutes les 7 s', () => {
  const G = newCerbere(5, { miners: [spec(0)], hp: 1000 });
  G.next.bite = G.next.sweep = G.next.magma = 1e9;
  G.boss.hp = 340; G.miners[0].x = G.boss.x - 1;
  for(let i = 0; i < 50 && !G.boss.rage; i++) tickCerbere(G);
  assert.ok(G.boss.rage);
  assert.ok(G.next.bite - G.t <= C.rage.biteEvery + 1e-9);
});

test('partie complète : minage → porte (rassemblement) → arène ; temps total limité ; départ d\'un joueur', () => {
  const G = newRaid(7, { miners: [spec(0), spec(1)], hp: 50 });
  assert.equal(G.phase, 'mine');
  for(let y = AREA_Y0; y < AREA_Y0 + 2 * AREA_H; y++) G.mine.tiles[y].fill(0);   // tout miné
  for(let i = 0; i < 20; i++) tickRaid(G);
  assert.equal(G.phase, 'door');
  for(let i = 0; i < Math.round(RAID.mine.gather / DT) + 2; i++) tickRaid(G);
  assert.equal(G.phase, 'boss'); assert.equal(G.boss.miners.length, 2);
  assert.ok(leaveRaid(G, 'A1')); assert.equal(leaveRaid(G, 'A1'), false);
  while(!G.over) tickRaid(G);
  assert.ok(G.summary.success, 'Cerbère à 50 PV');
  assert.equal(G.summary.shares.length, 2); assert.ok(G.summary.shares[1].left);
});
