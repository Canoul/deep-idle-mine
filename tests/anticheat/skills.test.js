/* Anti-triche des skills : jamais plus de rangs que de points de niveau, quoi que contienne le stockage ou
   l'enregistrement d'une session ; aucune suite de demandes ne contourne les règles de l'arbre. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS } from '../../src/config.js';
import { mulberry32 } from '../../src/core/rng.js';
import { createSkills, skillOp, sanitizeSkills, spentPoints, NODES } from '../../src/meta/skills.js';
import { buildSession } from '../../src/shared/game.js';
import { STATS } from '../../src/config.js';

const valid = st => {
  const trees = new Set(Object.keys(st.ranks).filter(k => st.ranks[k] > 0).map(k => NODES[k].tree));
  if(trees.size > 1) return 'deux arbres';
  for(const [k, r] of Object.entries(st.ranks)){
    const n = NODES[k]; if(r > n.max) return 'rang > max';
    /* arbres en étages : un nœud de l'étage r > 1 demande AU MOINS UN nœud de l'étage r-1 au rang max (deux nœuds
       d'un même étage, comme Échelle de 2 et Treuil, ne dépendent pas l'un de l'autre) */
    const prev = SKILLS.trees.find(t => t.id === n.tree).nodes.filter(p => p.row === n.row - 1);
    if(prev.length && !prev.some(p => (st.ranks[p.id] ?? 0) >= p.max)) return 'étape sans la précédente';
  }
  return null;
};

test('skills : 500 suites de demandes au hasard (nœuds inconnus, opId rejoués, resets), règles toujours tenues', () => {
  const r = mulberry32(8);
  const ids = [...Object.keys(NODES), 'x', '__proto__', null];
  for(let t = 0; t < 500; t++){
    const points = Math.floor(r() * 12), st = createSkills(), ops = [];
    for(let k = 0; k < 25; k++){
      const opId = ops.length && r() < 0.2 ? ops[Math.floor(r() * ops.length)] : 's' + t + '-' + k; ops.push(opId);
      skillOp(st, r() < 0.1 ? { action:'reset', opId } : { action:'learn', node:ids[Math.floor(r() * ids.length)], opId }, points);
      assert.ok(spentPoints(st) <= points, 'plus de rangs que de points');
      assert.equal(valid(st), null);
    }
  }
});

test('skills : enregistrement de session trafiqué → revérifié (rangs impossibles ignorés)', () => {
  const G = buildSession({ id:'S', seed:1, players:[{ account:'A', name:'Ana' }],
    skills:{ A:{ tree:'barbare', ranks:{ damage:50, taunt:3, loot:99, mine_speed:3 } } } });
  const m = G.miners[0];
  assert.ok(Math.abs(m.carac.damage - STATS.damage * 1.15) < 1e-9, 'damage plafonné au rang 3');
  assert.equal(m.skill.loot, 0.15, 'loot plafonné au rang 5');
  assert.equal(m.skill.mine_speed, 0, 'pas de skill d\'un autre arbre');
  assert.equal(m.carac.mineSpeed, STATS.mineSpeed);
  assert.equal(sanitizeSkills({ tree:'barbare', ranks:{ damage:3, taunt:1 } }, 3).ranks.taunt, undefined, '3 points : taunt hors budget');
});