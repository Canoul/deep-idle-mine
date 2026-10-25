/* Case Torche et Lampe à incandescence (25/10) : +10 torches, rayon 8, pose en 0,5 s ; craft débloqué par son blueprint (Treasure T2, depuis le 25/10 ; avant : sans blueprint) ;
   chaque torche garde le rayon de celui qui l'a posée (mine et tour). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS, STUFF, LOOT, ITEMS } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { createInventory, addAll, countOf } from '../src/meta/inventory.js';
import { craft, learn } from '../src/meta/craft.js';
import { equippedStats, slotsFor } from '../src/meta/stuff.js';
import { minerSpecs } from '../src/shared/game.js';
import { finishAction } from '../src/sim/actions.js';
import { decide } from '../src/sim/ai.js';
import { newTower, tickTower } from '../src/sim/tower/session.js';
import { createTowerViewer, applyTowerView } from '../src/shared/tower-view.js';
import { worldFrom } from './helpers.js';

const LAMP = 'Lampe à incandescence';

test('case Torche : la lampe y va, et seulement là', () => {
  assert.ok(STUFF.slots.some(s => s.id === 'torche'));
  assert.deepEqual(slotsFor(LAMP), ['torche']);
  assert.ok(!slotsFor('Pioche en pierre').includes('torche'));
});

test('recette : 200 vésicules de gaz, 2 000 charbon, 20 fragments de cœur, débloquée par son blueprint (Treasure T2)', () => {
  assert.deepEqual(RECIPES[LAMP], { cost: { 'Vésicule de gaz': 200, 'Charbon': 2000, 'Fragment de cœur': 20 }, qty: 1, unlock: LAMP + ' BP' });
  assert.ok(LOOT['Treasure T2'].oneOf.find(f => f.family === 'blueprint').items.some(i => i.item === LAMP + ' BP'), 'BP dans le Treasure T2');
  assert.equal(ITEMS[LAMP + ' BP']?.cat, 'blueprint');
  const inv = createInventory();
  addAll(inv, { 'Vésicule de gaz': 200, 'Charbon': 2000, 'Fragment de cœur': 20 });
  assert.equal(craft(inv, LAMP, 'op0').error, 'locked', 'plus disponible de base');
  addAll(inv, { [LAMP + ' BP']: 1 });
  assert.equal(learn(inv, LAMP + ' BP', 'op-l').ok, true);
  assert.equal(craft(inv, LAMP, 'op1').ok, true);
  assert.equal(countOf(inv, LAMP), 1);
  assert.equal(countOf(inv, 'Charbon'), 0);
});

test('effet : torches +10, rayon 8 (au lieu de 5), pose en 0,5 s (au lieu de 1)', () => {
  const s = equippedStats([{ item: LAMP }]);
  assert.equal(s.torches, STATS.torches + 10); assert.equal(s.torchRadius, 8); assert.equal(s.torchTime, 0.5);
  const base = equippedStats([]);
  assert.equal(base.torchRadius, 5); assert.equal(base.torchTime, 1);
});

test('mine : avec la lampe, il pose une torche en 0,5 s et elle éclaire à 8 cases ; sans, 5', () => {
  for(const [gear, r, t] of [[[{ item: LAMP }], 8, 0.5], [[], 5, 1]]){
    const G = worldFrom(['', 'd'.repeat(50), '#@' + ' '.repeat(30) + '#', '#'.repeat(50)]), m = G.miners[0];
    m.carac = equippedStats(gear); m.torches = m.carac.torches;
    G.light = new Map(); G.torches = [];
    decide(G, m);
    assert.equal(m.action.type, 'torch'); assert.equal(m.action.dur, t);
    finishAction(G, m, m.action);
    assert.equal(G.torches.at(-1).r, r);
    assert.ok((G.light.get(m.y * 50 + m.x + r) || 0) > 0, `éclairé à ${r} cases`);
    assert.equal(G.light.get(m.y * 50 + m.x + r + 1) || 0, 0, `pas à ${r + 1}`);
  }
});

test('tour : la torche garde son rayon, aussi dans ce que reçoit le navigateur', () => {
  const [spec] = minerSpecs({ players: [{ account: 'A', name: 'Zoe' }], gear: { A: { torche: { item: LAMP, q: 1, lines: [], uid: 1 } } } });
  assert.equal(spec.carac.torchRadius, 8);
  const G = newTower(3, { side: 'angel', miners: [{ ...spec, account: 'A' }] });
  let guard = 0;
  while(!G.torches.length && guard++ < 3000) tickTower(G);
  assert.equal(G.torches[0].r, 8);
  const V = applyTowerView(createTowerViewer(G)(), null, 0);
  assert.equal(V.torches[0].r, 8);
});
