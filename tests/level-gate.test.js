/* Niveau requis des activités (03/11/2026, Geoffrey) : Mine instantanée niveau 3, Bloc géant et He's coming niveau 10.
   En dessous : scellées dans le lobby (cadenas), refusées par le serveur. N'importe pas tests/helpers.js (qui les ouvre). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENERGY, XP } from '../src/config.js';
import { minLevelOf, sealedBelow, levelLockText } from '../src/shared/level-gate.js';
import { mineModes, activityMenu } from '../src/ui/lobby.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createInlineRunner } from '../server/game/live.js';
import { createGiantService } from '../server/giant/service.js';
import { createInstantService } from '../server/instant/service.js';
import { xpForLevel } from '../src/meta/level.js';

ENERGY.start = 100;

test('niveaux requis : MI 3, Bloc géant et He\'s coming 10, le reste libre', () => {
  assert.equal(minLevelOf('mi'), 3); assert.equal(minLevelOf('giant'), 10); assert.equal(minLevelOf('hescoming'), 10);
  for(const m of ['mine', 'prison', 'instance_1', 'tower_angel']) assert.equal(minLevelOf(m), 0, m);
  assert.equal(sealedBelow('giant', 9), 10); assert.equal(sealedBelow('giant', 10), 0);
  assert.equal(sealedBelow('mi', 2), 3); assert.equal(sealedBelow('mi', 3), 0);
  assert.equal(sealedBelow('giant', null), 0, 'niveau pas encore reçu : rien de scellé (le serveur refuse quand même)');
  assert.equal(levelLockText('giant', 4), 'Niveau 10 requis (tu es niveau 4).');
});

test('lobby : sous le niveau, l\'activité est scellée (cadenas, grisée), et redevient normale au niveau', () => {
  const low = mineModes('mine', false, null, false, 1, 5), menu = activityMenu(low);
  const row = id => menu.find(a => a.id === id);
  assert.equal(row('giant').sealed, 10); assert.ok(row('giant').disabled);
  assert.equal(row('hescoming').sealed, 10); assert.ok(row('hescoming').disabled);
  assert.equal(row('mi').sealed, 0, 'niveau 5 : MI ouverte'); assert.ok(!row('mi').disabled);
  assert.equal(row('mine').sealed, 0); assert.equal(row('prison').sealed, 0);
  assert.equal(activityMenu(mineModes('mine', false, null, false, 1, 1)).find(a => a.id === 'mi').sealed, 3);
  const high = activityMenu(mineModes('mine', false, null, false, 1, 10));
  assert.ok(high.every(a => !a.sealed));
});

/* comptes : A niveau 1, B niveau 10 */
const A = { id: 'AAAA1111', name: 'Zoe' }, B = { id: 'BBBB2222', name: 'Max' };
async function setup(){
  const store = createMemoryGameStore();
  await store.putProgress(B.id, { xp: xpForLevel(10), spec: {}, credited: [] });
  const game = createGameService({ store, liveRunner: createInlineRunner, dev: true });
  return { store, game };
}

test('serveur : Bloc géant et He\'s coming refusés sous le niveau 10 (level_locked), acceptés au niveau 10', async () => {
  const { store, game } = await setup();
  assert.ok(XP);
  for(const mode of ['giant', 'hescoming']){
    const g = createGiantService({ store, game, dev: true, mode, key: mode === 'giant' ? 'Giant' : 'Hc' });
    await assert.rejects(g.enter(A), e => e.code === 'level_locked' && e.status === 403 && /Niveau 10/.test(e.message), mode);
    const r = await g.enter(B);
    assert.ok(r.visit, mode + ' : niveau 10, entrée acceptée');
  }
});

test('serveur : inscription à la MI refusée sous le niveau 3, acceptée au-dessus', async () => {
  const { game } = await setup();
  const mi = createInstantService({ game, store: createMemoryGameStore(), dev: true });
  await assert.rejects(mi.join(A), e => e.code === 'level_locked' && /Niveau 3/.test(e.message));
  await mi.join(B);
  assert.equal(mi.count(), 1);
});
