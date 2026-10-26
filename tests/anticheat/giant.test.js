/* Anti-triche du Bloc géant : récompense versée une seule fois (demandes simultanées, rejouées), jamais sans visite ;
   une entrée comptée une seule fois (demandes simultanées) ; points négatifs ou faux dans le stockage ignorés. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { createGiantService } from '../../server/giant/service.js';
import { GAME } from '../../src/config.js';
import { dayEnd, visitDurationMs } from '../../src/shared/giant.js';
import { countOf, deserialize } from '../../src/meta/inventory.js';
import { fakeLive } from '../helpers.js';

const A = { id:'AAAA1111', name:'Zoe' }, B = { id:'BBBB2222', name:'Max' };
const VISIT = visitDurationMs(GAME.speed);
const fakeSummary = rec => ({ id:rec.id, shares: rec.players.map(p => ({ account:p.account, left:false, bag:{} })) });
function setup(){
  const clock = { now: Date.UTC(2026, 9, 26, 9, 0) }, store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner:fakeLive(fakeSummary), clock: () => clock.now, randomSeed:() => 7 });
  const giant = createGiantService({ store, game, clock: () => clock.now, randomSeed: () => 7 });
  const advance = async ms => { const end = clock.now + ms; while(clock.now < end){ clock.now = Math.min(end, clock.now + 1000); await giant.pump(); } };
  return { store, game, giant, clock, advance };
}
const count = async (store, id, item) => countOf(deserialize(JSON.stringify(await store.getInventory(id) ?? { v:1, slots:[] })), item);

test('récompense : 5 demandes en même temps → versée une seule fois', async () => {
  const { store, giant, clock, advance } = setup();
  await giant.enter(A); await advance(VISIT + 1000);
  const d = await store.getGiantDay('2026-10-26'); d.total = 20000;
  await store.putGiantDayAndPlayer(d, A.id, await store.getGiantPlayer(A.id));
  clock.now = dayEnd(clock.now) + VISIT + 1;
  const all = await Promise.all(Array.from({ length: 5 }, () => giant.claim(A)));
  assert.equal(all.filter(r => Object.keys(r.given).length).length, 1);
  assert.equal(await count(store, A.id, 'Treasure T3'), 1);
  assert.equal(await count(store, A.id, 'Treasure T1'), 2);
});

test('récompense : jamais sans visite, même si le compte est inscrit à la main dans claimed d\'un autre jour', async () => {
  const { store, giant, clock, advance } = setup();
  await giant.enter(A); await advance(VISIT + 1000);
  const d = await store.getGiantDay('2026-10-26'); d.total = 10000;
  await store.putGiantDayAndPlayer(d, A.id, await store.getGiantPlayer(A.id));
  clock.now = dayEnd(clock.now) + VISIT + 1;
  assert.deepEqual((await giant.claim(B)).given, {});
  assert.equal(await store.getInventory(B.id), null);
});

test('entrée : 5 demandes en même temps → une visite, une seule entrée comptée', async () => {
  const { store, giant } = setup();
  const res = await Promise.allSettled(Array.from({ length: 5 }, () => giant.enter(A)));
  assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await store.getGiantDay('2026-10-26')).scores[A.id].visits, 1);
  assert.equal((await giant.info(A)).present, 1);
});

test('points : une fin de visite rejouée ou des points faux dans le stockage ne comptent pas', async () => {
  const { store, giant, advance } = setup();
  await giant.enter(A);
  const p = await store.getGiantPlayer(A.id);
  p.visit.points = -1e9;                                    // trafiqué : le point d'étape suivant le remplace
  await store.putGiantPlayer(A.id, p);
  await advance(VISIT + 1000);
  const total = (await store.getGiantDay('2026-10-26')).total;
  assert.ok(total > 100 && total < 200, `${total}`);
  await advance(VISIT);                                     // rien de plus après la fin
  assert.equal((await store.getGiantDay('2026-10-26')).total, total);
});
