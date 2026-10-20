/* Gobelin : bestiole voleuse des areas profondes (tacle, vol de minerais, butin, apparition). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOBS, ITEMS, BLOCKS, AREA_Y0, AREA_H, TREASURE } from '../src/config.js';
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
  run(G, STEAL_TICKS-1);
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

/* apparition : on force le tirage (rng = 0 : le gobelin est tiré s'il est permis) dans une galerie à la profondeur voulue */
function spawnAt(row){
  const rows=['', 'd'.repeat(50)];
  for(let y=2; y<=row+1; y++) rows.push(y===row ? '#@'+' '.repeat(20)+'#' : '#'.repeat(50));
  const G=worldFrom(rows), m=G.miners[0];
  m.action={type:'wait',dur:1e9,t:0,data:{}};
  G.rng=()=>0; G.spawnTimer=0;
  tick(G);
  return G.mobs.filter(o=>o.type!=='mimic');
}

test('apparition : jamais de gobelin avant l\'area 3, possible à partir de l\'area 3', () => {
  const before=spawnAt(AREA_Y0 + (MOBS.goblinMinArea-1)*AREA_H + 5);
  assert.equal(before.length, 1); assert.equal(before[0].type, 'bestiole');
  const after=spawnAt(AREA_Y0 + MOBS.goblinMinArea*AREA_H + 5);
  assert.equal(after.length, 1); assert.equal(after[0].type, 'gobelin');
  assert.equal(after[0].hp, MOBS.goblinHp(0));
});
