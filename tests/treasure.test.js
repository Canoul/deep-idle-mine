/* Coffres au trésor : un tirage par area, butin déterministe, ouverture, attrait pour l'IA. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W, AREA_H, AREAS, IDS, TREASURE, TREASURE_BLOCK, BLOCKS } from '../src/config.js';
import { newSession } from '../src/sim/session.js';
import { genArea, typeOf } from '../src/sim/world.js';
import { decide } from '../src/sim/ai.js';
import { mineBlock } from '../src/sim/actions.js';
import { updateLight } from '../src/sim/light.js';
import { worldFrom } from './helpers.js';

/* change temporairement la probabilité de toutes les areas */
function withChance(p, fn){
  const old=AREAS.map(a=>a.chestChance);
  AREAS.forEach(a=>{ a.chestChance=p; });
  try { return fn(); } finally { AREAS.forEach((a,i)=>{ a.chestChance=old[i]; }); }
}
const countTreasures = G => G.tiles.reduce((s,row)=>s+row.filter(t=>t===TREASURE_BLOCK).length, 0);

test('catégorie treasure', () => {
  assert.equal(typeOf(TREASURE_BLOCK), 'treasure');
});

test('probabilité 0 : jamais de coffre ; 1 : exactement un par area', () => {
  withChance(0, () => {
    for(let seed=1;seed<=20;seed++){ const G=newSession(seed); assert.equal(countTreasures(G), 0); assert.equal(G.areas[0].treasure, null); }
  });
  withChance(1, () => {
    for(let seed=1;seed<=20;seed++){
      const G=newSession(seed); for(let k=1;k<=5;k++) genArea(G,k);
      assert.equal(countTreasures(G), 6);
      for(const a of G.areas){ assert.ok(a.treasure); assert.equal(G.tiles[a.treasure.y][a.treasure.x], TREASURE_BLOCK); }
    }
  });
});

test('fréquence observée proche de la probabilité configurée (30 %)', () => {
  let n=0, c=0;
  for(let seed=1;seed<=600;seed++){ const G=newSession(seed); genArea(G,1); for(const a of G.areas){ n++; if(a.treasure) c++; } }
  const f=c/n;
  assert.ok(Math.abs(f-AREAS[0].chestChance)<0.05, `fréquence ${f.toFixed(3)}`);
});

test('coffre et butin déterministes ; butin = minerais de l\'area', () => {
  withChance(1, () => {
    const A=newSession(77), B=newSession(77);
    for(let k=1;k<=5;k++){ genArea(A,k); genArea(B,k); }
    for(let k=0;k<=5;k++){
      assert.deepEqual(A.areas[k].treasure, B.areas[k].treasure);
      const loot=A.areas[k].treasure.loot, comp=A.areas[k].comp;
      assert.equal(Object.values(loot).reduce((s,v)=>s+v,0), TREASURE.oreLoot);
      for(const id in loot) assert.ok(Object.keys(comp).some(n=>IDS[n]===+id), `area ${k} : ${BLOCKS[id].name} absent de l'area`);
    }
  });
});

test('le coffre remplace un bloc de terrain, pas un minerai ni du vide', () => {
  withChance(1, () => {
    for(let seed=1;seed<=20;seed++){
      const G=newSession(seed), a=G.areas[0];
      assert.equal(a.counts.treasure, 1);
      assert.equal(a.oreTotal, Math.round(0.10*W*AREA_H), 'les minerais ne bougent pas');
    }
  });
});

test('ouvrir un coffre : butin + Trésor dans l\'inventaire, ne compte pas pour le déblocage', () => {
  const G=worldFrom([
    '',
    'd'.repeat(50),
    '#@T#',
  ]);
  const m=G.miners[0];
  G.treasures.set(2*W+2, {k:0, x:2, y:2, loot:{[IDS.coal]:4, [IDS.iron]:2}, opened:false});
  const before=G.areas[0].oreMined;
  mineBlock(G,m,2,2);
  assert.equal(G.tiles[2][2], 0);
  assert.equal(m.inv.Charbon, 4);
  assert.equal(m.inv.Fer, 2);
  assert.equal(m.inv[TREASURE.item], TREASURE.itemCount);
  assert.equal(m.load, 4*BLOCKS[IDS.coal].w + 2*BLOCKS[IDS.iron].w + TREASURE.itemWeight*TREASURE.itemCount);
  assert.equal(G.areas[0].oreMined, before);
  assert.equal(m.stats.ore, 0);
  assert.equal(m.stats.treasures, 1);
  assert.equal(G.stats.treasures, 1);
  assert.ok(G.treasures.get(2*W+2).opened);
});

test('IA : un coffre au trésor découvert est visé, même face à un charbon', () => {
  const G=worldFrom([
    '',
    'd'.repeat(50),
    '#c @   T#',
    '#########',
  ]);
  const m=G.miners[0];
  G.torches.push({x:3,y:2}); updateLight(G);
  decide(G,m);
  assert.deepEqual(m.target, {x:7,y:2});
  assert.equal(m.status, 'Va ouvrir un coffre au trésor');
});

test('IA : un coffre au trésor non découvert n\'attire pas le mineur', () => {
  const G=worldFrom([
    '',
    'd'.repeat(50),
    '#  @   T#',
    '#########',
  ]);
  G.seen[2][7]=0;
  const m=G.miners[0];
  G.torches.push({x:3,y:2}); updateLight(G);
  decide(G,m);
  assert.notDeepEqual(m.target, {x:7,y:2});
});
