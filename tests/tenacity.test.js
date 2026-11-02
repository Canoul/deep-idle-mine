/* Ténacité à rendement décroissant (02/11/2026, Geoffrey) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TENACITY } from '../src/config.js';
import { effectiveTenacity, tenacityOf } from '../src/sim/tenacity.js';

const near = (a, b) => Math.abs(a - b) < 0.05;
test('courbe : k × ln(1 + t / k), presque intacte en bas, très réduite en haut, plafonnée', () => {
  assert.equal(effectiveTenacity(0), 0); assert.equal(effectiveTenacity(-5), 0); assert.equal(effectiveTenacity(NaN), 0);
  for(const [raw, eff] of [[10, 8.9], [20, 16.2], [30, 22.4], [50, 32.4], [100, 50.1]]) assert.ok(near(effectiveTenacity(raw), eff), `${raw} → ${effectiveTenacity(raw)}`);
  assert.equal(effectiveTenacity(1e6), TENACITY.max);
  for(let t = 1; t < 200; t++){ assert.ok(effectiveTenacity(t) <= t); assert.ok(effectiveTenacity(t) > effectiveTenacity(t - 1)); }   // plafond 75 % vers 221 de brute
  assert.ok(near(tenacityOf({ carac: { tenacity: 50 } }), 32.4)); assert.equal(tenacityOf({}), 0);
});

test('pénétration : points retirés de la brute avant la courbe, jamais en dessous de 0', () => {
  const m = { carac: { tenacity: 30 } }, keep = TENACITY.pen;
  TENACITY.pen = { golem: 10, boss: 20, gros: 50 };
  try {
    assert.equal(tenacityOf(m, 'golem'), effectiveTenacity(20));
    assert.equal(tenacityOf(m, 'boss'), effectiveTenacity(10));
    assert.equal(tenacityOf({ carac: { tenacity: 20 } }, 'boss'), 0, '20 de ténacité contre 20 de pénétration : plus rien');
    assert.equal(tenacityOf(m, 'gros'), 0);
    assert.equal(tenacityOf(m, 'inconnu'), effectiveTenacity(30)); assert.equal(tenacityOf(m), effectiveTenacity(30));
  } finally { TENACITY.pen = keep; }
});
