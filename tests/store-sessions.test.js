/* Lecture des sessions d'un joueur (04/11/2026 : copier tout son historique à chaque vue du Social saturait le
   serveur) : keep trie avant la copie, lastEndOf ne copie rien. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../server/game/store.js';

const rec = (id, status, startedAt, endedAt, account = 'A1') => ({ id, status, startedAt, endedAt, players: [{ account }], leaves: [] });

async function setup(){
  const store = createMemoryGameStore();
  for(const r of [rec('d1', 'done', 1, 10), rec('d2', 'done', 2, 30), rec('r1', 'running', 3, undefined), rec('x', 'done', 4, 99, 'B2')])
    await store.putGameSession(r);
  return store;
}

test('sessionsOf : sans keep, toutes ses sessions, les plus récentes d\'abord', async () => {
  const store = await setup();
  assert.deepEqual((await store.sessionsOf('A1')).map(s => s.id), ['r1', 'd2', 'd1']);
});

test('sessionsOf : keep ne garde que les sessions voulues, et ce sont des copies', async () => {
  const store = await setup();
  const list = await store.sessionsOf('A1', s => s.status === 'running');
  assert.deepEqual(list.map(s => s.id), ['r1']);
  list[0].status = 'done';
  assert.equal((await store.sessionsOf('A1', s => s.status === 'running')).length, 1);   // l'original n'a pas bougé
});

test('sessionsOf : keep est appliqué avant la copie (les sessions écartées ne sont pas copiées)', async () => {
  const store = await setup();
  const seen = [];
  const orig = globalThis.structuredClone;
  globalThis.structuredClone = o => { seen.push(o.id); return orig(o); };
  try { await store.sessionsOf('A1', s => s.status === 'running'); } finally { globalThis.structuredClone = orig; }
  assert.deepEqual(seen, ['r1']);
});

test('lastEndOf : fin la plus récente de ses sessions, 0 sans session, keep respecté', async () => {
  const store = await setup();
  assert.equal(await store.lastEndOf('A1'), 30);
  assert.equal(await store.lastEndOf('A1', s => s.id === 'd1'), 10);
  assert.equal(await store.lastEndOf('ZZ'), 0);
});
