/* Ver de terre (03/11/2026) : sprites cuirassés (scripts/gen_worm.py) et file qui pivote dans le sens de la marche
   (src/render/worm.js) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { MOB_INFO, TEXTURES } from '../src/config.js';
import { dirTo, wormCells, drawTurned } from '../src/render/worm.js';

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

test('ver : tête, anneau et queue en 16 × 16, dans la liste des textures ; icône = la tête', () => {
  for(const name of ['worm_head', 'worm_body', 'worm_tail']){
    const g = readPng(name);
    assert.deepEqual([g.w, g.h], [16, 16], name);
    assert.ok(TEXTURES.includes(name), name);
  }
  assert.equal(MOB_INFO.ver.tex, 'worm_head');
});

test("ver : l'anneau touche les deux bords (la file se suit sans trou), la gueule rougeoie à droite de la tête", () => {
  const b = readPng('worm_body');
  for(let y = 2; y < 14; y++){ assert.equal(b.px(0, y)[3], 255, `gauche ${y}`); assert.equal(b.px(15, y)[3], 255, `droite ${y}`); }
  const h = readPng('worm_head');
  let ember = 0;
  for(let y = 0; y < 16; y++) for(let x = 8; x < 16; x++){ const [r, g, bb] = h.px(x, y); if(r > 200 && g > 100 && g < 180 && bb < 80) ember++; }
  assert.ok(ember >= 2, `braise : ${ember} pixels`);
});

test('dirTo : droite, bas, gauche, haut ; même case : null ; saut : axe le plus long', () => {
  assert.equal(dirTo([3, 3], [4, 3]), 0);
  assert.equal(dirTo([3, 3], [3, 4]), 1);
  assert.equal(dirTo([3, 3], [2, 3]), 2);
  assert.equal(dirTo([3, 3], [3, 2]), 3);
  assert.equal(dirTo([3, 3], [3, 3]), null);
  assert.equal(dirTo([3, 3], [0, 4]), 2);
});

test('wormCells : la tête regarde où elle va, chaque anneau vers la case qui le précède (virage compris)', () => {
  // tête en (7,2) venant de la gauche ; le corps descend puis repart à gauche
  const w = { x: 7, y: 2, trail: [[6, 2], [5, 2], [5, 3], [5, 4], [4, 4]] };
  const c = wormCells(w);
  assert.deepEqual(c.map(q => q.tex), ['worm_head', 'worm_body', 'worm_body', 'worm_body', 'worm_body', 'worm_body']);
  assert.deepEqual(c.map(q => q.dir), [0, 0, 0, 3, 3, 0]);
  assert.deepEqual(wormCells({ x: 1, y: 1, trail: [[1, 0]] }).map(q => q.dir), [1, 1]);   // il descend
});

test('wormCells : sans corps, tête vers la droite ; deux cases confondues : direction de la case d\'avant', () => {
  assert.deepEqual(wormCells({ x: 5, y: 5 }).map(q => q.dir), [0]);
  assert.deepEqual(wormCells({ x: 5, y: 5, trail: [] }).map(q => q.dir), [0]);
  assert.deepEqual(wormCells({ x: 4, y: 5, trail: [[5, 5], [5, 5]] }).map(q => q.dir), [2, 2, 2]);
});

test('drawTurned : droite sans transformation, gauche retournée, bas / haut d\'un quart de tour', () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, k) => (...a) => calls.push([k, ...a]) });
  drawTurned(ctx, 'img', 32, 48, 0, 16);
  assert.deepEqual(calls, [['drawImage', 'img', 32, 48, 16, 16]]);
  for(const [dir, op, arg] of [[2, 'scale', -1], [1, 'rotate', Math.PI / 2], [3, 'rotate', -Math.PI / 2]]){
    calls.length = 0;
    drawTurned(ctx, 'img', 32, 48, dir, 16);
    assert.deepEqual(calls.map(c => c[0]), ['save', 'translate', op, 'drawImage', 'restore']);
    assert.deepEqual(calls[1], ['translate', 40, 56]);
    assert.equal(calls[2][1], arg);
    assert.deepEqual(calls[3], ['drawImage', 'img', -8, -8, 16, 16]);
  }
});
