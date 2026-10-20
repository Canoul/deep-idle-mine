/* Anti-duplication du craft et du stuff : aucune suite d'actions (rejouées, trafiquées) ne crée de pioche ou de
   lingot ; une pièce n'est jamais à la fois portée et dans l'inventaire. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/core/rng.js';
import { createInventory, addAll, countOf, serialize, deserialize } from '../../src/meta/inventory.js';
import { craft } from '../../src/meta/craft.js';
import { createStuff, stuffOp, sanitizeStuff } from '../../src/meta/stuff.js';

const PICK = 'Pioche en pierre';

test('craft + stuff : 400 suites d\'actions au hasard, matière conservée, pièces uniques', () => {
  const r = mulberry32(31);
  for(let t = 0; t < 400; t++){
    const inv = createInventory(); addAll(inv, { 'Lingot de fer':100 });
    let st = createStuff(); const ids = [];
    for(let k = 0; k < 25; k++){
      const opId = ids.length && r() < 0.25 ? ids[Math.floor(r() * ids.length)] : `op-${t}-${k}`;
      ids.push(opId);
      const a = r();
      if(a < 0.35) craft(inv, r() < 0.9 ? PICK : 'Inconnu', opId);
      else {
        const all = inv.slots.filter(s => s?.uid != null).map(s => s.uid);
        const uid = r() < 0.8 && all.length ? all[Math.floor(r() * all.length)] : [999, -1, 1.5, '1', null][Math.floor(r() * 5)];
        stuffOp(inv, st, { action: a < 0.75 ? 'equip' : 'unequip', slot: r() < 0.85 ? 'pioche' : 'casque', uid, opId });
      }
      if(r() < 0.2){                                         // sauvegarde / relecture au milieu
        const inv2 = deserialize(serialize(inv)); st = sanitizeStuff(JSON.parse(JSON.stringify(st)), inv2);
        Object.assign(inv, inv2);
      }
    }
    const worn = Object.values(st.worn).filter(Boolean);
    const picks = countOf(inv, PICK) + worn.length;
    assert.equal(countOf(inv, 'Lingot de fer') + 30 * picks, 100, `essai ${t}`);
    const all = [...inv.slots.filter(s => s?.uid != null).map(s => s.uid), ...worn.map(p => p.uid)];
    assert.equal(new Set(all).size, all.length, 'aucun uid en double');
    assert.ok(all.every(u => u < inv.nextUid));
  }
});
