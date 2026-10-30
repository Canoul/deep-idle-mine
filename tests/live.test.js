/* Parties en direct sur le serveur (server/game/live*.js) : une seule copie de la partie ; les choix s'appliquent au
   tick où ils arrivent ; la même seed + les choix enregistrés reconstruisent exactement la même partie (redémarrage). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLiveGame } from '../server/game/live-game.js';
import { createLiveRunner, createInlineRunner } from '../server/game/live.js';
import './helpers.js';   // énergie pleine au départ des tests (ENERGY.start, 30/10/2026)

const rec = (extra = {}) => ({ id:'S1', seed:1823878970, players:[{ account:'AAAA', name:'A' }, { account:'BBBB', name:'B' }],
  bots:0, prefs:{}, overrides:null, leaves:[], focus:[], ...extra });
const snap = G => JSON.stringify({ t:G.ticks, chest:G.chest, by:G.chestBy, stats:G.stats,
  miners:G.miners.map(m => [m.name, m.x, m.y, m.load, m.ox, m.prefs.focus]), mobs:G.mobs.map(o => [o.type, o.x, o.y, o.hp]) });

test('focus et départ en cours de partie : la reconstruction depuis l\'enregistrement donne la même partie', () => {
  const g = createLiveGame(rec());
  g.advance(1200);
  const f = g.focus('BBBB', { coal:'only' });
  g.advance(2500);
  const l = g.leave('AAAA');
  g.advance(4000);
  assert.deepEqual([f, l], [1200, 2500], 'chaque choix prend le tick où il arrive');
  const again = createLiveGame(rec({ focus:[{ account:'BBBB', tick:f, focus:{ coal:'only' } }], leaves:[{ account:'AAAA', tick:l }] }));
  again.advance(4000);
  assert.equal(snap(again.G), snap(g.G));
  assert.equal(g.G.miners.length, 1);
});

test('un fil d\'exécution par partie : même résultat que dans le fil principal', async () => {
  const runs = [createLiveRunner(), createInlineRunner()];
  const out = [];
  for(const run of runs){
    run.open(rec());
    await run.advance('S1', 600);
    const t = await run.focus('S1', 'AAAA', { area:0 });
    await run.advance('S1', 1500);
    out.push([t, run.tickOf('S1')]);
    run.closeAll();
  }
  assert.deepEqual(out[0], out[1]);
  assert.deepEqual(out[0], [600, 1500]);
});

test('fin : onEnd appelé une seule fois avec le résumé (tous les mineurs partis), la partie est fermée', async () => {
  for(const make of [createLiveRunner, createInlineRunner]){
    const ends = [];
    const run = make({ onEnd: (id, s) => ends.push([id, s.shares.length]) });
    run.open(rec());
    await run.advance('S1', 300);
    await run.leave('S1', 'AAAA');
    await run.leave('S1', 'BBBB');
    assert.deepEqual(ends, [['S1', 2]]);
    assert.equal(run.has('S1'), false);
  }
});

test('réglages dev : une partie n\'influence pas une autre (ni les valeurs du serveur)', async () => {
  const run = createLiveRunner();
  run.open(rec({ id:'X', overrides:{ STATS:{ pods:5 } } }));
  run.open(rec({ id:'Y' }));
  await Promise.all([run.advance('X', 2000), run.advance('Y', 2000)]);
  const { STATS } = await import('../src/config.js');
  assert.equal(STATS.pods, 200, 'les réglages dev restent dans le fil de leur partie');
  run.closeAll();
});

test('service + vraie partie : focus en cours de route, fin libre (dev), le coffre de LA partie est versé', async () => {
  const { createMemoryGameStore } = await import('../server/game/store.js');
  const { createGameService } = await import('../server/game/service.js');
  let now = 1_000_000;
  const store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner: createInlineRunner, clock: () => now, dev: true, randomSeed: () => 7919 });
  const ME = { id:'AAAA1111', name:'Zoe', guest:false };
  const { session } = await game.start(ME, {});
  await game.devClock(ME, { speed:300 });
  now += 4000; await game.pump();                     // 4 s à x300 = 20 min de jeu
  const { event } = await game.focus(ME, { focus:{ coal:'only' } });
  assert.equal(event.tick, 12000);
  await game.finish(ME);
  const rec = await store.getGameSession(session.id);
  assert.equal(rec.status, 'done');
  const inv = (await game.state(ME)).inventory.slots.filter(Boolean);
  assert.deepEqual(Object.fromEntries(inv.map(s => [s.item, s.qty])), rec.result.chest, 'seul : tout le coffre de la partie');
  /* et la reconstruction depuis l'enregistrement redonne exactement ce coffre */
  const g = createLiveGame({ ...rec, focus: rec.focus }); g.finish();
  assert.deepEqual(g.summary.chest, rec.result.chest);
});

/* une demande en file derrière celle qui termine la partie (la partie est fermée entre-temps) : rejetée, jamais en
   attente pour toujours (Worker arrêté) ; dans le fil principal aussi */
test('demande en file après la fin de la partie : rejetée (fil d\'exécution et fil principal)', { timeout: 30000 }, async () => {
  const { runRecord, newPrisonRecord } = await import('../src/shared/prison.js');
  const p = newPrisonRecord({ id: 'q1', account: 'AAAA', seed: 7, specs: { name: 'A' }, now: 0 });
  for(const run of [createInlineRunner(), createLiveRunner()]){
    const r = runRecord(p);
    run.open(r);
    await run.advance(r.id, 50);
    const end = run.finish(r.id), next = run.view(r.id, null);   // la vue part avant la fin de finish
    await end;
    await assert.rejects(next, /fermée/);
    assert.equal(run.has(r.id), false);
    run.closeAll();
  }
});
