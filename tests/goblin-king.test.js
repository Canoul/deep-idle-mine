/* Coffre du Roi Gobelin (27/10/2026, Geoffrey) : objets, coffre R1 à R7 (pièces identifiées à sa qualité, recette une
   seule fois), recette Chitine au four (fermée, 5 par fournée), Four en or (3e four, × 1,5). Le passif de la couronne
   (gobelins asservis) : tests/goblin-thrall.test.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, STUFF, FURNACE, GOBLIN_KING, goblinChestItem, UPGRADE } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { createInventory, addAll, addItem, countOf, serialize, deserialize } from '../src/meta/inventory.js';
import { openTreasure, openAll, canOpen } from '../src/meta/loot.js';
import { craft, learn, recipeOfBlueprint } from '../src/meta/craft.js';
import { createFurnaces, furnaceOp, advance, sanitizeFurnaces, accepts } from '../src/meta/furnace.js';
import { createSpells, learnScroll } from '../src/meta/spells.js';
import { rarityOf } from '../src/meta/rarity.js';
import { itemName, tierOf } from '../src/meta/piece.js';
import { equippedStats } from '../src/meta/stuff.js';

const CROWN = 'Couronne du Roi Gobelin', MACE = 'Masse du Roi Gobelin', CAPE = 'Cape royale du Gobelin';
const RECIPE = 'Recette : Chitine', BP = 'Four en or BP', CHEST = q => goblinChestItem(q);
let n = 0; const id = () => 'op' + (n++);
/* hasard rejoué : always (3 nombres : graphite, fer souillé, peaux), famille boss, famille recette, famille parchemin, famille gemme */
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test('objets : cases, stats et raretés du créateur ; pas craftables (sauf le Four en or, par son plan)', () => {
  assert.deepEqual(STUFF.items[CROWN], { slot:'casque', tex:'crown_goblin_king', stats:{ fortune:10 }, set:{ goblinThrall:10 } });
  assert.deepEqual(STUFF.items[MACE], { slot:'epee', tex:'mace_goblin_king', set:{ damage:14 }, stats:{ crit:15 } });
  assert.deepEqual(STUFF.items[CAPE], { slot:'cape', tex:'cape_goblin_royal', stats:{ damagePct:5, mineSpeedPct:5 } });
  assert.deepEqual([CROWN, MACE, CAPE, RECIPE, 'Four en or', BP].map(rarityOf), ['legendaire', 'rare', 'rare', 'inhabituel', 'rare', 'rare']);
  for(const p of [CROWN, MACE, CAPE]) assert.equal(RECIPES[p], undefined, p);
  assert.equal(tierOf(MACE), 3); assert.equal(tierOf(CAPE), 3); assert.equal(tierOf(CROWN), 4, 'couronne : tier 4, 600 x (27/10)');
  assert.deepEqual(RECIPES['Four en or'], { cost:{ 'Shiny gold':50, 'Tainted gold':50, 'Diamant':50 }, qty:1, unlock:BP });
  const s = equippedStats([{ item:CROWN }, { item:MACE }, { item:CAPE }]);
  assert.equal(s.fortune, 10); assert.equal(s.goblinThrall, 10); assert.equal(s.damage, 14); assert.equal(s.crit, 15);
  assert.equal(s.damagePct, 5); assert.equal(s.mineSpeedPct, 5);
  assert.equal(equippedStats([]).goblinThrall, 0, 'sans couronne : aucun gobelin asservi');
});

test('coffre : un par qualité (R1 à R7), Unique, non empilable, nom affiché « Antique Coffre du Roi Gobelin »', () => {
  for(let q = 1; q <= 7; q++){
    const it = CHEST(q);
    assert.deepEqual(ITEMS[it].chest, { side:'goblin', q });
    assert.equal(ITEMS[it].stack, false); assert.equal(rarityOf(it), 'unique'); assert.ok(canOpen(it));
  }
  assert.equal(itemName(CHEST(5)), 'Antique Coffre du Roi Gobelin');
});

test('coffre : toujours lingots de graphite 5-15, fer souillé 10-20 et peaux 50-100 ; un seul objet rare au plus (1 / 2 / 2 / 2 %) ; gemmes 1 % chacune', () => {
  const open = (...r) => { const inv = createInventory(); addItem(inv, CHEST(3), 1); return openTreasure(inv, CHEST(3), id(), seq(...r)).loot; };
  assert.deepEqual(open(0, 0, 0, 0.99, 0.99, 0.99, 0.99), { 'Graphite ingot':5, 'Tainted iron':10, 'Peau de gobelin':50 });
  assert.deepEqual(open(0.9999, 0.9999, 0.9999, 0.99, 0.99, 0.99, 0.99), { 'Graphite ingot':15, 'Tainted iron':20, 'Peau de gobelin':100 });
  assert.equal(GOBLIN_KING.loot.always.some(a => a.item === 'Graphite ore'), false, 'plus de minerai de graphite (29/10)');
  const boss = r => Object.keys(open(0.5, 0.5, 0.5, r, 0.99, 0.99, 0.99)).filter(k => !['Graphite ingot', 'Tainted iron', 'Peau de gobelin'].includes(k));
  assert.deepEqual(boss(0), [CROWN]); assert.deepEqual(boss(0.0099), [CROWN]);
  assert.deepEqual(boss(0.01), [BP]); assert.deepEqual(boss(0.0299), [BP]);
  assert.deepEqual(boss(0.03), [MACE]); assert.deepEqual(boss(0.05), [CAPE]); assert.deepEqual(boss(0.0699), [CAPE]);
  assert.deepEqual(boss(0.07), []);
  assert.deepEqual(Object.keys(open(0.5, 0.5, 0.5, 0.99, 0.0499, 0.99, 0.99)).at(-1), RECIPE, 'recette : 5 %');
  assert.equal(open(0.5, 0.5, 0.5, 0.99, 0.05, 0.99, 0.99)[RECIPE], undefined);
  const gem = r => Object.keys(open(0.5, 0.5, 0.5, 0.99, 0.99, 0.99, r)).filter(k => k.endsWith('inférieur'));
  assert.deepEqual(gem(0), ['Rubis inférieur']); assert.deepEqual(gem(0.0299), ['Saphir inférieur']); assert.deepEqual(gem(0.03), []);
  /* fréquences réelles */
  let s = 11; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let rare = 0, crown = 0; const N = 40000;
  for(let k = 0; k < N; k++){ const inv = createInventory(); addItem(inv, CHEST(1), 1); const l = openTreasure(inv, CHEST(1), id(), rng).loot;
    const r = [CROWN, BP, MACE, CAPE].filter(x => l[x]); assert.ok(r.length <= 1); rare += r.length; crown += l[CROWN] ? 1 : 0; }
  assert.ok(Math.abs(rare / N - 0.07) < 0.006, `objet rare ${rare / N}`); assert.ok(Math.abs(crown / N - 0.01) < 0.003, `couronne ${crown / N}`);
});

test('coffre : la pièce de stuff arrive identifiée à la qualité du coffre ; le plan et la recette, non', () => {
  for(const [r, item] of [[0, CROWN], [0.04, MACE], [0.06, CAPE]]){
    const inv = createInventory(); addItem(inv, CHEST(6), 1);
    openTreasure(inv, CHEST(6), id(), seq(0.5, 0.5, 0.5, r, 0.0, 0.99, 0.99));
    const p = inv.slots.find(x => x?.item === item);
    assert.equal(p.q, 6, item); assert.ok(Number.isSafeInteger(p.uid));
    assert.equal(inv.slots.find(x => x?.item === RECIPE).q, undefined);
  }
  const inv = createInventory(); addItem(inv, CHEST(2), 1);
  openTreasure(inv, CHEST(2), id(), seq(0.5, 0.5, 0.5, 0.02, 0.99, 0.99, 0.99));
  assert.equal(inv.slots.find(x => x?.item === BP).q, undefined);
});

test('coffre : « Recette : Chitine » ne sort plus une fois apprise ; une demande rejouée ne rouvre rien', () => {
  const inv = createInventory(); addAll(inv, { [RECIPE]:1 });
  assert.equal(recipeOfBlueprint(RECIPE), 'Four : Chitine');
  assert.equal(learn(inv, RECIPE, id()).ok, true);
  addItem(inv, CHEST(4), 2);
  const r = openTreasure(inv, CHEST(4), 'same', seq(0.5, 0.5, 0.5, 0.99, 0.0, 0.99, 0.99));
  assert.equal(r.loot[RECIPE], undefined, 'déjà apprise : rien');
  assert.deepEqual(openTreasure(inv, CHEST(4), 'same', seq(0.5, 0.5, 0.5, 0.99, 0.0, 0.99, 0.99)), { loot:r.loot, repeated:true });
  assert.equal(countOf(inv, CHEST(4)), 1, 'un seul coffre ouvert');
  assert.equal(openAll(inv, CHEST(4), id(), seq(0.5)).count, 1);
  assert.equal(openTreasure(inv, CHEST(4), id(), seq(0.5)), null, 'plus de coffre');
});

test('four : Peau de gobelin → Chitine fermée tant que la recette n\'est pas apprise, puis 10 peaux + 10 charbon = 5 chitine en 60 s', () => {
  const inv = createInventory(), st = createFurnaces(); addAll(inv, { 'Peau de gobelin':25, 'Charbon':30, [RECIPE]:1 });
  const op = o => furnaceOp(st, inv, { furnace:0, opId:id(), ...o }, 0);
  assert.equal(accepts('ore', 'Peau de gobelin', 'smelt', inv), false);
  assert.equal(op({ action:'load', slot:'ore', item:'Peau de gobelin', qty:20 }).error, 'bad_item', 'pas apprise : refusé');
  assert.equal(countOf(inv, 'Peau de gobelin'), 25, 'rien retiré');
  assert.equal(learn(inv, RECIPE, id()).ok, true);
  assert.equal(countOf(inv, RECIPE), 0, 'la recette est consommée');
  assert.equal(learn(inv, RECIPE, id()).error, 'known', 'déjà apprise');
  assert.equal(op({ action:'load', slot:'ore', item:'Peau de gobelin', qty:20 }).ok, true);
  assert.equal(op({ action:'load', slot:'fuel', item:'Charbon', qty:30 }).ok, true);
  const f = st.list[0];
  assert.equal(f.since, 0);
  advance(f, 59_999); assert.equal(f.out, null);
  advance(f, 60_000); assert.deepEqual(f.out, { item:'Chitine', qty:5 });
  advance(f, 600_000); assert.deepEqual(f.out, { item:'Chitine', qty:10 }, '2 fournées (20 peaux)');
  assert.equal(f.ore, null); assert.deepEqual(f.fuel, { item:'Charbon', qty:10 });
  /* relu (redémarrage du serveur) : la chitine et une peau déjà posée restent */
  f.ore = { item:'Peau de gobelin', qty:5 };
  const back = sanitizeFurnaces(JSON.parse(JSON.stringify(st)));
  assert.deepEqual(back.list[0].out, { item:'Chitine', qty:10 }); assert.deepEqual(back.list[0].ore, { item:'Peau de gobelin', qty:5 });
});

test('Four en or : plan, craft, « Utiliser » ouvre le 3e four (après le four en fer), vitesse × 1,5', () => {
  assert.deepEqual(FURNACE.tiers[2], { name:'Four en or', speed:1.5 });
  assert.deepEqual(FURNACE.unlockItems['Four en or'], { slot:2, tier:2, tex:'furnace_gold' });
  const inv = createInventory(), st = createFurnaces();
  addAll(inv, { 'Shiny gold':50, 'Tainted gold':50, 'Diamant':50, [BP]:1 });
  assert.equal(craft(inv, 'Four en or', id()).error, 'locked');
  assert.equal(learn(inv, BP, id()).ok, true);
  assert.equal(craft(inv, 'Four en or', id()).ok, true);
  assert.equal(furnaceOp(st, inv, { action:'unlock', item:'Four en or', opId:id() }, 0).error, 'locked_before', 'il faut d\'abord le four en fer');
  st.list.push({ ...st.list[0], tier:1 });
  assert.equal(furnaceOp(st, inv, { action:'unlock', item:'Four en or', opId:id() }, 0).ok, true);
  assert.equal(st.list[2].tier, 2); assert.equal(countOf(inv, 'Four en or'), 0);
  addAll(inv, { 'Fer':10, 'Charbon':10 });
  furnaceOp(st, inv, { furnace:2, action:'load', slot:'ore', item:'Fer', qty:10, opId:id() }, 0);
  furnaceOp(st, inv, { furnace:2, action:'load', slot:'fuel', item:'Charbon', qty:10, opId:id() }, 0);
  advance(st.list[2], 39_999); assert.equal(st.list[2].out, null);
  advance(st.list[2], 40_000); assert.deepEqual(st.list[2].out, { item:'Lingot de fer', qty:1 }, '60 s / 1,5 = 40 s');
});

test('la recette apprise survit à l\'enregistrement (serveur) ; un nom inventé est retiré', () => {
  const inv = createInventory(); addAll(inv, { [RECIPE]:1 });
  learn(inv, RECIPE, id());
  inv.unlocked.push('Four : Diamant', 'Four : Chitine');
  const back = deserialize(serialize(inv));
  assert.deepEqual(back.unlocked, ['Four : Chitine']);
  assert.equal(accepts('ore', 'Peau de gobelin', 'smelt', back), true);
});

test('coffre : 2e tirage, un parchemin au plus (Ulti shen 1 %, Fast learner 0,5 %, Cleave 1 %, Hand of Justice 1 %) ; un sort déjà appris ne sort pas', () => {
  const US = 'Parchemin « Ulti shen »', FL = 'Parchemin « Fast learner »', CL = 'Parchemin « Cleave »', HJ = 'Parchemin « Hand of Justice »';
  const scroll = (r, spells) => { const inv = createInventory(); addItem(inv, CHEST(3), 1);
    return Object.keys(openTreasure(inv, CHEST(3), id(), seq(0.5, 0.5, 0.5, 0.99, 0.99, r, 0.99), { spells }).loot).filter(k => k.startsWith('Parchemin')); };
  assert.deepEqual(scroll(0), [US]); assert.deepEqual(scroll(0.0099), [US]);
  assert.deepEqual(scroll(0.01), [FL]); assert.deepEqual(scroll(0.0149), [FL]);
  assert.deepEqual(scroll(0.015), [CL]); assert.deepEqual(scroll(0.025), [HJ]); assert.deepEqual(scroll(0.0349), [HJ]);
  assert.deepEqual(scroll(0.035), []);
  assert.deepEqual(scroll(0, ['ulti_shen']), [], 'Ulti shen appris : rien');
  assert.deepEqual(scroll(0.02, ['ulti_shen']), [CL], 'les autres restent');
  /* avec l'état des sorts du joueur : appris par learnScroll */
  const inv = createInventory(), st = createSpells(); addAll(inv, { [HJ]:1 });
  assert.equal(learnScroll(st, inv, HJ, id()).ok, true);
  assert.deepEqual(scroll(0.03, st.learned), []);
  /* fréquence réelle : 3,5 % */
  let s = 5; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647; let n = 0; const N = 40000;
  for(let k = 0; k < N; k++){ const v = createInventory(); addItem(v, CHEST(1), 1); const l = openTreasure(v, CHEST(1), id(), rng).loot;
    const got = Object.keys(l).filter(x => x.startsWith('Parchemin')); assert.ok(got.length <= 1); n += got.length; }
  assert.ok(Math.abs(n / N - 0.035) < 0.004, `parchemin ${n / N}`);
});
