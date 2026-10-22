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
  test(`session complète seed ${seed} (1 mineur) : aucun blocage, au moins 1 area débloquée`, () => {
    const det=stuckDetector();
    const G=runSession(seed, { miners:1, onTick:det.onTick });
    assert.deepEqual(det.result(), []);
    assert.ok(G.unlockedAreas-1 >= 1, `areas débloquées : ${G.unlockedAreas-1}`);
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

/* Fin de session (22/10, Geoffrey) : un mineur qui repart de la surface peu avant la fin ne descend pas jusqu'au front
   pour remonter aussitôt ; il mine plus haut, à une profondeur qui lui laisse le temps de travailler. Seed 23757, 3
   mineurs, arbres mélangés (comme scripts/simulate.js --skills mixed) : avant, le logisticien repartait à 3300 s,
   descendait 150 cases par le treuil, arrivait au front à 3443 s et remontait sans avoir miné. */
test('fin de session : un départ tardif passe au moins un tiers de son trajet à travailler, pas à voyager (seed 23757, 3 mineurs)', async () => {
  const { SKILLS } = await import('../src/config.js');
  const { sanitizeSkills, skillEffects } = await import('../src/meta/skills.js');
  const giveTree = (m, tree) => {
    const t = SKILLS.trees.find(x => x.id === tree);
    const st = sanitizeSkills({ tree, ranks: Object.fromEntries(t.nodes.map(n => [n.id, n.max])) });
    m.skill = { ...m.skill, ...skillEffects(st) }; m.skillTree = tree;
    m.carac.mineSpeed *= 1 + m.skill.mine_speed; m.carac.damage *= 1 + m.skill.damage;
  };
  const trips = new Map();   // mineur → trajet en cours { start, work, n }
  const late = [];
  runSession(23757, { miners: 3, onTick: (G, i) => {
    if(i === 0) G.miners.forEach((m, k) => giveTree(m, SKILLS.trees[k % 3].id));
    for(const m of G.miners){
      let tr = trips.get(m.id);
      if(m.y > 0 && !tr){ tr = { start: G.t, work: 0, n: 0, name: m.name }; trips.set(m.id, tr); }
      /* travail = tout sauf le trajet pur : descendre au front par l'existant, remonter, tomber */
      const travel = m.mode === 'return' || m.status === 'Descend par l\'existant' || m.status === 'Tombe';
      if(tr && m.y > 0){ tr.n++; if(!travel) tr.work++; }
      if(tr && m.y === 0){ if(tr.start >= SESSION_LEN - 600 && tr.n * 0.1 > 60) late.push(tr); trips.delete(m.id); }
    }
  } });
  for(const tr of trips.values()) if(tr.start >= SESSION_LEN - 600 && tr.n * 0.1 > 60) late.push(tr);
  assert.ok(late.length > 0, 'au moins un départ dans les 10 dernières minutes');
  for(const tr of late) assert.ok(tr.work / tr.n >= 1 / 3, `${tr.name}, parti à ${Math.round(tr.start)} s : ${Math.round(100 * tr.work / tr.n)} % du trajet à travailler`);
});
