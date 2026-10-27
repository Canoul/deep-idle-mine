/* Graphite (23/10, Geoffrey) : minerai des areas 5 et 6, fonte en Graphite ingot, alliage Steel ingot. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FURNACE, ITEMS, BLOCKS, IDS, AREAS, XP, W, AREA_H } from '../src/config.js';
import { createInventory, addAll, countOf } from '../src/meta/inventory.js';
import { createFurnaces, furnaceOp, advance } from '../src/meta/furnace.js';
import { newSession } from '../src/sim/session.js';
import { genArea } from '../src/sim/world.js';

const MIN = 60_000, T0 = 1_000_000;
let n = 0;
const op = (st, inv, o, now = T0) => furnaceOp(st, inv, { furnace:0, opId:'op-graphite-' + (++n), ...o }, now);

test('bloc : Graphite ore, minerai, dureté 4, poids 3, attrait 4, 4 XP', () => {
  const b = BLOCKS[IDS.graphite];
  assert.equal(b.name, 'Graphite ore');
  assert.deepEqual([b.type, b.hard, b.w, b.val], ['ore', 4, 3, 4]);
  assert.equal(ITEMS['Graphite ore'].cat, 'ore');
  assert.equal(XP.ore.graphite, 4);
});

test('compositions des areas 5 et 6 : 100 %, graphite 5 % et 6 %, plus de charbon', () => {
  assert.deepEqual(AREAS[5].comp, { stone:55, hardstone:20, iron:9.5, gold:5, diamond:0.5, graphite:5, air:5 });
  assert.equal(AREAS[6].comp.graphite, 6);   // area 6 retouchée le 27/10 (mithril) : tests/deep-ores.test.js
  for(const k of [5, 6]) assert.equal(Object.values(AREAS[k].comp).reduce((s, v) => s + v, 0), 100);
  for(let k = 0; k < 5; k++) assert.ok(!AREAS[k].comp.graphite, `pas de graphite en area ${k}`);
});

test('génération : l\'area 6 contient bien ses 150 graphites (6 % de 2 500)', () => {
  const G = newSession(11);
  for(let k = 1; k <= 6; k++) genArea(G, k);
  assert.equal(G.areas[6].counts.graphite, Math.round(0.06 * W * AREA_H));
  assert.equal(G.areas[5].counts.graphite, Math.round(0.05 * W * AREA_H));
});

test('four : 10 Graphite ore + 10 charbons → 1 Graphite ingot en 60 s', () => {
  assert.deepEqual(FURNACE.recipes['Graphite ore'], { out:'Graphite ingot', time:60, tex:'ingot_graphite' });
  const inv = createInventory(); addAll(inv, { 'Graphite ore':25, Charbon:40 });
  const st = createFurnaces(), f = st.list[0];
  assert.ok(op(st, inv, { action:'load', slot:'ore', item:'Graphite ore', qty:25 }).ok);
  assert.ok(op(st, inv, { action:'load', slot:'fuel', item:'Charbon', qty:40 }).ok);
  advance(f, T0 + MIN - 1);
  assert.equal(f.out, null);
  advance(f, T0 + 10 * MIN);
  assert.deepEqual(f.out, { item:'Graphite ingot', qty:2 }, '25 minerais → 2 lingots, 5 restent');
  assert.equal(f.ore.qty, 5);
  assert.ok(op(st, inv, { action:'collect' }, T0 + 10 * MIN).ok);
  assert.equal(countOf(inv, 'Graphite ingot'), 2);
});

test('alliage : 3 Tainted iron + 5 Graphite ingot + 50 charbons → 1 Steel ingot en 3 min', () => {
  const r = FURNACE.alloys.find(a => a.out === 'Steel ingot');
  assert.deepEqual(r.in, { 'Tainted iron':3, 'Graphite ingot':5 });   // 26/10 : 10 → 5
  assert.equal(ITEMS['Steel ingot'].cat, 'ingot');
  const inv = createInventory(); addAll(inv, { 'Tainted iron':6, 'Graphite ingot':7, Charbon:200 });
  const st = createFurnaces(), f = st.list[0];
  op(st, inv, { action:'mode', mode:'alloy' });
  assert.ok(op(st, inv, { action:'load', slot:'a', item:'Graphite ingot', qty:7 }).ok, 'ordre libre');
  assert.ok(op(st, inv, { action:'load', slot:'b', item:'Tainted iron', qty:6 }).ok);
  assert.ok(op(st, inv, { action:'load', slot:'fuel', item:'Charbon', qty:200 }).ok);
  advance(f, T0 + 3 * MIN - 1);
  assert.equal(f.out, null);
  advance(f, T0 + 60 * MIN);
  assert.deepEqual(f.out, { item:'Steel ingot', qty:1 }, 'le graphite (7) limite à 1');
  assert.deepEqual([f.a.qty, f.b.qty, f.fuel.qty], [2, 3, 150]);
});
