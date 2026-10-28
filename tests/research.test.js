/* Table de recherche : 100 Blueprint parts → un blueprint du tier 1 pas encore appris ; recycler un blueprint →
   15 à 30 parts (tier 1, 25/10 au soir ; avant 30 à 60). Le hasard vient du serveur ; une demande renvoyée rend le même résultat. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESEARCH, LOOT } from '../src/config.js';
import { createInventory, addAll, countOf, serialize, deserialize } from '../src/meta/inventory.js';
import { research, recycle, researchPool, researchOdds, tierBlueprints, tierUnlocked, canResearch, PARTS } from '../src/meta/research.js';
import { RECIPES } from '../src/recipes.js';
import { learn } from '../src/meta/craft.js';
import { TABS } from '../src/ui/nav.js';

const invWith = bag => { const inv = createInventory(); addAll(inv, bag); return inv; };
let n = 0; const id = () => 'op-rs-' + (++n);
const fixed = v => () => v;
const T1 = LOOT['Treasure T1'].oneOf.find(f => f.family === 'blueprint').items.map(i => i.item);

test('config : tier 1 = 100 parts (recycle 15 à 30), tier 2 = 150 (30 à 45), tier 3 = 200 (45 à 60), tier 4 = 250 (60 à 75) (28/10) ; onglet présent', () => {
  assert.deepEqual(RESEARCH.tiers.map(t => [t.tier, t.cost]), [[1, 100], [2, 150], [3, 200], [4, 250]]);
  assert.deepEqual(tierBlueprints(1), T1);
  assert.equal(T1.length, 10);   // + Lance en fer BP (25/10)
  assert.deepEqual(RESEARCH.tiers.map(t => t.recycle), [{ min:15, max:30 }, { min:30, max:45 }, { min:45, max:60 }, { min:60, max:75 }]);
  assert.ok(TABS.some(t => t.id === 'recherche' && t.ready));
});

test('recherche : 100 parts exactement, un blueprint du tier 1 arrive dans l\'inventaire', () => {
  const inv = invWith({ [PARTS]:250 });
  const r = research(inv, 1, id(), fixed(0));
  assert.deepEqual(r, { ok:true, item:T1[0], repeated:false });
  assert.equal(countOf(inv, PARTS), 150);
  assert.equal(countOf(inv, T1[0]), 1);
  research(inv, 1, id(), fixed(0.9999999));
  assert.equal(countOf(inv, T1.at(-1)), 1);
  assert.equal(countOf(inv, PARTS), 50);
});

test('recherche : pas assez de parts → rien ne bouge ; tier inconnu refusé', () => {
  const inv = invWith({ [PARTS]:99 });
  assert.equal(research(inv, 1, id(), fixed(0)).error, 'not_enough');
  assert.equal(countOf(inv, PARTS), 99);
  for(const t of [0, 5, '1', null, 1.5]) assert.equal(research(invWith({ [PARTS]:500 }), t, id(), fixed(0)).error, 'bad_tier');
  assert.equal(canResearch(inv, 1), false);
});

test('recherche : jamais un blueprint déjà appris ; un BP en stock ou qui ne débloque rien peut ressortir', () => {
  const inv = invWith({ 'Pioche en fer BP':1, 'Épée en fer BP':1 });
  learn(inv, 'Pioche en fer BP', id());
  const pool = researchPool(inv, 1);
  assert.ok(!pool.includes('Pioche en fer BP'), 'appris : exclu');
  assert.ok(pool.includes('Épée en fer BP'), 'en stock mais pas appris : possible');
  assert.ok(pool.includes('Four en fer BP') && pool.includes('Boussole en or BP'), 'pas appris : possibles');
  assert.equal(pool.length, 9);
  addAll(inv, { [PARTS]:10000 });
  for(let k = 0; k < 200; k++){ const r = research(inv, 1, id(), Math.random); assert.notEqual(r.item, 'Pioche en fer BP'); }
});

test('recherche : demande rejouée (double clic) → même blueprint, payé une seule fois', () => {
  const inv = invWith({ [PARTS]:300 });
  const o = id();
  const a = research(inv, 1, o, fixed(0.5)), b = research(inv, 1, o, fixed(0));
  assert.equal(b.repeated, true); assert.equal(b.item, a.item);
  assert.equal(countOf(inv, PARTS), 200);
  /* même après relecture de la sauvegarde */
  const back = deserialize(serialize(inv));
  assert.equal(research(back, 1, o, fixed(0)).item, a.item);
  assert.equal(countOf(back, PARTS), 200);
});

test('recycle : un blueprint détruit rend 15 à 30 parts (tier 1) ; seulement des blueprints possédés', () => {
  const inv = invWith({ 'Four en fer BP':2, Charbon:5 });
  assert.deepEqual(recycle(inv, 'Four en fer BP', id(), fixed(0)), { ok:true, item:'Four en fer BP', parts:15, repeated:false });
  assert.equal(recycle(inv, 'Four en fer BP', id(), fixed(0.9999999)).parts, 30);
  assert.equal(countOf(inv, 'Four en fer BP'), 0); assert.equal(countOf(inv, PARTS), 45);
  assert.equal(recycle(inv, 'Four en fer BP', id(), fixed(0)).error, 'not_owned');
  assert.equal(recycle(inv, 'Charbon', id(), fixed(0)).error, 'bad_item');
  assert.equal(recycle(inv, PARTS, id(), fixed(0)).error, 'bad_item', 'les parts ne se recyclent pas');
  assert.equal(recycle(inv, { x:1 }, id(), fixed(0)).error, 'bad_item');
});

test('recycle : demande rejouée → même nombre de parts, un seul blueprint détruit', () => {
  const inv = invWith({ 'Casque en fer BP':2 });
  const o = id();
  const a = recycle(inv, 'Casque en fer BP', o, fixed(0.3)), b = recycle(inv, 'Casque en fer BP', o, fixed(0.9));
  assert.equal(b.repeated, true); assert.equal(b.parts, a.parts);
  assert.equal(countOf(inv, 'Casque en fer BP'), 1); assert.equal(countOf(inv, PARTS), a.parts);
  assert.equal(research(inv, 1, o, fixed(0)).error, 'bad_request', 'même opId pour une autre action : refusé');
});
test('table de recherche : description du blueprint obtenu (recette débloquée et ses effets)', async () => {
  const { bpInfoHtml } = await import('../src/ui/research.js');
  const h = bpInfoHtml('Pioche en fer BP');
  assert.match(h, /Débloque la recette/); assert.match(h, /Pioche en fer/); assert.match(h, /Vitesse de minage \+0,4/);   // pioche en fer +0,4 depuis le nerf du 25/10
  assert.match(bpInfoHtml('Inconnu BP'), /aucune recette/);
});

/* tier 3 (23/10/2026, Geoffrey) : blueprints du Treasure T3, 200 parts (26/10 ; avant 150), plan épique 4 fois moins probable */
const T2 = LOOT['Treasure T2'].oneOf.find(f => f.family === 'blueprint').items.map(i => i.item);
const T3 = LOOT['Treasure T3'].oneOf.find(f => f.family === 'blueprint').items.map(i => i.item);
const EPIC = 'Plastron de l\'équilibre BP';
const knowsTiers = (...tiers) => { const inv = createInventory();
  inv.unlocked.push(...tiers.flatMap(t => t).map(bp => Object.keys(RECIPES).find(r => RECIPES[r].unlock === bp)).filter(Boolean));
  return inv; };

test('tier 3 : fermé tant que les recettes du tier 2 ne sont pas toutes apprises, puis ouvert', () => {
  assert.deepEqual(tierBlueprints(3), T3);
  const half = knowsTiers(T1, T2.slice(1)); addAll(half, { [PARTS]:500 });
  assert.equal(tierUnlocked(half, 3), false);
  assert.equal(research(half, 3, id(), fixed(0)).error, 'tier_locked');
  assert.equal(countOf(half, PARTS), 500, 'rien payé');
  const all = knowsTiers(T1, T2); addAll(all, { [PARTS]:210 });
  assert.ok(tierUnlocked(all, 3) && canResearch(all, 3));
  const r = research(all, 3, id(), fixed(0));
  assert.ok(r.ok && T3.includes(r.item));
  assert.equal(countOf(all, PARTS), 10, '200 parts');
});

test('tier 3 : le plan épique pèse 4 fois moins que chaque autre plan', () => {
  const inv = knowsTiers(T1, T2);
  const odds = Object.fromEntries(researchOdds(inv, 3).map(o => [o.item, o.chance]));
  assert.ok(Math.abs(odds[EPIC] * 4 - odds['Casque en acier BP']) < 1e-12);
  assert.ok(Math.abs(Object.values(odds).reduce((s, v) => s + v, 0) - 1) < 1e-12);
  assert.ok(Math.abs(odds[EPIC] - 0.25 / 6.25) < 1e-12, '4 % de chance avec les 7 plans possibles');
  /* tirages réels : fréquence du plan épique ≈ 4 % */
  let s = 7, epic = 0; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647, N = 20000;
  for(let i = 0; i < N; i++){ const v = knowsTiers(T1, T2); addAll(v, { [PARTS]:200 }); if(research(v, 3, id(), rng).item === EPIC) epic++; }
  assert.ok(Math.abs(epic / N - 0.04) < 0.006, `fréquence ${epic / N}`);
  /* en bout de tirage (rng proche de 1) : le dernier plan possible, jamais hors de la liste */
  const v = knowsTiers(T1, T2); addAll(v, { [PARTS]:200 });
  assert.equal(research(v, 3, id(), fixed(0.9999999)).item, T3.at(-1));
});

test('tier 3 : un plan appris sort du tirage ; recycler un plan T3 rend 45 à 60 parts', () => {
  const inv = knowsTiers(T1, T2, T3.filter(b => b !== EPIC));
  assert.deepEqual(researchOdds(inv, 3), [{ item:EPIC, chance:1 }], 'seul reste le plan épique : il sort à coup sûr');
  addAll(inv, { 'Casque en acier BP':1 });
  const r = recycle(inv, 'Casque en acier BP', id(), fixed(0.9999999));
  assert.equal(r.parts, 60);
});

test('tier 3 : fermé tant que TOUS les tiers inférieurs ne sont pas finis (tout le T2 appris mais une recette du T1 manque)', () => {
  const inv = knowsTiers(T1.slice(1), T2); addAll(inv, { [PARTS]:500 });
  assert.equal(tierUnlocked(inv, 2), false, 'le T2 aussi reste fermé (une recette du T1 manque)');
  assert.equal(tierUnlocked(inv, 3), false);
  assert.equal(canResearch(inv, 3), false);
  assert.equal(research(inv, 3, id(), fixed(0)).error, 'tier_locked');
  assert.equal(countOf(inv, PARTS), 500, 'rien payé');
  const all = knowsTiers(T1, T2);
  assert.equal(tierUnlocked(all, 3), true);
});

/* tier 4 (28/10/2026, Geoffrey) : 250 parts, plans du 1er jet du Treasure T4, ouvert quand les tiers 1 à 3 sont finis */
test('tier 4 : fermé tant qu\'une recette des tiers 1 à 3 manque ; 250 parts → un plan du T4 ; recycler un plan T4 rend 60 à 75 parts', () => {
  const T4 = tierBlueprints(4);
  assert.ok(T4.includes('Casque en mithril BP') && T4.includes('Jambières titanesques BP'));
  assert.ok(!T4.includes('Saphir BP'), 'les plans du 2e jet (clé, gemmes) ne sortent pas de la recherche');
  const part = knowsTiers(T1, T2, T3.slice(1)); addAll(part, { [PARTS]:250 });
  assert.equal(research(part, 4, id(), fixed(0)).error, 'tier_locked');
  assert.equal(countOf(part, PARTS), 250, 'rien payé');
  const inv = knowsTiers(T1, T2, T3); addAll(inv, { [PARTS]:249 });
  assert.equal(tierUnlocked(inv, 4), true);
  assert.equal(research(inv, 4, id(), fixed(0)).error, 'not_enough');
  addAll(inv, { [PARTS]:1 });
  const r = research(inv, 4, id(), fixed(0.5));
  assert.ok(r.ok && T4.includes(r.item), r.item);
  assert.equal(countOf(inv, PARTS), 0);
  addAll(inv, { 'Casque en mithril BP':2 });
  assert.equal(recycle(inv, 'Casque en mithril BP', id(), fixed(0)).parts, 60);
  assert.equal(recycle(inv, 'Casque en mithril BP', id(), fixed(0.9999999)).parts, 75);
});
