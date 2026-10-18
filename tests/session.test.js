/* Tests de non-régression sur des sessions complètes (1 h de jeu simulée chacune, quelques secondes).
   Les seeds « bug » sont celles où un blocage de l'IA a été trouvé puis corrigé : elles ne doivent plus bloquer. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSession, newSession, tick } from '../src/sim/session.js';
import { stuckDetector } from '../src/sim/diagnostics.js';

const BUG_SEEDS = [
  65361775,   // va-et-vient au retour (plan dépendant de la lumière de la case)
  823773703,  // boucle « grimpe, passe sur le puits, retombe » (plan qui s'arrêtait dans le vide)
  63352,      // boucle « avance en galerie, tombe, remonte » sans passerelle
  7919,       // seed de référence
];

for(const seed of BUG_SEEDS){
  test(`session complète seed ${seed} (1 mineur) : aucun blocage, au moins 2 areas débloquées`, () => {
    const det=stuckDetector();
    const G=runSession(seed, { miners:1, onTick:det.onTick });
    assert.deepEqual(det.result(), []);
    assert.ok(G.unlockedAreas-1 >= 2, `areas débloquées : ${G.unlockedAreas-1}`);
    assert.ok(G.stats.trips >= 8, `allers-retours : ${G.stats.trips}`);
  });
}

test('simulation déterministe : même seed → même partie', () => {
  const a=newSession(4242), b=newSession(4242);
  for(let i=0;i<3000;i++){ tick(a); tick(b); }
  const snap=G=>JSON.stringify({m:G.miners.map(m=>[m.x,m.y,m.load,m.status]), s:G.stats, c:G.chest, n:G.mobs.length});
  assert.equal(snap(a), snap(b));
});
