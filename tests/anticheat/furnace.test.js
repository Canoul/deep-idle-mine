/* Anti-duplication du four : aucune suite d'actions (même trafiquées, rejouées, à des heures quelconques)
   ne crée de minerai, de charbon ou de lingot. 10 minerais + 10 charbons = 1 lingot, jamais plus. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FURNACE } from '../../src/config.js';
import { mulberry32 } from '../../src/core/rng.js';
import { createInventory, addAll, countOf } from '../../src/meta/inventory.js';
import { createFurnaces, furnaceOp, advance, sanitizeFurnaces } from '../../src/meta/furnace.js';

const START = { Fer:200, Or:100, Diamant:30, Charbon:400 };
const BAD_QTY = [0, -10, 2.5, Infinity, -Infinity, NaN, '50', 1e300, null, undefined, {}];

function total(inv, st, name){
  let n = countOf(inv, name);
  for(const f of st.list) for(const s of ['ore', 'fuel', 'out']) if(f[s]?.item === name) n += f[s].qty;
  return n;
}

test('four : matière conservée sur 500 suites d\'actions au hasard (quantités trafiquées, opId rejoués, 3 fours)', () => {
  const r = mulberry32(2026);
  for(let t = 0; t < 500; t++){
    const inv = createInventory(); addAll(inv, START);
    const st = createFurnaces(); while(st.list.length < FURNACE.max) st.list.push(createFurnaces().list[0]);
    let now = 1e6; const ids = [];
    for(let k = 0; k < 30; k++){
      now += Math.floor(r() * 200_000) - 20_000;                  // l'heure peut même reculer un peu
      const reuse = ids.length && r() < 0.2;
      const opId = reuse ? ids[Math.floor(r() * ids.length)] : 'op-' + t + '-' + k;
      ids.push(opId);
      const slot = ['ore', 'fuel', 'out', 'x'][Math.floor(r() * 4)];
      const item = ['Fer', 'Or', 'Diamant', 'Charbon', 'Lingot de fer', 'Pierre'][Math.floor(r() * 6)];
      const qty = r() < 0.2 ? BAD_QTY[Math.floor(r() * BAD_QTY.length)] : 1 + Math.floor(r() * 80);
      const action = ['load', 'load', 'unload', 'collect', 'hack'][Math.floor(r() * 5)];
      furnaceOp(st, inv, { action, furnace: Math.floor(r() * 4) - (r() < 0.1 ? 5 : 0), slot, item, qty, opId }, now);
    }
    for(const f of st.list) advance(f, now + 1e12);
    const ingots = { Fer: total(inv, st, 'Lingot de fer'), Or: total(inv, st, 'Lingot d\'or'), Diamant: total(inv, st, 'Lingot de diamant') };
    for(const ore of ['Fer', 'Or', 'Diamant'])
      assert.equal(total(inv, st, ore) + FURNACE.orePerIngot * ingots[ore], START[ore], `${ore} (essai ${t})`);
    const all = ingots.Fer + ingots.Or + ingots.Diamant;
    assert.equal(total(inv, st, 'Charbon') + FURNACE.fuelPerIngot * all, START.Charbon, `charbon (essai ${t})`);
    for(const s of inv.slots) if(s) assert.ok(Number.isSafeInteger(s.qty) && s.qty > 0);
  }
});

test('four : sauvegarde trafiquée (quantités folles, objets interdits, fours en trop) → nettoyée', () => {
  const st = sanitizeFurnaces({ list: Array.from({ length: 10 }, () => ({
    ore:{ item:'Charbon', qty:50 }, fuel:{ item:'Charbon', qty:-5 }, out:{ item:'Lingot de fer', qty:1.5 }, since:Infinity })) });
  assert.equal(st.list.length, FURNACE.max);
  for(const f of st.list) assert.deepEqual(f, { tier:0, ore:null, fuel:null, out:null, since:null });
});
