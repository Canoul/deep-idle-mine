/* Anti-duplication du recyclage (25/10/2026) : une pièce ne se recycle qu'une fois, même en rafale ; jamais une pièce
   portée ni une pièce d'un set ; jamais plus que 60 % de la recette. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { fakeLive } from '../helpers.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };
const setup = () => createGameService({ store: createMemoryGameStore(), liveRunner: fakeLive(() => ({ shares:[] })), clock: () => 1_000_000,
                                         dev:false, config:{ startsPerHour:1000, keepEnded:1e12, maxLive:2 } });
const count = (inv, item) => inv.slots.reduce((n, s) => n + (s?.item === item ? s.qty : 0), 0);
const uidOf = (inv, item) => inv.slots.find(s => s?.item === item)?.uid;

test('recycler en rafale (double clic, onglets) : une seule fois', async () => {
  const game = setup();
  await game.adminGive(ME.id, 'Pioche en pierre', 1);
  const uid = uidOf((await game.state(ME)).inventory, 'Pioche en pierre');
  const res = await Promise.allSettled(Array.from({ length:8 }, () => game.recycle(ME, { uid })));
  assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
  assert.ok(res.filter(r => r.status === 'rejected').every(r => r.reason.code === 'not_owned'));
  const inv = (await game.state(ME)).inventory;
  assert.equal(count(inv, 'Lingot de fer'), 18);
  assert.equal(count(inv, 'Pioche en pierre'), 0);
});

test('recycler : ni une pièce portée, ni une pièce d\'un set, ni un objet non recyclable, ni un uid trafiqué', async () => {
  const game = setup();
  await game.adminGive(ME.id, 'Épée en fer', 2); await game.adminGive(ME.id, 'Rune', 1).catch(() => {});
  let inv = (await game.state(ME)).inventory;
  const [a, b] = inv.slots.filter(s => s?.item === 'Épée en fer').map(s => s.uid);
  await game.stuff(ME, { action:'equip', slot:'epee', uid:a, opId:'equip-0001' });
  await assert.rejects(game.recycle(ME, { uid:a }), { code:'not_owned' });               // portée : pas dans l'inventaire
  await game.sets(ME, { action:'create', opId:'set-create-01' });                         // le set retient l'épée a
  await game.stuff(ME, { action:'unequip', slot:'epee', opId:'unequip-0001' });
  await assert.rejects(game.recycle(ME, { uid:a }), { code:'in_set' });
  for(const bad of ['1', 1.5, -0.5, Infinity, null, {}, [a]]) await assert.rejects(game.recycle(ME, { uid:bad }), { code:'bad_request' });
  await assert.rejects(game.recycle(ME, { uid:999999 }), { code:'not_owned' });
  const rune = uidOf((await game.state(ME)).inventory, 'Rune');
  if(rune != null) await assert.rejects(game.recycle(ME, { uid:rune }), { code:'not_recyclable' });
  inv = (await game.state(ME)).inventory;
  assert.equal(count(inv, 'Épée en fer'), 2); assert.equal(count(inv, 'Tainted iron'), 0);
  const r = await game.recycle(ME, { uid:b });                                            // la seconde, hors set : oui
  assert.deepEqual(r.refund, { 'Tainted iron':6 });
});
