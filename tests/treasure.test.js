/* Coffres au trésor : un tirage par area, butin Treasure TX selon l'area, ouverture, attrait pour l'IA. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W, AREA_H, AREAS, IDS, TREASURE, TREASURE_BLOCK, BLOCKS } from '../src/config.js';
import { newSession } from '../src/sim/session.js';
import { genArea, typeOf, treasureItem, areaTop } from '../src/sim/world.js';
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

test('coffre déterministe ; butin = Treasure T1 en areas 0–2, T2 en areas 3–5 (et au-delà)', () => {
  withChance(1, () => {
    const A=newSession(77), B=newSession(77);
    for(let k=1;k<=7;k++){ genArea(A,k); genArea(B,k); }
    const want=['Treasure T1','Treasure T1','Treasure T1','Treasure T2','Treasure T2','Treasure T2','Treasure T2','Treasure T2'];
    for(let k=0;k<=7;k++){
      assert.deepEqual(A.areas[k].treasure, B.areas[k].treasure);
      assert.equal(A.areas[k].treasure.item, want[k], `area ${k}`);
      assert.equal(A.areas[k].treasure.loot, undefined, `area ${k} : plus de minerais`);
    }
  });
});

test('tiers : treasureItem suit la config', () => {
  assert.equal(treasureItem(0), 'Treasure T1');
  assert.equal(treasureItem(2), 'Treasure T1');
  assert.equal(treasureItem(3), 'Treasure T2');
  assert.equal(treasureItem(5), 'Treasure T2');
  assert.equal(treasureItem(9), TREASURE.tiers.at(-1).item, 'au-delà : dernier tier');
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

test('ouvrir un coffre : seulement un Treasure TX dans l\'inventaire, aucun minerai', () => {
  const G=worldFrom([
    '',
    'd'.repeat(50),
    '#@T#',
  ]);
  const m=G.miners[0];
  G.treasures.set(2*W+2, {k:0, x:2, y:2, item:'Treasure T1', opened:false});
  const before=G.areas[0].oreMined;
  mineBlock(G,m,2,2);
  assert.equal(G.tiles[2][2], 0);
  assert.deepEqual(m.inv, {'Treasure T1': TREASURE.itemCount});
  assert.equal(m.load, TREASURE.itemWeight*TREASURE.itemCount);
  assert.equal(G.areas[0].oreMined, before);
  assert.equal(m.stats.ore, 0);
  assert.equal(m.stats.treasures, 1);
  assert.equal(G.stats.treasures, 1);
  assert.ok(G.treasures.get(2*W+2).opened);
});

test('ouvrir un coffre d\'area 3 : Treasure T2', () => {
  const G=newSession(1);
  for(let k=1;k<=3;k++) genArea(G,k);
  const y=areaTop(3)+5, m=G.miners[0];
  G.tiles[y][10]=TREASURE_BLOCK; G.treasures.clear();
  mineBlock(G,m,10,y);
  assert.deepEqual(m.inv, {'Treasure T2': TREASURE.itemCount});
});

test('IA : un treasure découvert est visé, même face à un charbon', () => {
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
  assert.equal(m.status, 'Va ouvrir un treasure');
});

test('IA : un treasure non découvert n\'attire pas le mineur', () => {
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

test('chaque Treasure TX a son icône d\'inventaire et son entrée au catalogue', async () => {
  const { TEXTURES, ITEMS } = await import('../src/config.js');
  const { existsSync } = await import('node:fs');
  for(const t of TREASURE.tiers){
    assert.ok(TEXTURES.includes(t.tex), t.tex);
    assert.ok(existsSync(new URL(`../textures/${t.tex}.png`, import.meta.url)), t.tex+'.png');
    assert.equal(ITEMS[t.item].tex, t.tex);
    assert.equal(ITEMS[t.item].cat, 'treasure');
  }
});

test('l\'entité de la mine s\'appelle Treasure', () => {
  assert.equal(BLOCKS[TREASURE_BLOCK].name, 'Treasure');
});
