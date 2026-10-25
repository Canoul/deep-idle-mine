/* Four : familles d'objets, fonte en temps réel, actions du joueur (poser, retirer, récupérer), relecture. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FURNACE, ITEMS, BLOCKS } from '../src/config.js';
import { createInventory, addAll, countOf } from '../src/meta/inventory.js';
import { createFurnaces, furnaceOp, advance, progress, canRun, accepts, sanitizeFurnaces } from '../src/meta/furnace.js';

const MIN = 60_000, T0 = 1_000_000;
let n = 0;
const id = () => 'op-test-' + (++n);
const setup = (bag = { Fer:100, Or:40, Charbon:200, Pierre:5 }) => {
  const inv = createInventory(); addAll(inv, bag);
  return { inv, st: createFurnaces() };
};
const op = (st, inv, o, now = T0) => furnaceOp(st, inv, { furnace:0, opId:id(), ...o }, now);

test('familles : charbon = combustible (mais minerai dans la mine), fer/or = ore, lingots = ingot', () => {
  assert.equal(ITEMS.Charbon.cat, 'combustible');
  assert.equal(Object.values(BLOCKS).find(b => b.name === 'Charbon').type, 'ore', 'la mine ne change pas');
  assert.equal(ITEMS.Fer.cat, 'ore'); assert.equal(ITEMS.Or.cat, 'ore');
  assert.equal(ITEMS['Lingot de fer'].cat, 'ingot');
  assert.ok(!FURNACE.recipes.Diamant, 'pas de recette pour le diamant (pour l\'instant)');
});

test('cases : minerai seulement dans « ore », combustible seulement dans « fuel »', () => {
  assert.ok(accepts('ore', 'Fer')); assert.ok(accepts('ore', 'Or'));
  assert.ok(!accepts('ore', 'Diamant'), 'minerai sans recette : refusé');
  assert.ok(!accepts('ore', 'Charbon')); assert.ok(!accepts('ore', 'Pierre'));
  assert.ok(accepts('fuel', 'Charbon')); assert.ok(!accepts('fuel', 'Fer'));
  const { inv, st } = setup();
  assert.equal(op(st, inv, { action:'load', slot:'ore', item:'Charbon', qty:10 }).error, 'bad_item');
  assert.equal(op(st, inv, { action:'load', slot:'fuel', item:'Fer', qty:10 }).error, 'bad_item');
  assert.equal(countOf(inv, 'Charbon'), 200);
});

test('un démarré au départ, 3 au maximum', () => {
  assert.equal(createFurnaces().list.length, FURNACE.startOwned);
  assert.equal(FURNACE.max, 3);
  const { inv, st } = setup();
  assert.equal(furnaceOp(st, inv, { action:'load', furnace:1, slot:'ore', item:'Fer', qty:10, opId:id() }, T0).error, 'bad_furnace');
});

test('fer : 10 minerais + 10 charbons = 1 lingot en 1 min, consommés à la fin du lingot', () => {
  const { inv, st } = setup();
  op(st, inv, { action:'load', slot:'ore', item:'Fer', qty:25 });
  op(st, inv, { action:'load', slot:'fuel', item:'Charbon', qty:100 });
  assert.equal(countOf(inv, 'Fer'), 75); assert.equal(countOf(inv, 'Charbon'), 100);
  const f = st.list[0];
  assert.equal(f.since, T0);
  assert.equal(progress(f, T0 + 30_000), 0.5);
  advance(f, T0 + MIN - 1);
  assert.equal(f.out, null); assert.equal(f.ore.qty, 25);
  advance(f, T0 + MIN);
  assert.deepEqual(f.out, { item:'Lingot de fer', qty:1 });
  assert.equal(f.ore.qty, 15); assert.equal(f.fuel.qty, 90);
  advance(f, T0 + 10 * MIN);           // page fermée longtemps : il s'arrête faute de minerai
  assert.deepEqual(f.out, { item:'Lingot de fer', qty:2 });
  assert.equal(f.ore.qty, 5); assert.equal(f.fuel.qty, 80); assert.equal(f.since, null);
});

test('or : 2 min par lingot ; s\'arrête faute de combustible', () => {
  const { inv, st } = setup();
  op(st, inv, { action:'load', slot:'ore', item:'Or', qty:40 });
  op(st, inv, { action:'load', slot:'fuel', item:'Charbon', qty:25 });
  advance(st.list[0], T0 + 2 * MIN - 1);
  assert.equal(st.list[0].out, null);
  advance(st.list[0], T0 + 60 * MIN);
  assert.deepEqual(st.list[0].out, { item:'Lingot d\'or', qty:2 });
  assert.equal(st.list[0].fuel.qty, 5); assert.equal(st.list[0].ore.qty, 20);
  assert.ok(!canRun(st.list[0]));
});

test('rajouter du combustible relance un four arrêté, à partir de maintenant', () => {
  const { inv, st } = setup();
  op(st, inv, { action:'load', slot:'ore', item:'Fer', qty:20 });
  assert.equal(st.list[0].since, null, 'pas de combustible : à l\'arrêt');
  op(st, inv, { action:'load', slot:'fuel', item:'Charbon', qty:10 }, T0 + 5 * MIN);
  assert.equal(st.list[0].since, T0 + 5 * MIN);
});

test('retirer pendant la fonte : tout revient, le lingot en cours est annulé', () => {
  const { inv, st } = setup();
  op(st, inv, { action:'load', slot:'ore', item:'Fer', qty:30 });
  op(st, inv, { action:'load', slot:'fuel', item:'Charbon', qty:30 });
  assert.equal(op(st, inv, { action:'unload', slot:'ore' }, T0 + 90_000).ok, true);   // 1 lingot fini, le 2e à moitié
  assert.equal(countOf(inv, 'Fer'), 70 + 20);
  assert.equal(st.list[0].since, null);
  assert.deepEqual(st.list[0].out, { item:'Lingot de fer', qty:1 });
  op(st, inv, { action:'unload', slot:'fuel' }, T0 + 90_000);
  assert.equal(countOf(inv, 'Charbon'), 170 + 20);
});

test('récupérer les lingots : ils vont dans l\'inventaire, le four repart', () => {
  const { inv, st } = setup();
  op(st, inv, { action:'load', slot:'ore', item:'Fer', qty:30 });
  op(st, inv, { action:'load', slot:'fuel', item:'Charbon', qty:30 });
  op(st, inv, { action:'collect' }, T0 + 2 * MIN);
  assert.equal(countOf(inv, 'Lingot de fer'), 2);
  assert.equal(st.list[0].out, null);
  assert.equal(st.list[0].since, T0 + 2 * MIN, 'le 3e lingot continue');
});

test('sortie occupée par un autre lingot : la fonte attend qu\'on récupère', () => {
  const { inv, st } = setup();
  op(st, inv, { action:'load', slot:'ore', item:'Fer', qty:10 });
  op(st, inv, { action:'load', slot:'fuel', item:'Charbon', qty:50 });
  advance(st.list[0], T0 + MIN);
  op(st, inv, { action:'load', slot:'ore', item:'Or', qty:10 }, T0 + MIN);
  assert.equal(st.list[0].since, null, 'lingots de fer dans la sortie');
  op(st, inv, { action:'collect' }, T0 + 2 * MIN);
  assert.equal(st.list[0].since, T0 + 2 * MIN);
});

test('une case ne contient qu\'une sorte d\'objet', () => {
  const { inv, st } = setup();
  op(st, inv, { action:'load', slot:'ore', item:'Fer', qty:10 });
  assert.equal(op(st, inv, { action:'load', slot:'ore', item:'Or', qty:10 }).error, 'slot_busy');
  assert.equal(countOf(inv, 'Or'), 40);
  op(st, inv, { action:'load', slot:'ore', item:'Fer', qty:5 });
  assert.equal(st.list[0].ore.qty, 15);
});

test('quantités invalides ou pas assez : refusées, rien ne bouge', () => {
  const { inv, st } = setup();
  for(const qty of [0, -5, 1.5, Infinity, NaN, '10', 1e20, null])
    assert.equal(op(st, inv, { action:'load', slot:'ore', item:'Fer', qty }).error, 'bad_qty', String(qty));
  assert.equal(op(st, inv, { action:'load', slot:'ore', item:'Fer', qty:101 }).error, 'not_enough');
  assert.equal(op(st, inv, { action:'load', slot:'ore', item:'Inconnu', qty:1 }).error, 'bad_item');
  assert.equal(op(st, inv, { action:'load', slot:'out', item:'Fer', qty:1 }).error, 'bad_slot');
  assert.equal(op(st, inv, { action:'détruire' }).error, 'bad_request');
  assert.equal(countOf(inv, 'Fer'), 100); assert.equal(st.list[0].ore, null);
});

test('demande rejouée (même opId) : appliquée une seule fois', () => {
  const { inv, st } = setup();
  const o = { action:'load', furnace:0, slot:'ore', item:'Fer', qty:10, opId:'double-clic-1' };
  assert.equal(furnaceOp(st, inv, o, T0).repeated, false);
  assert.equal(furnaceOp(st, inv, o, T0).repeated, true);
  assert.equal(countOf(inv, 'Fer'), 90); assert.equal(st.list[0].ore.qty, 10);
});

test('relecture : état trafiqué nettoyé (cases invalides, trop de fours, mauvais objets)', () => {
  const st = sanitizeFurnaces({ list:[
    { ore:{ item:'Fer', qty:1e400 }, fuel:{ item:'Fer', qty:10 }, out:{ item:'Diamant', qty:5 }, since:'hier' },
    { ore:{ item:'Or', qty:20 }, fuel:{ item:'Charbon', qty:20 }, out:null, since:5 },
    {}, {}, {},
  ], ops:['a', 3, 'b'] });
  assert.equal(st.list.length, FURNACE.max);
  assert.deepEqual(st.list[0], { tier:0, mode:'smelt', ore:null, a:null, b:null, fuel:null, out:null, since:null });
  assert.deepEqual(st.list[1].ore, { item:'Or', qty:20 }); assert.equal(st.list[1].since, 5);
  assert.deepEqual(st.ops, ['a', 'b']);
  assert.equal(sanitizeFurnaces(null).list.length, FURNACE.startOwned);
});

test('conservation : sur 300 suites d\'actions au hasard, rien n\'est créé ni perdu', () => {
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for(let t = 0; t < 300; t++){
    const { inv, st } = setup({ Fer:200, Or:100, Charbon:300 });
    let now = T0;
    for(let k = 0; k < 20; k++){
      now += Math.floor(r() * 3 * MIN);
      const a = ['load', 'load', 'unload', 'collect'][Math.floor(r() * 4)];
      const slot = r() < 0.5 ? 'ore' : 'fuel';
      const item = slot === 'fuel' ? 'Charbon' : (r() < 0.5 ? 'Fer' : 'Or');
      op(st, inv, { action:a, slot, item, qty: 1 + Math.floor(r() * 60) }, now);
    }
    advance(st.list[0], now + 1e9);
    const f = st.list[0], inF = name => (f.ore?.item === name ? f.ore.qty : 0) + (f.fuel?.item === name ? f.fuel.qty : 0);
    const ing = name => countOf(inv, name) + (f.out?.item === name ? f.out.qty : 0);
    const fe = ing('Lingot de fer'), au = ing('Lingot d\'or');
    assert.equal(countOf(inv, 'Fer') + inF('Fer') + 10 * fe, 200);
    assert.equal(countOf(inv, 'Or') + inF('Or') + 10 * au, 100);
    assert.equal(countOf(inv, 'Charbon') + inF('Charbon') + 10 * (fe + au), 300);
  }
});

/* ---------- mode Alliage ---------- */

const TAINTED = FURNACE.alloys.find(r => r.out === 'Tainted iron');
const alloySetup = () => setup({ 'Lingot de fer':20, Chitine:100, Charbon:300, Fer:50 });

test('alliage : la recette du créateur (Tainted iron = 5 lingots de fer + 15 chitine + 50 charbons, 3 min)', () => {
  assert.deepEqual(TAINTED.in, { 'Lingot de fer':5, 'Chitine':15 });
  assert.equal(TAINTED.fuel, 50); assert.equal(TAINTED.time, 180);
  assert.equal(ITEMS['Tainted iron'].cat, 'ingot');
});

test('alliage : changer de mode, poser les deux ingrédients et le charbon, 1 Tainted iron en 3 min', () => {
  const { inv, st } = alloySetup(), f = st.list[0];
  assert.equal(f.mode, 'smelt');
  assert.ok(op(st, inv, { action:'mode', mode:'alloy' }).ok);
  assert.equal(f.mode, 'alloy');
  assert.ok(op(st, inv, { action:'load', slot:'a', item:'Lingot de fer', qty:10 }).ok);
  assert.ok(op(st, inv, { action:'load', slot:'b', item:'Chitine', qty:25 }).ok);
  assert.ok(op(st, inv, { action:'load', slot:'fuel', item:'Charbon', qty:120 }).ok);
  assert.ok(canRun(f));
  advance(f, T0 + 3*MIN - 1);
  assert.equal(f.out, null, 'pas fini avant 3 min');
  assert.ok(progress(f, T0 + 1.5*MIN) > 0.49);
  advance(f, T0 + 3*MIN);
  assert.deepEqual(f.out, { item:'Tainted iron', qty:1 });
  assert.deepEqual([f.a.qty, f.b.qty, f.fuel.qty], [5, 10, 70]);
  advance(f, T0 + 60*MIN);                         // la chitine (10) limite : plus que 0 de plus
  assert.deepEqual(f.out, { item:'Tainted iron', qty:1 });
  assert.equal(f.since, null);
  assert.ok(op(st, inv, { action:'collect' }, T0 + 60*MIN).ok);
  assert.equal(countOf(inv, 'Tainted iron'), 1);
});

test('alliage : ingrédients dans n\'importe quel ordre ; mauvaises cases et mélanges refusés', () => {
  const { inv, st } = alloySetup(), f = st.list[0];
  assert.equal(op(st, inv, { action:'load', slot:'a', item:'Chitine', qty:20 }).error, 'bad_slot', 'pas de case a en mode Fondre');
  op(st, inv, { action:'mode', mode:'alloy' });
  assert.equal(op(st, inv, { action:'load', slot:'ore', item:'Fer', qty:10 }).error, 'bad_slot', 'pas de case minerai en Alliage');
  assert.equal(op(st, inv, { action:'load', slot:'a', item:'Fer', qty:10 }).error, 'bad_item', 'le fer brut n\'entre dans aucun alliage');
  assert.ok(op(st, inv, { action:'load', slot:'a', item:'Chitine', qty:15 }).ok);
  assert.equal(op(st, inv, { action:'load', slot:'b', item:'Chitine', qty:20 }).error, 'no_recipe', 'deux fois le même ingrédient');
  assert.ok(op(st, inv, { action:'load', slot:'b', item:'Lingot de fer', qty:5 }).ok);
  op(st, inv, { action:'load', slot:'fuel', item:'Charbon', qty:50 });
  advance(f, T0 + 3*MIN);
  assert.deepEqual(f.out, { item:'Tainted iron', qty:1 });
  assert.equal(f.a, null); assert.equal(f.b, null); assert.equal(f.fuel, null);
});

test('alliage : changer de mode seulement cases d\'ingrédients vides ; le combustible et la sortie restent', () => {
  const { inv, st } = alloySetup(), f = st.list[0];
  op(st, inv, { action:'load', slot:'ore', item:'Fer', qty:10 });
  op(st, inv, { action:'load', slot:'fuel', item:'Charbon', qty:60 });
  assert.equal(op(st, inv, { action:'mode', mode:'alloy' }).error, 'not_empty');
  advance(f, T0 + MIN);                            // 1 lingot de fer sort
  assert.deepEqual(f.out, { item:'Lingot de fer', qty:1 });
  assert.ok(op(st, inv, { action:'mode', mode:'alloy' }, T0 + MIN).ok);
  assert.equal(f.mode, 'alloy'); assert.equal(f.fuel.qty, 50); assert.deepEqual(f.out, { item:'Lingot de fer', qty:1 });
  assert.equal(op(st, inv, { action:'mode', mode:'fusion' }).error, 'bad_mode');
  /* sortie occupée par des lingots de fer : l'alliage attend qu'on les récupère */
  op(st, inv, { action:'load', slot:'a', item:'Lingot de fer', qty:5 }, T0 + MIN);
  op(st, inv, { action:'load', slot:'b', item:'Chitine', qty:20 }, T0 + MIN);
  assert.equal(canRun(f), false);
  assert.ok(op(st, inv, { action:'collect' }, T0 + MIN).ok);
  assert.ok(canRun(f));
});

test('relecture : un four enregistré avant les modes reste un four Fondre (rien de perdu)', () => {
  const st = sanitizeFurnaces({ list:[{ tier:0, ore:{ item:'Fer', qty:30 }, fuel:{ item:'Charbon', qty:30 }, out:null, since:7 }] });
  assert.equal(st.list[0].mode, 'smelt');
  assert.deepEqual(st.list[0].ore, { item:'Fer', qty:30 }); assert.equal(st.list[0].since, 7);
  const al = sanitizeFurnaces({ list:[{ mode:'alloy', a:{ item:'Lingot de fer', qty:5 }, b:{ item:'Chitine', qty:20 }, ore:{ item:'Fer', qty:9 } }] });
  assert.deepEqual(al.list[0].a, { item:'Lingot de fer', qty:5 });
  assert.equal(al.list[0].ore, null, 'pas de case minerai en Alliage');
});

/* « Tout retirer » (22/10) : un four, ou tous ; chaque case revient dans l'inventaire, rien ne se perd ni ne se double */
test('Tout retirer : minerai, combustible et lingots finis reviennent dans l\'inventaire ; rejouer ne fait rien', () => {
  const { inv, st } = setup();
  op(st, inv, { action:'load', slot:'ore', item:'Fer', qty:30 });
  op(st, inv, { action:'load', slot:'fuel', item:'Charbon', qty:30 });
  const t = T0 + 10 * MIN, opId = id();   // assez pour au moins un lingot fini
  const r = furnaceOp(st, inv, { action:'empty', furnace:0, opId }, t);
  assert.equal(r.ok, true); assert.equal(r.left, undefined);
  const f = st.list[0];
  assert.ok(!f.ore && !f.fuel && !f.out, 'four vide');
  const ingots = countOf(inv, 'Lingot de fer');
  assert.ok(ingots >= 1, 'les lingots finis sont récupérés');
  assert.equal(countOf(inv, 'Fer') + ingots * FURNACE.orePerIngot, 100, 'fer : rien de perdu');
  assert.equal(countOf(inv, 'Charbon') + ingots * FURNACE.fuelPerIngot, 200, 'charbon : rien de perdu');
  const again = furnaceOp(st, inv, { action:'empty', furnace:0, opId }, t);
  assert.equal(again.repeated, true);
  assert.equal(countOf(inv, 'Lingot de fer'), ingots, 'pas de doublon');
});

test('Tout retirer : une case qui ne rentre pas reste dans le four (les autres sortent), tous les fours d\'un coup', () => {
  const { inv, st } = setup();
  op(st, inv, { action:'load', slot:'ore', item:'Fer', qty:5 });
  op(st, inv, { action:'load', slot:'fuel', item:'Charbon', qty:5 });
  inv.slots.find(s => s?.item === 'Charbon').qty = Number.MAX_SAFE_INTEGER - 1;   // la pile de charbon déborderait
  const r = op(st, inv, { action:'emptyAll' });
  assert.equal(r.ok, true); assert.equal(r.left, 1);
  assert.equal(st.list[0].ore, null, 'le fer est sorti');
  assert.deepEqual(st.list[0].fuel, { item:'Charbon', qty:5 }, 'le charbon est resté, intact');
  assert.equal(countOf(inv, 'Fer'), 100);
  assert.equal(op(st, inv, { action:'empty', furnace:7 }).error, 'bad_furnace');
});
