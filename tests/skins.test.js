/* Apparence des mineurs : pseudo du joueur, même corps pour tous, équipement visible (src/skins.js) figé au lancement. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STUFF } from '../src/config.js';
import { SKIN, SKIN_TEXTURES, armorLayers, armorPieces, backPieces, auraPieces, pickaxeOf } from '../src/skins.js';
import { sanitizeLook } from '../src/meta/stuff.js';
import { minerSpecs, buildSession } from '../src/shared/game.js';
import { createViewer, emptyView, applyView } from '../src/shared/view.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { fakeLive } from './helpers.js';

test('skins : chaque texture existe dans textures/, chaque pièce d\'armure visible existe dans STUFF', () => {
  for(const n of SKIN_TEXTURES) assert.ok(fs.existsSync(new URL(`../textures/${n}.png`, import.meta.url)), n);
  for(const [item] of Object.entries(SKIN.armor)) assert.ok(STUFF.items[item], item);
  for(const item of Object.keys(SKIN.back)) assert.ok(SKIN.armor[item] && STUFF.items[item], `${item} : un dos sans devant`);
  for(const item of Object.keys(SKIN.pickaxe).filter(k => k !== 'base')) assert.equal(STUFF.items[item]?.slot, 'pioche', item);
});

test('calques : dans l\'ordre (pieds → casque), seulement ce qui est porté ; pioche en bois sans pioche équipée', () => {
  assert.deepEqual(armorLayers({}), []);
  assert.deepEqual(armorLayers({ casque:'Casque en chitine', pieds:'Bottes en chitine' }), [SKIN.armor['Bottes en chitine'], SKIN.armor['Casque en chitine']]);
  assert.equal(pickaxeOf({}), SKIN.pickaxe.base);
  assert.equal(pickaxeOf({ pioche:'Pioche en pierre' }), SKIN.pickaxe['Pioche en pierre']);
});

test('cape : le dos derrière le corps, le col devant (entre plastron et casque), aura sur le dos', () => {
  const look = { torse:'Plastron en fer', cape:'Cape de Naingui', casque:'Casque en fer' };
  assert.deepEqual(backPieces(look), [['cape', 'skins/naingui_cape']]);
  assert.deepEqual(armorPieces(look).map(([s]) => s), ['torse', 'cape', 'casque']);
  assert.deepEqual(auraPieces(look), [['cape', 'skins/naingui_cape'], ['torse', 'skins/iron_chest'], ['casque', 'skins/iron_helmet']]);
  assert.deepEqual(backPieces({}), []);
});

test('apparence revérifiée : case inconnue ou pièce dans la mauvaise case → ignorée', () => {
  assert.deepEqual(sanitizeLook({ casque:'Casque en chitine', torse:'Casque en chitine', aile:'X', pioche:42 }), { casque:'Casque en chitine' });
  assert.deepEqual(sanitizeLook(null), {});
});

test('mineurs de la session : pseudo de chaque joueur, sans couleur d\'équipe ; mineurs de test nommés à part', () => {
  const rec = { seed:1, players:[{ account:'A', name:'Zoé' }, { account:'B', name:'Max' }], bots:1,
                looks:{ A:{ casque:'Casque en chitine' } } };
  const specs = minerSpecs(rec);
  assert.deepEqual(specs.map(s => s.name), ['Zoé', 'Max', 'Mineur test 1']);
  assert.deepEqual(specs.map(s => s.look), [{ casque:'Casque en chitine' }, {}, {}]);
  const G = buildSession({ ...rec, id:'S' });
  assert.deepEqual(G.miners.map(m => [m.name, m.color]), [['Zoé', null], ['Max', null], ['Mineur test 1', null]]);
  assert.equal(minerSpecs({ players:[{ account:'A', name:'Solo' }] })[0].name, 'Solo');
});

test('l\'apparence arrive au navigateur avec la partie', () => {
  const G = buildSession({ id:'S', seed:1, players:[{ account:'A', name:'Zoé' }], looks:{ A:{ pioche:'Pioche en pierre' } } });
  const M = applyView(emptyView(), createViewer(G)(null), 0);
  assert.deepEqual([M.miners[0].name, M.miners[0].look], ['Zoé', { pioche:'Pioche en pierre' }]);
});

test('au lancement, le serveur fige l\'équipement porté de chaque joueur (son apparence pendant la session)', async () => {
  const store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner: fakeLive(() => ({ shares:[] })) });
  const ME = { id:'AAAA1111', name:'Zoe', guest:false };
  await store.putInventory(ME.id, { slots:[{ item:'Casque en chitine', qty:1, uid:1 }], nextUid:2, credited:[] });
  await game.stuff(ME, { action:'equip', slot:'casque', uid:1, opId:'op-skin-equip' });
  const { session } = await game.start(ME, {});
  assert.deepEqual(session.looks[ME.id], { casque:'Casque en chitine' });
  await game.stuff(ME, { action:'unequip', slot:'casque', opId:'op-skin-retire' });   // pendant la session : rien ne change
  assert.deepEqual((await store.getGameSession(session.id)).looks[ME.id], { casque:'Casque en chitine' });
});

test('lobby : le service de jeu donne l\'apparence d\'un joueur (équipement porté, noms seulement)', async () => {
  const store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner: fakeLive(() => ({ shares:[] })) });
  const ME = { id:'AAAA1111', name:'Zoe', guest:false };
  assert.deepEqual(await game.lookFor(ME.id), {}, 'rien de porté : tenue de base');
  await store.putInventory(ME.id, { slots:[{ item:'Casque en chitine', qty:1, uid:1 }], nextUid:2, credited:[] });
  await game.stuff(ME, { action:'equip', slot:'casque', uid:1, opId:'op-skin-lobby' });
  assert.deepEqual(await game.lookFor(ME.id), { casque:'Casque en chitine' });
});
