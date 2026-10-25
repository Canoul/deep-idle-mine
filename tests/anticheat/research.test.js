/* Anti-duplication de la table de recherche : aucune suite d'actions (rejouées, trafiquées) ne crée de parts ni de
   blueprints hors règle : chaque recherche coûte exactement 100 parts pour 1 blueprint, chaque recyclage détruit
   1 blueprint pour la fourchette de son tier (RESEARCH.tiers, tier 1 : 15 à 30 parts depuis le 25/10 au soir). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/core/rng.js';
import { createInventory, addAll, countOf, serialize, deserialize } from '../../src/meta/inventory.js';
import { research, recycle, isBlueprint, PARTS } from '../../src/meta/research.js';
import { RESEARCH } from '../../src/config.js';

const T1 = RESEARCH.tiers[0].recycle;   // seuls des blueprints du tier 1 sont en jeu ici

const BAD = [0, -1, 2, '1', 1.5, NaN, Infinity, null, undefined, {}, [], 'Charbon', 'Blueprint parts', '__proto__'];

test('recherche + recycle : 400 suites au hasard (opId rejoués, valeurs trafiquées, relectures), matière conservée', () => {
  const r = mulberry32(4242);
  for(let t = 0; t < 400; t++){
    const inv = createInventory(); addAll(inv, { [PARTS]:450, 'Épée en fer BP':1, Charbon:10 });
    const ids = []; let searches = 0, recycles = 0, partsBack = 0;
    for(let k = 0; k < 20; k++){
      const pick = a => a[Math.floor(r() * a.length)];
      const opId = ids.length && r() < 0.3 ? pick(ids) : 'r' + t + '-' + k; ids.push(opId);
      let res;
      if(r() < 0.5) res = research(inv, r() < 0.8 ? 1 : pick(BAD), opId, r);
      else {
        const bps = inv.slots.filter(s => s && isBlueprint(s.item)).map(s => s.item);
        res = recycle(inv, bps.length && r() < 0.8 ? pick(bps) : pick(BAD), opId, r);
      }
      if(res.ok && !res.repeated){ if(res.parts === undefined) searches++; else { recycles++; partsBack += res.parts; assert.ok(res.parts >= T1.min && res.parts <= T1.max); } }
      Object.assign(inv, deserialize(serialize(inv)));
    }
    const bps = inv.slots.filter(s => s && isBlueprint(s.item)).reduce((s, x) => s + x.qty, 0);
    assert.equal(countOf(inv, PARTS), 450 - 100 * searches + partsBack, 'parts');
    assert.equal(bps, 1 + searches - recycles, 'blueprints');
    assert.equal(countOf(inv, 'Charbon'), 10, 'le reste ne bouge pas');
  }
});