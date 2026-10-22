/* Détecteur de blocage : vrais blocages signalés, longs trajets (remontée ou descente vers le front) ignorés. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DT } from '../src/config.js';
import { stuckDetector, STUCK_WINDOW } from '../src/sim/diagnostics.js';

/* fait « vivre » un faux mineur pendant STUCK_WINDOW + 10 s ; yAt(s) donne sa couche au temps s */
/* mode : le mode du mineur, ou une fonction du temps (bascule en cours de route, ex. descente puis retour) */
function scenario(mode, yAt){
  const modeAt = typeof mode === 'function' ? mode : () => mode;
  const det=stuckDetector(), m={ name:'Test', x:5, y:yAt(0), mode:modeAt(0), status:'', stats:{mined:0, trips:0} }, G={ t:0, miners:[m] };
  const n=Math.round((STUCK_WINDOW+10)/DT);
  for(let i=0;i<n;i++){ G.t=i*DT; m.y=yAt(G.t); m.mode=modeAt(G.t); det.onTick(G,i); }
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

/* seed 23757 (3 mineurs, arbres mélangés), 22/10 : le logisticien redescend au front par le treuil, y arrive en fin de
   session et repart aussitôt en retour. Sur la fenêtre, il a descendu puis vient de passer en « retour » : pas bloqué. */
test('descente vers le front puis bascule en retour juste avant la fin de la fenêtre : pas un blocage', () => {
  const T = STUCK_WINDOW - 5;
  assert.deepEqual(scenario(s => s < T ? 'work' : 'return', s => s < T ? 100 + Math.floor(s * 0.6) : 100 + Math.floor(T * 0.6) - Math.floor(s - T)), []);
});

test('immobile puis bascule en retour sans remonter : bloqué', () => {
  assert.equal(scenario(s => s < STUCK_WINDOW - 5 ? 'work' : 'return', () => 40).length, 1);
});
