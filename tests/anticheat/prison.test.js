/* Anti-triche : versements de la prison. Un run n'est versé qu'une fois (clé prison:<id>:<run> dans l'inventaire, la
   progression et l'énergie), même rejoué après un redémarrage du serveur ; une seule prison par compte, même avec des
   lancements simultanés ; un arrêt au moment même où le run se termine ne verse rien deux fois. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../../server/game/store.js';
import { createGameService } from '../../server/game/service.js';
import { createInlineRunner } from '../../server/game/live.js';
import { GAME, DT } from '../../src/config.js';
import { createEnergy } from '../../src/meta/energy.js';
import { deserialize } from '../../src/meta/inventory.js';
import { runRecord, buildPrisonRun, sanitizePrison } from '../../src/shared/prison.js';
import { tickPrison } from '../../src/sim/prison.js';

const A = { id: 'AAAA1111', name: 'Zoe' };
const T0 = Date.UTC(2026, 9, 29, 12, 0);

function service(store, t){
  const box = {};
  const game = createGameService({ store, liveRunner: opts => (box.live = createInlineRunner(opts)), clock: () => t.now, randomSeed: () => 4242 });
  return { game, box };
}
const prisonOf = async store => sanitizePrison(await store.getPrison(A.id));
const items = async store => deserialize(JSON.stringify(await store.getInventory(A.id) ?? { v: 1, slots: [] })).slots.reduce((s, x) => s + (x?.qty ?? 0), 0);
const xpOf = async store => (await store.getProgress(A.id))?.xp ?? 0;
const energyOf = async store => (await store.getEnergy(A.id))?.value ?? 100;
/* heure de fin du run en cours (rejoué à part : même enregistrement, même partie) */
function endAt(p){
  const G = buildPrisonRun(runRecord(p));
  while(!G.over) tickPrison(G);
  return { at: p.runStartedAt + Math.ceil(G.ticks * DT / GAME.speed * 1000) + 1, bag: G.summary.shares[0].bag };
}
const total = bag => Object.values(bag).reduce((s, n) => s + n, 0);

test('run rejoué après un redémarrage (prison pas encore passée au run suivant) : un seul versement', async () => {
  const store = createMemoryGameStore(), t = { now: T0 };
  await store.putEnergy(A.id, { ...createEnergy(), value: 40 });
  const s1 = service(store, t);
  await s1.game.prisonStart(A);
  const before = await store.getPrison(A.id);   // l'enregistrement tel qu'avant la fin du run
  const { at, bag } = endAt(sanitizePrison(before));
  t.now = at;
  await s1.game.pump();
  const got = { items: await items(store), xp: await xpOf(store), energy: await energyOf(store) };
  assert.equal(got.items, total(bag)); assert.ok(got.xp > 0); assert.ok(got.energy > 40);
  /* panne : la prison écrite avant le versement revient (le serveur s'est arrêté entre les écritures), nouveau serveur */
  s1.game.close();
  await store.putPrison(A.id, before);
  const s2 = service(store, t);
  await s2.game.pump();
  assert.equal(await items(store), got.items, 'coffre pas versé deux fois');
  assert.equal(await xpOf(store), got.xp, 'XP pas créditée deux fois');
  assert.equal(await energyOf(store), got.energy, 'énergie pas créditée deux fois');
  const p = await prisonOf(store);
  assert.equal(p.run, 2, 'la prison passe quand même au run suivant');
  assert.equal(p.totals.runs, 0, 'bilan : rien de compté pour un versement déjà fait');
});

test('deux lancements de prison simultanés : une seule prison', async () => {
  const store = createMemoryGameStore(), t = { now: T0 };
  const { game, box } = service(store, t);
  const res = await Promise.allSettled([1, 2, 3].map(() => game.prisonStart(A)));
  assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
  assert.ok(res.filter(r => r.status === 'rejected').every(r => r.reason.code === 'prison_running'));
  assert.equal(box.live.size, 1);
});

test('lancement d\'une mine et d\'une prison simultanés : jamais les deux en même temps', async () => {
  const store = createMemoryGameStore(), t = { now: T0 };
  const { game, box } = service(store, t);
  await Promise.allSettled([game.prisonStart(A), game.start(A, {})]);
  const p = await prisonOf(store), session = await game.activeSessionId(A.id);
  assert.ok(!(p?.state === 'running' && session), 'pas de prison qui tourne pendant une session');
  assert.equal(box.live.size, 1);
});

test('arrêt et fin de run au même moment : un seul versement, prison fermée', async () => {
  const store = createMemoryGameStore(), t = { now: T0 };
  await store.putEnergy(A.id, { ...createEnergy(), value: 40 });
  const { game, box } = service(store, t);
  await game.prisonStart(A);
  const { at, bag } = endAt(await prisonOf(store));
  t.now = at;
  await Promise.all([game.pump(), game.prisonStop(A), game.prisonStop(A)]);
  await game.pump();
  assert.equal(await items(store), total(bag));
  const p = await prisonOf(store);
  assert.equal(p.state, 'done');
  assert.equal(p.totals.runs, 1);
  const e = await energyOf(store);
  await game.prisonStop(A); await game.pump();
  assert.equal(await items(store), total(bag)); assert.equal(await energyOf(store), e);
  assert.equal(box.live.size, 0);
});
