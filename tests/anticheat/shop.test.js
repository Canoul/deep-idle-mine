/* Anti-triche de la Boutique (05/11/2026) : aucune suite d'achats (rejoués, trafiqués) ne crée d'émeraude ni de coffre ;
   chaque coffre a coûté son prix ; le serveur refuse les demandes invalides sans rien toucher. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/core/rng.js';
import { createInventory, addAll, countOf, serialize, deserialize } from '../../src/meta/inventory.js';
import { buy } from '../../src/meta/shop.js';
import { SHOP } from '../../src/config.js';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { fakeLive } from '../helpers.js';

const EM = SHOP.currency, CHEST = 'Coffre affilié', PRICE = SHOP.items.find(o => o.id === 'affilie').price;

test('400 suites d\'achats au hasard : émeraudes + prix × coffres = départ, demandes rejouées sans effet', () => {
  const r = mulberry32(11);
  const counts = [1, 2, 0, -1, 1.5, '1', null, 1e9, NaN, Infinity, SHOP.maxCount + 1];
  const ids = ['affilie', 'affilie', 'inconnu', '__proto__', null, 42];
  for(let t = 0; t < 400; t++){
    let inv = createInventory(); const start = Math.floor(r() * 120); if(start) addAll(inv, { [EM]: start });
    const ops = [];
    for(let k = 0; k < 20; k++){
      const opId = ops.length && r() < 0.3 ? ops[Math.floor(r() * ops.length)] : `op-${t}-${k}`;
      ops.push(opId);
      buy(inv, { id: ids[Math.floor(r() * ids.length)], count: counts[Math.floor(r() * counts.length)], opId });
      if(r() < 0.2) inv = deserialize(serialize(inv));
    }
    assert.equal(countOf(inv, EM) + PRICE * countOf(inv, CHEST), start, `essai ${t}`);
    assert.ok(countOf(inv, EM) >= 0);
  }
});

test('serveur : achat, rejeu, pas assez, article ou quantité invalides', async () => {
  const store = createMemoryGameStore();
  const game = createGameService({ store, dev: false, liveRunner: fakeLive(rec => ({ id: rec.id, shares: [] })) });
  const me = { id: 'AAAA1111', name: 'Zoe' };
  await game.adminGive?.(me.id, EM, 50);
  if(!game.adminGive){ const inv = createInventory(); addAll(inv, { [EM]: 50 }); await store.putInventory(me.id, JSON.parse(serialize(inv))); }
  const n = async item => countOf(deserialize(JSON.stringify(await store.getInventory(me.id))), item);
  const r1 = await game.shop(me, { id: 'affilie', opId: 'achat-0001' });
  assert.equal(r1.count, 1);
  assert.deepEqual([await n(EM), await n(CHEST)], [50 - PRICE, 1]);
  await game.shop(me, { id: 'affilie', opId: 'achat-0001' });                 // double clic : rien de plus
  assert.deepEqual([await n(EM), await n(CHEST)], [50 - PRICE, 1]);
  await game.shop(me, { id: 'affilie', opId: 'achat-0002' });
  await assert.rejects(game.shop(me, { id: 'affilie', opId: 'achat-0003' }), { code: 'not_enough' });
  for(const bad of [{ id: 'inconnu', opId: 'achat-0004' }, { id: 'affilie', count: 0, opId: 'achat-0005' }, { id: 'affilie', count: 1.5, opId: 'achat-0006' },
                    { id: 'affilie', opId: 'x' }, { id: 42, opId: 'achat-0007' }])
    await assert.rejects(game.shop(me, bad));
  assert.deepEqual([await n(EM), await n(CHEST)], [50 - 2 * PRICE, 2]);
});
