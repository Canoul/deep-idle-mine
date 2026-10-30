import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENERGY } from '../src/config.js';
import { createEnergy, sanitizeEnergy, canPay, rollCost, spendEnergy, creditEnergy, energyOfTicks, publicEnergy } from '../src/meta/energy.js';

test('créer et assainir : un compte part de 0 (30/10/2026 : tous les joueurs à 0 à la mise en ligne)', () => {
  assert.equal(ENERGY.start, 0);
  assert.deepEqual(createEnergy(), { value: 0, keys: [] });
  assert.equal(sanitizeEnergy(null).value, 0);
  assert.equal(sanitizeEnergy({ value: 'x' }).value, 0);
  assert.equal(sanitizeEnergy({ value: -5 }).value, 0);
  assert.equal(sanitizeEnergy({ value: 150 }).value, 100);
  assert.equal(sanitizeEnergy({ value: 42.46 }).value, 42.5);
  assert.deepEqual(sanitizeEnergy({ value: 10, keys: ['a', 3, null, 'b'] }).keys, ['a', 'b']);
  const many = Array.from({ length: 300 }, (_, i) => 'k' + i);
  const k = sanitizeEnergy({ value: 10, keys: many }).keys;
  assert.equal(k.length, 200);
  assert.equal(k.at(-1), 'k299');
});

test('rollCost', () => {
  assert.equal(rollCost(() => 0), 6);
  assert.equal(rollCost(() => 0.9999), 12);
  let s = 12345;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const seen = new Set();
  for(let i = 0; i < 10000; i++){ const c = rollCost(rnd); assert.ok(Number.isInteger(c) && c >= 6 && c <= 12); seen.add(c); }
  assert.equal(seen.size, 7);
});

test('spendEnergy', () => {
  const e = { ...createEnergy(), value: 100 };
  assert.equal(spendEnergy(e, 's1', 9), true);
  assert.equal(e.value, 91);
  assert.equal(spendEnergy(e, 's1', 9), false);
  assert.equal(e.value, 91);
  assert.equal(spendEnergy(e, 's2', 200), false);
  for(const c of [-1, 0.5, NaN, '9']) assert.equal(spendEnergy(e, 'x' + c, c), false);
  assert.equal(e.value, 91);
});

test('canPay', () => {
  assert.equal(canPay({ value: 5.9 }), false);
  assert.equal(canPay({ value: 6 }), true);
});

test('creditEnergy', () => {
  const e = { value: 50, keys: [] };
  assert.equal(creditEnergy(e, 'prison:a:1', 8), true);
  assert.equal(e.value, 58);
  assert.equal(creditEnergy(e, 'prison:a:1', 8), false);
  assert.equal(e.value, 58);
  const f = { value: 98, keys: [] };
  assert.equal(creditEnergy(f, 'k', 8), true);
  assert.equal(f.value, 100);
  for(const a of [-1, Infinity, NaN]) assert.equal(creditEnergy(f, 'y' + a, a), false);
});

test('energyOfTicks et publicEnergy', () => {
  assert.equal(energyOfTicks(36000), 4, '1 h de jeu : 4 (30/10/2026, avant 8)');
  assert.equal(energyOfTicks(9000), 1);
  assert.deepEqual(publicEnergy({ value: 42.46, keys: ['a'] }), { value: 42, max: 100 });
});
