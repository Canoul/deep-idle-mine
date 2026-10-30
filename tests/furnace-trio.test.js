/* Four : 3e case d'alliage (30/10/2026, Geoffrey). Aucune recette à 3 ingrédients en config pour l'instant : les tests en
   ajoutent une le temps de leur exécution. */
import { test, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FURNACE } from '../src/config.js';
import { createInventory, addAll, countOf } from '../src/meta/inventory.js';
import { createFurnaces, furnaceOp, advance, activeRecipe, batches, alloyOf, alloyFits, sanitizeFurnaces } from '../src/meta/furnace.js';

const TRIO = { out:'Diamant', in:{ 'Lingot de fer':2, 'Lingot d\'or':3, 'Chitine':4 }, fuel:10, time:60 };
beforeEach(() => FURNACE.alloys.push(TRIO));
afterEach(() => FURNACE.alloys.pop());

const T0 = 1_000_000, MIN = 60_000;
let n = 0;
const setup = (mode = 'alloy') => {
  const inv = createInventory(), st = createFurnaces();
  addAll(inv, { 'Lingot de fer':100, 'Lingot d\'or':100, Chitine:100, Charbon:300, 'Graphite ingot':100 });
  st.list[0].mode = mode;
  return { inv, st, f: st.list[0] };
};
const op = (st, inv, o, now = T0) => furnaceOp(st, inv, { furnace:0, opId:'trio-' + (++n), ...o }, now);

test('alloyOf : exactement ces ingrédients, dans n\'importe quel ordre ; une recette à 2 reste à 2', () => {
  assert.equal(alloyOf('Chitine', 'Lingot de fer', 'Lingot d\'or'), TRIO);
  assert.equal(alloyOf('Lingot de fer', 'Chitine').out, 'Tainted iron');
  assert.equal(alloyOf('Lingot de fer', 'Lingot de fer', 'Chitine'), null, 'deux fois le même');
  assert.equal(alloyOf('Lingot de fer'), null, 'un seul');
  assert.equal(alloyOf('Lingot de fer', 'Lingot d\'or'), null, 'il en manque un');
  assert.equal(alloyFits(['Lingot de fer', 'Lingot d\'or']), true, 'mais ils tiennent dans une recette');
  assert.equal(alloyFits(['Lingot de fer', 'Graphite ingot']), false);
});

test('3 ingrédients : posés dans n\'importe quelles cases, consommés tous les trois ; retirer rend le reste', () => {
  const { inv, st, f } = setup();
  for(const [slot, item] of [['c', 'Chitine'], ['a', 'Lingot d\'or'], ['b', 'Lingot de fer']])
    assert.equal(op(st, inv, { action:'load', slot, item, qty:20 }).ok, true, slot);
  assert.equal(op(st, inv, { action:'load', slot:'fuel', item:'Charbon', qty:20 }).ok, true);
  assert.deepEqual(activeRecipe(f).need, { a:3, b:2, c:4, fuel:10 });
  assert.equal(batches(f), 2);
  advance(f, T0 + 2 * MIN);
  assert.deepEqual(f.out, { item:'Diamant', qty:2 });
  assert.deepEqual([f.a.qty, f.b.qty, f.c.qty, f.fuel], [14, 16, 12, null]);
  assert.equal(op(st, inv, { action:'empty' }, T0 + 2 * MIN).ok, true);
  assert.deepEqual([countOf(inv, 'Lingot d\'or'), countOf(inv, 'Lingot de fer'), countOf(inv, 'Chitine')], [94, 96, 92], 'seule la part cuite a disparu');
  assert.equal(countOf(inv, 'Diamant'), 2);
});

test('il manque le 3e ingrédient : le four attend (pas de recette, rien ne cuit)', () => {
  const { inv, st, f } = setup();
  op(st, inv, { action:'load', slot:'a', item:'Lingot d\'or', qty:3 });
  op(st, inv, { action:'load', slot:'c', item:'Lingot de fer', qty:2 });
  op(st, inv, { action:'load', slot:'fuel', item:'Charbon', qty:10 });
  assert.equal(activeRecipe(f), null);
  assert.equal(f.since, null);
});

test('recette à 2 : marche la 3e case vide ; un ingrédient étranger refusé, rien n\'est pris', () => {
  const { inv, st, f } = setup();
  op(st, inv, { action:'load', slot:'a', item:'Lingot de fer', qty:5 });
  op(st, inv, { action:'load', slot:'b', item:'Chitine', qty:15 });
  assert.deepEqual(activeRecipe(f).need, { a:5, b:15, fuel:50 });
  assert.equal(activeRecipe(f).out, 'Tainted iron');
  assert.equal(op(st, inv, { action:'load', slot:'c', item:'Graphite ingot', qty:5 }).error, 'no_recipe');
  assert.equal(f.c, null);
  assert.equal(countOf(inv, 'Graphite ingot'), 100);
});

test('case c : refusée en mode Fondre ; deux fois le même ingrédient refusé', () => {
  const a = setup('smelt');
  assert.equal(op(a.st, a.inv, { action:'load', slot:'c', item:'Chitine', qty:1 }).error, 'bad_slot');
  const b = setup();
  assert.equal(op(b.st, b.inv, { action:'load', slot:'a', item:'Chitine', qty:1 }).ok, true);
  assert.equal(op(b.st, b.inv, { action:'load', slot:'c', item:'Chitine', qty:1 }).error, 'no_recipe');
  assert.equal(countOf(b.inv, 'Chitine'), 99);
});

test('changer de mode : refusé tant que la case c est pleine (rien ne disparaît)', () => {
  const { inv, st, f } = setup();
  op(st, inv, { action:'load', slot:'c', item:'Chitine', qty:4 });
  assert.equal(op(st, inv, { action:'mode', mode:'smelt' }).error, 'not_empty');
  assert.equal(f.mode, 'alloy');
});

test('bouton Recettes : remplit les trois cases ; changer de recette rend la 3e', () => {
  const { inv, st, f } = setup();
  assert.equal(op(st, inv, { action:'recipe', out:'Diamant', count:2 }).ok, true);
  assert.deepEqual(Object.fromEntries(['a', 'b', 'c'].map(s => [f[s].item, f[s].qty])), { 'Lingot de fer':4, 'Lingot d\'or':6, Chitine:8 });
  assert.equal(activeRecipe(f).out, 'Diamant');
  assert.equal(f.fuel.qty, 20);
  assert.equal(op(st, inv, { action:'recipe', out:'Tainted iron', count:1 }).ok, true);
  assert.equal(activeRecipe(f).out, 'Tainted iron');
  assert.ok(!['a', 'b', 'c'].some(k => f[k]?.item === "Lingot d'or"), "plus d'or dans le four");
  assert.equal(countOf(inv, 'Lingot d\'or'), 100, 'l\'ingrédient qui ne sert plus revient');
});

test('relecture : un four enregistré sans case c continue ; le contenu de la case c survit', () => {
  const old = { list:[{ tier:0, mode:'alloy', ore:null, a:{ item:'Lingot de fer', qty:5 }, b:{ item:'Chitine', qty:15 },
                        fuel:{ item:'Charbon', qty:50 }, out:null, since:1000 }], ops:[] };
  const f = sanitizeFurnaces(old).list[0];
  assert.equal(f.c, null);
  assert.equal(f.since, 1000, 'la fonte en cours n\'est pas coupée');
  assert.equal(activeRecipe(f).out, 'Tainted iron');
  const again = sanitizeFurnaces(JSON.parse(JSON.stringify({ list:[{ ...f, c:{ item:'Lingot d\'or', qty:3 } }], ops:[] })));
  assert.deepEqual(again.list[0].c, { item:'Lingot d\'or', qty:3 });
});
