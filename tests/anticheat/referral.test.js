/* Anti-triche du parrainage (05/11/2026) : codes trafiqués refusés, pas de récompense sans le niveau, jamais deux fois, même
   avec des demandes en même temps ; un filleul ne change jamais de parrain ; le serveur seul décide de la récompense. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REFERRAL } from '../../src/config.js';
import { xpForLevel } from '../../src/meta/level.js';

async function setup(){
  const { createMemoryGameStore } = await import('../../server/game/store.js');
  const { createGameService } = await import('../../server/game/service.js');
  const { fakeLive } = await import('../helpers.js');
  const store = createMemoryGameStore();
  const t = REFERRAL.legacyBefore + 1000;
  const acc = Object.fromEntries(['AAAA1111', 'BBBB2222', 'CCCC3333'].map((id, i) => [id, { id, name: 'P' + i, nameKey: 'p' + i, createdAt: t }]));
  const game = createGameService({ store, liveRunner: fakeLive(r => ({ id: r.id, shares: [] })), clock: () => t, randomSeed: () => 1,
    accountOf: async id => acc[id] ?? null, accountByName: async () => null });
  const gems = async id => ((await store.getInventory(id))?.slots ?? []).filter(x => x?.item === REFERRAL.item).reduce((n, x) => n + x.qty, 0);
  return { store, game, gems, me: id => ({ id, name: acc[id].name }) };
}

test('codes trafiqués : refusés, rien d\'enregistré', async () => {
  const { game, store, me } = await setup();
  for(const code of [null, 42, {}, [], 'AAAA111', 'AAAA11111', '__proto__', 'AAAA111$', '../AAAA1111', 'ZZZZZZZZ', 'BBBB2222'])
    await assert.rejects(game.setReferral(me('BBBB2222'), { code }));
  await assert.rejects(game.setReferral(me('BBBB2222'), null));
  assert.equal(await store.getReferral('BBBB2222'), null);
});

test('pas de récompense sans le niveau ; jamais deux fois, même en rafale ; pas de changement de parrain après', async () => {
  const { game, store, gems, me } = await setup();
  await game.setReferral(me('BBBB2222'), { code: 'AAAA1111' });
  for(let i = 0; i < 5; i++) await game.state(me('BBBB2222'));
  assert.equal(await gems('BBBB2222'), 0);
  await store.putProgress('BBBB2222', { xp: xpForLevel(REFERRAL.level), credited: [] });
  await Promise.all(Array.from({ length: 20 }, (_, i) => i % 2 ? game.state(me('BBBB2222')) : game.referral(me('BBBB2222'))));
  assert.deepEqual([await gems('BBBB2222'), await gems('AAAA1111')], [REFERRAL.qty, REFERRAL.qty]);
  await assert.rejects(game.setReferral(me('BBBB2222'), { code: 'CCCC3333' }));
  assert.equal(await gems('CCCC3333'), 0);
  await game.state(me('BBBB2222'));
  assert.deepEqual([await gems('BBBB2222'), await gems('AAAA1111')], [REFERRAL.qty, REFERRAL.qty]);
});

test('deux codes envoyés en même temps : un seul parrain', async () => {
  const { game, store, me } = await setup();
  const r = await Promise.allSettled([game.setReferral(me('CCCC3333'), { code: 'AAAA1111' }), game.setReferral(me('CCCC3333'), { code: 'BBBB2222' })]);
  assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
  assert.ok(['AAAA1111', 'BBBB2222'].includes((await store.getReferral('CCCC3333')).by));
});
