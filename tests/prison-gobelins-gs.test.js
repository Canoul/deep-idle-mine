/* Prison : moins de gobelins sous 2 500 GS (PRISON.lowGs, 01/11/2026). Le multiplicateur vient du stuff porté, monte sans
   palier jusqu'à 1, et les apparitions perdues vont aux autres mobs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRISON, MOBS } from '../src/config.js';
import { prisonGoblinMul } from '../src/meta/gearscore.js';
import { fewerGoblins, spawnTableAt } from '../src/sim/mobs.js';
import { newPrisonRun } from '../src/sim/prison.js';
import { newSession } from '../src/sim/session.js';
import { contentAt } from '../src/sim/world.js';
import { buildPrisonRun, newPrisonRecord, runRecord } from '../src/shared/prison.js';

const { gsMax, goblinMul } = PRISON.lowGs;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
const sum = t => Object.values(t).reduce((s, v) => s + v, 0);

test('multiplicateur : le minimum à 0 GS, 1 à partir de gsMax', () => {
  assert.equal(prisonGoblinMul(0), goblinMul);
  assert.equal(prisonGoblinMul(gsMax), 1);
  assert.equal(prisonGoblinMul(gsMax * 3), 1);
});

test('multiplicateur : monte régulièrement, sans palier, et ne dépasse jamais 1', () => {
  near(prisonGoblinMul(gsMax / 2), (goblinMul + 1) / 2);
  let last = 0;
  for(let gs = 0; gs <= gsMax + 100; gs += 100){
    const m = prisonGoblinMul(gs);
    assert.ok(m >= last && m <= 1 && m - last < 0.05 + (gs ? 0 : 1), `${gs} GS : ${m}`);
    last = m;
  }
});

test('multiplicateur : un GS invalide ne change rien', () => {
  for(const gs of [NaN, Infinity, undefined, null, 'x']) assert.equal(prisonGoblinMul(gs), 1);
  assert.equal(prisonGoblinMul(-500), goblinMul);
});

test('table : les gobelins baissent, les autres mobs prennent le reste, le total reste 1', () => {
  const base = MOBS.spawnTable[4], t = fewerGoblins(base, 0.25);
  near(t.gobelin, base.gobelin * 0.25);
  near(sum(t), 1);
  near(t.mimic / t.mephite, base.mimic / base.mephite);
  assert.ok(t.mimic > base.mimic);
});

test('table : inchangée à ×1, sans gobelin, ou s\'il n\'y a que des gobelins', () => {
  const noGob = MOBS.spawnTable[0], only = { gobelin: 1 };
  assert.equal(fewerGoblins(MOBS.spawnTable[4], 1), MOBS.spawnTable[4]);
  assert.equal(fewerGoblins(noGob, 0.25), noGob);
  assert.equal(fewerGoblins(only, 0.25), only);
});

test('table : ne modifie pas la table de la config', () => {
  const copy = { ...MOBS.spawnTable[4] };
  fewerGoblins(MOBS.spawnTable[4], 0.25);
  assert.deepEqual(MOBS.spawnTable[4], copy);
});

test('run : la table de la prison applique goblinMul, aussi sur la table du profil', () => {
  const mobs = { gobelin: 0.5, bestiole: 0.5 }, profile = { n: 10, area: 4, ores: null, treasures: null, mobs };
  near(spawnTableAt(newPrisonRun(1, { areaMax: 4, profile, goblinMul: 0.5 }), 5).gobelin, 0.25);
  near(spawnTableAt(newPrisonRun(1, { areaMax: 4, profile }), 5).gobelin, 0.5);
});

test('serveur : le multiplicateur vient du stuff figé pour le run', () => {
  const rec = g => runRecord(newPrisonRecord({ id: 'p', account: 'a', seed: 3, specs: { name: 'A', gear: g }, areaMax: 4, now: 0 }));
  assert.equal(buildPrisonRun(rec([])).prison.goblinMul, goblinMul);
  const iron = buildPrisonRun(rec(['Pioche en fer', 'Épée en fer'])).prison.goblinMul;
  assert.ok(iron > goblinMul && iron < 1);
});

test('mine classique : table inchangée, même pour un mineur sans stuff', () => {
  assert.equal(spawnTableAt(newSession(1, {}), 5), MOBS.spawnTable[contentAt(newSession(1, {}), 5)]);
});
