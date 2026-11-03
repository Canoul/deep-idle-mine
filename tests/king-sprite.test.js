/* Sprite du roi gobelin (scripts/gen_king.py, 03/11/2026, « roi guerrier balafré ») : taille du boss, posé au sol, il
   porte son butin (couronne d'or, cape rouge, hermine blanche) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { INSTANCE, TEXTURES } from '../src/config.js';

function readPng(name){
  const b = readFileSync(`textures/${name}.png`), w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  let o = 8, idat = [];
  while(o < b.length){
    const len = b.readUInt32BE(o), type = b.toString('latin1', o + 4, o + 8);
    if(type === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const px = (x, y) => [...raw.subarray(y * (w * 4 + 1) + 1 + x * 4, y * (w * 4 + 1) + 1 + x * 4 + 4)];
  return { w, h, px };
}

test('roi gobelin : 16 pixels par case (INSTANCE.boss : 3 × 3 cases = 48 × 48), dans la liste des textures', () => {
  const g = readPng('goblin_king');
  assert.deepEqual([g.w, g.h], [INSTANCE.boss.w * 16, INSTANCE.boss.h * 16]);
  assert.ok(TEXTURES.includes('goblin_king'));
});

test('roi gobelin : pieds sur la dernière ligne, silhouette massive', () => {
  const g = readPng('goblin_king');
  let ground = 0, filled = 0;
  for(let x = 0; x < g.w; x++) if(g.px(x, g.h - 1)[3]) ground++;
  for(let y = 0; y < g.h; y++) for(let x = 0; x < g.w; x++) if(g.px(x, y)[3]) filled++;
  assert.ok(ground >= 10, `${ground} pixels au sol`);
  assert.ok(filled > g.w * g.h * 0.55, `${filled} pixels pleins`);
});

test('roi gobelin : il porte son butin (or de la couronne en haut, cape rouge, hermine blanche)', () => {
  const g = readPng('goblin_king');
  let gold = 0, red = 0, white = 0;
  for(let y = 0; y < g.h; y++) for(let x = 0; x < g.w; x++){
    const [r, gg, b, a] = g.px(x, y);
    if(!a) continue;
    if(y < 12 && r > 200 && gg > 140 && b < 120) gold++;
    if(r > 140 && gg < 60 && b < 60) red++;
    if(r > 200 && gg > 200 && b > 200) white++;
  }
  assert.ok(gold >= 20, `or ${gold}`);
  assert.ok(red >= 15, `rouge ${red}`);
  assert.ok(white >= 20, `blanc ${white}`);
});
