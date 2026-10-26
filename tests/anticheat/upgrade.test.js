/* Anti-triche de l'amélioration côté serveur : le hasard est tiré par le serveur, une demande renvoyée n'agit qu'une
   fois, une pièce portée ou trafiquée ne passe pas, la session lit les pièces revérifiées. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { createInventory, addItem, addAll, serialize } from '../../src/meta/inventory.js';
import { fakeLive } from '../helpers.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };
const PICK = 'Pioche en pierre', FEATHER = 'Plume d\'ange', STONE = 'Cristal de pleine lune';

async function setup(random = () => 0.5){
  const store = createMemoryGameStore();
  const inv = createInventory(); addItem(inv, PICK, 3); addAll(inv, { [FEATHER]:30, [STONE]:10 });
  await store.putInventory(ME.id, JSON.parse(serialize(inv)));
  const live = fakeLive(rec => ({ shares: rec.players.map(p => ({ account:p.account, left:false, bag:{} })) }));
  const game = createGameService({ store, liveRunner: live, clock: () => 1e6, dev:false, random,
                                   config:{ startsPerHour:1000, keepEnded:1e12, maxLive:2 } });
  const uids = inv.slots.filter(s => s?.item === PICK).map(s => s.uid);
  return { game, store, uids };
}
const count = (inv, item) => inv.slots.filter(s => s?.item === item).reduce((n, s) => n + s.qty, 0);

test('identifier : tiré par le serveur ; double clic = un seul sacrifice, même résultat', async () => {
  const { game, uids:[a, b, c] } = await setup();
  const op = { action:'identify', uid:a, sacrifice:b, opId:'op-identify-1' };
  const [r1, r2] = await Promise.all([game.upgrade(ME, op), game.upgrade(ME, { ...op, sacrifice:c })]);
  assert.deepEqual(r1.piece, r2.piece);
  assert.ok(r1.piece.q >= 1);
  assert.equal(count(r2.inventory, PICK), 2);
});

test('demandes invalides refusées sans rien changer', async () => {
  const { game, uids:[a, b] } = await setup();
  for(const body of [{}, { action:'identify', uid:a, sacrifice:b }, { action:'identify', uid:'1', sacrifice:b, opId:'op-bad-0001' },
                     { action:'identify', uid:a, opId:'op-bad-0002' }, { action:'hack', uid:a, opId:'op-bad-0003' },
                     { action:'identify', uid:a, sacrifice:a, opId:'op-bad-0004' }, { action:'upgrade', uid:999, opId:'op-bad-0005' }])
    await assert.rejects(game.upgrade(ME, body));
  const inv = (await game.state(ME)).inventory;
  assert.equal(count(inv, PICK), 3); assert.equal(count(inv, FEATHER), 30);
  assert.ok(inv.slots.every(s => s?.q === undefined));
});

test('améliorer : matériaux consommés une fois ; une pièce portée ne s\'améliore pas', async () => {
  const { game, uids:[a, b] } = await setup(() => 0);
  const op = { action:'upgrade', uid:a, opId:'op-upgrade-1' };
  await Promise.all([game.upgrade(ME, op), game.upgrade(ME, op)]);
  let inv = (await game.state(ME)).inventory;
  assert.equal(count(inv, FEATHER), 30 - 6); assert.equal(inv.slots.find(s => s?.uid === a).plus, 1);   // +1 = 6 plumes, payé une seule fois (26/10)
  await game.stuff(ME, { action:'equip', slot:'pioche', uid:b, opId:'op-equip-01' });
  await assert.rejects(game.upgrade(ME, { action:'upgrade', uid:b, opId:'op-upgrade-2' }), { code:'not_owned' });
});

test('session : les caractéristiques viennent de la pièce portée, revérifiée (lignes trafiquées ignorées)', async () => {
  const { game, store, uids:[a, b] } = await setup(() => 0);
  await game.upgrade(ME, { action:'upgrade', uid:a, opId:'op-upgrade-s' });                  // +1
  await game.stuff(ME, { action:'equip', slot:'pioche', uid:a, opId:'op-equip-s1' });
  const st = await store.getStuff(ME.id);
  st.worn.pioche.q = 1; st.worn.pioche.lines = [{ stat:'mineSpeed', pct:99 }];                  // trafiqué dans la base
  await store.putInventoryAndStuff(ME.id, await store.getInventory(ME.id), st);
  await game.start(ME, {});
  const [rec] = await store.sessionsOf(ME.id);
  assert.deepEqual(rec.gear[ME.id].pioche, { item:PICK, uid:a, plus:1 });
});
