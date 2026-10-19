/* Détecteur de blocage : vrais blocages signalés, longs trajets (remontée ou descente vers le front) ignorés. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DT } from '../src/config.js';
import { stuckDetector, STUCK_WINDOW } from '../src/sim/diagnostics.js';

/* fait « vivre » un faux mineur pendant STUCK_WINDOW + 10 s ; yAt(s) donne sa couche au temps s */
function scenario(mode, yAt){
  const det=stuckDetector(), m={ name:'Test', x:5, y:yAt(0), mode, status:'', stats:{mined:0, trips:0} }, G={ t:0, miners:[m] };
  const n=Math.round((STUCK_WINDOW+10)/DT);
  for(let i=0;i<n;i++){ G.t=i*DT; m.y=yAt(G.t); det.onTick(G,i); }
  return det.result();
}

test('immobile sous terre sans miner : bloqué', () => {
  assert.equal(scenario('work', ()=>40).length, 1);
});

test('longue descente vers le front (sans miner) : pas un blocage', () => {
  assert.deepEqual(scenario('work', s=>5+Math.floor(s*1.5)), []);
});

test('longue remontée (sans miner) : pas un blocage', () => {
  assert.deepEqual(scenario('return', s=>Math.max(1, 160-Math.floor(s*1.5))), []);
});

test('oscille sur place sans progresser : bloqué', () => {
  assert.equal(scenario('work', s=>40+(Math.floor(s)%2)).length, 1);
});
