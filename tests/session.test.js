/* Tests de non-régression sur des sessions complètes (1 h de jeu simulée chacune, quelques secondes).
   Les seeds « bug » sont celles où un blocage de l'IA a été trouvé puis corrigé : elles ne doivent plus bloquer. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSession, newSession, tick } from '../src/sim/session.js';
import { stuckDetector } from '../src/sim/diagnostics.js';
import { SESSION_LEN } from '../src/config.js';

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

/* Bug : la session ne se terminait jamais en jeu normal. Le navigateur s'arrête au dernier tick (tickAt plafonne à
   TOTAL_TICKS), mais 36 000 additions de 0,1 donnaient G.t = 3599,9999999978 < 3600 : pas de fin, pas de résultat. */
test('fin de session : exactement au dernier tick, même sans jamais le dépasser (comme le navigateur)', async () => {
  const { buildSession, tickAt, realDurationMs, TOTAL_TICKS } = await import('../src/shared/game.js');
  const { SESSION_TICKS } = await import('../src/sim/session.js');
  assert.equal(TOTAL_TICKS, SESSION_TICKS);
  const G = buildSession({ id:'fin', seed:3, players:[{ account:'AAAA1111', name:'Zoe' }], bots:0, prefs:{}, leaves:[] });
  const target = tickAt(realDurationMs() * 10);          // bien après l'heure de fin : plafonné au dernier tick
  assert.equal(target, TOTAL_TICKS);
  while(G.ticks < target && !G.over) tick(G);
  assert.equal(G.over, true, 'la session est finie au dernier tick');
  assert.equal(G.ticks, TOTAL_TICKS);
  assert.equal(G.t, SESSION_LEN, 'le temps affiché tombe pile sur 60:00');
  assert.ok(G.summary, 'le bilan existe');
});
