/* Bancs d'essai du GS expérimental (28/10/2026, src/sim/bench.js) : chaque banc réagit à ses stats, et seulement à elles. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CFG, STATS } from '../src/config.js';
import { fightBench, mineBench, walkBench, climbBench, BENCH, classify } from '../src/sim/bench.js';

const lit = f => { const d = CFG.darkSlow; CFG.darkSlow = 1; try { return f(); } finally { CFG.darkSlow = d; } };

test('mine : vitesse de minage ×2 → deux fois plus de blocs ; la marche ne compte pas', () => lit(() => {
  const b = mineBench({});
  assert.ok(b > 0);
  assert.ok(Math.abs(mineBench({ mineSpeed: STATS.mineSpeed * 2 }) / b - 2) < 0.02);
  assert.ok(Math.abs(mineBench({ speed: STATS.speed * 3 }) - b) < 1e-6, 'les bottes ne minent pas');
  assert.ok(mineBench({ piercing: 50 }) > b && mineBench({ oneTap: 50 }) > b);
}));

test('marche et montée : ×2 → deux fois plus de cases ; chacune ignore l\'autre', () => lit(() => {
  const w = walkBench({}), c = climbBench({});
  assert.equal(walkBench({ speed: STATS.speed * 2 }), 2 * w);
  assert.equal(climbBench({ climbSpeed: STATS.climbSpeed * 2 }), 2 * c);
  assert.equal(walkBench({ climbSpeed: 99 }), w); assert.equal(climbBench({ speed: 99 }), c);
}));

test('combat : dégâts ×2 → deux fois plus ; le mannequin repousse, un gros recul coûte des coups au mineur rapide', () => lit(() => {
  const f = fightBench({});
  assert.equal(fightBench({ damage: STATS.damage * 2 }), 2 * f);
  assert.equal(fightBench({ mineSpeed: 9 }), f, 'la pioche ne se bat pas');
  const k = BENCH.dummyKnock; BENCH.dummyKnock = 1;
  try {
    const fast = { attackSpeed: 250 };
    assert.ok(fightBench({ ...fast, knockRes: 100 }) > fightBench(fast), 'résistance au recul : plus de coups');
  } finally { BENCH.dummyKnock = k; }
}));

test('classement des actions pour les parts de temps', () => {
  const m = { x: 3, y: 5 };
  assert.equal(classify({ ...m, action: null }), 'other');
  assert.equal(classify({ ...m, action: { type: 'attack', data: {} } }), 'fight');
  assert.equal(classify({ ...m, action: { type: 'mine', data: {} } }), 'mine');
  assert.equal(classify({ ...m, action: { type: 'move', data: { x: 4, y: 5 } } }), 'walk');
  assert.equal(classify({ ...m, action: { type: 'move', data: { x: 3, y: 4 } } }), 'climb');
  assert.equal(classify({ ...m, action: { type: 'move', data: { x: 3, y: 6, fall: true } } }), 'other');
  assert.equal(classify({ ...m, action: { type: 'ladder', data: {} } }), 'other');
});
