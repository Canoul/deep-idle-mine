/* Coup unique sur les boss qui se minent (01/11/2026) : Bloc géant, spawners, cristal du Golbute. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GIANT, INSTANCE, STATS, DT } from '../src/config.js';
import { oneTapBonus } from '../src/sim/one-tap.js';
import { newGiant, joinGiant, tickGiant, runGiant } from '../src/sim/giant/session.js';
import { newInstance, tickInstance } from '../src/sim/instance/session.js';
import { newGolbute, tickGolbute } from '../src/sim/instance/golbute.js';

const miner = oneTap => ({ carac:{ oneTap } });
const never = () => { throw new Error('tirage sans la stat'); };

test('une chance par seconde de minage, gain = la vitesse de minage ; le temps s\'additionne sur plusieurs ticks', () => {
  const m = miner(100);
  let total = 0, procs = 0;
  for(let i = 0; i < 30; i++){ const b = oneTapBonus(m, DT, 1.5, () => 0); if(b){ procs++; total += b; } }
  assert.equal(procs, 3, '3 s de minage : 3 tirages');
  assert.ok(Math.abs(total - 4.5) < 1e-9);
});

test('chance : 25 % ne passe pas à 0,25, passe à 0,24 ; sans la stat, aucun tirage', () => {
  assert.equal(oneTapBonus(miner(25), 1, 2, () => 0.25), 0);
  assert.equal(oneTapBonus(miner(25), 1, 2, () => 0.24), 2);
  assert.equal(oneTapBonus(miner(0), 5, 2, never), 0);
  assert.equal(oneTapBonus({ carac:{} }, 5, 2, never), 0);
});

test('une longue tranche d\'un coup compte plusieurs tirages, le reste est gardé', () => {
  const m = miner(100);
  assert.equal(oneTapBonus(m, 2.5, 1, () => 0), 2);
  assert.equal(oneTapBonus(m, 0.5, 1, () => 0), 1);
});

test('Bloc géant : à 100 %, deux fois plus de points ; à 50 %, environ une fois et demie, sans oxygène ni recul en plus', () => {
  const visit = oneTap => runGiant(11, [{ spec:{ account:'A', name:'A', carac:{ ...STATS, oxygenMax:1e6, oneTap } } }]).done[0];
  const base = visit(0), all = visit(100), half = visit(50);
  assert.ok(Math.abs(base.points - base.mining) < 1e-6);
  assert.ok(Math.abs(all.points - 2 * all.mining) <= 1 + 1e-6, `${all.points} pour ${all.mining} s`);
  const ratio = half.points / half.mining;
  assert.ok(ratio > 1.35 && ratio < 1.65, `ratio ${ratio}`);
  assert.ok(all.hits <= all.mining + 1, `${all.hits} coups`);
});

test('Bloc géant : le score commun reçoit le bonus lui aussi', () => {
  const G = newGiant(3);
  const m = joinGiant(G, { account:'A', name:'A', carac:{ ...STATS, oxygenMax:1e6, oneTap:100 } });
  for(let i = 0; i < 400; i++) tickGiant(G);
  assert.ok(Math.abs(G.stats.points - m.points) < 1e-6);
  assert.ok(m.points > m.stats.mining * 1.8);
});

test('spawner : le coup unique le casse plus vite', () => {
  const left = oneTap => {
    const G = newInstance(4, { miners:[{ name:'M', account:'a', carac:{ ...STATS, oneTap } }] });
    G.fightRng = () => 0;
    const m = G.miners[0], s = G.spawners[0];
    m.x = s.mx; m.y = s.y; m.action = { type:'drill', dur:99, t:0, data:{ sp:s.id, x:s.x, y:s.y } };
    for(let i = 0; i < 12; i++) tickInstance(G);
    return s.maxhp - s.hp;
  };
  assert.ok(Math.abs(left(100) - left(0) - STATS.mineSpeed) < 1e-6, `${left(0)} puis ${left(100)}`);
});

test('cristal du Golbute : le coup unique le mine plus vite', () => {
  const mined = oneTap => {
    const G = newGolbute(6, { miners:[{ name:'M', account:'A', carac:{ damage:0, mineSpeed:10, oneTap } }] });
    G.next.split = Infinity; G.next.avalanche = Infinity;
    G.fightRng = () => 0;
    const c = INSTANCE.golbute.crystal.hp, b = G.boss;
    b.state = 'crystal'; b.crystal = { hp:c, max:c };
    const m = G.miners[0]; m.action = { type:'drill', dur:0.5, t:0, data:{} };
    for(let i = 0; i < 20; i++){ tickGolbute(G); if(!m.action) m.action = { type:'drill', dur:0.5, t:0, data:{} }; }
    return c - b.crystal.hp;
  };
  assert.ok(Math.abs(mined(0) - 20) < 1e-6, `${mined(0)}`);
  assert.ok(Math.abs(mined(100) - 40) < 1e-6, `${mined(100)}`);
});
