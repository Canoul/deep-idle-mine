/* Minerais profonds (27/10/2026, Geoffrey) : mithril, cobalt, thorium ; areas 6 retouchée, 7 et 8 nouvelles. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKS, IDS, AREAS, ITEMS, XP, TEXTURES, JUDGMENT, W, AREA_H } from '../src/config.js';
import { rarityOf } from '../src/meta/rarity.js';
import { newSession } from '../src/sim/session.js';
import { genArea, areaComp, fillComp } from '../src/sim/world.js';
import { mulberry32 } from '../src/core/rng.js';
import { ORE_KEYS } from '../src/sim/focus.js';
import { AREA_KEYS } from '../src/wiki/data.js';

const NEW = { mithril:'Mithril ore', cobalt:'Cobalt ore', thorium:'Thorium ore' };

test('blocs : trois minerais, objets d\'inventaire « ore », XP, texture, focus et wiki', () => {
  for(const [key, name] of Object.entries(NEW)){
    const b = BLOCKS[IDS[key]];
    assert.equal(b.name, name);
    assert.equal(b.type, 'ore');
    assert.equal(ITEMS[name].cat, 'ore');
    assert.ok(XP.ore[key] > 0, `XP de ${key}`);
    assert.ok(TEXTURES.includes(b.tex), `texture de ${key}`);
    assert.ok(ORE_KEYS.includes(key), `${key} dans le focus`);
    assert.ok(AREA_KEYS.includes(key), `${key} dans le wiki`);
  }
});

test('rareté : mithril commun, cobalt et thorium inhabituels', () => {
  assert.equal(rarityOf('Mithril ore'), 'commun');
  assert.equal(rarityOf('Cobalt ore'), 'inhabituel');
  assert.equal(rarityOf('Thorium ore'), 'inhabituel');
});

/* tableau du 27/10 (Geoffrey), résidus compris (pris sur la pierre à la génération) */
const SHEET = {
  6: { stone:34.5, hardstone:40,   iron:5, gold:6, diamond:1, graphite:6, mithril:2,                       air:5 },
  7: { stone:20,   hardstone:54.5, iron:2, gold:1, diamond:1, graphite:7, mithril:5, cobalt:2, thorium:2,  air:5 },
  8: { stone:15,   hardstone:59.5,                            graphite:5, mithril:7, cobalt:4, thorium:4,  air:5 },
};

test('compositions des areas 6 à 8 : 100 %, la dernière (8) se répète', () => {
  assert.equal(AREAS.length, 9);
  for(const k of [6, 7, 8]){
    const c = AREAS[k].comp;
    assert.equal(Object.values(c).reduce((s, v) => s + v, 0), 100, `area ${k}`);
    assert.deepEqual({ ...c, stone: c.stone - JUDGMENT.pct }, SHEET[k], `area ${k} (résidus déduits)`);
  }
  assert.deepEqual(areaComp(12), AREAS[8].comp);
  for(let k = 0; k < 6; k++) assert.ok(!AREAS[k].comp.mithril, `pas de mithril en area ${k}`);
  for(let k = 0; k < 7; k++) assert.ok(!AREAS[k].comp.cobalt && !AREAS[k].comp.thorium, `ni cobalt ni thorium en area ${k}`);
});

test('remplissage : comptes exacts des nouveaux minerais (avant donjon, pièges et résidus)', () => {
  const N = W * AREA_H, n = p => Math.round(p * N / 100);
  for(const k of [6, 7, 8]){
    const { grid, counts } = fillComp(mulberry32(k), AREAS[k].comp);
    for(const key of ['mithril', 'cobalt', 'thorium']){
      assert.equal(counts[key] ?? 0, n(SHEET[k][key] ?? 0), `${key} en area ${k}`);
      assert.equal(grid.filter(t => t === IDS[key]).length, n(SHEET[k][key] ?? 0), `${key} posés en area ${k}`);
    }
  }
});

test("génération : une partie descend jusqu'à l'area 9 avec les nouveaux minerais", () => {
  const G = newSession(7);
  for(let k = 1; k <= 9; k++) genArea(G, k);
  for(const k of [7, 8, 9]) for(const key of ['mithril', 'cobalt', 'thorium']) assert.ok(G.areas[k].counts[key] > 0, `${key} en area ${k}`);
  assert.ok(G.areas[6].counts.mithril > 0 && !G.areas[6].counts.cobalt);
});
