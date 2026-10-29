/* Anti-triche : coffre du Roi Gobelin et recette Chitine au four (27/10/2026). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goblinChestItem } from '../../src/config.js';
import { createInventory, addAll, addItem, countOf } from '../../src/meta/inventory.js';
import { openTreasure } from '../../src/meta/loot.js';
import { createFurnaces, furnaceOp } from '../../src/meta/furnace.js';

const CHEST = goblinChestItem(5);

test('coffre du Roi Gobelin : sans coffre rien ne s\'ouvre ; la même demande ne donne qu\'une fois ; la qualité vient du coffre', () => {
  const inv = createInventory();
  assert.equal(openTreasure(inv, CHEST, 'a', () => 0), null, 'pas de coffre : rien');
  addItem(inv, CHEST, 1);
  const r = openTreasure(inv, CHEST, 'a', () => 0);
  for(let k = 0; k < 5; k++) assert.equal(openTreasure(inv, CHEST, 'a', () => 0).repeated, true);
  assert.equal(countOf(inv, 'Couronne du Roi Gobelin'), 1, 'une seule couronne');
  assert.equal(countOf(inv, 'Peau de gobelin'), r.loot['Peau de gobelin']);
  assert.equal(inv.slots.find(s => s?.item === 'Couronne du Roi Gobelin').q, 5);
  assert.equal(openTreasure(inv, 'Coffre du Roi Gobelin R9', 'b', () => 0), null, 'qualité inconnue : refusé');
  assert.equal(openTreasure(inv, 'Coffre du Roi Gobelin', 'c', () => 0), null);
});

test('four : la recette Chitine fermée est refusée par le serveur même si le navigateur l\'envoie ; quantités invalides refusées', () => {
  const inv = createInventory(), st = createFurnaces(); addAll(inv, { 'Peau de gobelin':100, 'Charbon':100 });
  assert.equal(furnaceOp(st, inv, { furnace:0, action:'load', slot:'ore', item:'Peau de gobelin', qty:10, opId:'x' }, 0).error, 'bad_item');
  inv.unlocked.push('Four : Chitine');
  for(const qty of [-10, 0, 2.5, Infinity, NaN, '10', 101])
    assert.ok(furnaceOp(st, inv, { furnace:0, action:'load', slot:'ore', item:'Peau de gobelin', qty, opId:'q' + String(qty) }, 0).error, String(qty));
  assert.equal(countOf(inv, 'Peau de gobelin'), 100, 'rien retiré');
});

test('serveur : un parchemin de sort déjà appris ne sort jamais d\'un coffre du Roi Gobelin (sorts relus au serveur)', async () => {
  const { createMemoryGameStore } = await import('../../server/game/store.js');
  const { createGameService } = await import('../../server/game/service.js');
  const { fakeLive } = await import('../helpers.js');
  const store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner: fakeLive(rec => ({ id: rec.id, shares: [] })), clock: () => 5e6 });
  const ME = { id: 'AAAA1111', name: 'Zoe' };
  const inv = createInventory(); addItem(inv, CHEST, 400);
  await store.putInventory(ME.id, JSON.parse(JSON.stringify({ v: 1, ...inv })));
  await store.putSpells(ME.id, { learned: ['ulti_shen', 'fast_learner', 'cleave', 'hand_of_justice'], slots: [null, null], ops: [] });
  let scrolls = 0, opened = 0;
  for(let k = 0; k < 4; k++){
    const r = await game.open(ME, { item: CHEST, opId: 'open-all-' + k, all: true });
    opened += r.count; scrolls += Object.keys(r.loot).filter(x => x.startsWith('Parchemin')).length;
  }
  assert.equal(opened, 400);
  assert.equal(scrolls, 0, 'tous les sorts sont appris : aucun parchemin');
});

test('coffre du Roi Gobelin II (niveau 2, 29/10) : même chemin, une seule ouverture par demande, niveau ou qualité inventés refusés', () => {
  const C2 = goblinChestItem(4, 2), inv = createInventory();
  assert.equal(openTreasure(inv, C2, 'a', () => 0), null, 'pas de coffre : rien');
  addItem(inv, C2, 1);
  const r = openTreasure(inv, C2, 'a', () => 0);
  for(let k = 0; k < 5; k++) assert.equal(openTreasure(inv, C2, 'a', () => 0).repeated, true);
  assert.equal(countOf(inv, C2), 0);
  assert.equal(countOf(inv, 'Peau de gobelin'), r.loot['Peau de gobelin']);
  assert.equal(countOf(inv, 'Couronne du Roi Gobelin'), 1);
  for(const fake of ['Coffre du Roi Gobelin III R4', 'Coffre du Roi Gobelin II R9', 'Coffre du Roi Gobelin II', 'Coffre du Roi Gobelin 2 R4'])
    assert.equal(openTreasure(inv, fake, 'f' + fake, () => 0), null, fake);
});
