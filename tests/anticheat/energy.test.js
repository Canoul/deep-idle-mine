/* Anti-triche de l'énergie (29/10/2026) : un double clic ou deux onglets ne coûtent qu'un seul lancement ; une demande
   refusée ne débite rien. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENERGY } from '../../src/config.js';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { fakeLive } from '../helpers.js';

const A = { id: 'AAAA1111', name: 'Zoe' };
const setup = () => {
  const store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner: fakeLive(() => ({ shares: [] })), clock: () => 5_000_000, randomSeed: () => 7,
                                   config: { startsPerHour: 1000, keepEnded: 1e12 } });
  return { store, game };
};

test('deux lancements simultanés : une seule session, un seul débit', async () => {
  const { store, game } = setup();
  const res = await Promise.allSettled([game.start(A, {}), game.start(A, {})]);
  assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(res.find(r => r.status === 'rejected').reason.code, 'session_running');
  const id = res.find(r => r.status === 'fulfilled').value.session.id;
  const cost = (await store.getGameSession(id)).energy[A.id];
  assert.equal((await game.state(A)).energy.value, ENERGY.start - cost);
  assert.equal((await store.getEnergy(A.id)).keys.length, 1);
});

test('lancement refusé (session déjà en cours, clé manquante) : rien de débité', async () => {
  const { store, game } = setup();
  await game.start(A, {});
  const after = (await store.getEnergy(A.id)).value;
  await assert.rejects(game.start(A, {}), { code: 'session_running' });
  await assert.rejects(game.start(A, { mode: 'instance_1' }), e => ['session_running', 'no_key'].includes(e.code));
  assert.equal((await store.getEnergy(A.id)).value, after);
  const fresh = setup();
  await assert.rejects(fresh.game.start(A, { mode: 'instance_1' }), { code: 'no_key' });
  assert.equal(await fresh.store.getEnergy(A.id), null, 'aucune énergie écrite');
});
