/* Ouverture des Treasure TX hors session : table de butin, tirage, ouverture dans l'inventaire. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { LOOT, ITEMS, TEXTURES } from '../src/config.js';
import { mulberry32 } from '../src/core/rng.js';
import { rollLoot, openTreasure, canOpen } from '../src/meta/loot.js';
import { createInventory, addItem, countOf, serialize, deserialize } from '../src/meta/inventory.js';
import { recipesLeft, treasureBlueprintsDone } from '../src/meta/research.js';

const T1 = LOOT['Treasure T1'];
const fixed = v => () => v;

test('Treasure T1 : toujours des Blueprint parts, du Charbon et du Fer dans les bornes', () => {
  const rng = mulberry32(7);
  for(let n=0; n<2000; n++){
    const loot = rollLoot(T1, rng);
    for(const a of T1.always){
      assert.ok(Number.isInteger(loot[a.item]), a.item);
      assert.ok(loot[a.item] >= a.min && loot[a.item] <= a.max, `${a.item} = ${loot[a.item]}`);
    }
  }
});

test('les bornes min et max sont atteignables', () => {
  assert.equal(rollLoot(T1, fixed(0))['Charbon'], 100);
  assert.equal(rollLoot(T1, fixed(0.999999))['Charbon'], 150);
});

test('un seul tirage par famille : jamais deux blueprints ni deux gemmes', () => {
  const rng = mulberry32(3);
  for(const f of T1.oneOf){
    const names = new Set(f.items.map(i => i.item));
    for(let n=0; n<5000; n++){
      const got = Object.keys(rollLoot(T1, rng)).filter(k => names.has(k));
      assert.ok(got.length <= 1);
    }
  }
});

test('chaque objet rare sort environ 1 fois sur 100', () => {
  const rng = mulberry32(11), N = 200000, seen = {};
  for(let n=0; n<N; n++) for(const k in rollLoot(T1, rng)) seen[k] = (seen[k] || 0) + 1;
  for(const f of T1.oneOf) for(const i of f.items){
    const rate = (seen[i.item] || 0) / N;
    assert.ok(Math.abs(rate - i.chance) < 0.002, `${i.item} : ${rate}`);
  }
});

test('chaque objet du butin est au catalogue avec une icône', () => {
  for(const t of Object.values(LOOT)) for(const i of [...t.always, ...t.oneOf.flatMap(f => f.items)]){
    const d = ITEMS[i.item];
    assert.ok(d, i.item);
    assert.ok(TEXTURES.includes(d.tex), d.tex);
    assert.ok(existsSync(new URL(`../textures/${d.tex}.png`, import.meta.url)), d.tex + '.png');
  }
});

test('ouvrir : retire un Treasure T1 et verse le butin', () => {
  const inv = createInventory();
  addItem(inv, 'Treasure T1', 2);
  const r = openTreasure(inv, 'Treasure T1', 'op-00001', mulberry32(1));
  assert.equal(r.repeated, false);
  assert.equal(countOf(inv, 'Treasure T1'), 1);
  for(const k in r.loot) assert.equal(countOf(inv, k), r.loot[k]);
});

test('ouvrir sans Treasure, ou un objet qui ne s\'ouvre pas : rien ne se passe', () => {
  const inv = createInventory();
  addItem(inv, 'Treasure T9', 1);       // un tier sans table de butin
  assert.equal(canOpen('Treasure T9'), false);
  assert.equal(openTreasure(inv, 'Treasure T1', 'op-00001', mulberry32(1)), null);
  assert.equal(openTreasure(inv, 'Treasure T9', 'op-00002', mulberry32(1)), null);
  assert.equal(countOf(inv, 'Treasure T9'), 1);
  assert.equal(inv.opened.length, 0);
});

test('même demande rejouée : même butin, aucun second treasure ouvert, même après sauvegarde', () => {
  let inv = createInventory();
  addItem(inv, 'Treasure T1', 2);
  const a = openTreasure(inv, 'Treasure T1', 'op-00001', mulberry32(1));
  inv = deserialize(serialize(inv));
  const b = openTreasure(inv, 'Treasure T1', 'op-00001', mulberry32(99));
  assert.equal(b.repeated, true);
  assert.deepEqual(b.loot, a.loot);
  assert.equal(countOf(inv, 'Treasure T1'), 1);
  assert.equal(countOf(inv, 'Charbon'), a.loot['Charbon']);
});

/* « Ouvrir tout » (25/10/2026) */
test('ouvrir tout : tous les exemplaires, chacun son tirage, butin additionné ; une demande renvoyée ne rouvre rien', async () => {
  const { openAll } = await import('../src/meta/loot.js');
  const inv = createInventory(); addItem(inv, 'Treasure T1', 7); addItem(inv, 'Fer', 3);
  const r = openAll(inv, 'Treasure T1', 'op-all-1', mulberry32(9));
  assert.equal(r.count, 7); assert.equal(r.repeated, false);
  assert.equal(countOf(inv, 'Treasure T1'), 0);
  const parts = LOOT['Treasure T1'].always.find(a => a.item === 'Blueprint parts');
  assert.ok(r.loot['Blueprint parts'] >= 7 * parts.min && r.loot['Blueprint parts'] <= 7 * parts.max, 'chacun son tirage');
  assert.equal(countOf(inv, 'Fer'), 3 + r.loot.Fer);
  const again = openAll(inv, 'Treasure T1', 'op-all-1', mulberry32(9));
  assert.deepEqual([again.repeated, again.count, again.loot], [true, 7, r.loot]);
  assert.equal(openAll(inv, 'Treasure T1', 'op-all-2', mulberry32(9)), null, 'plus rien à ouvrir');
  const back = deserialize(serialize(inv));
  assert.equal(back.opened.find(o => o.id === 'op-all-1').count, 7, 'relu avec la sauvegarde');
});

test('ouvrir tout : au plus TREASURE.openAllMax par demande ; objet qui ne s\'ouvre pas refusé', async () => {
  const { openAll } = await import('../src/meta/loot.js');
  const { TREASURE } = await import('../src/config.js');
  const inv = createInventory(); addItem(inv, 'Treasure T1', TREASURE.openAllMax + 5);
  assert.equal(openAll(inv, 'Treasure T1', 'op-all-3', mulberry32(1)).count, TREASURE.openAllMax);
  assert.equal(countOf(inv, 'Treasure T1'), 5);
  const other = createInventory(); addItem(other, 'Fer', 10);
  assert.equal(openAll(other, 'Fer', 'op-all-4', mulberry32(1)), null);
  assert.equal(countOf(other, 'Fer'), 10);
});

/* 31/10/2026 : tirages à 0 = le premier objet de chaque famille, donc toujours un blueprint si la famille en donne un */
const learnTiers = (inv, ...tiers) => { for(const t of tiers) inv.unlocked.push(...recipesLeft(inv, t)); return inv; };
const bpsOf = (inv, item) => {
  addItem(inv, item, 1);
  const { loot } = openTreasure(inv, item, `op-tier-${++opTier}`, () => 0);
  return { loot, bps: Object.keys(loot).filter(n => ITEMS[n]?.cat === 'blueprint' && n !== 'Blueprint parts') };
};
let opTier = 0;

test('tous les BP des tiers 1 à 3 appris : plus de BP dans les Treasures T1 et T2, encore dans le T3', () => {
  const inv = learnTiers(createInventory(), 1, 2, 3);
  assert.deepEqual(bpsOf(inv, 'Treasure T1').bps, []);
  assert.deepEqual(bpsOf(inv, 'Treasure T2').bps, []);
  assert.equal(bpsOf(inv, 'Treasure T3').bps.length, 1);
});

test('le tier du coffre appris mais pas le suivant : le coffre donne encore des BP', () => {
  assert.equal(bpsOf(learnTiers(createInventory(), 1), 'Treasure T1').bps.length, 1);
  assert.equal(bpsOf(learnTiers(createInventory(), 2), 'Treasure T1').bps.length, 1);   // T2 fini, pas le T1
});

test('un BP en stock mais pas appris ne compte pas comme une recette apprise', () => {
  const inv = learnTiers(createInventory(), 1, 2);
  const last = inv.unlocked.pop();
  addItem(inv, `${last} BP`, 1);
  assert.equal(bpsOf(inv, 'Treasure T1').bps.length, 1);
});

test('Treasure dépassé : le reste du butin ne change pas', () => {
  const { loot } = bpsOf(learnTiers(createInventory(), 1, 2), 'Treasure T1');
  for(const a of LOOT['Treasure T1'].always) assert.equal(loot[a.item], a.min);
  assert.ok(Object.keys(loot).some(n => ITEMS[n]?.cat === 'gem'));
});

test('Treasure T4 : dernier tier, pas de tier suivant, règle non appliquée', () => {
  const inv = learnTiers(createInventory(), 1, 2, 3, 4);
  assert.equal(treasureBlueprintsDone(inv, 'Treasure T4'), false);
  assert.ok(bpsOf(inv, 'Treasure T4').bps.includes('Saphir BP'));
});

