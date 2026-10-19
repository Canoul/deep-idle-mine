/* Rejeu d'une session par le serveur : même partie que dans le navigateur (déterminisme), départs rejoués
   au bon moment, réglages dev isolés, et rejeu dans un thread (worker_threads). Sessions raccourcies (maxTicks). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../src/config.js';
import { buildSession, applyDueLeaves, replayRecord, minerSpecs, applyOverrides, tickAt } from '../src/shared/game.js';
import { tick, endSession } from '../src/sim/session.js';
import { createReplayer } from '../server/game/replay.js';

const N = 4500;   // 7,5 min de jeu : l'oxygène (300 s) force au moins un aller-retour au coffre
const rec = (extra = {}) => ({ id:'S1', seed:777, players:[{ account:'AAAA', name:'Zoe' }], bots:2,
  prefs:{ AAAA:{ priority:'minerais', fightMobs:true } }, overrides:null, leaves:[], ...extra });

/* ce que fait le navigateur : construire, appliquer les départs dus, avancer */
function clientRun(record, n){
  const G = buildSession(record);
  while(!G.over && G.ticks < n){ applyDueLeaves(G, record); tick(G); }
  if(!G.over) endSession(G);
  return G.summary;
}
const strip = s => JSON.parse(JSON.stringify({ ...s, id:undefined }));

test('déterminisme : deux rejeux du même enregistrement donnent le même résultat', () => {
  assert.deepEqual(strip(replayRecord(rec(), { maxTicks:N })), strip(replayRecord(rec(), { maxTicks:N })));
});

test('le rejeu serveur donne la même partie que le navigateur', () => {
  const r = rec({ leaves:[{ account:'AAAA', tick:3500 }], bots:2 });
  assert.deepEqual(strip(replayRecord(r, { maxTicks:N })), strip(clientRun(r, N)));
});

test('le coffre a bien été rempli pendant la partie rejouée (sinon le test ne prouve rien)', () => {
  const s = replayRecord(rec(), { maxTicks:N });
  assert.ok(Object.values(s.chest).reduce((a, b) => a + b, 0) > 0);
});

test('un départ est rejoué au bon tick : le joueur parti ne reçoit rien', () => {
  const s = replayRecord(rec({ leaves:[{ account:'AAAA', tick:600 }] }), { maxTicks:N });
  const mine = s.shares.find(x => x.account === 'AAAA');
  assert.equal(mine.left, true);
  assert.deepEqual(mine.bag, {});
});

test('préférences du joueur appliquées à son mineur, défauts pour les mineurs de test', () => {
  const specs = minerSpecs(rec({ prefs:{ AAAA:{ priority:'descendre', fightMobs:false } } }));
  assert.deepEqual(specs.map(s => s.prefs.priority), ['descendre', 'minerais', 'minerais']);
  assert.equal(minerSpecs(rec({ bots:0 })).length, 1, 'seul : le mineur solo habituel');
  assert.equal(minerSpecs(rec({ prefs:{ AAAA:{ priority:'n\'importe quoi' } } }))[0].prefs.priority, 'minerais');
});

test('réglages dev : appliqués pendant le rejeu, puis valeurs de base remises', () => {
  const base = STATS.pods;
  const a = replayRecord(rec({ overrides:{ STATS:{ pods:20 } } }), { maxTicks:N });
  assert.equal(STATS.pods, base);
  const b = replayRecord(rec(), { maxTicks:N });
  assert.notDeepEqual(strip(a), strip(b), 'des pods minuscules changent la partie');
  applyOverrides(null);
});

test('temps réel → ticks : x2, 10 s réelles = 200 ticks, jamais au-delà de la session', () => {
  assert.equal(tickAt(10_000, 2), 200);
  assert.equal(tickAt(-5, 2), 0);
  assert.equal(tickAt(1e12, 2), 36000);
});

test('rejeu dans un thread : même résultat qu\'en direct, file d\'attente respectée', async () => {
  const replay = createReplayer({ workers:1, options:{ maxTicks:800 } });
  const records = [rec({ id:'A' }), rec({ id:'B', seed:5 }), rec({ id:'C', bots:0 })];
  const out = await Promise.all(records.map(replay));
  for(const [i, r] of records.entries())
    assert.deepEqual(strip(out[i]), strip(replayRecord(r, { maxTicks:800 })), r.id);
});

test('rejeu dans un thread : un rejeu trop long est abandonné', async () => {
  const replay = createReplayer({ workers:1, timeout:1, options:{ maxTicks:5000 } });
  await assert.rejects(replay(rec()), /trop long/);
});
