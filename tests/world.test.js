import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W, AREA_H, AREA_Y0, IDS, BARRIER, AREAS, TREASURE_BLOCK, DUNGEON_WALL, JUDGMENT } from '../src/config.js';
import { newSession } from '../src/sim/session.js';
import { areaOf, areaTop, tileAt, supported, landing, genArea, typeOf } from '../src/sim/world.js';
import { mulberry32 } from '../src/core/rng.js';
import { worldFrom } from './helpers.js';

const countRows = (G, y0, y1) => { const c={}; for(let y=y0;y<=y1;y++) for(const t of G.tiles[y]) c[t]=(c[t]||0)+1; return c; };

test('RNG déterministe : même seed, même suite', () => {
  const a=mulberry32(42), b=mulberry32(42);
  for(let i=0;i<100;i++) assert.equal(a(), b());
});

test('génération déterministe : même seed → même monde', () => {
  const A=newSession(123456), B=newSession(123456);
  assert.deepEqual(A.tiles, B.tiles);
  assert.deepEqual(A.mobs, B.mobs);
});

test('seeds différentes → mondes différents', () => {
  assert.notDeepEqual(newSession(1).tiles, newSession(2).tiles);
});

test('couche 1 toujours en terre, hors de toute area', () => {
  for(const seed of [1, 99, 123456]){
    const G=newSession(seed);
    assert.ok(G.tiles[1].every(t=>t===IDS.dirt));
  }
  assert.equal(areaOf(0), -1); assert.equal(areaOf(1), -1);
  const last0=AREA_Y0+AREA_H-1;   // dernière couche de l'area 0
  assert.equal(areaOf(2), 0);  assert.equal(areaOf(last0), 0); assert.equal(areaOf(last0+1), 1);
  assert.equal(areaTop(0), 2); assert.equal(areaTop(1), last0+1);
});

test('area 0 : W×AREA_H blocs, comptes exacts (52/33/10/5 %), 10 % de charbon', () => {
  const N=W*AREA_H, G=newSession(777), c=countRows(G, 2, AREA_Y0+AREA_H-1);
  assert.equal(G.tiles.length, 1+1+AREA_H);
  assert.equal(c[IDS.dirt]+c[IDS.stone]+c[IDS.coal]+c[IDS.air]+(c[TREASURE_BLOCK]||0), W*AREA_H);
  assert.equal(c[IDS.coal], Math.round(0.10*N));
  assert.equal(G.areas[0].oreTotal, Math.round(0.10*N));
  assert.ok(Math.abs(c[IDS.dirt]-0.52*N)<=2 && Math.abs(c[IDS.stone]-0.33*N)<=2);
  assert.ok(Math.abs(c[IDS.air]-0.05*N)<=1, `vide : ${c[IDS.air]}`);
});

test('chaque area (0 à 6) : blocs posés = comptes de l\'area, comptes = % (à l\'arrondi près)', () => {
  const G=newSession(5);
  for(let k=1;k<=6;k++) genArea(G,k);
  for(let k=0;k<=6;k++){
    const a=G.areas[k], comp=AREAS[Math.min(k,AREAS.length-1)].comp, c=countRows(G, areaTop(k), areaTop(k)+AREA_H-1);
    /* blocs posés par-dessus la composition : donjon (murs, intérieur vide), treasure, résidus (Jugement) */
    const extra=(c[DUNGEON_WALL]||0)+(c[TREASURE_BLOCK]||0)+(c[IDS.residueAngel]||0)+(c[IDS.residueDemon]||0);
    const replaced=extra+(a.counts.air||0)-Math.round((comp.air||0)*W*AREA_H/100);
    let total=0;
    for(const n in comp){
      assert.equal(c[IDS[n]]||0, a.counts[n]||0, `area ${k} ${n} : posés ≠ comptés`);
      // arrondis (au plus 1 bloc par entrée, absorbés par le terrain principal) + blocs remplacés (donjon, treasure, résidus)
      assert.ok(Math.abs(a.counts[n]-comp[n]*W*AREA_H/100)<=3+replaced, `area ${k} ${n} : ${a.counts[n]}`);
      total+=c[IDS[n]]||0;
    }
    for(const key of ['residueAngel','residueDemon']) assert.equal(c[IDS[key]]||0, a.counts[key]||0, `area ${k} ${key} : posés ≠ comptés`);
    assert.equal(total+extra, W*AREA_H, `area ${k} : aucun autre bloc`);
    for(const n in comp) if(typeOf(IDS[n])==='ore' && !G.dungeons.some(d=>d.k===k))
      assert.equal(c[IDS[n]], Math.round(comp[n]*W*AREA_H/100), `area ${k} ${n} : minerais exacts`);
  }
});

test('résidus (Jugement) : aucun avant l\'area 4, puis 0,5 % de chaque sorte, à la place de terrain, déterministes', () => {
  const G=newSession(5), H=newSession(5);
  for(let k=1;k<=6;k++){ genArea(G,k); genArea(H,k); }
  const n=Math.round(W*AREA_H*JUDGMENT.pct/100);
  for(let k=0;k<=6;k++){
    const c=countRows(G, areaTop(k), areaTop(k)+AREA_H-1);
    const want=k>=JUDGMENT.fromArea ? n : 0;
    assert.equal(c[IDS.residueAngel]||0, want, `area ${k} ange`);
    assert.equal(c[IDS.residueDemon]||0, want, `area ${k} démon`);
  }
  assert.deepEqual(G.tiles, H.tiles, 'même seed, même mine');
});

test('compositions : chaque area totalise 100 %', () => {
  for(const a of AREAS) assert.equal(Object.values(a.comp).reduce((s,v)=>s+v,0), 100);
});

test('pierre dure : absente avant l\'area 3, présente ensuite', () => {
  const G=newSession(9);
  for(let k=1;k<=5;k++) genArea(G,k);
  const hard = k => countRows(G, areaTop(k), areaTop(k)+AREA_H-1)[IDS.hardstone]||0;
  assert.equal(hard(2), 0);
  assert.ok(hard(3)>0 && hard(4)>hard(3) && hard(5)>hard(4));
});

test('poches de vide : cachées tant qu\'elles ne sont pas découvertes', () => {
  const G=newSession(4242);
  let air=0, seenAir=0;
  for(let y=areaTop(0)+3;y<areaTop(0)+AREA_H;y++) for(let x=0;x<W;x++) if(G.tiles[y][x]===0){ air++; if(G.seen[y][x]) seenAir++; }
  assert.ok(air>0);
  assert.equal(seenAir, 0);
});

test('génération des areas profondes déterministe', () => {
  const A=newSession(31), B=newSession(31);
  for(let k=1;k<=5;k++){ genArea(A,k); genArea(B,k); }
  assert.deepEqual(A.tiles, B.tiles);
});

test('mimics placés sur des minerais de leur area', () => {
  const G=newSession(31337);
  for(const o of G.mobs.filter(o=>o.type==='mimic')){
    assert.ok(o.y>=AREA_Y0 && o.y<AREA_Y0+AREA_H);
    assert.equal(G.tiles[o.y][o.x], o.ore);
  }
});

test('sous la dernière area débloquée : barrière', () => {
  const G=newSession(1);
  assert.equal(tileAt(G, 10, AREA_Y0+AREA_H), BARRIER);
  assert.notEqual(tileAt(G, 10, AREA_Y0+AREA_H-1), BARRIER);
});

test('gravité : règles d\'appui', () => {
  const G=worldFrom([
    '',          // 0 surface
    '#   ##',    // 1
    '# H ##',    // 2
    '# H ##',    // 3
    '######',    // 4
  ]);
  assert.equal(supported(G,3,3), true,  'bloc dessous');
  assert.equal(supported(G,2,2), true,  'sur une échelle');
  assert.equal(supported(G,2,1), true,  'au sommet d\'une échelle (échelle juste dessous)');
  assert.equal(supported(G,3,1), false, 'vide dessous, sans échelle : il tombe');
  assert.deepEqual(landing(G,3,1), {y:3, n:2}, 'il tombe de 2 cases jusqu\'au sol');
});

test('quota : seuls les minerais minés DANS la dernière area ouverte comptent pour ouvrir la suivante', async () => {
  const { newSession } = await import('../src/sim/session.js');
  const { mineBlock } = await import('../src/sim/actions.js');
  const { unlockNeed, areaTop } = await import('../src/sim/world.js');
  const G = newSession(5), m = G.miners[0];
  G.shinyRng = () => 0.99;
  const dig = (y) => { G.tiles[y][0] = IDS.coal; mineBlock(G, m, 0, y); };
  G.areas[0].oreMined = unlockNeed(G.areas[0]) - 1;
  dig(areaTop(0) + 3);
  assert.equal(G.unlockedAreas, 2, 'area 1 ouverte au seuil de l\'area 0');
  for(let i = 0; i < 50; i++) dig(areaTop(0) + 5);               // on continue de miner dans l'area 0
  assert.equal(G.areas[1].oreMined, 0, 'les minerais de l\'area 0 ne comptent pas pour l\'area 1');
  assert.equal(G.unlockedAreas, 2);
  G.areas[1].oreMined = unlockNeed(G.areas[1]) - 1;
  dig(areaTop(1) + 2);
  assert.equal(G.unlockedAreas, 3, 'un minerai de l\'area 1 ouvre l\'area 2');
});

test('panneau de la mine : l\'objectif suit la dernière area ouverte, pas l\'area où se trouve le mineur', async () => {
  const { objectiveHtml } = await import('../src/ui/hud.js');
  const G = { unlockedAreas:2, areas:[{ oreMined:250, oreTotal:250 }, { oreMined:12, oreTotal:400 }] };
  const h = objectiveHtml(G);
  assert.match(h, /minerais de l'area 1/);
  assert.match(h, /12 \/ 160/);
  assert.match(h, /Area 2/);
});
