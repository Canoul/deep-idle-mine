/* Anti-triche : ouverture des Treasure TX (suite lancée à la demande : npm run test:anticheat).
   Le serveur tire le butin ; le navigateur ne peut ni choisir le butin, ni ouvrir plus de treasures qu'il n'en a,
   ni rejouer une ouverture pour la doubler. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../../server/game/store.js';
import { fakeLive } from '../helpers.js';
import { createGameService } from '../../server/game/service.js';
import { createInventory, addItem, serialize } from '../../src/meta/inventory.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };
const OTHER = { id:'BBBB2222', name:'Max', guest:false };

async function setup(t1 = 1){
  const store = createMemoryGameStore();
  const inv = createInventory();
  if(t1) addItem(inv, 'Treasure T1', t1);
  await store.putInventory(ME.id, JSON.parse(serialize(inv)));
  const game = createGameService({ store, liveRunner:fakeLive(() => ({ shares:[] })), clock:() => 0, dev:false,
                                   config:{ startsPerHour:1000, keepEnded:1e12 }, random:() => 0.5 });
  return { game, store };
}
const qty = async (game, item, who = ME) => (await game.state(who)).inventory.slots.find(s => s?.item === item)?.qty ?? 0;

test('objet inconnu, objet qui ne s\'ouvre pas, ou identifiant de demande invalide : refusé', async () => {
  const { game } = await setup();
  for(const item of [undefined, null, 3, '', 'Charbon', 'Chitine', '__proto__', 'constructor', { a:1 }, ['Treasure T1']])
    await assert.rejects(game.open(ME, { item, opId:'op-00000001' }), { code:'bad_item' }, String(item));
  for(const opId of [undefined, 42, '', 'court', 'x'.repeat(65), '../../etc', 'a b c d e f', { id:1 }])
    await assert.rejects(game.open(ME, { item:'Treasure T1', opId }), { code:'bad_request' }, String(opId));
  assert.equal(await qty(game, 'Treasure T1'), 1);
});

test('le navigateur ne choisit pas le butin', async () => {
  const { game } = await setup();
  const r = await game.open(ME, { item:'Treasure T1', opId:'op-00000001', loot:{ Diamant:999 }, qty:50 });
  assert.equal(r.loot.Diamant, undefined);
  assert.equal(await qty(game, 'Diamant'), 0);
  assert.equal(await qty(game, 'Treasure T1'), 0);
});

test('sans Treasure T1 : refusé, rien de créé', async () => {
  const { game } = await setup(0);
  await assert.rejects(game.open(ME, { item:'Treasure T1', opId:'op-00000001' }), { code:'not_owned' });
  assert.equal((await game.state(ME)).inventory.slots.filter(Boolean).length, 0);
});

test('double clic / requête renvoyée (même opId) : un seul treasure ouvert, même butin', async () => {
  const { game } = await setup(2);
  const res = await Promise.all([1,2,3].map(() => game.open(ME, { item:'Treasure T1', opId:'op-00000001' })));
  assert.equal(await qty(game, 'Treasure T1'), 1);
  for(const r of res) assert.deepEqual(r.loot, res[0].loot);
  assert.equal(await qty(game, 'Charbon'), res[0].loot.Charbon);
});

test('ouvertures simultanées avec un seul treasure : une seule réussit', async () => {
  const { game } = await setup(1);
  const res = await Promise.allSettled(['op-aaaaaaa1','op-aaaaaaa2','op-aaaaaaa3'].map(opId => game.open(ME, { item:'Treasure T1', opId })));
  assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
  assert.ok(res.filter(r => r.status === 'rejected').every(r => r.reason.code === 'not_owned'));
  assert.equal(await qty(game, 'Treasure T1'), 0);
});

test('l\'opId d\'un autre joueur ne donne rien', async () => {
  const { game } = await setup(1);
  await game.open(ME, { item:'Treasure T1', opId:'op-00000001' });
  await assert.rejects(game.open(OTHER, { item:'Treasure T1', opId:'op-00000001' }), { code:'not_owned' });
  assert.equal(await qty(game, 'Charbon', OTHER), 0);
});
