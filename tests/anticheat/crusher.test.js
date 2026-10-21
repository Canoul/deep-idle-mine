/* Anti-duplication du concasseur : aucune suite d'actions (même trafiquées, rejouées, à des heures quelconques)
   ne crée de blocs ; chaque lot de 100 blocs consommé correspond à un cycle compté, et le butin ne vient que des cycles. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CRUSHER } from '../../src/config.js';
import { mulberry32 } from '../../src/core/rng.js';
import { createInventory, addAll, countOf } from '../../src/meta/inventory.js';
import { createCrusher, crusherOp, advance } from '../../src/meta/crusher.js';

const START = { Terre:900, Pierre:700, 'Pierre dure':400, Fer:100 };
const BLOCKS = ['Terre', 'Pierre', 'Pierre dure'];
const LOOT = ['Rubis inférieur', 'Saphir inférieur', 'Jade inférieur', 'Treasure T1', 'Treasure T2'];
const BAD_QTY = [0, -10, 2.5, Infinity, -Infinity, NaN, '50', 1e300, null, undefined, {}];

const total = (inv, c, name) => countOf(inv, name) + [...c.in, ...c.out].reduce((n, s) => n + (s?.item === name ? s.qty : 0), 0);

test('concasseur : blocs conservés et butin borné sur 500 suites d\'actions au hasard (quantités trafiquées, opId rejoués)', () => {
  const r = mulberry32(2026);
  const pick = a => a[Math.floor(r() * a.length)];
  for(let t = 0; t < 500; t++){
    const inv = createInventory(); addAll(inv, START);
    const c = createCrusher(); let now = 1e6; const ids = [];
    for(let k = 0; k < 40; k++){
      now += Math.floor(r() * 150_000) - 20_000;                 // l'heure peut même reculer un peu
      advance(c, now, r);
      const opId = ids.length && r() < 0.2 ? pick(ids) : `op-${t}-${k}`;
      ids.push(opId);
      const qty = r() < 0.2 ? pick(BAD_QTY) : 1 + Math.floor(r() * 300);
      const slot = r() < 0.1 ? pick([-1, 8, 'all', '0', 2.5]) : Math.floor(r() * 8);
      crusherOp(c, inv, { action:pick(['load', 'load', 'unload', 'collect', 'hack']), slot, item:pick([...BLOCKS, 'Fer', 'Rubis inférieur']), qty, opId }, now);
    }
    advance(c, now + 1e12, r);
    const consumed = BLOCKS.reduce((n, b) => n + START[b] - total(inv, c, b), 0);
    assert.equal(consumed, c.crushed * CRUSHER.batch, `blocs consommés = lots × ${CRUSHER.batch} (essai ${t})`);
    assert.equal(total(inv, c, 'Fer'), START.Fer);
    const loot = LOOT.reduce((n, i) => n + total(inv, c, i), 0);
    assert.ok(loot <= 2 * c.crushed, `au plus une gemme + un treasure par lot (essai ${t})`);
    for(const s of [...inv.slots, ...c.in, ...c.out]) if(s) assert.ok(Number.isSafeInteger(s.qty) && s.qty > 0);
  }
});
