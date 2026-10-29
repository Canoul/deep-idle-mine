/* Prison côté serveur (spec docs/superpowers/specs/2026-10-29-prison-energie-design.md) : lancer (solo, une seule à la
   fois), runs versés un à un (coffre, XP, énergie, clé prison:<id>:<run>), arrêt au tick atteint (coffre versé, pas le
   sac du mineur), mine / tour / instance qui terminent la prison avant de créer la session, mine instantanée et Bloc
   géant qui ne la terminent pas, mode dev (pas de coût de mine, recharge normale). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { gameRoutes } from '../server/game/routes.js';
import { createInlineRunner } from '../server/game/live.js';
import { createPartyService } from '../server/party/service.js';
import { partyRoutes } from '../server/party/routes.js';
import { createGiantService } from '../server/giant/service.js';
import { GAME, DT, INSTANCE, MINE_MODES } from '../src/config.js';
import { createEnergy, energyOfTicks } from '../src/meta/energy.js';
import { createInventory, addItem, serialize, deserialize, countOf } from '../src/meta/inventory.js';
import { runRecord, buildPrisonRun, sanitizePrison, prisonTickAt } from '../src/shared/prison.js';
import { tickPrison, endPrisonRun } from '../src/sim/prison.js';

const A = { id: 'AAAA1111', name: 'Zoe' }, B = { id: 'BBBB2222', name: 'Max' };
const P = [{ account: A.id, name: 'Zoe' }, { account: B.id, name: 'Max' }];
const T0 = Date.UTC(2026, 9, 29, 12, 0);

function setup({ dev = false, store = createMemoryGameStore(), t = { now: T0 } } = {}){
  const box = {};
  const liveRunner = opts => (box.live = createInlineRunner(opts));
  const game = createGameService({ store, liveRunner, clock: () => t.now, randomSeed: () => 4242, dev });
  return { store, game, t, box };
}
const prisonOf = async (store, id) => sanitizePrison(await store.getPrison(id));
const invOf = async (store, id) => deserialize(JSON.stringify(await store.getInventory(id) ?? { v: 1, slots: [] }));
const energyOf = async (store, id) => (await store.getEnergy(id))?.value ?? 100;
const setEnergy = (store, id, value) => store.putEnergy(id, { ...createEnergy(), value });
const realMs = ticks => ticks * DT / GAME.speed * 1000;

/* le run en cours rejoué à part (même enregistrement : même partie), jusqu'au tick voulu ou jusqu'à sa fin */
function replayRun(p, ticks = Infinity){
  const G = buildPrisonRun(runRecord(p));
  while(!G.over && G.ticks < ticks) tickPrison(G);
  return G;
}
/* heure à laquelle le run en cours de p se termine (en suivant le temps réel) */
const runEndAt = (p, G = replayRun(p)) => p.runStartedAt + p.pausedMs + Math.ceil(realMs(G.ticks)) + 1;
const total = bag => Object.values(bag).reduce((s, n) => s + n, 0);
const sumInv = inv => inv.slots.reduce((s, x) => s + (x?.qty ?? 0), 0);

test('mode Prison : listé, solo ; start() le refuse (il a sa propre route)', async () => {
  const m = MINE_MODES.find(x => x.id === 'prison');
  assert.ok(m?.ready && m.prison && m.solo);
  const { game } = setup();
  await assert.rejects(game.start(A, { mode: 'prison' }), { code: 'mode_prison' });
  const routes = gameRoutes(game);
  assert.ok(routes['POST /api/game/prison/start'] && routes['POST /api/game/prison/stop']);
});

test('lancer : running, run 1, specs figées ; relancer → prison_running ; en session → session_running', async () => {
  const { game, store, box } = setup();
  const r = await game.prisonStart(A);
  assert.equal(r.prison.state, 'running'); assert.equal(r.prison.run, 1);
  const s = await game.state(A);
  assert.equal(s.prison.state, 'running'); assert.equal(s.prison.run, 1);
  assert.ok(Number.isInteger(s.prison.goal) && s.prison.goal > 0, 'objectif du run connu du moteur');
  assert.equal(s.prison.mined, 0);
  const p = await prisonOf(store, A.id);
  assert.equal(p.account, A.id); assert.equal(p.seed, 4242); assert.equal(p.areaMax, 0);
  assert.ok(p.specs && p.specs.prefs && p.specs.skills && p.specs.gear, 'prefs, skills, stuff figés');
  assert.equal(box.live.size, 1);
  await assert.rejects(game.prisonStart(A), { code: 'prison_running' });
  const { game: g2 } = setup();
  await g2.start(B, {});
  await assert.rejects(g2.prisonStart(B), { code: 'session_running' });
  await assert.rejects(game.prisonStart(A, P), { code: 'not_solo' });
});

test('groupe de plusieurs au lobby : not_solo (route du service des groupes) ; seul dans son groupe : permis', async () => {
  const { game } = setup();
  let n = 0;
  const party = createPartyService({ game, clock: () => T0, getAccount: async () => null, newCode: () => ['K7Q4P2', 'H3XM9T'][n++ % 2] });
  const route = partyRoutes(party)['POST /api/game/prison/start'];
  assert.ok(route, 'la route passe par le service des groupes');
  await party.create(A);
  await party.join(B, 'K7Q4P2');
  await assert.rejects(route({ me: A, body: {} }), { code: 'not_solo' });
  await assert.rejects(route({ me: B, body: {} }), { code: 'not_solo' });
  await party.leave(B);
  const r = await route({ me: A, body: {} });
  assert.equal((r[1] ?? r).prison.state, 'running');
});

test('prison puis mine : start() termine la prison avant de créer la session (coffre versé), une seule partie en direct', async () => {
  const { game, store, t, box } = setup();
  await game.prisonStart(A);
  const p = await prisonOf(store, A.id);
  const ticks = 8000;
  t.now = p.runStartedAt + Math.ceil(realMs(ticks));
  await game.pump();
  const G = replayRun(p, ticks), bag = endPrisonRun(G).shares[0].bag;
  assert.ok(total(bag) > 0, 'le coffre a déjà quelque chose');
  await game.start(A, {});
  const after = await prisonOf(store, A.id);
  assert.equal(after.state, 'done');
  const inv = await invOf(store, A.id);
  for(const [item, n] of Object.entries(bag)) assert.equal(countOf(inv, item), n, item);
  assert.equal(box.live.size, 1, 'seulement la mine');
  assert.ok(await game.activeSessionId(A.id));
  assert.equal((await game.state(A)).prison.state, 'done');
});

test('groupe : la prison de B est terminée avant la création de la session ; jamais deux parties pour B', async () => {
  const { game, store, box } = setup();
  await game.prisonStart(B);
  assert.equal(box.live.size, 1);
  const sizes = [];
  const putSession = store.putGameSession.bind(store);
  store.putGameSession = async rec => { sizes.push([box.live.size, (await prisonOf(store, B.id)).state]); return putSession(rec); };
  await game.start(A, {}, P);
  assert.deepEqual(sizes[0], [0, 'done'], 'à la création : plus de prison en direct, prison de B fermée');
  assert.equal(box.live.size, 1);
  assert.equal((await prisonOf(store, B.id)).state, 'done');
});

test('refus de lancement (énergie) : la prison continue', async () => {
  const { game, store } = setup();
  await game.prisonStart(A);
  await setEnergy(store, A.id, 3);
  await assert.rejects(game.start(A, {}), { code: 'no_energy' });
  assert.equal((await prisonOf(store, A.id)).state, 'running');
});

test('fin de run : coffre + XP + énergie crédités une fois, run 2 ; moteur fermé et même avance rejouée : rien deux fois', async () => {
  const { game, store, t, box } = setup();
  await setEnergy(store, A.id, 50);
  await game.prisonStart(A);
  const p = await prisonOf(store, A.id);
  const G = replayRun(p), sum = G.summary, bag = sum.shares[0].bag;
  assert.ok(total(bag) > 0 && sum.shares[0].xp > 0);
  t.now = runEndAt(p, G);
  await game.pump();
  const p2 = await prisonOf(store, A.id);
  assert.equal(p2.run, 2); assert.equal(p2.state, 'running');
  assert.equal(p2.runStartedAt, p.runStartedAt + sum.t / GAME.speed * 1000);
  assert.equal(p2.pausedMs, 0);
  assert.equal(p2.totals.runs, 1);
  const inv = await invOf(store, A.id);
  for(const [item, n] of Object.entries(bag)) assert.equal(countOf(inv, item), n, item);
  assert.ok(inv.credited.includes(`prison:${p.id}:1`));
  const xp = (await store.getProgress(A.id)).xp;
  assert.equal(xp, sum.shares[0].xp);
  const e = await energyOf(store, A.id);
  assert.equal(e, Math.round((50 + energyOfTicks(sum.t / DT)) * 10) / 10);
  assert.ok(e > 50);
  /* redémarrage du moteur : le run 2 reprend depuis son début, le run 1 ne revient pas */
  box.live.closeAll();
  await game.pump();
  assert.equal(sumInv(await invOf(store, A.id)), sumInv(inv));
  assert.equal((await store.getProgress(A.id)).xp, xp);
  assert.equal(await energyOf(store, A.id), e);
  assert.equal((await prisonOf(store, A.id)).run, 2);
  assert.equal(box.live.size, 1, 'le run 2 tourne');
});

test('arrêt au milieu d\'un run : coffre versé, sac du mineur perdu, énergie au prorata, done ; un deuxième arrêt ne fait rien', async () => {
  const { game, store, t, box } = setup();
  await setEnergy(store, A.id, 50);
  await game.prisonStart(A);
  const p = await prisonOf(store, A.id);
  /* un moment où le mineur porte quelque chose et où le coffre n'est pas vide */
  const G = buildPrisonRun(runRecord(p));
  let ticks = 0;
  while(!G.over){ tickPrison(G); if(G.ticks > 1500 && Object.keys(G.miners[0].inv).length && Object.keys(G.chest).length){ ticks = G.ticks; break; } }
  assert.ok(ticks, 'moment trouvé');
  const carried = { ...G.miners[0].inv }, sum = endPrisonRun(G), bag = sum.shares[0].bag;
  t.now = p.runStartedAt + Math.ceil(realMs(ticks));
  const r = await game.prisonStop(A);
  assert.equal(r.prison.state, 'done');
  const inv = await invOf(store, A.id);
  for(const [item, n] of Object.entries(bag)) assert.equal(countOf(inv, item), n, `${item} : le coffre seulement`);
  for(const [item, n] of Object.entries(carried)) assert.equal(countOf(inv, item), bag[item] ?? 0, `${item} porté (${n}) : pas versé`);
  assert.equal(await energyOf(store, A.id), Math.round((50 + energyOfTicks(ticks)) * 10) / 10);
  assert.equal(box.live.size, 0);
  const before = sumInv(inv), e = await energyOf(store, A.id), xp = (await store.getProgress(A.id))?.xp ?? 0;
  const again = await game.prisonStop(A);
  assert.equal(again.prison.state, 'done');
  assert.equal(sumInv(await invOf(store, A.id)), before);
  assert.equal(await energyOf(store, A.id), e);
  assert.equal((await store.getProgress(A.id))?.xp ?? 0, xp);
  assert.deepEqual(await game.prisonStop(B), { prison: null }, 'pas de prison : rien');
  /* une nouvelle prison repart au run 1, carte neuve (nouvel id) */
  const r2 = await game.prisonStart(A);
  assert.equal(r2.prison.run, 1);
  assert.notEqual((await prisonOf(store, A.id)).id, p.id);
});

test('une tour et une instance lancées terminent la prison', async () => {
  {
    const { game, store } = setup({ dev: true });   // dev : tour toujours ouverte
    await game.prisonStart(A);
    await game.start(A, { mode: 'tower_angel' });
    assert.equal((await prisonOf(store, A.id)).state, 'done');
  }
  {
    const { game, store } = setup();
    const inv = createInventory(); addItem(inv, INSTANCE.list[0].key, 1);
    await store.putInventory(A.id, JSON.parse(serialize(inv)));
    await game.prisonStart(A);
    await game.start(A, { mode: 'instance_1' });
    assert.equal((await prisonOf(store, A.id)).state, 'done');
    assert.equal(countOf(await invOf(store, A.id), INSTANCE.list[0].key), 0, 'clé consommée, inventaire de la prison pas écrasé');
  }
});

test('mine instantanée et Bloc géant : la prison continue', async () => {
  const { game, store, t, box } = setup();
  await game.prisonStart(A);
  const mi = await game.openInstant('mi-prison', t.now, [{ account: A.id, name: 'Zoe' }]);
  assert.ok(mi, 'A joue la mine instantanée');
  assert.equal((await prisonOf(store, A.id)).state, 'running');
  assert.equal(box.live.size, 2, 'prison + mine instantanée');
  const giant = createGiantService({ store, game, clock: () => t.now, randomSeed: () => 7 });
  await giant.enter(A);
  assert.equal((await prisonOf(store, A.id)).state, 'running');
});

test('mode dev : mine sans coût d\'énergie, mais la prison recharge normalement', async () => {
  const { game, store, t } = setup({ dev: true });
  await setEnergy(store, A.id, 50);
  await game.prisonStart(A);
  const p = await prisonOf(store, A.id);
  t.now = p.runStartedAt + Math.ceil(realMs(2000));
  await game.prisonStop(A);
  assert.equal(await energyOf(store, A.id), Math.round((50 + energyOfTicks(2000)) * 10) / 10);
  await game.start(A, {});
  assert.equal(await energyOf(store, A.id), Math.round((50 + energyOfTicks(2000)) * 10) / 10, 'pas de coût en dev');
});

test('prisonTickAt : temps réel → ticks, sans le plafond d\'une heure de session', () => {
  assert.equal(prisonTickAt(0, 2), 0);
  assert.equal(prisonTickAt(-5, 2), 0);
  assert.equal(prisonTickAt(3 * 3600e3, 2), 3 * 3600 * 2 / DT);
});

test('stockage : ns prison (get, put, liste) gardé dans la sauvegarde', async () => {
  const store = createMemoryGameStore(), changes = [];
  store.changed = async c => { changes.push(...c); };
  await store.putPrison(A.id, { id: 'p1', account: A.id });
  assert.deepEqual(changes.map(c => [c.ns, c.key]), [['prison', A.id]]);
  assert.deepEqual(await store.listPrisons(), [{ account: A.id, value: { id: 'p1', account: A.id } }]);
  const again = createMemoryGameStore(JSON.parse(JSON.stringify(store.snapshot())));
  assert.deepEqual(await again.getPrison(A.id), { id: 'p1', account: A.id });
  assert.equal(await again.getPrison(B.id), null);
});
