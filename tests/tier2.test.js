/* Tier 2 : Treasure T2 (table de butin), Gants tactique / Gants d'ouvrier / Cape de Naingui (blueprints, recettes, stats),
   vitesse d'attaque, fortune, table de recherche tier 2 (verrou, 150 parts, recyclage 40 à 70). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { LOOT, ITEMS, STATS, STUFF, IDS, TEXTURES, RESEARCH } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { mulberry32 } from '../src/core/rng.js';
import { rollLoot, openTreasure, canOpen } from '../src/meta/loot.js';
import { createInventory, addAll, addItem, countOf } from '../src/meta/inventory.js';
import { craft, learn, recipeOfBlueprint, isUnlocked, craftable } from '../src/meta/craft.js';
import { research, recycle, researchPool, tierBlueprints, tierOfBlueprint, tierUnlocked, recipesLeft, canResearch, PARTS } from '../src/meta/research.js';
import { statLines, statsOf } from '../src/meta/stuff.js';
import { mineBlock } from '../src/sim/actions.js';
import { decide } from '../src/sim/ai.js';
import { dk } from '../src/sim/mineur.js';
import { newSession } from '../src/sim/session.js';
import { rarityOf } from '../src/meta/rarity.js';
import { worldFrom } from './helpers.js';

const invWith = bag => { const inv = createInventory(); addAll(inv, bag); return inv; };
let n = 0; const id = () => 'op-t2-' + (++n);
const fixed = v => () => v;
/* hasard imposé, valeur par valeur : always (3 tirages « between ») puis un tirage par famille */
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const T2 = LOOT['Treasure T2'];
const T1BP = tierBlueprints(1), T2BP = tierBlueprints(2);

/* ---------- Treasure T2 ---------- */

test('Treasure T2 : toujours Or 20-40, Peau de gobelin 3-10, Blueprint parts 8-18 (bornes atteignables)', () => {
  assert.deepEqual(T2.always, [
    { item:'Or', min:20, max:40 }, { item:'Peau de gobelin', min:3, max:10 }, { item:'Blueprint parts', min:8, max:18 } ]);
  const lo = rollLoot(T2, fixed(0)), hi = rollLoot(T2, fixed(0.999999));
  assert.deepEqual([lo['Or'], lo['Peau de gobelin'], lo['Blueprint parts']], [20, 3, 8]);
  assert.deepEqual([hi['Or'], hi['Peau de gobelin'], hi['Blueprint parts']], [40, 10, 18]);
  const rng = mulberry32(11);
  for(let k = 0; k < 2000; k++){
    const l = rollLoot(T2, rng);
    assert.ok(l['Or'] >= 20 && l['Or'] <= 40 && l['Peau de gobelin'] >= 3 && l['Peau de gobelin'] <= 10 && l['Blueprint parts'] >= 8 && l['Blueprint parts'] <= 18);
  }
});

test('Treasure T2 : blueprints à 2 % chacun, gemmes à 1,5 % chacune, un seul tirage par famille', () => {
  assert.deepEqual(T2BP, ['Gants tactique BP', 'Gants d\'ouvrier BP', 'Cape de Naingui BP', 'Lampe à incandescence BP']);   // lampe : 26/10
  const bp = r => Object.keys(rollLoot(T2, seq(0, 0, 0, r, 0.99))).filter(k => k.endsWith(' BP'));
  assert.deepEqual(bp(0.0), ['Gants tactique BP']);
  assert.deepEqual(bp(0.0199), ['Gants tactique BP']);
  assert.deepEqual(bp(0.02), ['Gants d\'ouvrier BP']);
  assert.deepEqual(bp(0.0399), ['Gants d\'ouvrier BP']);
  assert.deepEqual(bp(0.04), ['Cape de Naingui BP']);
  assert.deepEqual(bp(0.0599), ['Cape de Naingui BP']);
  assert.deepEqual(bp(0.06), ['Lampe à incandescence BP']);
  assert.deepEqual(bp(0.0799), ['Lampe à incandescence BP']);
  assert.deepEqual(bp(0.08), []);
  const gem = r => Object.keys(rollLoot(T2, seq(0, 0, 0, 0.99, r))).filter(k => k.endsWith('inférieur'));
  assert.deepEqual(gem(0.0), ['Rubis inférieur']);
  assert.deepEqual(gem(0.0149), ['Rubis inférieur']);
  assert.deepEqual(gem(0.015), ['Jade inférieur']);
  assert.deepEqual(gem(0.0299), ['Jade inférieur']);
  assert.deepEqual(gem(0.03), ['Saphir inférieur']);
  assert.deepEqual(gem(0.0449), ['Saphir inférieur']);
  assert.deepEqual(gem(0.045), []);
  const rng = mulberry32(5);
  for(let k = 0; k < 3000; k++){
    const keys = Object.keys(rollLoot(T2, rng));
    assert.ok(keys.filter(x => x.endsWith(' BP')).length <= 1 && keys.filter(x => x.endsWith('inférieur')).length <= 1);
  }
});

test('Treasure T2 : une fréquence réelle proche de 2 % (BP) et 1,5 % (gemme)', () => {
  const rng = mulberry32(99); let bp = 0, gem = 0; const N = 40000;
  for(let k = 0; k < N; k++){ const l = rollLoot(T2, rng); if(Object.keys(l).some(x => x.endsWith(' BP'))) bp++; if(Object.keys(l).some(x => x.endsWith('inférieur'))) gem++; }
  assert.ok(Math.abs(bp / N - 0.08) < 0.01, `BP ${bp / N}`);         // 4 blueprints × 2 % (lampe : 26/10)
  assert.ok(Math.abs(gem / N - 0.045) < 0.01, `gemmes ${gem / N}`);  // 3 gemmes × 1,5 %
});

test('Treasure T2 : s\'ouvre depuis l\'inventaire, comme le T1 (une fois par demande)', () => {
  assert.equal(canOpen('Treasure T2'), true);
  const inv = invWith({ 'Treasure T2':1 });
  const o = id(), r = openTreasure(inv, 'Treasure T2', o, fixed(0.5));
  assert.equal(r.repeated, false);
  assert.equal(countOf(inv, 'Treasure T2'), 0);
  for(const [k, q] of Object.entries(r.loot)) assert.equal(countOf(inv, k), q);
  const again = openTreasure(inv, 'Treasure T2', o, fixed(0));
  assert.equal(again.repeated, true); assert.deepEqual(again.loot, r.loot);
  assert.equal(countOf(inv, 'Or'), r.loot['Or'], 'rejoué : rien en double');
});

/* ---------- objets, recettes, blueprints ---------- */

test('3 objets de stuff : cases, stats et recettes demandées', () => {
  assert.deepEqual(ITEMS['Gants tactique'].stats, { attackSpeed:20 });   assert.equal(ITEMS['Gants tactique'].slot, 'gants');
  assert.deepEqual(ITEMS['Gants d\'ouvrier'].stats, { fortune:5 });     assert.equal(ITEMS['Gants d\'ouvrier'].slot, 'gants');
  assert.deepEqual(ITEMS['Cape de Naingui'].stats, { discoverMax:1 });    assert.equal(ITEMS['Cape de Naingui'].slot, 'cape');
  assert.deepEqual(RECIPES['Gants tactique'].cost, { 'Shiny iron':20, 'Tainted iron':20, 'Jade inférieur':1 });
  assert.deepEqual(RECIPES['Gants d\'ouvrier'].cost, { 'Shiny gold':20, 'Tainted iron':20 });
  assert.deepEqual(RECIPES['Cape de Naingui'].cost, { 'Tissu sombre':20, 'Rubis inférieur':1, 'Saphir inférieur':1 });
});

test('recettes secrètes : chacune a son blueprint, jamais débloquée de base', () => {
  const pairs = [['Gants tactique', 'Gants tactique BP'], ['Gants d\'ouvrier', 'Gants d\'ouvrier BP'], ['Cape de Naingui', 'Cape de Naingui BP']];
  const inv = invWith({});
  for(const [item, bp] of pairs){
    assert.equal(RECIPES[item].unlock, bp);
    assert.equal(recipeOfBlueprint(bp), item);
    assert.ok(ITEMS[bp] && ITEMS[bp].cat === 'blueprint', `${bp} : dans le catalogue`);
    assert.equal(isUnlocked(item, inv), false);
    assert.ok(!craftable(inv).includes(item));
  }
  addItem(inv, 'Gants tactique BP', 1);
  assert.deepEqual(learn(inv, 'Gants tactique BP', id()), { ok:true, repeated:false, recipe:'Gants tactique' });
  assert.ok(craftable(inv).includes('Gants tactique'));
  assert.ok(!craftable(inv).includes('Gants d\'ouvrier'), 'les autres restent secrètes');
});

test('fabrication : Gants tactique, Gants d\'ouvrier et Cape de Naingui consomment leurs ingrédients', () => {
  const inv = invWith({ 'Shiny iron':20, 'Shiny gold':20, 'Tainted iron':40, 'Jade inférieur':1, 'Tissu sombre':20, 'Rubis inférieur':1, 'Saphir inférieur':1,
                        'Gants tactique BP':1, 'Gants d\'ouvrier BP':1, 'Cape de Naingui BP':1 });
  for(const bp of ['Gants tactique BP', 'Gants d\'ouvrier BP', 'Cape de Naingui BP']) assert.equal(learn(inv, bp, id()).ok, true);
  for(const item of ['Gants tactique', 'Gants d\'ouvrier', 'Cape de Naingui']) assert.equal(craft(inv, item, id()).ok, true, item);
  for(const item of ['Gants tactique', 'Gants d\'ouvrier', 'Cape de Naingui']) assert.equal(countOf(inv, item), 1);
  for(const k of ['Shiny iron', 'Shiny gold', 'Tainted iron', 'Jade inférieur', 'Tissu sombre', 'Rubis inférieur', 'Saphir inférieur']) assert.equal(countOf(inv, k), 0, k);
  assert.equal(craft(invWith({ 'Tissu sombre':19, 'Rubis inférieur':1, 'Saphir inférieur':1, 'Cape de Naingui BP':1 }), 'Cape de Naingui', id()).error, 'locked');
});

test('Tissu sombre : nouvel objet du catalogue (icône qui existe, empilable) ; textures des 3 objets', () => {
  assert.deepEqual([ITEMS['Tissu sombre'].cat, ITEMS['Tissu sombre'].stack], ['material', true]);
  for(const item of ['Tissu sombre', 'Gants tactique', 'Gants d\'ouvrier', 'Cape de Naingui', 'Gants tactique BP', 'Gants d\'ouvrier BP', 'Cape de Naingui BP', 'Rubis inférieur', 'Jade inférieur', 'Saphir inférieur']){
    const tex = ITEMS[item]?.tex;
    assert.ok(tex, `${item} : pas d'icône`);
    assert.ok(TEXTURES.includes(tex), `${item} : ${tex} absente de TEXTURES`);
    assert.ok(existsSync(new URL(`../textures/${tex}.png`, import.meta.url)), `${item} : textures/${tex}.png manquant`);
  }
});

test('valeur en x : Gants tactique ≈ 39 x (attaque : 196 s de combat / 100 % = 1,96 x par %), Gants d\'ouvrier 180 x (fortune : 36 x par %)', () => {
  const ATTACK_PER_PCT = 196 / STATS.attackSpeed, FORTUNE_PER_PCT = 3600 / 100;
  const tactical = ITEMS['Gants tactique'].stats.attackSpeed * ATTACK_PER_PCT;
  const worker = ITEMS['Gants d\'ouvrier'].stats.fortune * FORTUNE_PER_PCT;
  assert.ok(Math.abs(tactical - 39.2) < 0.01, `tactique ${tactical}`);
  assert.equal(worker, 180);
});

test('stats du mineur : vitesse d\'attaque et fortune, affichées avec leur unité', () => {
  assert.equal(STATS.attackSpeed, 100); assert.equal(STATS.fortune, 0);
  assert.deepEqual(statLines('Gants tactique'), ['Vitesse d\'attaque +20 %']);
  assert.deepEqual(statLines('Gants d\'ouvrier'), ['Fortune +5 %']);
  assert.deepEqual(statLines('Cape de Naingui'), ['Découverte +1']);
  for(const [item, tier] of [['Gants tactique','inhabituel'], ['Gants tactique BP','inhabituel'], ['Gants d\'ouvrier','inhabituel'], ['Gants d\'ouvrier BP','inhabituel'], ['Cape de Naingui','rare'], ['Cape de Naingui BP','rare']])
    assert.equal(rarityOf(item), tier, item);
  const s = statsOf(['Gants tactique', 'Cape de Naingui']);
  assert.equal(s.attackSpeed.total, 120); assert.equal(s.discoverMax.total, STATS.discoverMax + 1); assert.equal(s.fortune.total, 0);
  assert.equal(statsOf(['Gants d\'ouvrier']).fortune.total, 5);
  assert.ok(STUFF.shownStats.includes('attackSpeed') && STUFF.shownStats.includes('fortune'));
});

/* ---------- vitesse d'attaque ---------- */

const fight = attackSpeed => {
  const G = worldFrom(['', 'd'.repeat(50), '#@c#']), m = G.miners[0];
  G.mobs.push({ id:99, type:'mimic', x:2, y:2, hp:25, maxhp:25, revealed:true, ore:IDS.coal });
  if(attackSpeed != null) m.carac.attackSpeed = attackSpeed;
  decide(G, m);
  return { action:m.action, slow:dk(G, m) };        // slow : 1 avec de la lumière, CFG.darkSlow sans (cette mine est sombre)
};
test('vitesse d\'attaque en % : 100 % = un coup toutes les 0,8 s ; 200 % = deux fois plus vite (avant malus d\'obscurité)', () => {
  const base = fight(), fast = fight(200), gloves = fight(250);
  assert.equal(base.action.type, 'attack');
  assert.ok(Math.abs(base.action.dur * base.slow - 0.8) < 1e-9);
  assert.ok(Math.abs(fast.action.dur * fast.slow - 0.4) < 1e-9);
  assert.ok(Math.abs(gloves.action.dur * gloves.slow - 0.8 / 2.5) < 1e-9);
});

/* ---------- fortune ---------- */

/* mine un bloc de `id` à (2,2) avec ce hasard de fortune ; renvoie { m, G } */
function mineOne(id, fortune, rng){
  const G = worldFrom(['', 'd'.repeat(50), '#@ #', '#'.repeat(50)]), m = G.miners[0];
  G.shinyRng = fixed(0.99);                    // pas de shiny
  m.carac.fortune = fortune; if(rng) G.fortuneRng = rng;
  G.tiles[2][2] = id; mineBlock(G, m, 2, 2);
  return { G, m };
}
test('fortune : 0 % ne tire rien et ne duplique pas', () => {
  let calls = 0;
  const { m } = mineOne(IDS.iron, 0, () => { calls++; return 0; });
  assert.deepEqual(m.inv, { Fer:1 }); assert.equal(calls, 0);
});
test('fortune : 50 % — tirage sous 0,5 = minerai dupliqué, au-dessus = un seul', () => {
  assert.deepEqual(mineOne(IDS.iron, 50, fixed(0.4999)).m.inv, { Fer:2 });
  assert.deepEqual(mineOne(IDS.iron, 50, fixed(0.5)).m.inv, { Fer:1 });
});
test('fortune : le doublon pèse dans les pods, ne compte pas pour le déblocage ni les blocs minés', () => {
  const { G, m } = mineOne(IDS.iron, 100, fixed(0));
  assert.equal(m.inv.Fer, 2); assert.equal(m.load, 2 * ITEMS.Fer.w);
  assert.equal(G.areas[0].oreMined, 1, 'un seul minerai miné pour le déblocage');
  assert.equal(m.stats.ore, 1); assert.equal(m.stats.fortune, 1);
});
test('fortune : seulement les minerais (pas la terre ni la pierre), et le shiny est dupliqué aussi', () => {
  assert.deepEqual(mineOne(IDS.stone, 100, fixed(0)).m.inv, { Pierre:1 });
  assert.deepEqual(mineOne(IDS.dirt, 100, fixed(0)).m.inv, { Terre:1 });
  const G = worldFrom(['', 'd'.repeat(50), '#@ #', '#'.repeat(50)]), m = G.miners[0];
  G.shinyRng = fixed(0); m.carac.fortune = 100; G.fortuneRng = fixed(0);
  G.tiles[2][2] = IDS.iron; mineBlock(G, m, 2, 2);
  assert.deepEqual(m.inv, { 'Shiny iron':2 });
});
test('fortune : au-delà de 100 % = un doublon sûr par tranche, plus une chance sur le reste', () => {
  assert.equal(mineOne(IDS.coal, 250, fixed(0.49)).m.inv.Charbon, 4);   // 1 + 2 + (0,49 < 0,5)
  assert.equal(mineOne(IDS.coal, 250, fixed(0.5)).m.inv.Charbon, 3);
});
test('fortune : hasard dérivé de la seed (même seed = mêmes tirages), distinct de celui du shiny', () => {
  const a = newSession(123), b = newSession(123), c = newSession(124);
  const seqOf = G => [G.fortuneRng(), G.fortuneRng(), G.fortuneRng()];
  assert.deepEqual(seqOf(a), seqOf(b));
  assert.notDeepEqual(seqOf(newSession(123)), seqOf(c));
  assert.notEqual(newSession(123).fortuneRng(), newSession(123).shinyRng());
});
test('fortune en session : un mineur avec les Gants d\'ouvrier a 5 % ; sans, 0', () => {
  const { carac } = (() => { const G = newSession(1, { miners:[{ carac:{ ...STATS, fortune:5 } }, {}] }); return { carac:G.miners.map(m => m.carac.fortune) }; })();
  assert.deepEqual(carac, [5, 0]);
});

/* ---------- table de recherche, tier 2 ---------- */

const learnedT1 = () => {
  const inv = invWith({});
  for(const bp of T1BP) if(recipeOfBlueprint(bp)){ addItem(inv, bp, 1); learn(inv, bp, id()); }
  return inv;
};
test('recherche T2 : verrouillée tant qu\'une recette du tier 1 manque ; les BP sans recette ne comptent pas', () => {
  const inv = invWith({ [PARTS]:1000 });
  assert.equal(tierUnlocked(inv, 1), true);
  assert.equal(tierUnlocked(inv, 2), false);
  assert.equal(recipesLeft(inv, 1).length, 10, '10 recettes du tier 1 (Four en fer, Boussole en or et Lance en fer compris)');
  assert.equal(research(inv, 2, id(), fixed(0)).error, 'tier_locked');
  assert.equal(countOf(inv, PARTS), 1000, 'rien n\'est dépensé');
  assert.equal(canResearch(inv, 2), false);
  /* une recette de moins que toutes : toujours verrouillé */
  const nearly = learnedT1();
  nearly.unlocked.pop();
  assert.equal(tierUnlocked(nearly, 2), false);
  assert.equal(recipesLeft(nearly, 1).length, 1);
});
test('recherche T2 : ouverte quand les 7 recettes du tier 1 sont apprises (150 parts, un BP du T2)', () => {
  const inv = learnedT1(); addAll(inv, { [PARTS]:400 });
  assert.equal(recipesLeft(inv, 1).length, 0);
  assert.equal(tierUnlocked(inv, 2), true);
  assert.equal(canResearch(inv, 2), true);
  assert.deepEqual(researchPool(inv, 2), T2BP);
  const r = research(inv, 2, id(), fixed(0));
  assert.deepEqual(r, { ok:true, item:'Gants tactique BP', repeated:false });
  assert.equal(countOf(inv, PARTS), 250, '150 parts dépensées');
  assert.equal(research(inv, 2, id(), fixed(0.9999)).item, 'Lampe à incandescence BP');
  assert.equal(countOf(inv, PARTS), 100);
  assert.equal(research(inv, 2, id(), fixed(0)).error, 'not_enough', '100 < 150');
  assert.equal(countOf(inv, PARTS), 100);
});
test('recherche T2 : le tier 1 ne donne jamais de BP du T2, et inversement', () => {
  const inv = learnedT1(); addAll(inv, { [PARTS]:100000 });
  const fresh = invWith({ [PARTS]:100000 });                    // tier 1 rien appris (tout appris : plus rien à tirer)
  for(let k = 0; k < 100; k++){
    assert.ok(T2BP.includes(research(inv, 2, id(), Math.random).item));
    assert.ok(T1BP.includes(research(fresh, 1, id(), Math.random).item));
  }
  assert.equal(research(inv, 1, id(), Math.random).error, 'nothing_left', 'tier 1 entièrement appris');
});
test('recherche T2 : tout appris → nothing_left', () => {
  const inv = learnedT1(); addAll(inv, { [PARTS]:1000, 'Gants tactique BP':1, 'Gants d\'ouvrier BP':1, 'Cape de Naingui BP':1, 'Lampe à incandescence BP':1 });
  for(const bp of T2BP) learn(inv, bp, id());
  assert.equal(research(inv, 2, id(), fixed(0)).error, 'nothing_left');
  assert.equal(countOf(inv, PARTS), 1000);
});
test('recycle : un BP du T2 rend 30 à 45 parts (28/10), un BP du T1 15 à 30 (RESEARCH.tiers[0].recycle)', () => {
  assert.equal(tierOfBlueprint('Gants tactique BP').tier, 2); assert.equal(tierOfBlueprint('Pioche en fer BP').tier, 1);
  const inv = invWith({ 'Gants tactique BP':3, 'Pioche en fer BP':3 });
  assert.equal(recycle(inv, 'Gants tactique BP', id(), fixed(0)).parts, 30);
  assert.equal(recycle(inv, 'Gants tactique BP', id(), fixed(0.9999999)).parts, 45);
  const T1R = RESEARCH.tiers[0].recycle;
  assert.equal(recycle(inv, 'Pioche en fer BP', id(), fixed(0)).parts, T1R.min);
  assert.equal(recycle(inv, 'Pioche en fer BP', id(), fixed(0.9999999)).parts, T1R.max);
  const rng = mulberry32(8);
  for(let k = 0; k < 500; k++){ addItem(inv, 'Cape de Naingui BP', 1); const p = recycle(inv, 'Cape de Naingui BP', id(), rng).parts; assert.ok(p >= 30 && p <= 45); }
});
