/* Area max du joueur : gardée dans la progression, rattrapée depuis l'historique (session_stat). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeProgress, createProgress, raiseAreaMax } from '../src/meta/level.js';
import { realDurationMs } from '../src/shared/game.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { fakeLive } from './helpers.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };
const OTHER = { id:'BBBB2222', name:'Max', guest:false };
const team = [{ account:ME.id, name:'Zoe' }, { account:OTHER.id, name:'Max' }];

test('sanitizeProgress : areaMax entier >= 0, sinon 0', () => {
  assert.equal(createProgress().areaMax, 0);
  assert.equal(sanitizeProgress({ areaMax: 4 }).areaMax, 4);
  for(const v of [-1, 2.5, '3', NaN, Infinity, null, undefined]) assert.equal(sanitizeProgress({ areaMax: v }).areaMax, 0, String(v));
});

test('raiseAreaMax : garde le maximum, rejouer ne change rien', () => {
  const p = createProgress();
  assert.equal(raiseAreaMax(p, 3), true); assert.equal(p.areaMax, 3);
  assert.equal(raiseAreaMax(p, 2), false); assert.equal(p.areaMax, 3);
  assert.equal(raiseAreaMax(p, 3), false);
  for(const v of [-1, 2.5, '9', NaN, Infinity]) assert.equal(raiseAreaMax(p, v), false);
  assert.equal(p.areaMax, 3);
});

function setup({ dev = false } = {}){
  let now = 1_000_000;
  const store = createMemoryGameStore();
  const live = fakeLive(rec => ({ id:rec.id, areasUnlocked:3, chest:{}, shares: rec.players.map(p => ({ account:p.account, left: rec.leaves.some(l => l.account === p.account), bag:{} })) }));
  const game = createGameService({ store, liveRunner: live, clock: () => now, dev, randomSeed: () => 4242 });
  return { game, store, advance: ms => { now += ms; } };
}

test('fin de mine classique : areaMax pour les présents, 0 pour le joueur parti', async () => {
  const { game, store, advance } = setup();
  await game.start(ME, {}, team);
  await game.leave(OTHER, {});
  advance(realDurationMs()); await game.pump();
  assert.equal((await store.getProgress(ME.id)).areaMax, 3);
  assert.equal((await store.getProgress(OTHER.id))?.areaMax ?? 0, 0);
  assert.equal(await game.areaMaxOf(ME.id), 3);
  assert.equal(await game.areaMaxOf(OTHER.id), 0);
});

test('mode dev : areaMax inchangée', async () => {
  const { game, store } = setup({ dev: true });
  await game.start(ME, {});
  await game.finish(ME).catch(() => {});
  assert.equal((await store.getProgress(ME.id))?.areaMax ?? 0, 0);
});

test('areaMaxOf : nouveau joueur 0 ; rattrapage depuis l\'historique (max des areas)', async () => {
  const { game, store } = setup();
  assert.equal(await game.areaMaxOf('CCCC3333'), 0);
  await store.putSessionStats([
    { key:'s1:'+ME.id, value:{ session:'s1', account:ME.id, areas:2 } },
    { key:'s2:'+ME.id, value:{ session:'s2', account:ME.id, areas:5 } },
    { key:'s3:'+OTHER.id, value:{ session:'s3', account:OTHER.id, areas:7 } },
  ]);
  assert.equal(await game.areaMaxOf(ME.id), 5);
  assert.equal((await store.getProgress(ME.id)).areaMax, 5, 'enregistrée dans la progression');
});

test('une fin de mine ne masque pas l\'historique plus profond (rattrapage avant la montée)', async () => {
  const { game, store, advance } = setup();
  await store.putSessionStats([{ key:'old:'+ME.id, value:{ session:'old', account:ME.id, areas:5 } }]);
  await game.start(ME, {});
  advance(realDurationMs()); await game.pump();
  assert.equal(await game.areaMaxOf(ME.id), 5);
});

/* table de recherche (05/11/2026) : tiers à area ; le serveur lit l'area max du compte, l'état l'envoie au navigateur */
test('recherche : T3 refusé (area_locked, rien payé) sous l\'area 5, accepté une fois l\'area 5 atteinte ; l\'état donne areaMax', async () => {
  const { createInventory, addAll, countOf, serialize } = await import('../src/meta/inventory.js');
  const { learn, recipeOfBlueprint } = await import('../src/meta/craft.js');
  const { tierBlueprints, PARTS } = await import('../src/meta/research.js');
  const { game, store } = setup();
  const inv = createInventory(); let n = 0;
  for(const bp of [...tierBlueprints(1), ...tierBlueprints(2)]) if(recipeOfBlueprint(bp)){ addAll(inv, { [bp]:1 }); learn(inv, bp, 'l' + (++n)); }
  addAll(inv, { [PARTS]:200 });
  await store.putInventory(ME.id, JSON.parse(serialize(inv)));
  await store.putSessionStats([{ key:'s1:'+ME.id, value:{ session:'s1', account:ME.id, areas:4 } }]);
  assert.equal((await game.state(ME)).progress.areaMax, 4);
  await assert.rejects(game.research(ME, { action:'research', tier:3, opId:'op-area-1' }), { code:'area_locked' });
  await store.putSessionStats([{ key:'s2:'+ME.id, value:{ session:'s2', account:ME.id, areas:5 } }]);
  await store.putProgress(ME.id, { ...(await store.getProgress(ME.id)), areaMax:0 });   // rattrapage depuis l'historique
  const r = await game.research(ME, { action:'research', tier:3, opId:'op-area-2' });
  assert.ok(tierBlueprints(3).includes(r.item));
  assert.equal(countOf({ slots:r.inventory.slots }, PARTS), 0);
});
