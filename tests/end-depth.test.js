/* Fin de session : profondeur max d'un trajet (depthCap) d'après la remontée ET la descente mesurées (27/10/2026).
   Avant : 2,25 × la remontée mesurée ; avec un treuil rapide, il s'arrêtait 90 couches au-dessus du front à 6-7 min
   de la fin (session dev du 27/10, seed 468608167 : front 338, profondeur max 245 à 390 s de la fin). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CFG, SESSION_LEN } from '../src/config.js';
import { depthCap } from '../src/sim/ai.js';
import { newSession } from '../src/sim/session.js';
import { run } from './helpers.js';

const at = left => ({ t: SESSION_LEN - left });

test('profondeur max : descente et remontée mesurées (cas de la session du 27/10)', () => {
  const m = { carac:{ climbSpeed:2 }, secPerRow:0.32, secPerRowDown:0.21 };
  const cap = depthCap(at(390), m);
  assert.equal(cap, Math.floor((390*(1-CFG.endWorkShare)-12)/(0.21+0.32)));
  assert.ok(cap >= 330, `${cap} : le front (338) est presque atteignable`);
  assert.ok(cap > Math.floor((390*(1-CFG.endWorkShare)-12)/(2.25*0.32)) + 80, 'bien plus profond que l\'ancien calcul (254)');
});

test('profondeur max : sans descente mesurée, elle compte comme la remontée', () => {
  const m = { carac:{ climbSpeed:2 }, secPerRow:0.3 };
  assert.equal(depthCap(at(300), m), Math.floor((300*(1-CFG.endWorkShare)-12)/0.6));
  const fresh = { carac:{ climbSpeed:2 } };   // rien de mesuré : vitesse de montée × 1,25, dans les deux sens
  assert.equal(depthCap(at(300), fresh), Math.floor((300*(1-CFG.endWorkShare)-12)/(2*1.25/2)));
  assert.equal(depthCap(at(10), m), 0);
});

test('la descente se mesure en vraie partie, et reste dans des valeurs plausibles', () => {
  const G = newSession(7, { miners: 3 });
  run(G, Math.round(1500/0.1));
  const measured = G.miners.filter(m => Number.isFinite(m.secPerRowDown));
  assert.ok(measured.length > 0, 'au moins un mineur a mesuré sa descente');
  for(const m of measured) assert.ok(m.secPerRowDown > 0 && m.secPerRowDown < 5, `${m.name} : ${m.secPerRowDown} s/couche`);
  for(const m of G.miners) assert.ok(m.descentStart == null || m.descentStart <= G.t);
});
