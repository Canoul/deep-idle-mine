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
  await game.adminGive(ME.id, 'Épée en fer', 2); await game.adminGive(ME.id, 'Fer', 5);
  let inv = (await game.state(ME)).inventory;
  const [a, b] = inv.slots.filter(s => s?.item === 'Épée en fer').map(s => s.uid);
  await game.stuff(ME, { action:'equip', slot:'epee', uid:a, opId:'equip-0001' });
  await assert.rejects(game.recycle(ME, { uid:a }), { code:'not_owned' });               // portée : pas dans l'inventaire
  await game.sets(ME, { action:'create', opId:'set-create-01' });                         // le set retient l'épée a
  await game.stuff(ME, { action:'unequip', slot:'epee', opId:'unequip-0001' });
  await assert.rejects(game.recycle(ME, { uid:a }), { code:'in_set' });
  for(const bad of ['1', 1.5, -0.5, Infinity, null, {}, [a]]) await assert.rejects(game.recycle(ME, { uid:bad }), { code:'bad_request' });
  await assert.rejects(game.recycle(ME, { uid:999999 }), { code:'not_owned' });
  await game.adminGive(ME.id, 'Anneau du tigre', 1);                                      // un anneau ne se recycle pas
  const ring = uidOf((await game.state(ME)).inventory, 'Anneau du tigre');
  await assert.rejects(game.recycle(ME, { uid:ring }), { code:'not_recyclable' });
  inv = (await game.state(ME)).inventory;
  assert.equal(count(inv, 'Épée en fer'), 2); assert.equal(count(inv, 'Tainted iron'), 0);
  const r = await game.recycle(ME, { uid:b });                                            // la seconde, hors set : oui
  assert.deepEqual(r.refund, { 'Tainted iron':6 });
});

test('butin rare des mobs (26/10/2026) : recyclé une seule fois en rafale, quantités fixes', async () => {
  const game = setup();
  await game.adminGive(ME.id, 'Ceinture du Géant', 1);
  const uid = uidOf((await game.state(ME)).inventory, 'Ceinture du Géant');
  const res = await Promise.allSettled(Array.from({ length:8 }, () => game.recycle(ME, { uid })));
  assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
  const inv = (await game.state(ME)).inventory;
  assert.equal(count(inv, 'Chitine'), 50);
  assert.equal(count(inv, 'Steel ingot'), 5);
  assert.equal(count(inv, 'Ceinture du Géant'), 0);
});

test('rune (29/10/2026) : recyclée une seule fois en rafale, 8 à 12 Poudre de rêve tirées par le serveur', async () => {
  const game = setup();
  await game.adminGive(ME.id, 'Poudre de rêve', 100);
  await game.craft(ME, { item:'Rune', opId:'craft-rune-0100' });                          // une vraie rune (qualité, lignes)
  const uid = uidOf((await game.state(ME)).inventory, 'Rune');
  const res = await Promise.allSettled(Array.from({ length:8 }, () => game.recycle(ME, { uid })));
  assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
  assert.ok(res.filter(r => r.status === 'rejected').every(r => r.reason.code === 'not_owned'));
  const inv = (await game.state(ME)).inventory, n = count(inv, 'Poudre de rêve');
  assert.ok(n >= 8 && n <= 12, String(n));
  assert.equal(count(inv, 'Rune'), 0);
});

test('recette Rune (29/10/2026) : la même demande en rafale ne fabrique qu\'une rune ; qualité et lignes tirées par le serveur', async () => {
  const game = setup();
  await game.adminGive(ME.id, 'Poudre de rêve', 250);
  const res = await Promise.allSettled(Array.from({ length:8 }, () => game.craft(ME, { item:'Rune', opId:'craft-rune-0001' })));
  assert.ok(res.every(r => r.status === 'fulfilled'));
  const inv = (await game.state(ME)).inventory;
  assert.equal(count(inv, 'Poudre de rêve'), 150);
  assert.equal(count(inv, 'Rune'), 1);
  const piece = res.map(r => r.value.piece).find(Boolean);
  assert.ok(piece.q >= 1 && piece.q <= 7 && piece.lines.length >= 1);
  await game.craft(ME, { item:'Rune', opId:'craft-rune-0002' });                          // 150 → 50
  await assert.rejects(game.craft(ME, { item:'Rune', opId:'craft-rune-0003' }), { code:'not_enough' });
  assert.equal(count((await game.state(ME)).inventory, 'Poudre de rêve'), 50);
});
