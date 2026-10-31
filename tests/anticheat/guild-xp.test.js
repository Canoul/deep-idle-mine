/* Guilde, anti-triche : l'XP n'est transmise qu'une fois, seulement quand le joueur vient de la recevoir (server/game/service.js). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { createGuildService } from '../../server/guild/service.js';
import { createInlineRunner } from '../../server/game/live.js';
import { GAME, DT, PRISON } from '../../src/config.js';
import { realDurationMs } from '../../src/shared/game.js';
import { runRecord, buildPrisonRun, sanitizePrison } from '../../src/shared/prison.js';
import { tickPrison } from '../../src/sim/prison.js';
import { fakeLive } from '../helpers.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };
const T0 = Date.UTC(2026, 9, 29, 12, 0);

function server({ dev = false, onXp, xp = 900 } = {}){
  let now = 1_000_000;
  const store = createMemoryGameStore(), calls = [];
  const live = fakeLive(rec => ({ id:rec.id, chest:{}, xp, shares:rec.players.map(p => ({ account:p.account, left:false, bag:{}, xp })) }));
  const game = createGameService({ store, liveRunner:live, clock:() => now, dev, randomSeed:() => 1,
    onXp:onXp ?? (async (id, n) => { calls.push([id, n]); }) });
  const play = async () => { await game.start(ME, {}); now += realDurationMs(); await game.pump(); };
  return { game, store, calls, play };
}

test('fin de session : onXp reçoit la part du joueur, une fois', async () => {
  const { game, calls, play } = server();
  await play();
  await game.pump();
  assert.deepEqual(calls, [[ME.id, 900]]);
});

test('session rejouée : pas de second onXp', async () => {
  const { game, store, calls, play } = server();
  await play();
  const pr = await store.getProgress(ME.id), id = pr.credited[0];
  assert.ok(id);
  await game.recover();
  await game.pump();
  assert.equal(calls.length, 1);
});

test('session de développement : pas de onXp', async () => {
  const { calls, play } = server({ dev:true });
  await play();
  assert.deepEqual(calls, []);
});

test('session sans XP : pas de onXp', async () => {
  const { calls, play } = server({ xp:0 });
  await play();
  assert.deepEqual(calls, []);
});

test('onXp qui échoue : la session se termine et le joueur est crédité', async () => {
  const { store, play } = server({ onXp:async () => { throw new Error('panne'); } });
  const err = console.error; console.error = () => {};
  try { await play(); } finally { console.error = err; }
  assert.equal((await store.getProgress(ME.id)).xp, 900);
  const sync = server({ onXp:() => { throw new Error('panne'); } });
  console.error = () => {};
  try { await sync.play(); } finally { console.error = err; }
  assert.equal((await sync.store.getProgress(ME.id)).xp, 900);
});

test('joueur parti de sa guilde avant la fin : aucune guilde créditée', async () => {
  const store = createMemoryGameStore();
  const guild = createGuildService({ store, accounts:{ getAccount:async () => ME, findAccountByName:async () => null }, statusOf:async () => ({ status:'offline' }) });
  await guild.create(ME, 'Les Rois');
  const other = { id:'BBBB2222', name:'Max', guest:false };
  await guild.addXp(ME.id, 100);
  await guild.leave(ME);
  await guild.addXp(ME.id, 100000);
  assert.deepEqual((await guild.list(other, '')).guilds, []);
  assert.equal((await guild.create(ME, 'Les Nains')).mine.xp, 0);
});

test('run de prison : onXp une fois, même rejoué après un redémarrage', async () => {
  const store = createMemoryGameStore(), t = { now:T0 }, calls = [];
  const service = () => createGameService({ store, liveRunner:opts => createInlineRunner(opts), clock:() => t.now, randomSeed:() => 4242, onXp:async (id, n) => { calls.push([id, n]); } });
  const g1 = service();
  await g1.prisonStart(ME);
  const before = await store.getPrison(ME.id), p = sanitizePrison(before);
  const G = buildPrisonRun(runRecord(p));
  while(!G.over) tickPrison(G);
  t.now = Math.max(p.runStartedAt + Math.ceil(G.ticks * DT / GAME.speed * 1000) + 1, before.lastSeenAt + PRISON.batchMs);
  await g1.pump();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], (await store.getProgress(ME.id)).xp);
  g1.close();
  await store.putPrison(ME.id, before);
  await service().pump();
  assert.equal(calls.length, 1);
});
