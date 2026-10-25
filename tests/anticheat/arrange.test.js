/* Anti-duplication du rangement de l'inventaire (25/10/2026) : trier et déplacer ne créent ni ne retirent rien, même
   envoyés en rafale, rejoués ou trafiqués ; le serveur vérifie l'objet attendu à la place de départ. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/core/rng.js';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { fakeLive } from '../helpers.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };
function setup(){
  const store = createMemoryGameStore();
  return createGameService({ store, liveRunner: fakeLive(() => ({ shares:[] })), clock: () => 1_000_000, dev:false, config:{ startsPerHour:1000, keepEnded:1e12, maxLive:2 } });
}
const totals = inv => { const t = {}; for(const s of inv.slots) if(s) t[s.uid ? `${s.item}#${s.uid}` : s.item] = (t[s.uid ? `${s.item}#${s.uid}` : s.item] ?? 0) + s.qty; return t; };
const BAD = [-1, 1.5, NaN, Infinity, '2', null, undefined, {}, [], 1e9];

test('ranger : 300 demandes au hasard (en rafale, rejouées, trafiquées) → mêmes objets, mêmes quantités', async () => {
  const game = setup(), r = mulberry32(77);
  for(const [item, qty] of [['Fer', 40], ['Terre', 300], ['Épée en fer', 3], ['Tissu sombre', 2], ['Treasure T1', 1], ['Charbon', 12]])
    await game.adminGive(ME.id, item, qty);
  const before = totals((await game.state(ME)).inventory);
  const pick = a => a[Math.floor(r() * a.length)];
  for(let k = 0; k < 30; k++){
    const inv = (await game.state(ME)).inventory, full = inv.slots.map((s, i) => [s, i]).filter(([s]) => s);
    const reqs = [];
    for(let n = 0; n < 10; n++){
      const [s, i] = pick(full);
      const op = r() < 0.15 ? { action:'sort' }
        : { action:'move', from: r() < 0.85 ? i : pick(BAD), to: r() < 0.85 ? Math.floor(r() * 48) : pick(BAD), item: r() < 0.9 ? s.item : 'Diamant', uid: s.uid };
      reqs.push(game.inventory(ME, op).catch(e => { assert.ok([400, 409].includes(e.status), e.message); }));
    }
    await Promise.all(reqs);
  }
  assert.deepEqual(totals((await game.state(ME)).inventory), before);
});

test('ranger : action inconnue refusée', async () => {
  const game = setup();
  await assert.rejects(game.inventory(ME, { action:'dupe' }), { code:'bad_request' });
});
