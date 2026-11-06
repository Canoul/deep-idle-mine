/* Raid 1 : Cerbère (04/11/2026, Geoffrey ; spec docs/superpowers/specs/2026-11-04-raid-cerbere-design.md) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RAID, BLOCKS, IDS, AREA_Y0, AREA_H, W, STATS, DT } from '../src/config.js';
import { newSession, tick } from '../src/sim/session.js';
import { breakBlock } from '../src/sim/actions.js';
import { newCerbere, tickCerbere, pickTargets, bitten } from '../src/sim/raid/cerbere.js';
import { newRaid, tickRaid, leaveRaid, cluesLeft } from '../src/sim/raid/session.js';
import './helpers.js';

const C = RAID.cerbere;
/* Magma (05/11) : bond en arrière, puis le souffle C.magma.breath s plus tard */
const breathe = G => { for(let i = 0; i < 100 && G.boss.magmaAt == null && !G.over; i++) tickCerbere(G); };
const spec = (i, o = {}) => ({ name: 'M' + i, account: 'A' + i, carac: { ...STATS, damage: 20, mineSpeed: 2, ...(o.carac || {}) }, skills: o.skills || {}, skillTree: o.tree ?? 'mineur', spells: [] });

test('minage : 2 areas de terrain en bandes, dans le noir, avec RAID.mine.clues Indices cachés ; un Indice miné compte', () => {
  const G = newSession(5, { miners: [spec(0)], raid: true });
  assert.equal(G.unlockedAreas, 2);
  assert.equal(BLOCKS[IDS.hellstone].hard, 2 * BLOCKS[IDS.hardstone].hard);
  const at = ry => G.tiles[AREA_Y0 + ry];
  let clues = [];
  for(let ry = 0; ry < 2 * AREA_H; ry++) for(let x = 0; x < W; x++){
    const t = at(ry)[x];
    if(t === IDS.clue){ clues.push([x, ry]); continue; }
    assert.equal(BLOCKS[t].type, 'terrain', `${x},${ry}`);
  }
  assert.equal(clues.length, RAID.mine.clues);
  assert.equal(clues.filter(([, ry]) => ry < AREA_H).length, Math.ceil(RAID.mine.clues / 2), 'moitié par area');
  assert.ok(clues.every(([, ry]) => ry >= RAID.mine.clueMinDepth), 'pas tout en haut');
  assert.equal(G.seen[AREA_Y0 + 40][10], 0, 'dans le noir');
  assert.equal(at(5)[10] === IDS.clue || at(5)[10] === IDS.dirt, true); assert.ok([IDS.hellstone, IDS.clue].includes(at(90)[10]));
  /* un Indice miné : dans le sac (lourd), il montre le plus proche encore caché ; il compte une fois au coffre */
  const [x, ry] = clues[0], m = G.miners[0];
  breakBlock(G, m, x, AREA_Y0 + ry);
  assert.equal(G.raid.found, 1); assert.equal(m.stats.clues, 1);
  assert.equal(m.inv.Indice, 1); assert.equal(m.load, BLOCKS[IDS.clue].w);
  assert.equal(clues.slice(1).filter(([cx, cy]) => G.seen[AREA_Y0 + cy][cx]).length, 1, 'le suivant est montré');
  assert.equal(cluesLeft(G), RAID.mine.clues, 'pas encore rapporté');
  G.chest.Indice = 1; assert.equal(cluesLeft(G), RAID.mine.clues - 1);
  for(let i = 0; i < 3000; i++) tick(G);
  assert.equal(G.mobs.length, 0, 'pas de mobs');
});

test('Cerbère : ses 3 cibles d\'abord parmi ceux qui le provoquent ; Morsure sans résistance → une des 3 meurt', () => {
  const G = newCerbere(1, { miners: Array.from({ length: 6 }, (_, i) => spec(i)) });
  G.boss.taunts.add(0); G.boss.taunts.add(1);
  for(let k = 0; k < 20; k++){ const ts = pickTargets(G).map(m => m.id); assert.equal(ts.length, 3); assert.ok(ts.includes(0) && ts.includes(1)); }
  G.boss.taunts.add(2);
  G.next.bite = 0; G.next.sweep = G.next.magma = 1e9; tickCerbere(G);
  const [a, b, c] = G.miners;
  assert.equal([a, b, c].filter(m => m.dead).length, 1, 'ténacité 0 : une des 3 cibles mordues meurt');
  assert.ok(!G.miners[3].dead);
});

test('Cerbère : une cible qui résiste dissipe la Morsure pour les 3 ; rien ne persiste à la suivante', () => {
  const G = newCerbere(2, { miners: [spec(0, { carac: { tenacity: 100 } }), spec(1), spec(2)] });
  G.next.sweep = G.next.magma = 1e9;
  for(let k = 0; k < 5; k++){ G.next.bite = G.t; tickCerbere(G); }
  assert.ok(G.miners.every(m => !m.dead), '5 Morsures, une cible résiste toujours : personne ne meurt');
  assert.ok(bitten(G, G.miners[1]) && !bitten(G, G.miners[0]), 'affichage : mordu / résisté');
  while(G.t < C.bite.show + 1) tickCerbere(G);
  assert.ok(!bitten(G, G.miners[1]), 'la Morsure ne persiste pas');
});

test('Magma : Durci (intouchable), libéré quand les autres le minent ; la ténacité ne joue que pour la spé Mineur', () => {
  const G = newCerbere(4, { miners: [spec(0, { tree: 'barbare', carac: { tenacity: 100 } }), spec(1, { tree: 'mineur', carac: { tenacity: 100 } }), spec(2, { tree: 'logisticien' })] });
  C.magma.chance = 1;
  try { G.next.magma = 0; G.next.bite = G.next.sweep = 1e9; breathe(G); } finally { C.magma.chance = 0.5; }
  const [bar, min, log] = G.miners;
  assert.ok(bar.stone, 'barbare : la ténacité ne joue pas'); assert.ok(!min.stone, 'mineur : la ténacité joue'); assert.ok(log.stone);
  assert.ok(!pickTargets(G).includes(bar), 'en pierre : pas ciblé');
  G.next.magma = 1e9;
  for(let i = 0; i < 2000 && (bar.stone || log.stone); i++) tickCerbere(G);
  assert.ok(!bar.stone && !log.stone, 'libérés par le mineur');
  assert.ok(G.stats.freed >= 2 && min.stats.mined > 0);
});

test('Magma : jamais sur les tanks (ceux qui provoquent Cerbère)', () => {
  const G = newCerbere(6, { miners: [spec(0, { tree: 'barbare' }), spec(1, { tree: 'logisticien' })] });
  G.boss.taunts.add(0);
  C.magma.chance = 1;
  try { G.next.magma = 0; G.next.bite = G.next.sweep = 1e9; breathe(G); } finally { C.magma.chance = 0.5; }
  assert.ok(!G.miners[0].stone && G.miners[1].stone);
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
  const G = newRaid(7, { miners: [spec(0, { carac: { tenacity: 100 } }), spec(1)], hp: 50 });   // seul en arène : il doit résister aux Morsures
  assert.equal(G.phase, 'mine');
  G.mine.chest.Indice = RAID.mine.clues;                            // tous les Indices rapportés
  for(let i = 0; i < 20; i++) tickRaid(G);
  assert.equal(G.phase, 'door');
  for(let i = 0; i < Math.round(RAID.mine.gather / DT) + 2; i++) tickRaid(G);
  assert.equal(G.phase, 'boss'); assert.equal(G.boss.miners.length, 2);
  assert.ok(leaveRaid(G, 'A1')); assert.equal(leaveRaid(G, 'A1'), false);
  while(!G.over) tickRaid(G);
  assert.ok(G.summary.success, 'Cerbère à 50 PV');
  assert.equal(G.summary.shares.length, 2); assert.ok(G.summary.shares[1].left);
});

test('groupes : Inspiration et Cri de guerre ne vont qu\'à son groupe ; les anneaux aussi', async () => {
  const { SPELL } = await import('../src/config.js');
  const { warcryOf } = await import('../src/sim/raid/cerbere.js');
  const { inspirePct } = await import('../src/sim/groups.js');
  const { raidSpecs } = await import('../src/shared/raid.js');
  const g = (i, group, o = {}) => ({ ...spec(i, o), group });
  const G = newCerbere(8, { miners: [g(0, 1, { tree: 'logisticien' }), g(1, 1), g(2, 2, { tree: 'barbare' }), g(3, 2), g(4, 1)] });
  G.miners[0].spells = ['inspiration']; G.miners[2].spells = ['war_cry'];
  G.miners[1].stone = { hp: 1e6, max: 1e6 };                        // le logisticien vient le libérer : il lance Inspiration
  G.next.bite = G.next.sweep = G.next.magma = 1e9;
  for(let i = 0; i < 600 && !inspirePct(G, G.miners[0]); i++) tickCerbere(G);
  assert.ok(inspirePct(G, G.miners[4]) > 0 && inspirePct(G, G.miners[3]) === 0, 'Inspiration : groupe 1 seulement');
  G.miners[1].stone = null; for(const m of G.miners) m.action = null;   // plus personne à libérer : on frappe
  for(let i = 0; i < 600 && !warcryOf(G, G.miners[2]); i++) tickCerbere(G);
  for(const m of [G.miners[3], G.miners[4]]){ m.x = G.miners[2].x; m.y = G.miners[2].y; }
  assert.ok(warcryOf(G, G.miners[2]), 'Cri de guerre lancé');
  assert.ok(warcryOf(G, G.miners[3]) && !warcryOf(G, G.miners[4]), 'Cri de guerre : groupe 2 seulement (même à côté)');
  /* anneaux : l'Anneau en pierre d'un joueur du groupe 1 ne va pas au groupe 2 */
  const players = ['A', 'B', 'C'].map((a, i) => ({ account: a, name: a, group: i < 2 ? 1 : 2 }));
  const rec = { mode: 'raid', seed: 1, players, gear: { A: { anneau1: { uid: 1, item: 'Anneau en pierre' } }, B: {}, C: {} } };
  const S = raidSpecs(rec);
  assert.deepEqual(S.map(s => s.group), [1, 1, 2]);
  assert.ok(S[1].rings.some(r => r.item === 'Anneau en pierre') && !S[2].rings.some(r => r.item === 'Anneau en pierre'));
  assert.ok(S[1].carac.tenacity > S[2].carac.tenacity);
});

test('Magma : il bondit de C.magma.leap cases en arrière, souffle, puis revient au contact des tanks', () => {
  const G = newCerbere(9, { miners: [spec(0, { tree: 'barbare', skills: { taunt: 1 } }), spec(1)] });
  G.next.bite = G.next.sweep = 1e9; G.next.magma = 0; G.boss.taunts.add(0);
  const x0 = G.boss.x, ch = C.magma.chance; C.magma.chance = 0;                // personne en pierre : la partie continue
  tickCerbere(G);
  assert.equal(G.boss.x, x0 + C.magma.leap, 'bond en arrière'); assert.equal(G.boss.move.from, x0);
  assert.equal(G.boss.magmaAt, null, 'il souffle un peu après');
  breathe(G);
  assert.ok(G.boss.magmaAt != null);
  /* le tank est resté loin (repoussé) : Cerbère revient jusqu'à lui */
  G.boss.taunts.add(0); const tank = G.miners[0]; tank.x = 6; tank.y = G.floorY; tank.action = { type: 'wait', t: 0, dur: 1e9, data: {} };
  for(let i = 0; i < 100 && G.boss.returnAt != null; i++) tickCerbere(G);
  assert.equal(G.boss.x, Math.max(...G.miners.filter(m => G.boss.taunts.has(m.id) && m.y === G.floorY).map(m => m.x)) + 1, 'au contact du tank le plus avancé');
  assert.ok(G.boss.x + G.boss.w <= G.w - C.magma.leap, 'de la place pour le prochain bond');
  C.magma.chance = ch;
});

test('pénétration de ténacité de Cerbère : seulement contre les tanks', async () => {
  const { penSrc } = await import('../src/sim/raid/cerbere.js');
  const fs = await import('node:fs');
  const cfg = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');   // les tests neutralisent TENACITY.pen
  assert.match(cfg, /cerbere:[1-9]\d*, cerbere_soft:0 \}/);
  const G = newCerbere(10, { miners: [spec(0), spec(1)] });
  G.boss.taunts.add(0);
  assert.equal(penSrc(G, G.miners[0]), 'cerbere'); assert.equal(penSrc(G, G.miners[1]), 'cerbere_soft');
});
