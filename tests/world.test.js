import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W, AREA_H, IDS, BARRIER, AREAS } from '../src/config.js';
import { newSession } from '../src/sim/session.js';
import { areaOf, areaTop, tileAt, supported, landing, genArea } from '../src/sim/world.js';
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
  assert.equal(areaOf(2), 0);  assert.equal(areaOf(26), 0); assert.equal(areaOf(27), 1);
  assert.equal(areaTop(0), 2); assert.equal(areaTop(1), 27);
});

test('area 0 : 1250 blocs, comptes exacts (57/33/10 %), 125 charbons', () => {
  const G=newSession(777), c=countRows(G, 2, 26);
  assert.equal(G.tiles.length, 1+1+AREA_H);
  assert.equal(c[IDS.dirt]+c[IDS.stone]+c[IDS.coal], W*AREA_H);
  assert.equal(c[IDS.coal], 125);
  assert.equal(G.areas[0].oreTotal, 125);
  assert.ok(Math.abs(c[IDS.dirt]-0.57*1250)<=1 && Math.abs(c[IDS.stone]-0.33*1250)<=1);
});

test('area 3 : composition exacte (diamants compris)', () => {
  const G=newSession(5);
  for(let k=1;k<=3;k++) genArea(G,k);
  const c=countRows(G, areaTop(3), areaTop(3)+AREA_H-1), comp=AREAS[3];
  for(const n in comp) assert.ok(Math.abs(c[IDS[n]]-comp[n]*12.5)<=1, n);
});

test('mimics placés sur des minerais de leur area', () => {
  const G=newSession(31337);
  for(const o of G.mobs.filter(o=>o.type==='mimic')){
    assert.ok(o.y>=2 && o.y<=26);
    assert.equal(G.tiles[o.y][o.x], o.ore);
  }
});

test('sous la dernière area débloquée : barrière', () => {
  const G=newSession(1);
  assert.equal(tileAt(G, 10, 27), BARRIER);
  assert.notEqual(tileAt(G, 10, 26), BARRIER);
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
