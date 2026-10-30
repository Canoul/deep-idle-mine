/* Fortune et butin en plus à 0 pod (30/10/2026, Geoffrey) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collect, uncollect } from '../src/sim/mineur.js';

const bag = () => ({ inv: {}, load: 0 });
test('les exemplaires gratuits sont dans le sac sans pods', () => {
  const m = bag(); collect(m, 'Fer', 2, 3); collect(m, 'Fer', 2, 2, true);
  assert.equal(m.inv.Fer, 5); assert.equal(m.load, 6); assert.equal(m.free.Fer, 2);
});
test('retrait : les payants d\'abord, puis les gratuits ; sac vide = 0 pod', () => {
  const m = bag(); collect(m, 'Fer', 2, 3); collect(m, 'Fer', 2, 2, true);
  assert.equal(uncollect(m, 'Fer', 2, 1), 2); assert.equal(m.load, 4); assert.equal(m.inv.Fer, 4);
  uncollect(m, 'Fer', 2, 3); assert.equal(m.load, 0); assert.equal(m.inv.Fer, 1); assert.equal(m.free.Fer, 1);
  uncollect(m, 'Fer', 2, 1); assert.deepEqual(m.inv, {}); assert.equal(m.load, 0); assert.ok(!m.free.Fer);
});
