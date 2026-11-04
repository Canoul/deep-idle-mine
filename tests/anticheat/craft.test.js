/* Anti-duplication du craft et du stuff : aucune suite d'actions (rejouées, trafiquées) ne crée de pioche ou de
   lingot ; une pièce n'est jamais à la fois portée et dans l'inventaire. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/core/rng.js';
import { createInventory, addAll, countOf, serialize, deserialize } from '../../src/meta/inventory.js';
import { craft, learn } from '../../src/meta/craft.js';
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

test('blueprints : 300 suites d\'apprentissages et de crafts au hasard, jamais un blueprint consommé deux fois', () => {
  const r = mulberry32(99);
  const BPS = ['Pioche en fer BP', 'Épée en fer BP', 'Casque en fer BP', 'Four en fer BP'];
  for(let t = 0; t < 300; t++){
    const inv = createInventory(); addAll(inv, { 'Pioche en fer BP':2, 'Épée en fer BP':1, 'Casque en fer BP':1, 'Four en fer BP':1, 'Tainted iron':60 });
    const ids = [];
    let learned = 0;
    for(let k = 0; k < 25; k++){
      const pick = a => a[Math.floor(r() * a.length)];
      const opId = ids.length && r() < 0.3 ? pick(ids) : 'b' + t + '-' + k; ids.push(opId);
      if(r() < 0.6){ const res = learn(inv, pick(BPS), opId); if(res.ok && !res.repeated) learned++; }
      else craft(inv, pick(['Pioche en fer', 'Épée en fer', 'Casque en fer']), opId);
      const back = deserialize(serialize(inv)); Object.assign(inv, back);   // relecture à chaque étape
    }
    const bpsLeft = BPS.reduce((s, b) => s + countOf(inv, b), 0);
    assert.equal(bpsLeft + learned, 5, 'chaque blueprint est soit gardé, soit transformé en UNE recette');
    assert.equal(inv.unlocked.length, learned);
    assert.ok(learned <= 4, 'au plus 4 recettes (une par sorte de blueprint)');
    const made = { 'Pioche en fer':20, 'Épée en fer':10, 'Casque en fer':5 };
    const spent = Object.entries(made).reduce((s, [it, c]) => s + countOf(inv, it) * c, 0);
    assert.equal(countOf(inv, 'Tainted iron') + spent, 60, 'matière conservée');
  }
});

test('craft en série (04/11/2026) : 300 demandes au hasard (quantités trafiquées, rejouées), matière conservée', async () => {
  const { createInventory, addAll, countOf } = await import('../../src/meta/inventory.js');
  const { RECIPES } = await import('../../src/recipes.js');
  const cost = RECIPES.Orbe.cost, start = { 'Tissu sombre':900, 'Vésicule de gaz':900, 'Pierre glissante':300 };
  const inv = createInventory(); addAll(inv, start);
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const counts = [1, 2, 5, 40, 0, -1, 2.5, '3', NaN, Infinity, 1e9, 1001];
  for(let i = 0; i < 300; i++){
    const opId = 'op-serie-' + Math.floor(r() * 60);                 // beaucoup d'opId rejoués
    craft(inv, 'Orbe', opId, undefined, counts[Math.floor(r() * counts.length)]);
  }
  const made = countOf(inv, 'Orbe');
  for(const [k, n] of Object.entries(cost)) assert.equal(countOf(inv, k), start[k] - made * n, k);
  assert.ok(made > 0 && made <= 30);
});

test('craft en série par le serveur : count vérifié, rafale du même opId créditée une fois', async () => {
  const { createMemoryGameStore } = await import('../../server/game/store.js');
  const { createGameService } = await import('../../server/game/service.js');
  const { fakeLive } = await import('../helpers.js');
  const ME = { id:'AAAA1111', name:'Zoe', guest:false };
  const game = createGameService({ store: createMemoryGameStore(), liveRunner: fakeLive(() => ({ shares:[] })), clock: () => 1_000_000,
                                  dev:false, config:{ startsPerHour:1000, keepEnded:1e12, maxLive:2 } });
  for(const [k, n] of [['Tissu sombre', 300], ['Vésicule de gaz', 300], ['Pierre glissante', 100]]) await game.adminGive(ME.id, k, n);
  const count = (inv, item) => inv.slots.reduce((n, s) => n + (s?.item === item ? s.qty : 0), 0);
  for(const bad of ['4', -1, 0, 2.5, 1001]) await assert.rejects(game.craft(ME, { item:'Orbe', opId:'op-srv-bad-1', count:bad }), { code:'bad_count' });
  await assert.rejects(game.craft(ME, { item:'Orbe', opId:'op-srv-big-1', count:11 }), { code:'not_enough' });
  const res = await Promise.allSettled(Array.from({ length:6 }, () => game.craft(ME, { item:'Orbe', opId:'op-srv-ten-1', count:10 })));
  assert.ok(res.every(r => r.status === 'fulfilled'));
  const inv = (await game.state(ME)).inventory;
  assert.deepEqual([count(inv, 'Orbe'), count(inv, 'Tissu sombre'), count(inv, 'Pierre glissante')], [10, 0, 0]);
});
