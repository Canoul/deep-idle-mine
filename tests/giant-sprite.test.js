/* Sprite du Bloc géant (scripts/gen_giant.py, 02/11/2026, « Géode éventrée ») : pleine résolution, un bloc plein posé au sol */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { GIANT, TEXTURES } from '../src/config.js';

/* PNG RGBA écrit par gen_textures.py (png_wh : un seul IDAT, filtre 0 sur chaque ligne) */
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

test('Bloc géant : 16 pixels par case (GIANT.block × GIANT.block cases), dans la liste des textures', () => {
  const { w, h } = readPng('giant_block');
  assert.deepEqual([w, h], [GIANT.block * 16, GIANT.block * 16]);
  assert.ok(TEXTURES.includes('giant_block'));
});

test('Bloc géant : un bloc plein (seulement les coins ébréchés transparents), posé sur toute la dernière ligne', () => {
  const g = readPng('giant_block');
  let empty = 0;
  for(let y = 0; y < g.h; y++) for(let x = 0; x < g.w; x++) if(g.px(x, y)[3] === 0) empty++;
  assert.ok(empty < g.w * g.h * 0.03, `${empty} pixels transparents`);
  for(let x = 0; x < g.w; x++) assert.equal(g.px(x, g.h - 1)[3], 255, `pied du bloc, x = ${x}`);
});

test('Bloc géant : des cristaux de couleur (géode), pas un bloc de pierre grise', () => {
  const g = readPng('giant_block');
  const hues = new Set();
  for(let y = 0; y < g.h; y++) for(let x = 0; x < g.w; x++){
    const [r, gg, b, a] = g.px(x, y), max = Math.max(r, gg, b), min = Math.min(r, gg, b);
    if(a && max > 150 && max - min > 90){
      const h = max === r ? (gg - b) / (max - min) : max === gg ? 2 + (b - r) / (max - min) : 4 + (r - gg) / (max - min);
      hues.add(Math.floor(((h * 60 + 360) % 360) / 45));   // 8 secteurs de teinte
    }
  }
  assert.ok(hues.size >= 6, `${hues.size} teintes vives`);
});

test('fontaine et torche de la salle : 1 × 2 cases (16 × 32), posées au sol', () => {
  for(const name of ['giant_fountain', 'giant_torch']){
    const g = readPng(name);
    assert.deepEqual([g.w, g.h], [16, 32], name);
    assert.ok(TEXTURES.includes(name), name);
    let ground = 0;
    for(let x = 0; x < g.w; x++) if(g.px(x, g.h - 1)[3]) ground++;
    assert.ok(ground >= 6, `${name} : ${ground} pixels sur la dernière ligne`);
  }
});
