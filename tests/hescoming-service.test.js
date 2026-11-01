/* He's coming (serveur) : le service du Bloc géant, avec sa propre journée, son propre délai et sa propre récompense. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createGiantService } from '../server/giant/service.js';
import { giantRoutes } from '../server/giant/routes.js';
import { GAME, GIANT, HES_COMING as HC, MINE_MODES } from '../src/config.js';
import { luciferSim } from '../src/shared/giant-room.js';
import { dayEnd, visitDurationMs } from '../src/shared/giant.js';
import { countOf, deserialize } from '../src/meta/inventory.js';
import { fakeLive } from './helpers.js';

const A = { id:'AAAA1111', name:'Zoe' }, B = { id:'BBBB2222', name:'Max' };
const VISIT = visitDurationMs(GAME.speed), H = 3600e3;

function setup({ store = createMemoryGameStore(), config = HC } = {}){
  const clock = { now:Date.UTC(2026, 10, 1, 9, 0) };
  const game = createGameService({ store, liveRunner:fakeLive(rec => ({ id:rec.id, shares:[] })), clock:() => clock.now, randomSeed:() => 7 });
  const giant = createGiantService({ store, game, clock:() => clock.now, randomSeed:() => 7 });
  const make = () => createGiantService({ store, game, clock:() => clock.now, config, sim:luciferSim, key:'Hc', mode:'hescoming', place:'Lucifer', randomSeed:() => 7 });
  const hc = make();
  const advance = async (ms, svc = hc) => { const end = clock.now + ms; while(clock.now < end){ clock.now = Math.min(end, clock.now + 1000); await svc.pump(); await (svc === hc ? giant : hc).pump(); } };
  return { store, game, giant, hc, make, clock, advance };
}
const inv = async (store, id) => deserialize(JSON.stringify(await store.getInventory(id) ?? { v:1, slots:[] }));

test('menu : He\'s coming s\'entre comme le Bloc géant', () => {
  assert.ok(MINE_MODES.find(m => m.id === 'hescoming')?.giant);
});

test('une visite : les dégâts deviennent des points du jour', async () => {
  const { hc, advance, store } = setup();
  const r = await hc.enter(A);
  assert.equal(r.view.miners.length, 1);
  await advance(VISIT + 1000);
  const i = await hc.info(A);
  assert.equal(i.visit, null);
  assert.ok(i.total > 0);
  assert.equal(i.mine.visits, 1);
  assert.equal((await store.getHcDay(i.day)).total, i.total);
  assert.equal(await store.getGiantDay(i.day), null, 'rien dans le Bloc géant');
});

test('indépendant du Bloc géant : les deux entrées, deux délais, deux scores', async () => {
  const { hc, giant, advance } = setup();
  await hc.enter(A); await giant.enter(A);
  assert.ok((await hc.info(A)).visit && (await giant.info(A)).visit);
  await advance(VISIT + 1000);
  await assert.rejects(hc.enter(A), { code:'cooldown' });
  await assert.rejects(giant.enter(A), { code:'cooldown' });
  const a = await hc.info(A), b = await giant.info(A);
  assert.notEqual(a.total, b.total);
});

test('la vue dit le rugissement et l\'autoattaque, et le DPS', async () => {
  const { hc, advance } = setup();
  await hc.enter(A);
  await advance(HC.roar.every * 1000 / GAME.speed + 1000);
  const v = await hc.view(A);
  assert.ok(v.boss.roarAgo >= 0);
  assert.ok(v.boss.swingAgo >= 0);
  assert.ok(v.me.rate > 0);
  assert.ok(v.miners[0].effects.some(e => e.id === 'fear'));
});

test('visite en cours : réponse « déjà là », mode propre pour les amis', async () => {
  const { hc, advance } = setup();
  await hc.enter(A);
  await assert.rejects(hc.enter(A), { code:'in_visit' });
  assert.equal((await hc.busy(A.id)).mode, 'hescoming');
  await hc.leave(A);
  await assert.rejects(hc.leave(A), { code:'no_visit' });
  await advance(1000);
});

test('redémarrage : la visite reprend, sans perdre de temps ni être comptée deux fois', async () => {
  const s = setup();
  await s.hc.enter(A);
  await s.advance(VISIT / 2);
  const again = s.make();
  await s.advance(VISIT / 2 + 1000, again);
  const i = await again.info(A);
  assert.equal(i.visit, null);
  assert.equal(i.mine.visits, 1);
  assert.ok(i.total > 0);
});

test('récompense : deux visites, paliers × 8, pépites par 800 points, une seule fois', async () => {
  const config = { ...HC, tiers:[{ min:1, items:{ 'Treasure T1':1 } }], nugget:{ ...HC.nugget, per:1 } };
  const { hc, advance, clock, store } = setup({ config });
  await hc.enter(A); await advance(VISIT + 1000);
  clock.now += GIANT.cooldownMs;
  await hc.enter(A); await advance(VISIT + 1000);
  clock.now = dayEnd(clock.now) + VISIT + 1000;
  const r = await hc.claim(A);
  assert.equal(r.days.length, 1);
  assert.equal(countOf(await inv(store, A.id), 'Treasure T1'), 1);
  const again = await hc.claim(A);
  assert.deepEqual(again.given, {});
  assert.equal(countOf(await inv(store, A.id), 'Treasure T1'), 1);
  assert.deepEqual((await hc.info(A)).rewards, []);
});

test('une seule visite : pas de récompense', async () => {
  const config = { ...HC, tiers:[{ min:1, items:{ 'Treasure T1':1 } }] };
  const { hc, advance, clock } = setup({ config });
  await hc.enter(A); await advance(VISIT + 1000);
  clock.now = dayEnd(clock.now) + VISIT + 1000;
  assert.deepEqual((await hc.claim(A)).given, {});
});

test('réclamer au Bloc géant ne touche pas à He\'s coming', async () => {
  const config = { ...HC, tiers:[{ min:1, items:{ 'Treasure T1':1 } }] };
  const { hc, giant, advance, clock, store } = setup({ config });
  await hc.enter(A); await advance(VISIT + 1000);
  clock.now += GIANT.cooldownMs;
  await hc.enter(A); await advance(VISIT + 1000);
  clock.now = dayEnd(clock.now) + VISIT + 1000;
  await giant.claim(A);
  assert.equal(countOf(await inv(store, A.id), 'Treasure T1'), 0);
  assert.equal((await hc.claim(A)).days.length, 1);
  assert.equal((await store.getGiantPlayer(A.id))?.claimed?.length ?? 0, 0);
});

test('routes : /api/hescoming/…', () => {
  const r = giantRoutes({}, '/api/hescoming');
  assert.deepEqual(Object.keys(r).sort(), ['GET /api/hescoming', 'GET /api/hescoming/view', 'POST /api/hescoming/claim', 'POST /api/hescoming/enter', 'POST /api/hescoming/leave']);
});

test('sauvegarde : journée et joueur repris par un nouveau stockage', async () => {
  const store = createMemoryGameStore();
  await store.putHcDayAndPlayer({ day:'2026-11-01', total:5, scores:{} }, A.id, { lastEntry:1, visit:null, claimed:[] });
  const again = createMemoryGameStore(store.snapshot?.() ?? {});
  if(store.snapshot) assert.equal((await again.getHcDay('2026-11-01')).total, 5);
  assert.equal((await store.listHcPlayers()).length, 1);
});
