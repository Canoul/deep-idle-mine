/* He's coming : anti-triche. La récompense se réclame une seule fois, y compris en parallèle ; le navigateur ne décide d'aucun point ;
   une visite ne peut pas être rejouée ; rien ne passe d'un mode à l'autre. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { createGiantService } from '../../server/giant/service.js';
import { GAME, GIANT, HES_COMING as HC } from '../../src/config.js';
import { luciferSim } from '../../src/shared/giant-room.js';
import { dayEnd, visitDurationMs } from '../../src/shared/giant.js';
import { countOf, deserialize } from '../../src/meta/inventory.js';
import { fakeLive } from '../helpers.js';

const A = { id:'AAAA1111', name:'Zoe' }, VISIT = visitDurationMs(GAME.speed);
const ONE = { ...HC, tiers:[{ min:1, items:{ 'Treasure T1':1 } }], nugget:{ ...HC.nugget, per:1e12 } };

function setup(){
  const store = createMemoryGameStore(), clock = { now:Date.UTC(2026, 10, 1, 9, 0) };
  const game = createGameService({ store, liveRunner:fakeLive(rec => ({ id:rec.id, shares:[] })), clock:() => clock.now, randomSeed:() => 7 });
  const hc = createGiantService({ store, game, clock:() => clock.now, config:ONE, sim:luciferSim, key:'Hc', mode:'hescoming', place:'Lucifer', randomSeed:() => 7 });
  const advance = async ms => { const end = clock.now + ms; while(clock.now < end){ clock.now = Math.min(end, clock.now + 1000); await hc.pump(); } };
  return { store, hc, clock, advance };
}
const treasures = async (store, id) => countOf(deserialize(JSON.stringify(await store.getInventory(id) ?? { v:1, slots:[] })), 'Treasure T1');
async function twoVisits({ hc, advance, clock }){
  await hc.enter(A); await advance(VISIT + 1000);
  clock.now += GIANT.cooldownMs;
  await hc.enter(A); await advance(VISIT + 1000);
  clock.now = dayEnd(clock.now) + VISIT + 1000;
}

test('réclamer dix fois en parallèle : une seule récompense', async () => {
  const s = setup();
  await twoVisits(s);
  await Promise.all(Array.from({ length:10 }, () => s.hc.claim(A)));
  assert.equal(await treasures(s.store, A.id), 1);
});

test('entrer deux fois en parallèle : une seule visite comptée', async () => {
  const s = setup();
  const r = await Promise.allSettled([s.hc.enter(A), s.hc.enter(A)]);
  assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal((await s.hc.info(A)).mine.visits, 1);
});

test('sortir deux fois : points comptés une fois', async () => {
  const s = setup();
  await s.hc.enter(A); await s.advance(VISIT / 2);
  await s.hc.leave(A);
  const a = (await s.hc.info(A)).total;
  await assert.rejects(s.hc.leave(A), { code:'no_visit' });
  assert.equal((await s.hc.info(A)).total, a);
});

test('sortir ne rend pas l\'entrée', async () => {
  const s = setup();
  await s.hc.enter(A);
  await s.hc.leave(A);
  await assert.rejects(s.hc.enter(A), { code:'cooldown' });
});

test('une récompense du Bloc géant ne se réclame pas ici', async () => {
  const s = setup();
  await s.store.putGiantDayAndPlayer({ day:'2026-10-31', total:1e9, scores:{ [A.id]:{ points:1e6, visits:9, name:'Zoe' } } }, A.id, { lastEntry:null, visit:null, claimed:[] });
  assert.deepEqual((await s.hc.claim(A)).given, {});
  assert.equal(await treasures(s.store, A.id), 0);
});
