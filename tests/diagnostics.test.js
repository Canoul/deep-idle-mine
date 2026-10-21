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

/* variante : le mineur peut frapper (action attack) ou changer de mode en cours de route */
function scenario2(step){
  const det=stuckDetector(), m={ name:'Test', x:5, y:10, mode:'work', status:'', action:null, stats:{mined:0, trips:0, kills:0} }, G={ t:0, miners:[m] };
  const n=Math.round((STUCK_WINDOW+10)/DT);
  for(let i=0;i<n;i++){ G.t=i*DT; step(m, G.t); det.onTick(G,i); }
  return det.result();
}

test('combat long contre un boss (il frappe sans cesse) : pas un blocage ; immobile sans frapper : bloqué', () => {
  assert.deepEqual(scenario2(m => { m.action={ type:'attack' }; }), []);
  assert.equal(scenario2(m => { m.action={ type:'wait' }; }).length, 1);
});

test('un mob tué pendant la période : pas un blocage', () => {
  assert.deepEqual(scenario2((m, t) => { if(t > 50) m.stats.kills = 1; }), []);
});

test('longue descente puis passage en retour (fin de session) : pas un blocage', () => {
  assert.deepEqual(scenario2((m, t) => { m.y = 10 + Math.floor(t * 2); if(t > 95) m.mode = 'return'; }), []);
});
