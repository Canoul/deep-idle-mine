/* Anti-duplication des glyphes : aucune suite d'actions (rejouées, trafiquées, relues) ne crée ni ne détruit de glyphe :
   pour chaque glyphe, (exemplaires dans l'inventaire) + (1 s'il est posé) reste constant. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/core/rng.js';
import { GLYPHS } from '../../src/config.js';
import { createInventory, addAll, countOf, serialize, deserialize } from '../../src/meta/inventory.js';
import { sanitizeSkills, skillOp } from '../../src/meta/skills.js';
import { glyphOp } from '../../src/meta/glyphs.js';

const BAD = [0, -1, '1', NaN, null, undefined, {}, [], 'taunt', 'inconnu', '__proto__', 'Glyphe Ruée'];
const NODES_ = Object.keys(GLYPHS.items);

test('glyphes : 300 suites au hasard (opId rejoués, valeurs trafiquées, reset, relectures), matière conservée', () => {
  const r = mulberry32(777), pick = a => a[Math.floor(r() * a.length)];
  for(let t = 0; t < 300; t++){
    const inv = createInventory(); addAll(inv, { 'Glyphe Ruée':2, 'Glyphe Second souffle':1, 'Glyphe Force brute':1, Charbon:5 });
    let st = sanitizeSkills({ tree:'mineur', ranks:{ mine_speed:3, ore_oxygen:1, ore_rush:5 } });
    const start = Object.fromEntries(Object.values(GLYPHS.items).map(n => [n, countOf(inv, n)]));
    const ids = [];
    for(let k = 0; k < 20; k++){
      const opId = ids.length && r() < 0.3 ? pick(ids) : `g${t}-${k}`; ids.push(opId);
      if(r() < 0.08) skillOp(st, { action:'reset', opId }, 99);
      else glyphOp(st, inv, { action:r() < 0.5 ? 'pose' : r() < 0.9 ? 'remove' : pick(BAD), node:r() < 0.8 ? pick(NODES_) : pick(BAD), opId });
      st = sanitizeSkills(JSON.parse(JSON.stringify(st)));
      Object.assign(inv, deserialize(serialize(inv)));
    }
    for(const [node, name] of Object.entries(GLYPHS.items))
      assert.equal(countOf(inv, name) + (st.glyphs[node] === name ? 1 : 0), start[name], `${name} (suite ${t})`);
    assert.equal(countOf(inv, 'Charbon'), 5);
  }
});
