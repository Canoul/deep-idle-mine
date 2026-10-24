/* Gobelin : mob voleur (tacle, vol de minerais, butin) et apparitions des mobs (table par area, PV, mimics). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOBS, ITEMS, BLOCKS, IDS, AREA_Y0, AREA_H, TREASURE } from '../src/config.js';
import { tackler } from '../src/sim/ai.js';
import { killMob } from '../src/sim/actions.js';
import { tick } from '../src/sim/session.js';
import { worldFrom, run } from './helpers.js';

const STEAL_TICKS = Math.round(MOBS.goblinStealEvery / 0.1);
const corridor = () => worldFrom(['', 'd'.repeat(50), '#@'+' '.repeat(20)+'#', '#'.repeat(50)]);
/* minerai de la mine (ce que vole le gobelin) : blocs de type ore, charbon compris */
const isMineOre = k => Object.values(BLOCKS).some(b => b.type==='ore' && b.name===k);
const load = inv => Object.entries(inv).reduce((s,[k,n]) => s + ITEMS[k].w*n, 0);
const ores = inv => Object.entries(inv).filter(([k]) => isMineOre(k)).reduce((s,[,n]) => s+n, 0);

function tackled(inv){
  const G=corridor(), m=G.miners[0];
  m.inv={...inv}; m.load=load(inv); m.ox=300;
  G.mobs.push({id:99, type:'gobelin', x:m.x, y:m.y, hp:1e9, maxhp:1e9, cd:5});
  run(G, 1);   // le tacle se décide au tick des mobs
  return { G, m };
}

test('gobelin : il tacle comme une bestiole', () => {
  const { G, m } = tackled({});
  assert.equal(tackler(G,m)?.type, 'gobelin');
  const x0=m.x, y0=m.y; run(G, 50);
  assert.deepEqual([m.x,m.y], [x0,y0]);
});

test('gobelin : un minerai volé toutes les 2 s de tacle, jamais autre chose', () => {
  const T1=TREASURE.tiers[0].item;
  const { G, m } = tackled({ Charbon:3, Fer:2, Pierre:5, Chitine:1, [T1]:1 });
  run(G, STEAL_TICKS-2);   // + le tick de tacle de tackled()
  assert.equal(ores(m.inv), 5, 'rien avant 2 s');
  run(G, 1);
  assert.equal(ores(m.inv), 4, 'un minerai à 2 s');
  run(G, STEAL_TICKS*10);
  assert.equal(ores(m.inv), 0, 'tous les minerais finissent volés');
  assert.equal(m.inv.Pierre, 5); assert.equal(m.inv.Chitine, 1); assert.equal(m.inv[T1], 1);
  assert.ok(!('Charbon' in m.inv) && !('Fer' in m.inv), 'pas de pile vide qui traîne');
  assert.equal(m.load, load(m.inv), 'le poids suit l\'inventaire');
  assert.equal(G.stats.stolen, 5); assert.equal(m.stats.stolen, 5);
});

test('gobelin : rien à voler, rien ne se passe (pas de quantité négative)', () => {
  const { G, m } = tackled({ Pierre:2 });
  run(G, STEAL_TICKS*5);
  assert.deepEqual(m.inv, { Pierre:2 }); assert.equal(m.load, 4); assert.equal(G.stats.stolen, 0);
});

test('gobelin : pas de vol s\'il n\'est pas sur la case du mineur', () => {
  const G=corridor(), m=G.miners[0];
  m.inv={ Charbon:5 }; m.load=10;
  m.action={type:'wait',dur:1e9,t:0,data:{}};   // le mineur reste sur place
  // séparé du mineur par un mur : il ne peut pas l'atteindre
  G.tiles[2][3]=2;
  G.mobs.push({id:99, type:'gobelin', x:5, y:2, hp:1e9, maxhp:1e9, cd:0});
  run(G, STEAL_TICKS*5);
  assert.equal(m.inv.Charbon, 5);
});

test('gobelin vaincu : peau de gobelin et chitine', () => {
  const { G, m } = tackled({});
  const o=G.mobs[0]; killMob(G, m, o);
  assert.ok(m.inv[MOBS.goblinItem] >= 1 && m.inv[MOBS.goblinItem] <= 2);
  assert.equal(m.inv[MOBS.bugItem], MOBS.goblinChitin);
  assert.equal(m.load, load(m.inv));
  assert.equal(G.mobs.length, 0);
  assert.equal(ITEMS[MOBS.goblinItem].cat, 'mob');
});

/* apparition : on force les tirages (G.rng renvoie seq dans l'ordre : délai, type, case) dans une galerie de la ligne
   voulue, sans minerai autour */
function spawnAt(row, seq, line){
  const rows=['', 'd'.repeat(50)];
  for(let y=2; y<=row+1; y++) rows.push(y===row ? (line ?? '#@'+' '.repeat(20)+'#') : '#'.repeat(50));
  const G=worldFrom(rows), m=G.miners[0];
  m.action={type:'wait',dur:1e9,t:0,data:{}};
  let i=0; G.rng=()=>seq[i++] ?? 0; G.spawnTimer=0;
  tick(G);
  return G.mobs;
}
const rowOf = k => AREA_Y0 + k*AREA_H + 5;

test('apparition : type tiré selon l\'area du mineur (table MOBS.spawnTable), PV selon l\'area où il naît', () => {
  const cases = [   // [area, tirage du type, type attendu, PV attendus]
    [0, 0.1,  'bestiole',   50],
    [1, 0.1,  'bestiole',   57],     // 50 × 1,15 = 57,4999… (arrondi)
    [1, 0.7,  'gobelin',    100],    // gobelin dès l'area 1 : 100 × 1,15^(1−1)
    [3, 0.3,  'gobelin',    132],    // 100 × 1,15²
    [4, 0.1,  'gobelin',    152],
    [4, 0.6,  'occultiste', 150],    // occultiste dès l'area 4 (150 PV depuis le 23/10)
    [5, 0.5,  'occultiste', 173],
    [3, 0.77, 'mephite',    70],     // méphite dès l'area 3 (24/10) : 70 PV, +15 % par area
    [4, 0.7,  'mephite',    81],
    [5, 0.75, 'mephite',    93],
  ];
  for(const [k, r, type, hp] of cases){
    const mobs = spawnAt(rowOf(k), [0, r, 0]);
    assert.equal(mobs.length, 1, `area ${k}, tirage ${r}`);
    assert.equal(mobs[0].type, type, `area ${k}, tirage ${r}`);
    assert.equal(mobs[0].hp, hp, `PV area ${k}`); assert.equal(mobs[0].maxhp, hp);
  }
  assert.deepEqual(Object.values(MOBS.spawnTable).map(t => Math.round(Object.values(t).reduce((a, b) => a + b, 0) * 100)),
    [100, 100, 100, 100, 100, 100], 'chaque ligne de la table fait 100 %');
});

test('apparition : mimic = un minerai de la roche proche devient un mimic caché (aucun sans minerai)', () => {
  assert.equal(spawnAt(rowOf(0), [0, 0.9, 0]).length, 0, 'pas de minerai : pas de mimic');
  const line = '#@' + ' '.repeat(5) + 'c' + ' '.repeat(14) + '#';   // un charbon à 6 cases
  const mobs = spawnAt(rowOf(2), [0, 0.9, 0], line);
  assert.equal(mobs.length, 1); const o = mobs[0];
  assert.equal(o.type, 'mimic'); assert.equal(o.revealed, false);
  assert.equal(o.hp, Math.round(50 * 1.15 ** 2));
  assert.equal(o.ore, IDS.coal); assert.equal(o.x, 7, 'à la place du charbon (la roche ne change pas)');
});
