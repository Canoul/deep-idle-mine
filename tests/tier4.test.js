/* Treasure T4 (27/10/2026, Geoffrey) : matières (four, alliages), table du trésor (BP, recettes apprises, gemmes),
   recettes du stuff en mithril / thorium / cobalt et des pièces spéciales, valeurs (T4 650 x, T4.5 750 x), et la règle
   du craft qui consomme une pièce : l'exemplaire le plus simple d'abord. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FURNACE, ITEMS, LOOT, TREASURE, UPGRADE, STUFF } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { createInventory, addAll, addItem, countOf } from '../src/meta/inventory.js';
import { createFurnaces, furnaceOp } from '../src/meta/furnace.js';
import { openTreasure, rollLoot } from '../src/meta/loot.js';
import { craft, learn, recipeOfBlueprint } from '../src/meta/craft.js';
import { pieceGS } from '../src/meta/gearscore.js';
import { tierOf } from '../src/meta/piece.js';

const MIN = 60_000, T0 = 1_000_000;
let n = 0;
const op = (st, inv, o, now = T0) => furnaceOp(st, inv, { furnace:0, opId:'op-t4-' + (++n), ...o }, now);
const PIECES = ['Casque', 'Plastron', 'Jambes', 'Bottes'];

test('four : 10 mithril, 5 cobalt, 5 thorium (+ 10 charbon) ; alliages cobalt et thorium', () => {
  for(const [ore, need, out] of [['Mithril ore', 10, 'Mithril ingot'], ['Cobalt ore', 5, 'Refined cobalt'], ['Thorium ore', 5, 'Refined thorium']]){
    const inv = createInventory(), st = createFurnaces();
    addAll(inv, { [ore]:need * 2 + 1, Charbon:30 });
    op(st, inv, { action:'load', slot:'ore', item:ore, qty:need * 2 + 1 });
    op(st, inv, { action:'load', slot:'fuel', item:'Charbon', qty:30 });
    op(st, inv, { action:'collect' }, T0 + 2 * MIN + 1);
    assert.equal(countOf(inv, out), 2, ore);
    assert.equal(st.list[0].ore.qty, 1, `${ore} : il en reste 1`);
    assert.equal(ITEMS[out].cat, 'ingot');
  }
  for(const [ing, out] of [['Refined cobalt', 'Cobalt ingot'], ['Refined thorium', 'Thorium ingot']]){
    const a = FURNACE.alloys.find(r => r.out === out);
    assert.deepEqual(a.in, { 'Mithril ingot':5, [ing]:5, 'Tainted gold':3 });   // Tainted gold : 30/10
  }
});

test('Treasure T4 : areas 7 et 8 ; toujours mithril, cobalt, thorium et BP parts ; 1er jet 12,5 %', () => {
  assert.equal(TREASURE.tiers.find(t => t.item === 'Treasure T4').maxArea, 8);
  assert.equal(TREASURE.tiers.find(t => t.item === 'Treasure T3').maxArea, 6);
  const t = LOOT['Treasure T4'];
  assert.deepEqual(t.always.map(a => [a.item, a.min, a.max]), [['Mithril ore', 20, 40], ['Cobalt ore', 5, 10], ['Thorium ore', 5, 10], ['Blueprint parts', 12, 14]]);
  const first = t.oneOf[0].items;
  assert.equal(Math.round(first.reduce((s, i) => s + i.chance, 0) * 1e4) / 1e4, 0.125);
  for(const p of PIECES){
    assert.equal(first.find(i => i.item === `${p} en mithril BP`).chance, 0.01);
    assert.equal(first.find(i => i.item === `${p} en thorium BP`).chance, 0.005);
    assert.equal(first.find(i => i.item === `${p} en cobalt BP`).chance, 0.005);
  }
  const gems = t.oneOf.find(f => f.family === 'gem').items;
  assert.deepEqual(gems.map(g => [g.item, g.chance]), [['Topaze', 0.01], ['Saphir', 0.01], ['Rubis', 0.01], ['Jade', 0.01]]);
  /* chaque BP du trésor débloque une recette qui existe, dont les ingrédients existent */
  for(const f of t.oneOf.filter(f => f.family === 'blueprint')) for(const { item } of f.items){
    const r = recipeOfBlueprint(item);
    assert.ok(r && RECIPES[r], `${item} débloque une recette`);
    for(const k of Object.keys(RECIPES[r].cost)) assert.ok(ITEMS[k], `${r} : ${k} existe`);
  }
});

test('Treasure T4 : un BP du 2e jet (clé, gemmes) ne sort pas si sa recette est déjà apprise', () => {
  const inv = createInventory();
  addAll(inv, { 'Saphir BP':1 });
  assert.equal(learn(inv, 'Saphir BP', 'op-learn-saphir').ok, true);
  const t = LOOT['Treasure T4'], f = t.oneOf.find(f => f.items[0].item === 'Saphir BP');
  const i = t.oneOf.indexOf(f);
  /* rng : premier tirage du jet du Saphir BP = 0 (il sortirait) ; tout le reste rate */
  let k = 0;
  const calls = t.always.length + i;
  const rng = () => (k++ === calls ? 0 : 0.999);
  addItem(inv, 'Treasure T4', 1);
  const r = openTreasure(inv, 'Treasure T4', 'op-open-t4', rng);
  assert.equal(r.loot['Saphir BP'], undefined, 'recette apprise : rien');
  k = 0;
  const fresh = rollLoot(t, rng);
  assert.equal(fresh['Saphir BP'], 1, 'sans la recette : il sort');
});

test('stuff : T4 = 650 x (mithril, pièces spéciales), T4.5 = 750 x (thorium, cobalt, jambières) ; la Couronne passe à 650 x', () => {
  assert.equal(UPGRADE.tiers[4].x, 650); assert.equal(UPGRADE.tiers['4.5'].x, 750);
  assert.equal(tierOf('Couronne du Roi Gobelin'), 4);
  for(const m of ['Casque', 'Jambes', 'Bottes']){
    const name = `${m} en mithril`;
    assert.equal(tierOf(name), 4);
    assert.ok(Math.abs(pieceGS(name) - 650) <= 0.025 * 650, `${name} : ${pieceGS(name)} x`);
  }
  assert.ok(pieceGS('Plastron en mithril') > pieceGS('Plastron en acier'));
  for(const mat of ['thorium', 'cobalt']) for(const p of PIECES){
    const name = `${p} en ${mat}`;
    assert.equal(tierOf(name), 4.5, name);
    assert.equal(Object.keys(STUFF.items[name].stats).length, 2, `${name} : deux stats`);
    assert.equal(STUFF.items[name].slot, STUFF.items[`${p} en mithril`].slot);
  }
  assert.equal(STUFF.items['Lunettes Gucci'].slot, 'casque');
  assert.equal(STUFF.items['Lunettes Gucci'].stats.discoverMax, 1);
  assert.equal(tierOf('Jambières titanesques'), 4.5);
  assert.equal(Object.keys(STUFF.items['Jambières titanesques'].stats).length, 4);
});

test('craft : Casque en thorium consomme le Casque en mithril le plus simple (pas l\'identifié ni l\'amélioré)', () => {
  const inv = createInventory();
  addAll(inv, { 'Thorium ingot':10, 'Rubis':1, 'Diamant':25, 'Casque en thorium BP':1 });
  const [a, b, c] = addItem(inv, 'Casque en mithril', 3).map(i => inv.slots[i]);
  Object.assign(a, { q:5 }); Object.assign(c, { plus:2 });
  assert.equal(learn(inv, 'Casque en thorium BP', 'op-learn-th').ok, true);
  assert.equal(craft(inv, 'Casque en thorium', 'op-craft-th').ok, true);
  const left = inv.slots.filter(s => s?.item === 'Casque en mithril').map(s => s.uid).sort();
  assert.deepEqual(left, [a.uid, c.uid].sort(), 'le casque simple est consommé');
  assert.equal(countOf(inv, 'Casque en thorium'), 1);
  assert.equal(countOf(inv, 'Thorium ingot'), 0);
  assert.equal(craft(inv, 'Casque en thorium', 'op-craft-th').repeated, true, 'rejouée : rien de plus');
  assert.equal(countOf(inv, 'Casque en mithril'), 2);
});

test('recettes du T4 : clé d\'instance, gemmes, pièces spéciales (valeurs du créateur)', () => {
  assert.deepEqual(RECIPES['Clé d\'instance I'].cost, { 'Peau de gobelin':250, 'Pierre glissante':20, 'Tissu sombre':50, 'Barre d\'argent':1 });
  for(const g of ['Saphir', 'Rubis', 'Jade']) assert.deepEqual(RECIPES[g].cost, { 'Diamant':50, [`${g} inférieur`]:3 });
  assert.deepEqual(RECIPES['Doc Martins'].cost, { 'Cuir de minotaure':50, 'Thorium ingot':4, 'Tissu sombre':100 });
  assert.deepEqual(RECIPES['Gants de boucher'].cost, { 'Rotten flesh':50, 'Mithril ingot':15, 'Peau de gobelin':500 });
  for(const [name, r] of Object.entries(RECIPES)) for(const k of Object.keys(r.cost)) assert.ok(ITEMS[k], `${name} : ${k}`);
});

test('Treasure T4 (30/10) : Clé d\'instance II, son propre tirage à 10 %', () => {
  const fam = LOOT['Treasure T4'].oneOf.find(f => f.items.some(i => i.item === 'Clé d\'instance II'));
  assert.ok(fam); assert.equal(fam.items.length, 1); assert.equal(fam.items[0].chance, 0.10);
  let n = 0, k = 0; const rng = () => { k = (k * 1103515245 + 12345) % 2147483648; return k / 2147483648; };
  for(let i = 0; i < 20000; i++) if(rollLoot(LOOT['Treasure T4'], rng)['Clé d\'instance II']) n++;
  assert.ok(n / 20000 > 0.09 && n / 20000 < 0.11, `${n / 200} %`);
  assert.equal(ITEMS['Clé d\'instance II'].cat, 'key');
});
