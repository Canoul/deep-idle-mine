/* Wiki : objets secrets (WIKI.secret, 27/10/2026) : leurs effets restent cachés tant qu'aucun joueur ne les a trouvés en
   jeu ; le serveur retient la première trouvaille (coffre, trésor, fin de session), pas un don d'administration. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIKI, STUFF, ITEMS, goblinChestItem } from '../src/config.js';
import * as D from '../src/wiki/data.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { gameRoutes } from '../server/game/routes.js';
import { createInventory, addItem, serialize } from '../src/meta/inventory.js';
import { fakeLive } from './helpers.js';

const ME = { id: 'AAAA1111', name: 'Zoe' };

test('les objets secrets sont des pièces de stuff du jeu', () => {
  assert.ok(WIKI.secret.length >= 1);
  for(const n of WIKI.secret){ assert.ok(Object.hasOwn(STUFF.items, n), n); assert.equal(ITEMS[n].cat, 'stuff'); }
});

test('wiki : effets cachés tant que pas trouvés, puis visibles ; leurs stats propres aussi', () => {
  D.setDiscovered([]);
  for(const n of WIKI.secret) assert.deepEqual(D.statsOf(n), [D.HIDDEN_TEXT]);
  assert.ok(D.statsOf('Épée en fer').length > 0, 'les autres objets ne changent pas');
  assert.ok(!D.statRows().some(s => s.items.some(i => WIKI.secret.includes(i.name))), 'pas cités dans le tableau des stats');
  assert.ok(!D.statRows().some(s => s.key === 'goblinThrall'), 'la stat de la Couronne est cachée');
  D.setDiscovered(['Couronne du Roi Gobelin']);
  assert.ok(!D.statsOf('Couronne du Roi Gobelin').includes(D.HIDDEN_TEXT));
  assert.ok(D.statRows().some(s => s.key === 'goblinThrall'));
  assert.deepEqual(D.statsOf('Masse du Roi Gobelin'), [D.HIDDEN_TEXT], 'les autres restent cachés');
  D.setDiscovered([]);
});

test('serveur : trouvé à l\'ouverture d\'un coffre (une fois), pas par un don d\'administration ; route publique', async () => {
  const store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner: fakeLive(r => ({ id: r.id, shares: [] })), clock: () => 1e12, randomSeed: () => 7,
                                   random: () => 0 });   // le premier objet de chaque tirage : la Couronne du coffre
  const routes = gameRoutes(game);
  assert.deepEqual((await routes['GET /api/wiki']({})).discovered, [], 'public, sans compte');
  await game.adminGive(ME.id, 'Masse du Roi Gobelin', 1);
  assert.deepEqual((await game.wiki()).discovered, [], 'un don ne révèle rien');
  const inv = createInventory(); addItem(inv, goblinChestItem(5), 1);
  await store.putInventory(ME.id, JSON.parse(serialize(inv)));
  const r = await game.open(ME, { item: goblinChestItem(5), opId: 'open-test-1' });
  const found = WIKI.secret.filter(n => r.loot[n]);
  assert.ok(found.length >= 1, `butin : ${Object.keys(r.loot).join(', ')}`);
  assert.deepEqual((await game.wiki()).discovered, found);
  assert.deepEqual(await store.listDiscovered(), found, 'retenu par le serveur');
});
