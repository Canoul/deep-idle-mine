/* Objets du Coffre du Golbute (30/10/2026, Geoffrey) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOLBUTE, ITEMS, RINGS, BLOCKS, IDS, UPGRADE } from '../src/config.js';
import { mineT } from '../src/sim/mineur.js';
import { killMob } from '../src/sim/actions.js';
import { openTreasure } from '../src/meta/loot.js';
import { createInventory, addItem, countOf } from '../src/meta/inventory.js';
import { withRings } from '../src/meta/stuff.js';
import { worldFrom } from './helpers.js';

const NEW = ['Némésis du Golbute', 'Torse de Gollex', 'Jambières du Golbute', 'Âme du Golbute', 'Anneau en pierre'];

test('les 5 objets existent, sont dans le coffre aux bonnes chances, T4.5 pour les runes (pas l\'anneau)', () => {
  for(const n of NEW) assert.ok(ITEMS[n], n);
  const boss = GOLBUTE.loot.oneOf.find(f => f.family === 'boss').items;
  assert.deepEqual(boss.map(i => [i.item, i.chance]), [['Némésis du Golbute', 0.01], ['Torse de Gollex', 0.03], ['Anneau en pierre', 0.02], ['Jambières du Golbute', 0.03], ['Âme du Golbute', 0.02]]);
  for(const n of NEW.slice(0, 4)) assert.ok(UPGRADE.tiers['4.5'].items.includes(n), n);
  assert.deepEqual(RINGS.items['Anneau en pierre'].add, { tenacity: 3 });
  assert.equal(withRings({ tenacity: 2 }, ['Anneau en pierre']).tenacity, 5);
});

test('Némésis : minage × 1,25 sur la terre et la pierre, pas sur les minerais', () => {
  const G = worldFrom(['', 'dddd', '####']), m = G.miners[0];
  const plain = { stone: mineT(G, m, IDS.stone), iron: mineT(G, m, IDS.iron) };
  m.carac.blockMinePct = 25;
  assert.ok(Math.abs(mineT(G, m, IDS.stone) - plain.stone / 1.25) < 1e-9);
  assert.equal(mineT(G, m, IDS.iron), plain.iron);
});

test('Âme : un golem tué à 8 cases rend 25 d\'oxygène au porteur (pas plus que son max), rien au-delà ni sans l\'âme', () => {
  const G = worldFrom(['', 'dddddddddddddddddddddd', '######################']);
  const m = G.miners[0]; m.x = 2; m.carac.golemOxygen = 25; m.ox = 50; m.carac.oxygenMax = 100;
  const golem = x => ({ id: G.mobId++, type: 'golem', x, y: m.y, hp: 1, maxhp: 1 });
  let o = golem(10); G.mobs.push(o); killMob(G, m, o);
  assert.equal(m.ox, 75, '8 cases : oui');
  o = golem(11); G.mobs.push(o); killMob(G, m, o);
  assert.equal(m.ox, 75, '9 cases : non');
  o = golem(3); G.mobs.push(o); killMob(G, m, o);
  assert.equal(m.ox, 100, 'plafonné au max');
});

test('coffre : toujours les matériaux, une pièce de stuff identifiée à la qualité du coffre, l\'anneau sans qualité', () => {
  let seen = new Set();
  for(let s = 1; s <= 3000; s++){
    const inv = createInventory(); addItem(inv, 'Coffre du Golbute R4', 1);
    let r = s * 7919; const rng = () => (r = (r * 16807) % 2147483647) / 2147483647;
    const { loot } = openTreasure(inv, 'Coffre du Golbute R4', 'op' + s, rng, { spells: [] });
    assert.ok(loot['Mithril ingot'] >= 2 && loot['Mithril ingot'] <= 4);
    assert.ok(loot['Pierre glissante'] >= 5 && loot['Pierre glissante'] <= 10);
    for(const n of NEW) if(loot[n]){ seen.add(n); const sl = inv.slots.find(x => x?.item === n);
      if(n === 'Anneau en pierre') assert.ok(!sl.q); else assert.equal(sl.q, 4); }
  }
  assert.equal(seen.size, 5, [...seen].join(', '));
});
