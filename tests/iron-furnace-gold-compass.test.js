/* Four en fer (objet qui ouvre le 2e four, ×1,25) , Boussole en or (+1 ligne dessus/dessous), Tainted gold. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FURNACE, ITEMS, IDS, STATS } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { createInventory, addAll, countOf } from '../src/meta/inventory.js';
import { createFurnaces, furnaceOp, ingotMs, sanitizeFurnaces, alloyOf, unlockError } from '../src/meta/furnace.js';
import { recipeOfBlueprint } from '../src/meta/craft.js';
import { rarityOf } from '../src/meta/rarity.js';
import { equippedStats } from '../src/meta/stuff.js';
import { compassScan } from '../src/sim/ai.js';
import { worldFrom } from './helpers.js';

const setup = (bag = { 'Four en fer':2 }) => { const inv = createInventory(); addAll(inv, bag); return { inv, st:createFurnaces() }; };
let n = 0;
const op = (st, inv, o) => furnaceOp(st, inv, { opId:`op-${n++}`, ...o }, 1e6);

test('recettes : Four en fer et Boussole en or, débloquées par leur BP ; tout est inhabituel', () => {
  assert.deepEqual(RECIPES['Four en fer'].cost, { Charbon:1000, 'Tainted iron':20, 'Shiny iron':5 });
  assert.deepEqual(RECIPES['Boussole en or'].cost, { 'Tainted gold':20, 'Shiny gold':5 });
  assert.equal(recipeOfBlueprint('Four en fer BP'), 'Four en fer');
  assert.equal(recipeOfBlueprint('Boussole en or BP'), 'Boussole en or');
  for(const n of ['Four en fer', 'Four en fer BP', 'Boussole en or', 'Boussole en or BP']) assert.equal(rarityOf(n), 'inhabituel', n);
  for(const n of ['Four en fer', 'Boussole en or', 'Tainted gold']) assert.ok(ITEMS[n]?.tex, `${n} a une icône`);
});

test('Tainted gold : alliage 5 lingots d\'or + 20 chitine + 50 charbon, 3 min (comme le Tainted iron)', () => {
  const r = alloyOf('Lingot d\'or', 'Chitine');
  assert.deepEqual({ out:r.out, in:r.in, fuel:r.fuel, time:r.time },
                   { out:'Tainted gold', in:{ 'Lingot d\'or':5, Chitine:20 }, fuel:50, time:180 });
  assert.equal(alloyOf('Lingot de fer', 'Chitine').out, 'Tainted iron', 'le Tainted iron ne change pas');
  const { inv, st } = setup({ 'Lingot d\'or':5, Chitine:20, Charbon:50 });
  assert.ok(op(st, inv, { action:'mode', furnace:0, mode:'alloy' }).ok);
  assert.ok(op(st, inv, { action:'load', furnace:0, slot:'a', item:'Lingot d\'or', qty:5 }).ok);
  assert.ok(op(st, inv, { action:'load', furnace:0, slot:'b', item:'Chitine', qty:20 }).ok);
  assert.ok(op(st, inv, { action:'load', furnace:0, slot:'fuel', item:'Charbon', qty:50 }).ok);
  assert.ok(furnaceOp(st, inv, { opId:'collect-1', action:'collect', furnace:0 }, 1e6 + 180_000).ok);
  assert.equal(countOf(inv, 'Tainted gold'), 1);
});

test('Four en fer : « Utiliser » consomme l\'objet et ouvre le 2e four, un Four en fer ×1,25', () => {
  const { inv, st } = setup();
  assert.equal(st.list.length, 1);
  assert.ok(op(st, inv, { action:'unlock', item:'Four en fer' }).ok);
  assert.equal(st.list.length, 2);
  assert.equal(countOf(inv, 'Four en fer'), 1);
  assert.equal(FURNACE.tiers[st.list[1].tier].name, 'Four en fer');
  st.list[1].ore = { item:'Fer', qty:10 }; st.list[1].fuel = { item:'Charbon', qty:10 };
  assert.equal(ingotMs(st.list[1]), 60_000 / 1.25, 'lingot de fer en 48 s au lieu de 60');
  assert.equal(ingotMs({ ...st.list[1], tier:0 }), 60_000);
});

test('Four en fer : un seul utile (le 3e four reste fermé), refus sans rien consommer', () => {
  const { inv, st } = setup();
  op(st, inv, { action:'unlock', item:'Four en fer' });
  assert.deepEqual(op(st, inv, { action:'unlock', item:'Four en fer' }), { error:'already_unlocked' });
  assert.equal(countOf(inv, 'Four en fer'), 1);
  assert.equal(st.list.length, 2);
  const empty = setup({});
  assert.deepEqual(op(empty.st, empty.inv, { action:'unlock', item:'Four en fer' }), { error:'not_enough' });
  for(const bad of ['Fer', 'Lingot de fer', 'Four en fer BP', '', null, 42, '__proto__'])
    assert.deepEqual(op(empty.st, empty.inv, { action:'unlock', item:bad }), { error:'bad_item' }, String(bad));
  assert.equal(unlockError(empty.st, 'Four en fer'), null);
});

test('Four en fer : demande rejouée (double clic) → un seul objet consommé ; le 2e four survit à la relecture', () => {
  const { inv, st } = setup();
  const o = { opId:'same-op-123', action:'unlock', item:'Four en fer' };
  assert.equal(furnaceOp(st, inv, o, 1e6).repeated, false);
  assert.equal(furnaceOp(st, inv, o, 1e6).repeated, true);
  assert.equal(countOf(inv, 'Four en fer'), 1);
  const back = sanitizeFurnaces(JSON.parse(JSON.stringify(st)));
  assert.equal(back.list.length, 2);
  assert.equal(back.list[1].tier, 1);
});

test('Boussole en or : stat compassRows +1 (0 de base)', () => {
  assert.equal(STATS.compassRows, 0);
  assert.equal(ITEMS['Boussole en or'].slot, 'boussole');
  assert.equal(equippedStats(['Boussole en or']).compassRows, 1);
  assert.equal(equippedStats([]).compassRows, 0);
});

test('Boussole en or : voit les minerais 1 ligne au-dessus et en dessous, pas 2', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#'.repeat(50), '#@   #', '#'.repeat(50), '#'.repeat(50), '#'.repeat(50)]);
  const m = G.miners[0];
  G.tiles[2][4] = IDS.iron; G.tiles[4][3] = IDS.gold; G.tiles[5][2] = IDS.coal; G.tiles[3][5] = IDS.coal;
  const seen = () => compassScan(G, m, 8).map(o => `${o.x},${o.y}`).sort();
  assert.deepEqual(seen(), ['5,3'], 'de base : sa ligne seulement');
  m.carac.compassRows = 1;
  assert.deepEqual(seen(), ['3,4', '4,2', '5,3'], '+1 ligne au-dessus et en dessous, pas la 2e en dessous');
});
