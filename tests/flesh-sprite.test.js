/* Sprite du mur de chair (scripts/gen_flesh.py, 03/11/2026) : 1 × 6 cases, plein, et son icône (le grand œil) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { MOB_INFO, TEXTURES } from '../src/config.js';

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

test('mur de chair : 16 × 96 (1 × 6 cases), icône 16 × 16, dans la liste des textures', () => {
  assert.deepEqual([readPng('flesh_wall').w, readPng('flesh_wall').h], [16, 96]);
  assert.deepEqual([readPng('flesh_icon').w, readPng('flesh_icon').h], [16, 16]);
  for(const name of ['flesh_wall', 'flesh_icon']) assert.ok(TEXTURES.includes(name), name);
  assert.equal(MOB_INFO.chair.tex, 'flesh_icon');
});

test('mur de chair : une colonne pleine, de haut en bas (il recouvre la roche)', () => {
  const g = readPng('flesh_wall');
  for(let y = 0; y < g.h; y++){
    let n = 0;
    for(let x = 0; x < g.w; x++) if(g.px(x, y)[3]) n++;
    assert.ok(n >= 12, `ligne ${y} : ${n} pixels pleins`);
  }
});

test("mur de chair : l'icône est un morceau du mur, avec l'œil (blanc de l'œil et iris de braise)", () => {
  const g = readPng('flesh_wall'), ic = readPng('flesh_icon');
  const key = p => p.join(',');
  let at = -1;
  for(let y0 = 0; y0 + 16 <= g.h && at < 0; y0++){
    let same = true;
    for(let y = 0; y < 16 && same; y++) for(let x = 0; x < 16 && same; x++) same = key(g.px(x, y0 + y)) === key(ic.px(x, y));
    if(same) at = y0;
  }
  assert.ok(at >= 0, 'icône découpée dans le mur');
  let sclera = 0, ember = 0;
  for(let y = 0; y < 16; y++) for(let x = 0; x < 16; x++){
    const [r, gg, b] = ic.px(x, y);
    if(r > 200 && gg > 180 && b > 140) sclera++;
    if(r > 230 && gg > 100 && gg < 210 && b < 80) ember++;
  }
  assert.ok(sclera >= 8 && ember >= 3, `blanc ${sclera}, braise ${ember}`);
});
