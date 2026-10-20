/* Anti-triche de l'XP : une session n'est versée qu'une fois, même si la fin est signalée plusieurs fois ;
   un joueur parti ne reçoit pas d'XP ; une part invalide (bug ou triche) ne change rien. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { fakeLive } from '../helpers.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };

function setup(xpOf = () => 700){
  const store = createMemoryGameStore();
  const live = fakeLive(rec => ({ id:rec.id, chest:{}, shares: rec.players.map(p => {
    const left = rec.leaves.some(l => l.account === p.account);
    return { account:p.account, left, bag:{}, xp: left ? 0 : xpOf() };
  }) }));
  const game = createGameService({ store, liveRunner: live, dev:true, randomSeed: () => 1 });
  return { game, store };
}

test('fin signalée trois fois en même temps : XP versée une seule fois', async () => {
  const { game } = setup();
  await game.start(ME, {});
  await Promise.all([game.finish(ME), game.finish(ME), game.finish(ME)].map(p => p.catch(() => {})));
  assert.equal((await game.state(ME)).progress.xp, 700);
});

test('quitter avant la fin : aucune XP', async () => {
  const { game } = setup();
  await game.start(ME, { bots:1 });
  await game.leave(ME, {});
  assert.equal((await game.state(ME)).progress.xp, 0);
});

test('part d\'XP invalide dans le résumé : rien n\'est versé', async () => {
  for(const bad of [-50, 1.5, NaN, Infinity, '700', null]){
    const { game } = setup(() => bad);
    await game.start(ME, {});
    await game.finish(ME).catch(() => {});
    assert.equal((await game.state(ME)).progress.xp, 0, String(bad));
  }
});

test('progression stockée abîmée : relue comme 0, sans planter', async () => {
  const { game, store } = setup();
  await store.putProgress(ME.id, { xp:'beaucoup', credited:{} });
  assert.equal((await game.state(ME)).progress.xp, 0);
});
