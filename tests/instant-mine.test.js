/* Mine instantanée (MI) : réglages, objet Plume d'ange. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { INSTANT_MINE as MI, ITEMS, TEXTURES, IDS } from '../src/config.js';
import { rarityOf } from '../src/meta/rarity.js';

test('MI : composition = 100 %, que des minerais connus, plumes 1 à 5', () => {
  const total = Object.values(MI.comp).reduce((a, b) => a + b, 0) + MI.feather;
  assert.equal(total, 100);
  for(const k of Object.keys(MI.comp)) assert.ok(IDS[k] > 0, k);
  assert.ok(Number.isInteger(MI.featherMin) && MI.featherMin >= 1 && MI.featherMax >= MI.featherMin);
});

test('MI : Plume d\'ange, objet rare qui s\'empile, textures de l\'objet et du tas présentes', () => {
  const it = ITEMS[MI.featherItem];
  assert.ok(it && it.stack && it.tex === MI.featherTex);
  assert.equal(rarityOf(MI.featherItem), 'rare');
  for(const t of [MI.featherTex, MI.heapTex]){
    assert.ok(TEXTURES.includes(t), t);
    assert.ok(existsSync(new URL(`../textures/${t}.png`, import.meta.url)), t);
  }
});
