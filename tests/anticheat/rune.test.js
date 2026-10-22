/* Anti-triche des coffres de tour, des runes et de l'enchantement côté serveur : le hasard est tiré par le serveur,
   une demande renvoyée n'agit qu'une fois, une rune ne se duplique pas, une rune trafiquée ne passe pas. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUNE, chestItem } from '../../src/config.js';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { createInventory, addItem, serialize } from '../../src/meta/inventory.js';
import { fakeLive } from '../helpers.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };
const PICK = 'Pioche en pierre', CHEST = chestItem('angel', 3);

async function setup(){
  const store = createMemoryGameStore();
  const inv = createInventory(); addItem(inv, PICK, 2); addItem(inv, CHEST, 2);
  for(const s of inv.slots) if(s?.item === PICK) s.q = 5;       // identifiées : une rune R3 est acceptée (qualité ≤ celle de la pièce)
  await store.putInventory(ME.id, JSON.parse(serialize(inv)));
  const live = fakeLive(rec => ({ shares: rec.players.map(p => ({ account:p.account, left:false, bag:{} })) }));
  const game = createGameService({ store, liveRunner: live, clock: () => 1e6, dev:false,
                                   config:{ startsPerHour:1000, keepEnded:1e12, maxLive:2 } });
  const uids = inv.slots.filter(s => s?.item === PICK).map(s => s.uid);
  return { game, store, uids };
}
const runes = inv => inv.slots.filter(s => s?.item === RUNE.item);
const count = (inv, item) => inv.slots.filter(s => s?.item === item).reduce((n, s) => n + s.qty, 0);

test('ouvrir un coffre : double clic = un seul coffre ouvert, une seule rune ; deux ouvertures = deux runes aux uid uniques', async () => {
  const { game } = await setup();
  const op = { item:CHEST, opId:'op-chest-0001' };
  const [a, b] = await Promise.all([game.open(ME, op), game.open(ME, op)]);
  assert.deepEqual(a.loot, b.loot);
  let inv = (await game.state(ME)).inventory;
  assert.equal(count(inv, CHEST), 1); assert.equal(runes(inv).length, 1);
  assert.equal(runes(inv)[0].q, 3, 'la qualité du coffre');
  await game.open(ME, { item:CHEST, opId:'op-chest-0002' });
  inv = (await game.state(ME)).inventory;
  const uids = inv.slots.filter(s => s?.uid != null).map(s => s.uid);
  assert.equal(new Set(uids).size, uids.length, 'uid uniques');
});

test('une rune ne prend jamais l\'uid d\'une pièce portée (compteur d\'uid trop bas dans la base)', async () => {
  const { game, store, uids:[, b] } = await setup();
  await game.stuff(ME, { action:'equip', slot:'pioche', uid:b, opId:'op-equip-r1' });   // b : le plus grand uid
  const raw = await store.getInventory(ME.id); raw.nextUid = 1; await store.putInventory(ME.id, raw);
  await game.open(ME, { item:CHEST, opId:'op-chest-0003' });
  const r = runes((await game.state(ME)).inventory)[0];
  assert.ok(r.uid > b, `rune ${r.uid}, pièce portée ${b}`);
});

test('enchanter : double clic = une seule rune consommée ; deuxième rune refusée ; refus sans rien changer', async () => {
  const { game, uids:[a, b] } = await setup();
  await game.open(ME, { item:CHEST, opId:'op-chest-0004' });
  await game.open(ME, { item:CHEST, opId:'op-chest-0005' });
  let inv = (await game.state(ME)).inventory;
  const [r1, r2] = runes(inv).map(s => s.uid);
  const op = { action:'enchant', uid:a, rune:r1, opId:'op-enchant-01' };
  await Promise.all([game.upgrade(ME, op), game.upgrade(ME, op)]);
  inv = (await game.state(ME)).inventory;
  assert.equal(runes(inv).length, 1, 'une seule rune consommée');
  assert.equal(inv.slots.find(s => s?.uid === a).rune.q, 3);
  await assert.rejects(game.upgrade(ME, { action:'enchant', uid:a, rune:r2, opId:'op-enchant-02' }), { code:'already_enchanted' });
  for(const body of [{ action:'enchant', uid:b, opId:'op-enchant-03' }, { action:'enchant', uid:b, rune:'1', opId:'op-enchant-04' },
                     { action:'enchant', uid:r2, rune:r2, opId:'op-enchant-05' }, { action:'enchant', uid:b, rune:b, opId:'op-enchant-06' },
                     { action:'enchant', uid:b, rune:999, opId:'op-enchant-07' }])
    await assert.rejects(game.upgrade(ME, body));
  inv = (await game.state(ME)).inventory;
  assert.equal(runes(inv).length, 1); assert.equal(inv.slots.find(s => s?.uid === b).rune, undefined);
});

test('enchanter : la qualité de la rune ne dépasse jamais celle de la pièce, une pièce non identifiée est refusée (serveur)', async () => {
  const { game, store, uids:[a, b] } = await setup();
  await game.open(ME, { item:CHEST, opId:'op-chest-0010' });                        // rune R3
  const raw = await store.getInventory(ME.id);
  raw.slots.find(s => s?.uid === a).q = 2;                                          // pièce R2 : rune R3 trop rare
  delete raw.slots.find(s => s?.uid === b).q;                                       // pièce non identifiée
  await store.putInventory(ME.id, raw);
  const r = runes((await game.state(ME)).inventory)[0].uid;
  await assert.rejects(game.upgrade(ME, { action:'enchant', uid:a, rune:r, opId:'op-enchant-10' }), { code:'rune_too_rare' });
  await assert.rejects(game.upgrade(ME, { action:'enchant', uid:b, rune:r, opId:'op-enchant-11' }), { code:'not_identified' });
  const inv = (await game.state(ME)).inventory;
  assert.equal(runes(inv).length, 1, 'la rune n\'est pas consommée');
  assert.equal(inv.slots.find(s => s?.uid === a).rune, undefined); assert.equal(inv.slots.find(s => s?.uid === b).rune, undefined);
  raw.slots.find(s => s?.uid === a).q = 3; await store.putInventory(ME.id, raw);     // pièce R3 : rune R3 acceptée
  await game.upgrade(ME, { action:'enchant', uid:a, rune:r, opId:'op-enchant-12' });
  assert.equal((await game.state(ME)).inventory.slots.find(s => s?.uid === a).rune.q, 3);
});

test('une rune ou une pièce enchantée trafiquée dans la base ne passe pas', async () => {
  const { game, store, uids:[a] } = await setup();
  await game.open(ME, { item:CHEST, opId:'op-chest-0006' });
  const raw = await store.getInventory(ME.id);
  const rs = raw.slots.find(s => s?.item === RUNE.item);
  rs.lines = rs.lines.map(l => ({ ...l, pct: 99 }));                                          // rune gonflée
  const p = raw.slots.find(s => s?.uid === a); p.rune = { q:7, s:2, lines:[{ stat:'crit', pct:500 }] };   // rune inventée
  await store.putInventory(ME.id, raw);
  const inv = (await game.state(ME)).inventory;
  assert.equal(runes(inv).length, 0, 'rune trafiquée retirée');
  assert.equal(inv.slots.find(s => s?.uid === a).rune, undefined, 'rune inventée ignorée');
});
