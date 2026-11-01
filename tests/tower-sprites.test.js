/* Sprites des tours du Jugement (scripts/gen_bosses.py, 30/10/2026) : boss en pleine résolution, 16 pixels par case */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOWER, TEXTURES } from '../src/config.js';

const sizeOf = name => { const b = readFileSync(`textures/${name}.png`); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('boss Ange et Démon : 16 pixels par case (3 × 5 cases = 48 × 80), plus de pixels doublés', () => {
  for(const s of Object.values(TOWER.sides)) assert.deepEqual(sizeOf(s.bossTex), [TOWER.boss.w * 16, TOWER.boss.h * 16], s.bossTex);
});

test('Séraphin et Diablotin : 1 × 2 cases (16 × 32), dans la liste des textures', () => {
  for(const s of Object.values(TOWER.sides)){
    assert.deepEqual(sizeOf(s.mobTex), [16, 32], s.mobTex);
    assert.ok(TEXTURES.includes(s.mobTex) && TEXTURES.includes(s.bossTex));
  }
});
