/* Détecteur de blocage : vrais blocages signalés, longs trajets (remontée ou descente vers le front) ignorés. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DT } from '../src/config.js';
import { stuckDetector, STUCK_WINDOW } from '../src/sim/diagnostics.js';

/* fait « vivre » un faux mineur pendant STUCK_WINDOW + 10 s ; yAt(s) donne sa couche au temps s */
/* mode : le mode du mineur, ou une fonction du temps (bascule en cours de route, ex. descente puis retour) ;
   actAt(s) : type de son action au temps s (ex. 'attack'), aucune par défaut */
function scenario(mode, yAt, actAt = () => null){
  const modeAt = typeof mode === 'function' ? mode : () => mode;
  const det=stuckDetector(), m={ name:'Test', x:5, y:yAt(0), mode:modeAt(0), status:'', stats:{mined:0, trips:0} }, G={ t:0, miners:[m] };
  const n=Math.round((STUCK_WINDOW+10)/DT);
  for(let i=0;i<n;i++){ G.t=i*DT; m.y=yAt(G.t); m.mode=modeAt(G.t); const a=actAt(G.t); m.action=a ? { type:a } : null; det.onTick(G,i); }
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

/* seed 39595 (3 mineurs, arbres mélangés, seau ×2), 22/10 : l'équipe combat le minotaure du donjon (1000 PV) pendant
   plus de 90 s sans rien miner : c'est un combat, pas un blocage */
test('long combat sur place (boss du donjon) : pas un blocage', () => {
  assert.deepEqual(scenario('work', () => 214, s => Math.floor(s) % 10 < 8 ? 'attack' : null), []);
});

test('immobile, à peine quelques coups dans la fenêtre : bloqué', () => {
  assert.equal(scenario('work', () => 40, s => s < 5 ? 'attack' : null).length, 1);
});
