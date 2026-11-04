/* Anti-triche des skills : jamais plus de rangs que de points de niveau, quoi que contienne le stockage ou
   l'enregistrement d'une session ; aucune suite de demandes ne contourne les règles de l'arbre. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS } from '../../src/config.js';
import { mulberry32 } from '../../src/core/rng.js';
import { createSkills, skillOp, sanitizeSkills, spentPoints, NODES } from '../../src/meta/skills.js';
import { buildSession } from '../../src/shared/game.js';
import { STATS } from '../../src/config.js';

/* arbres v2 (04/11/2026) : rangs seulement avec une spé ; étage r ⇐ 3 × (r − 1) points dans l'arbre ; needs au max ; hors
   spé : étage ≤ profondeur de la spé − 1 et jamais un skill de classe (specOnly) */
const valid = st => {
  const ranked = Object.keys(st.ranks).filter(k => st.ranks[k] > 0);
  if(ranked.length && !st.tree) return 'rangs sans spé';
  const pts = t => SKILLS.trees.find(x => x.id === t).nodes.reduce((s, n) => s + (st.ranks[n.id] ?? 0), 0);
  const depth = t => Math.max(0, ...SKILLS.trees.find(x => x.id === t).nodes.filter(n => (st.ranks[n.id] ?? 0) > 0).map(n => n.row));
  for(const k of ranked){
    const n = NODES[k], r = st.ranks[k];
    if(r > n.max) return 'rang > max';
    if(n.needs && (st.ranks[n.needs] ?? 0) < NODES[n.needs].max) return 'needs pas au max';
    if(n.tree !== st.tree && n.specOnly) return 'skill de classe hors spé';
    if(n.tree !== st.tree && n.row > depth(st.tree) - 1) return 'trop profond hors spé';
  }
  /* étages : les points des étages AU-DESSUS d'un nœud suffisent à l'ouvrir (on ne retire jamais un rang seul) */
  for(const t of SKILLS.trees) for(const n of t.nodes) if((st.ranks[n.id] ?? 0) > 0){
    const above = t.nodes.filter(x => x.row < n.row).reduce((s, x) => s + (st.ranks[x.id] ?? 0), 0);
    if(above < SKILLS.tierPoints * (n.row - 1)) return 'étage ouvert sans les points';
  }
  return null;
};

test('skills : 500 suites de demandes au hasard (nœuds inconnus, opId rejoués, resets), règles toujours tenues', () => {
  const r = mulberry32(8);
  const ids = [...Object.keys(NODES), 'x', '__proto__', null];
  for(let t = 0; t < 500; t++){
    const points = Math.floor(r() * 40), st = createSkills(), ops = [];
    for(let k = 0; k < 60; k++){
      const opId = ops.length && r() < 0.2 ? ops[Math.floor(r() * ops.length)] : 's' + t + '-' + k; ops.push(opId);
      const x = r(), trees = [...SKILLS.trees.map(t => t.id), 'hacker', null];
      skillOp(st, x < 0.05 ? { action:'reset', opId } : x < 0.12 ? { action:'spec', tree:trees[Math.floor(r() * trees.length)], opId }
        : { action:'learn', node:ids[Math.floor(r() * ids.length)], opId }, points);
      assert.ok(spentPoints(st) <= points, 'plus de rangs que de points');
      assert.equal(valid(st), null);
    }
  }
});

test('skills : enregistrement de session trafiqué → revérifié (rangs impossibles ignorés)', () => {
  const G = buildSession({ id:'S', seed:1, players:[{ account:'A', name:'Ana' }],
    skills:{ A:{ tree:'barbare', ranks:{ damage:50, taunt:3, loot:99, ore_oxygen:1, filou:3, aura_berserk:1 } } } });
  const m = G.miners[0];
  assert.ok(Math.abs(m.carac.damage - STATS.damage * 1.15) < 1e-9, 'damage plafonné au rang 3');
  assert.equal(m.skill.loot, 0.09, 'loot plafonné au rang 3');
  assert.equal(m.skill.ore_oxygen, 0, 'skill de classe d\'un autre arbre : refusé');
  assert.equal(m.skill.filou, 0, 'étage 2 d\'un autre arbre avec la spé à l\'étage 2 : refusé');
  assert.equal(m.skill.aura_berserk, 0, 'aura sans les points ni Saccager : refusée');
  assert.equal(m.carac.crit, STATS.crit ?? 0, 'pas de critique en plus');
  assert.equal(sanitizeSkills({ tree:'barbare', ranks:{ damage:3, taunt:1 } }, 3).ranks.taunt, undefined, '3 points : taunt hors budget');
  assert.deepEqual(sanitizeSkills({ ranks:{ damage:3 } }).ranks, {}, 'sans spé : rien');
});
