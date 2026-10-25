/* Banque de stats des runes (25/10/2026) : ténacité, résistance au recul, portée, recul, double attaque ajoutées ;
   Découverte aussi probable qu'une autre stat (R6/R7, une au plus) ; nouvelle stat Double attaque. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { W, UPGRADE, STATS, STUFF } from '../src/config.js';
import { mulberry32 } from '../src/core/rng.js';
import { rollRune, linePoints } from '../src/meta/piece.js';
import { landHit } from '../src/sim/actions.js';
import { worldFrom } from './helpers.js';

test('banque : les 5 nouvelles stats y sont, chacune avec un prix, un pas, un nom et une unité', () => {
  for(const k of ['tenacity', 'knockRes', 'reach', 'knockback', 'doubleAttack']) assert.ok(UPGRADE.pool.includes(k), k);
  for(const k of UPGRADE.pool){
    assert.ok(UPGRADE.prices[k] > 0, `prix ${k}`); assert.ok(UPGRADE.steps[k] > 0, `pas ${k}`);
    assert.ok(k in STATS, `stat ${k}`); assert.ok(STUFF.statLabels[k], `nom ${k}`);
  }
  assert.equal(STATS.doubleAttack, 0);
  assert.equal(linePoints('Épée en fer', 'reach', 40), 0.1, 'T2 (250 x) × 40 % = 100 x = +0,1 bloc');
  assert.equal(linePoints('Épée en fer', 'doubleAttack', 40), 5, '100 x = +5 %');
});

test('Découverte : en R6/R7, aussi probable qu\'une autre stat, une fois au plus par rune ; jamais en R1-R5', () => {
  const rnd = mulberry32(42), N = 20000;
  let disc = 0, lines = 0;
  for(let i = 0; i < N; i++){
    const r = rollRune(7, rnd);
    const d = r.lines.filter(l => l.stat === 'discoverMax').length;
    assert.ok(d <= 1, 'une au plus'); disc += d; lines += r.lines.length;
  }
  const share = disc / N, other = (lines - disc) / N / UPGRADE.pool.length;   // par rune : Découverte vs une stat donnée
  assert.ok(Math.abs(share - other) / other < 0.12, `Découverte ${share.toFixed(3)} / autre stat ${other.toFixed(3)} par rune`);
  for(let i = 0; i < 2000; i++) assert.ok(!rollRune(5, rnd).lines.some(l => l.stat === 'discoverMax'));
});

test('double attaque : à 100 %, chaque coup frappe deux fois (un seul recul) ; à 0 %, une fois', () => {
  for(const [pct, hits] of [[0, 1], [100, 2]]){
    const G = worldFrom(['', 'd'.repeat(W), '#@' + ' '.repeat(10) + '#', '#'.repeat(W)]), m = G.miners[0];
    m.carac.doubleAttack = pct;
    const o = { id:G.mobId++, type:'bestiole', x:m.x + 1, y:m.y, hp:1e6, maxhp:1e6, cd:0 };
    G.mobs.push(o);
    landHit(G, m, o);
    assert.equal(1e6 - o.hp, hits * m.carac.damage, `${pct} % : ${hits} coup(s)`);
    assert.equal(o.kx, 0.25, 'un seul recul');
  }
});
