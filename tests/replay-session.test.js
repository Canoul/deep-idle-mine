/* Outil de rejeu d'une session enregistrée (scripts/replay-session.js) : il doit rejouer exactement la partie du
   serveur (replayRecord), sinon un bug vu par un joueur ne se reproduirait pas. Sessions raccourcies (maxTicks). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replayRecord } from '../src/shared/game.js';
import { replayTrace } from '../scripts/replay-session.js';

const N = 3000;
const rec = { id:'S1', seed:222945787, players:[{ account:'AAAA', name:'Zoe' }], bots:2,
  prefs:{ AAAA:{ priority:'minerais', fightMobs:true } }, overrides:null, leaves:[{ account:'AAAA', tick:2500 }],
  focus:[{ account:'AAAA', tick:1200, focus:{ iron:'target' } }] };
const strip = s => JSON.parse(JSON.stringify({ ...s, id:undefined }));

test('rejeu : même partie que le rejeu du serveur (départs et focus compris)', () => {
  const { G } = replayTrace(rec, { maxTicks:N });
  assert.deepEqual(strip(G.summary), strip(replayRecord(rec, { maxTicks:N })));
});

test('rejeu : le suivi pas à pas ne garde que la période et le mineur demandés', () => {
  const { trace } = replayTrace(rec, { maxTicks:N, watch:{ miner:'Zoe', from:10, to:20 } });
  assert.ok(trace.length > 0);
  assert.ok(trace.every(l => l.t >= 10 && l.t <= 20));
});
