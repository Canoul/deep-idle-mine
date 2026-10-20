/* Ouverture des Treasure TX hors session : table de butin, tirage, ouverture dans l'inventaire. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { LOOT, ITEMS, TEXTURES } from '../src/config.js';
import { mulberry32 } from '../src/core/rng.js';
import { rollLoot, openTreasure, canOpen } from '../src/meta/loot.js';
import { createInventory, addItem, countOf, serialize, deserialize } from '../src/meta/inventory.js';

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
  addItem(inv, 'Treasure T2', 1);
  assert.equal(canOpen('Treasure T2'), false);
  assert.equal(openTreasure(inv, 'Treasure T1', 'op-00001', mulberry32(1)), null);
  assert.equal(openTreasure(inv, 'Treasure T2', 'op-00002', mulberry32(1)), null);
  assert.equal(countOf(inv, 'Treasure T2'), 1);
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
