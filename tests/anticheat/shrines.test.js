/* Anti-triche : dons aux shrines (28/10/2026). Suites au hasard (objets étrangers, quantités trafiquées, opId rejoués,
   relectures) : rien n'est créé, ce qui quitte l'inventaire est sur le shrine (payé ou consommé par une activation). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHRINES } from '../../src/config.js';
import { createShrines, sanitizeShrines, give } from '../../src/meta/shrines.js';
import { createInventory, addItem, countOf } from '../../src/meta/inventory.js';
import { mulberry32 } from '../../src/core/rng.js';

const AB = SHRINES.list.abundance, ITEMS = Object.keys(AB.price);
const BAD_QTY = [0, -5, 2.5, '3', NaN, Infinity, 1e12, null];

test('shrines : 300 suites au hasard, matière conservée, jamais plus que le prix', () => {
  for(let run = 0; run < 300; run++){
    const r = mulberry32(run + 1), pick = a => a[Math.floor(r() * a.length)];
    let st = createShrines(); const inv = createInventory(), start = {};
    for(const it of ITEMS){ start[it] = Math.floor(r() * 40); if(start[it]) addItem(inv, it, start[it]); }
    let activations = 0; const ids = [];
    for(let k = 0; k < 30; k++){
      const opId = ids.length && r() < 0.2 ? pick(ids) : 'op-' + run + '-' + k;
      ids.push(opId);
      const qty = r() < 0.15 ? pick(BAD_QTY) : 1 + Math.floor(r() * 25);
      const item = r() < 0.1 ? 'Charbon' : pick(ITEMS);
      const res = give(st, inv, { shrine: r() < 0.05 ? 'bidule' : 'abundance', item, qty, opId });
      if(res.activated && !res.repeated) activations++;
      if(r() < 0.3) st = sanitizeShrines(JSON.parse(JSON.stringify(st)));
      if(st.active.abundance && r() < 0.2) delete st.active.abundance;   // les sessions passent : on peut repayer
    }
    for(const it of ITEMS){
      const paid = st.paid.abundance?.[it] ?? 0;
      assert.ok(paid <= AB.price[it]);
      assert.equal(countOf(inv, it) + paid + activations * AB.price[it], start[it], `objet ${it}, suite ${run}`);
    }
  }
});
