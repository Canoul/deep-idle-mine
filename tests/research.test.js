/* Table de recherche : 100 Blueprint parts → un blueprint du tier 1 pas encore appris ; recycler un blueprint →
   30 à 60 parts. Le hasard vient du serveur ; une demande renvoyée rend le même résultat. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESEARCH, LOOT } from '../src/config.js';
import { createInventory, addAll, countOf, serialize, deserialize } from '../src/meta/inventory.js';
import { research, recycle, researchPool, tierBlueprints, canResearch, PARTS } from '../src/meta/research.js';
import { learn } from '../src/meta/craft.js';
import { TABS } from '../src/ui/nav.js';

const invWith = bag => { const inv = createInventory(); addAll(inv, bag); return inv; };
let n = 0; const id = () => 'op-rs-' + (++n);
const fixed = v => () => v;
const T1 = LOOT['Treasure T1'].oneOf.find(f => f.family === 'blueprint').items.map(i => i.item);

test('config : tier 1 = 100 parts (recycle 30 à 60), tier 2 = 150 parts (recycle 40 à 70) ; onglet présent', () => {
  assert.deepEqual(RESEARCH.tiers.map(t => [t.tier, t.cost]), [[1, 100], [2, 150]]);
  assert.deepEqual(tierBlueprints(1), T1);
  assert.equal(T1.length, 9);
  assert.deepEqual(RESEARCH.tiers.map(t => t.recycle), [{ min:30, max:60 }, { min:40, max:70 }]);
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
  for(const t of [0, 3, '1', null, 1.5]) assert.equal(research(invWith({ [PARTS]:500 }), t, id(), fixed(0)).error, 'bad_tier');
  assert.equal(canResearch(inv, 1), false);
});

test('recherche : jamais un blueprint déjà appris ; un BP en stock ou qui ne débloque rien peut ressortir', () => {
  const inv = invWith({ 'Pioche en fer BP':1, 'Épée en fer BP':1 });
  learn(inv, 'Pioche en fer BP', id());
  const pool = researchPool(inv, 1);
  assert.ok(!pool.includes('Pioche en fer BP'), 'appris : exclu');
  assert.ok(pool.includes('Épée en fer BP'), 'en stock mais pas appris : possible');
  assert.ok(pool.includes('Four en fer BP') && pool.includes('Boussole en or BP'), 'pas appris : possibles');
  assert.equal(pool.length, 8);
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

test('recycle : un blueprint détruit rend 30 à 60 parts ; seulement des blueprints possédés', () => {
  const inv = invWith({ 'Four en fer BP':2, Charbon:5 });
  assert.deepEqual(recycle(inv, 'Four en fer BP', id(), fixed(0)), { ok:true, item:'Four en fer BP', parts:30, repeated:false });
  assert.equal(recycle(inv, 'Four en fer BP', id(), fixed(0.9999999)).parts, 60);
  assert.equal(countOf(inv, 'Four en fer BP'), 0); assert.equal(countOf(inv, PARTS), 90);
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
  assert.match(h, /Débloque la recette/); assert.match(h, /Pioche en fer/); assert.match(h, /Vitesse de minage \+0,4/);
  assert.match(bpInfoHtml('Inconnu BP'), /aucune recette/);
});
