/* Vitesse d'attaque sans paliers (28/10/2026) : le coup suivant part à l'heure exacte (nowOf), pas au tick suivant.
   Avant : 250 % frappait comme 200 % (intervalle arrondi au dixième de seconde au-dessus). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../src/config.js';
import { tick } from '../src/sim/session.js';
import { worldFrom } from './helpers.js';

function hitsPerSec(attackSpeed, secs = 120){
  const G = worldFrom(['', 'd'.repeat(50), '#' + ' '.repeat(40) + '#', '#'.repeat(50)]);
  G.spawnTimer = Infinity;
  const m = G.miners[0]; m.x = 10; m.y = 2; m.carac.attackSpeed = attackSpeed; m.carac.oxygenMax = 1e9;
  const o = { id: G.mobId++, type: 'bestiole', x: 11, y: 2, hp: 1e12, maxhp: 1e12, cd: 1 };
  G.mobs.push(o);
  for(let i = 0; i < secs * 10; i++){ m.ox = 1e9; tick(G); }
  return (1e12 - o.hp) / m.carac.damage / secs;
}

test('chaque point de vitesse d\'attaque compte : 150, 250, 300 % frappent à leur vrai rythme', () => {
  const dark = CFG.darkSlow; CFG.darkSlow = 1;
  try {
    for(const as of [100, 150, 200, 250, 300, 400]){
      const want = as / 100 / CFG.attackInterval, got = hitsPerSec(as);
      assert.ok(Math.abs(got - want) / want < 0.01, `${as} % : ${got.toFixed(3)} coups/s au lieu de ${want.toFixed(3)}`);
    }
    assert.ok(hitsPerSec(250) > hitsPerSec(200) * 1.2, '250 % frappe plus vite que 200 %');
  } finally { CFG.darkSlow = dark; }
});
