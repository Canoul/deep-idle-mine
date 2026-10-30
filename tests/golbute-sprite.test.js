/* Sprites du Golbute et du golem (scripts/gen_golbute.py, 30/10/2026) : pleine résolution, même silhouette en pierre et en cristal */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { INSTANCE, TEXTURES } from '../src/config.js';

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
  const alpha = (x, y) => raw[y * (w * 4 + 1) + 1 + x * 4 + 3];
  return { w, h, alpha };
}

test('Golbute et Golbute cristallisé : 16 pixels par case (5 × 5 cases = 80 × 80), dans la liste des textures', () => {
  const { boss } = INSTANCE.golbute;
  for(const name of ['golbute', 'golbute_crystal']){
    const { w, h } = readPng(name);
    assert.deepEqual([w, h], [boss.w * 16, boss.h * 16], name);
    assert.ok(TEXTURES.includes(name), name);
  }
});

test('Golbute : même silhouette en pierre et en cristal (pas de saut quand il se cristallise), pieds au sol', () => {
  const a = readPng('golbute'), b = readPng('golbute_crystal');
  let diff = 0, filled = 0;
  for(let y = 0; y < a.h; y++) for(let x = 0; x < a.w; x++){
    if((a.alpha(x, y) > 0) !== (b.alpha(x, y) > 0)) diff++;
    if(a.alpha(x, y) > 0) filled++;
  }
  assert.equal(diff, 0);
  assert.ok(filled > a.w * a.h * 0.5, `silhouette massive (${filled} pixels pleins)`);
  let ground = 0;
  for(let x = 0; x < a.w; x++) if(a.alpha(x, a.h - 1) > 0) ground++;
  assert.ok(ground > 20, `pieds et poings posés sur la dernière ligne (${ground} pixels)`);
});

test('golem (mob des mines, golems de la Division) : 32 × 32 (2 × 2 cases), pieds au sol', () => {
  const g = readPng('golem');
  assert.deepEqual([g.w, g.h], [32, 32]);
  assert.ok(TEXTURES.includes('golem'));
  let ground = 0, left = 0, right = 0;
  for(let x = 0; x < g.w; x++) if(g.alpha(x, g.h - 1) > 0) ground++;
  for(let y = 6; y < 18; y++) for(let x = 0; x < 16; x++){ if(g.alpha(x, y) > 0) left++; if(g.alpha(x + 16, y) > 0) right++; }
  assert.ok(ground > 10, `pieds posés sur la dernière ligne (${ground} pixels)`);
  assert.ok(right > 0 && left > 0, 'tête et dos dans le haut de l\'image');
});
