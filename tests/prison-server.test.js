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
import { GAME, DT, INSTANCE, MINE_MODES, PRISON } from '../src/config.js';
import { GAME_SERVER } from '../server/config.js';
import { createEnergy, energyOfTicks } from '../src/meta/energy.js';
import { createInventory, addItem, serialize, deserialize, countOf } from '../src/meta/inventory.js';
import { runRecord, buildPrisonRun, sanitizePrison, prisonTickAt, prisonDueMs, touchPrison, isPresent, batchDue, newPrisonRecord, publicPrison, endedAway } from '../src/shared/prison.js';
import { tickPrison, endPrisonRun } from '../src/sim/prison.js';
import './helpers.js';   // énergie pleine au départ des tests (ENERGY.start, 30/10/2026)


const A = { id: 'AAAA1111', name: 'Zoe' }, B = { id: 'BBBB2222', name: 'Max' };
const P = [{ account: A.id, name: 'Zoe' }, { account: B.id, name: 'Max' }];
const T0 = Date.UTC(2026, 9, 29, 12, 0);

/* box.live : le moteur (dans le fil principal) ; box.advances : avances demandées ; box.opens : parties ouvertes ;
   box.reached : dernier tick atteint par partie */
/* Ces tests règlent le CALENDRIER des runs (versements, paquets d'absents, bilans), pas l'équilibrage : plusieurs supposent
   qu'un seul run finit avant le premier paquet (PRISON.batchMs). La durée d'un run dépend de PRISON.oreMul ; figée ici à la
   valeur avec laquelle ces calendriers ont été écrits (0,30, 29/10), pour que régler l'équilibrage ne les casse pas. */
PRISON.oreMul = 0.30;

function setup({ dev = false, store = createMemoryGameStore(), t = { now: T0 }, prison, config } = {}){
  const box = { advances: 0, opens: 0, reached: new Map() };
  const liveRunner = opts => {
    const l = box.live = createInlineRunner(opts), advance = l.advance, open = l.open;
    l.advance = async (id, target) => { box.advances++; const v = await advance(id, target); box.reached.set(id, l.tickOf(id) ?? target); return v; };
    l.open = rec => { if(!l.has(rec.id)) box.opens++; return open(rec); };
    return l;
  };
  const game = createGameService({ store, liveRunner, clock: () => t.now, randomSeed: () => 4242, dev, prison, config });
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
  assert.equal(p.account, A.id); assert.equal(p.seed, 4242); assert.equal(p.areaMax, PRISON.fallbackArea);   // aucune mine : fallbackArea (29/10)
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
  t.now = Math.max(runEndAt(p, G), p.lastSeenAt + PRISON.batchMs);   // absent : versé au premier paquet (runs < 10 min depuis le 29/10)
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
  assert.equal(box.live.size, 0, 'joueur absent : moteur fermé entre deux paquets');
  const v = await game.prisonView(A, null);
  assert.equal(v.prison.run, 2);
  assert.equal(v.view.tick, prisonTickAt(t.now - p2.runStartedAt), 'à sa visite, le run 2 est rejoué jusqu\'au tick dû');
  assert.equal(sumInv(await invOf(store, A.id)), sumInv(inv));
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

/* ---------- rythme : présent, absent, plafond de 24 h (Tâche 7) ---------- */

const runIdOf = p => `prison:${p.id}:${p.run}`;
/* fin des n premiers runs de p (rejoués à part) : l'enregistrement tel qu'il sera après ces n runs */
function afterRuns(p, n){
  const q = { ...p };
  for(let i = 0; i < n; i++){ const G = replayRun(q); q.runStartedAt += q.pausedMs + G.summary.t / GAME.speed * 1000; q.pausedMs = 0; q.run++; }
  return q;
}

test('règles : prisonDueMs plafonné à lastSeenAt + offlineMax, touchPrison (attente ajoutée à pausedMs, bilan remis à zéro), présence, paquet dû', () => {
  const cfg = { ...PRISON, offlineMax: 1000e3, presentFor: 30e3, batchMs: 600e3 };
  const p = newPrisonRecord({ id: 'x', account: A.id, seed: 1, specs: {}, now: 0 });
  assert.equal(prisonDueMs(p, 500e3, cfg), 500e3);
  assert.equal(prisonDueMs(p, 5000e3, cfg), 1000e3, 'plafond');
  p.pausedMs = 100e3;
  assert.equal(prisonDueMs(p, 5000e3, cfg), 900e3);
  assert.equal(prisonDueMs(p, 50e3, cfg), 0, 'jamais négatif');
  assert.ok(isPresent(p, 30e3, cfg)); assert.ok(!isPresent(p, 30e3 + 1, cfg));
  assert.ok(!batchDue(p, 599e3, cfg)); assert.ok(batchDue(p, 600e3, cfg));
  p.lastBatchAt = 700e3;
  assert.ok(!batchDue(p, 1299e3, cfg)); assert.ok(batchDue(p, 1300e3, cfg));
  /* retour après le plafond : 4000 s d'attente ajoutées, l'avancement reste celui du plafond */
  p.state = 'waiting'; p.away = { runs: 3, energy: 2.5, bag: { coal: 4 } };
  const due = prisonDueMs(p, 5000e3, cfg);
  assert.equal(touchPrison(p, 5000e3, cfg), true);
  assert.equal(p.state, 'running'); assert.equal(p.pausedMs, 100e3 + 4000e3); assert.equal(p.lastSeenAt, 5000e3);
  assert.equal(prisonDueMs(p, 5000e3, cfg), due, 'pas de saut');
  assert.deepEqual(p.lastAbsence, { from: 0, to: 5000e3 }, 'absence notée');
  assert.equal(p.away.runs, 3, 'le bilan reste à envoyer (le serveur le remet à zéro une fois envoyé)');
  /* run fini pendant l'absence, versé après le retour : compté ; fini après le retour : non */
  assert.ok(endedAway(p, 2000e3, cfg)); assert.ok(!endedAway(p, 10e3, cfg)); assert.ok(!endedAway(p, 5005e3, cfg));
  p.away = { runs: 0, energy: 0, xp: 0, t: 0, time: {}, bag: {} };
  /* présent : seul lastSeenAt change */
  assert.equal(touchPrison(p, 5010e3, cfg), false);
  assert.equal(p.lastSeenAt, 5010e3);
  const pub = publicPrison(p, null, { cfg });
  assert.equal(pub.waitAt, 5010e3 + 1000e3);
  assert.deepEqual(pub.away, { runs: 0, energy: 0, bag: {} });
  assert.deepEqual(sanitizePrison({ ...p, away: { runs: -1, energy: NaN, bag: { coal: 1.5 } } }).away, { runs: 0, energy: 0, xp: 0, t: 0, time: {}, bag: {} });
});

test('présent : vue toutes les 10 s → le run suit le temps réel (pump comme une session, vue au tick dû)', async () => {
  const { game, store, t, box } = setup();
  await game.prisonStart(A);
  const p = await prisonOf(store, A.id), id = runIdOf(p);
  assert.ok(gameRoutes(game)['GET /api/game/prison'], 'route de la vue');
  for(let i = 1; i <= 9; i++){
    t.now = p.runStartedAt + i * 10e3;
    await game.pump();
    assert.equal(box.live.tickOf(id), prisonTickAt(i * 10e3), `pump ${i} : à l'heure`);
    const r = await game.prisonView(A, null);
    assert.equal(r.prison.state, 'running'); assert.equal(r.prison.run, 1);
    assert.equal(r.view.tick, prisonTickAt(i * 10e3));
    assert.ok(r.view.full, 'carte entière sans since');
    const again = await game.prisonView(A, r.view.tick);
    assert.ok(!again.view.full && again.view.tick === r.view.tick, 'since : rien de neuf');
  }
  assert.equal(box.opens, 1, 'jamais refermé');
});

test('absent : un paquet toutes les 10 min au plus, moteur fermé entre deux ; au retour, bilan des runs une seule fois', async () => {
  const { game, store, t, box } = setup();
  await setEnergy(store, A.id, 50);             // de la place sous le plafond : le bilan compte l'énergie créditée
  await game.prisonStart(A);
  const p = await prisonOf(store, A.id);
  const q3 = afterRuns(p, 3), back = q3.runStartedAt + 60e3;   // 3 runs finis pendant l'absence
  assert.ok(back - T0 > 2 * PRISON.batchMs, `absence assez longue (${Math.round((back - T0) / 60e3)} min)`);
  const starts = [];
  let prev = false;
  for(t.now = T0 + 60e3; t.now <= back; t.now += 60e3){
    const before = box.advances;
    await game.pump();
    const moved = box.advances > before;
    if(moved && !prev) starts.push(t.now);
    if(!moved) assert.equal(box.live.size, 0, `moteur fermé entre deux paquets (${(t.now - T0) / 60e3} min)`);
    prev = moved;
  }
  assert.ok(starts.length >= Math.floor((back - T0) / PRISON.batchMs) - 1, `paquets : ${starts.length}`);
  for(let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= PRISON.batchMs, 'au plus un paquet toutes les 10 min');
  /* à jour à 10 min près (dernier tick atteint) */
  const cur = await prisonOf(store, A.id);
  const reached = box.reached.get(runIdOf(cur)) ?? 0;
  assert.ok(cur.runStartedAt + cur.pausedMs + realMs(reached) >= t.now - 60e3 - PRISON.batchMs, 'à jour à un paquet près');
  assert.equal(cur.lastSeenAt, T0, 'aucune visite');
  /* retour : la première vue joue le retard et donne le bilan, la suivante non */
  t.now = back;
  const r = await game.prisonView(A, null);
  assert.equal(r.prison.run, 4);
  assert.equal(r.prison.away.runs, 3);
  assert.ok(r.prison.away.energy > 0 && total(r.prison.away.bag) > 0);
  assert.equal(r.view.tick, prisonTickAt(back - q3.runStartedAt), 'retard joué avant la vue');
  const r2 = await game.prisonView(A, r.view.tick);
  assert.equal(r2.prison.away.runs, 0);
  assert.deepEqual(r2.prison.away.bag, {});
  /* présent : un run fini ne compte pas dans le bilan suivant */
  const s = await game.state(A);
  assert.equal(s.prison.away.runs, 0);
});

test('plafond : absent au-delà d\'offlineMax → waiting ; au retour, running, attente dans pausedMs, le run reprend où il s\'était arrêté', async () => {
  const cfg = { ...PRISON, offlineMax: 15 * 60e3, batchMs: 5 * 60e3 };
  const { game, store, t, box } = setup({ prison: cfg });
  await game.prisonStart(A);
  for(t.now = T0 + 60e3; t.now <= T0 + 20 * 60e3; t.now += 60e3) await game.pump();
  const w = await prisonOf(store, A.id);
  assert.equal(w.state, 'waiting');
  assert.equal(box.live.size, 0, 'moteur fermé');
  /* temps de jeu joué = offlineMax réel × vitesse : runs finis + run en cours jusqu'au plafond */
  const stopTick = box.reached.get(runIdOf(w));
  assert.equal(stopTick, prisonTickAt(T0 + cfg.offlineMax - w.runStartedAt - w.pausedMs));
  const played = (w.runStartedAt - T0) + realMs(stopTick);
  assert.ok(Math.abs(played - cfg.offlineMax) <= realMs(1), `joué ${played} ms`);
  /* plus rien tant qu'il n'est pas revenu */
  const n = box.advances;
  t.now += 30 * 60e3; await game.pump();
  assert.equal(box.advances, n);
  /* retour au bout de 50 min : 35 min d'attente */
  const backAt = t.now;
  const r = await game.prisonView(A, null);
  assert.equal(r.prison.state, 'running');
  const after = await prisonOf(store, A.id);
  assert.equal(after.pausedMs, w.pausedMs + backAt - (T0 + cfg.offlineMax));
  assert.equal(after.run, w.run);
  assert.equal(r.view.tick, stopTick, 'reprend au tick du plafond');
  /* et repart au rythme normal */
  t.now += 10e3; await game.pump();
  assert.equal(box.live.tickOf(runIdOf(after)), stopTick + prisonTickAt(10e3));
});

test('les sessions passent avant : budget serré, la session suit l\'heure, la prison absente attend', async () => {
  const config = { ...GAME_SERVER, tickBudget: 25, pumpEvery: 200 };   // 5 ticks par passage, la session en demande 4
  const { game, store, t, box } = setup({ config });
  await game.prisonStart(B);
  t.now = T0 + 20 * 60e3;                                               // B absent, un paquet est dû
  await game.start(A, {});
  const sid = await game.activeSessionId(A.id);
  const start = t.now;
  const pb = await prisonOf(store, B.id);
  for(let i = 1; i <= 10; i++){
    t.now = start + i * 200;
    await game.pump();
    assert.equal(box.live.tickOf(sid), prisonTickAt(i * 200), `passage ${i} : session à l'heure`);
  }
  assert.ok((box.live.tickOf(runIdOf(pb)) ?? 0) <= 10, 'la prison prend le reste (1 tick par passage)');
});

test('versement d\'un run en échec : pump le relance (une fois versé, une seule fois)', async () => {
  const { game, store, t } = setup();
  await game.prisonStart(A);
  const p = await prisonOf(store, A.id), G = replayRun(p), bag = G.summary.shares[0].bag;
  const put = store.putInventory.bind(store);
  let fail = 1;
  store.putInventory = async (...a) => { if(fail-- > 0) throw new Error('base indisponible'); return put(...a); };
  t.now = Math.max(runEndAt(p, G), p.lastSeenAt + PRISON.batchMs);   // absent : premier paquet
  const err = console.error; console.error = () => {};
  try { await game.pump(); } finally { console.error = err; }
  assert.equal((await prisonOf(store, A.id)).run, 1, 'pas versé');
  await game.pump();
  const p2 = await prisonOf(store, A.id);
  assert.equal(p2.run, 2);
  const inv = await invOf(store, A.id);
  for(const [item, n] of Object.entries(bag)) assert.equal(countOf(inv, item), n, item);
  await game.pump();
  assert.equal(sumInv(await invOf(store, A.id)), sumInv(inv));
});

test('pump ne relit que les prisons en cours (index en mémoire, rebâti au démarrage)', async () => {
  const store = createMemoryGameStore();
  const done = { ...newPrisonRecord({ id: 'old', account: B.id, seed: 1, specs: {}, now: T0 - 3600e3 }), state: 'done', endedAt: T0 - 60e3 };
  await store.putPrison(B.id, done);
  const t = { now: T0 };
  const { game: g0 } = setup({ store, t });
  await g0.prisonStart(A);
  /* redémarrage : un nouveau service sur le même stockage */
  const reads = [], lists = [];
  const get = store.getPrison.bind(store), list = store.listPrisons.bind(store);
  store.getPrison = async id => { reads.push(id); return get(id); };
  store.listPrisons = async () => { lists.push(1); return list(); };
  const { game, box } = setup({ store, t });
  for(let i = 1; i <= 3; i++){ t.now = T0 + i * 1000; await game.pump(); }
  assert.equal(lists.length, 1, 'liste lue une fois');
  assert.ok(!reads.includes(B.id), 'prison fermée jamais relue');
  assert.ok(reads.includes(A.id));
  assert.equal(box.live.tickOf(runIdOf(await prisonOf(store, A.id))), prisonTickAt(3000));
});

test('arrêt après un redémarrage du moteur : run rejoué depuis son début jusqu\'au tick dû, versement = rejeu à part', async () => {
  const { game, store, t, box } = setup();
  await game.prisonStart(A);
  const p = await prisonOf(store, A.id), ticks = 8000;
  t.now = p.runStartedAt + Math.ceil(realMs(ticks));
  await game.pump();
  box.live.closeAll();
  await game.prisonStop(A);
  const bag = endPrisonRun(replayRun(p, prisonTickAt(t.now - p.runStartedAt))).shares[0].bag;
  assert.ok(total(bag) > 0);
  const inv = await invOf(store, A.id);
  for(const [item, n] of Object.entries(bag)) assert.equal(countOf(inv, item), n, item);
  assert.equal(sumInv(inv), total(bag));
});

/* ---------- revue de la Tâche 7 : courses, state() sans rattrapage, bilan à l'heure de fin des runs ---------- */

test('deux vues et pump en même temps à travers la fin d\'un run : aucune erreur, tous répondent', async () => {
  const { game, store, t } = setup();
  await game.prisonStart(A);
  const p = await prisonOf(store, A.id);
  t.now = runEndAt(p);
  const res = await Promise.allSettled([game.prisonView(A, null), game.prisonView(A, null), game.pump(), game.state(A)]);
  assert.deepEqual(res.map(r => r.status), ['fulfilled', 'fulfilled', 'fulfilled', 'fulfilled'], res.map(r => r.reason?.message).join(' / '));
  await game.pump();
  const after = await prisonOf(store, A.id);
  assert.equal(after.run, 2); assert.equal(after.totals.runs, 1);
});

test('state() note la visite sans jouer le retard de la prison (aucune avance)', async () => {
  const { game, store, t, box } = setup();
  await game.prisonStart(A);
  t.now = T0 + 20 * 60e3;                       // absent, en retard
  const n = box.advances;
  const s = await game.state(A);
  assert.equal(box.advances, n, 'aucune avance');
  assert.equal(s.prison.state, 'running');
  assert.equal((await prisonOf(store, A.id)).lastSeenAt, t.now, 'visite écrite (retour d\'absence)');
});

test('bilan à l\'heure de fin : run fini pendant l\'absence versé plus tard (state puis vue) → compté ; run fini sous les yeux → non', async () => {
  {
    const { game, store, t } = setup();
    await game.prisonStart(A);
    const p = await prisonOf(store, A.id);
    t.now = runEndAt(p) + 60e3;                 // le run 1 a fini pendant l'absence, rien n'a tourné
    const s = await game.state(A);              // visite d'abord : rien de versé encore
    assert.equal(s.prison.away.runs, 0);
    const v = await game.prisonView(A, null);   // la vue joue le retard : run 1 versé maintenant
    assert.equal(v.prison.run, 2);
    assert.equal(v.prison.away.runs, 1, 'fini pendant l\'absence');
    assert.equal((await game.prisonView(A, v.view.tick)).prison.away.runs, 0, 'montré une fois');
  }
  {
    const { game, store, t } = setup();
    await game.prisonStart(A);
    const p = await prisonOf(store, A.id), end = runEndAt(p);
    for(t.now = T0 + 10e3; (await prisonOf(store, A.id)).run === 1; t.now += 10e3){
      await game.pump();
      const r = await game.prisonView(A, null);
      assert.equal(r.prison.away.runs, 0);
      assert.ok(t.now < end + 30e3, 'le run 1 finit');
    }
    assert.equal((await prisonOf(store, A.id)).away.runs, 0, 'fini sous les yeux du joueur');
  }
});

/* ---------- relecture finale : moteur en erreur, plafond des paquets, prisons en attente, énergie réelle ---------- */

const C = { id: 'CCCC3333', name: 'Lea' };
/* le moteur plante sur chaque avance (et fin) d'un run de prison ; les sessions ne sont pas touchées */
function crashPrisons(box){
  const advance = box.live.advance, finish = box.live.finish;
  box.live.advance = (id, target) => id.startsWith('prison:') ? Promise.reject(new Error('moteur en panne')) : advance(id, target);
  box.live.finish = id => id.startsWith('prison:') ? Promise.reject(new Error('moteur en panne')) : finish(id);
}
const quiet = async fn => { const err = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = err; } };

test('moteur en erreur : « Sortir de prison » réussit (rien versé, done) ; lancer une mine aussi', async () => {
  {
    const { game, store, t, box } = setup();
    await game.prisonStart(A);
    crashPrisons(box);
    t.now = T0 + 60e3;
    const r = await quiet(() => game.prisonStop(A));
    assert.equal(r.prison.state, 'done');
    assert.equal((await prisonOf(store, A.id)).state, 'done');
    assert.equal(sumInv(await invOf(store, A.id)), 0, 'pas de bilan : rien de versé');
    assert.equal(box.live.size, 0);
  }
  {
    const { game, store, t, box } = setup();
    await game.prisonStart(A);
    crashPrisons(box);
    t.now = T0 + 60e3;
    await quiet(() => game.start(A, {}));
    assert.ok(await game.activeSessionId(A.id), 'la mine est lancée');
    assert.equal((await prisonOf(store, A.id)).state, 'done');
  }
});

test('moteur en erreur dans pump : la prison s\'arrête après PRISON.crashMax plantages (journalisé), puis rien', async () => {
  const { game, store, t, box } = setup();
  await game.prisonStart(A);
  crashPrisons(box);
  const logs = [];
  const err = console.error; console.error = (...a) => logs.push(a.join(' '));
  try {
    for(let i = 1; i <= PRISON.crashMax + 2; i++){ t.now = T0 + i * 1000; await game.pump(); }
  } finally { console.error = err; }
  assert.equal((await prisonOf(store, A.id)).state, 'done');
  assert.ok(logs.some(l => /arrêtée/.test(l)), 'journalisé');
  assert.equal(box.live.size, 0);
  await game.start(A, {});
  assert.ok(await game.activeSessionId(A.id));
});

test('paquets d\'absents : au plus PRISON.batchConcurrency (1) par passage, le reste au passage suivant', async () => {
  assert.equal(PRISON.batchConcurrency, 1);
  const { game, t, box } = setup();
  for(const who of [A, B, C]) await game.prisonStart(who);
  const advance = box.live.advance;
  let ids = new Set();
  box.live.advance = (id, target) => { ids.add(id); return advance(id, target); };
  t.now = T0 + 20 * 60e3;                               // tous absents, un paquet dû pour chacun
  const per = [];
  for(let i = 0; i < 3; i++){ ids = new Set(); await game.pump(); per.push(ids.size); t.now += 200; }
  assert.deepEqual(per, [1, 1, 1], 'un paquet par passage, chacun son tour');
});

test('une prison en attente sort de l\'index : pump ne la relit plus ; sa visite l\'y remet', async () => {
  const cfg = { ...PRISON, offlineMax: 15 * 60e3, batchMs: 5 * 60e3 };
  const { game, store, t, box } = setup({ prison: cfg });
  await game.prisonStart(A);
  for(t.now = T0 + 60e3; t.now <= T0 + 20 * 60e3; t.now += 60e3) await game.pump();
  assert.equal((await prisonOf(store, A.id)).state, 'waiting');
  await game.pump();
  const get = store.getPrison.bind(store);
  let reads = 0;
  store.getPrison = async id => { reads++; return get(id); };
  for(let i = 0; i < 3; i++){ t.now += 60e3; await game.pump(); }
  assert.equal(reads, 0, 'jamais relue par pump');
  store.getPrison = get;
  await game.prisonView(A, null);
  const n = box.advances;
  t.now += 10e3; await game.pump();
  assert.ok(box.advances > n, 'revenue : pump la fait tourner');
});

test('bilan d\'absence : l\'énergie réellement créditée (plafond), pas celle du run', async () => {
  const { game, store, t } = setup();
  await game.prisonStart(A);
  const p = await prisonOf(store, A.id), G = replayRun(p);
  assert.ok(energyOfTicks(G.ticks) > 1, 'le run rapporte plus que la place qui reste');
  await setEnergy(store, A.id, 99);
  t.now = runEndAt(p, G) + 60e3;
  const v = await game.prisonView(A, null);
  assert.equal(v.prison.away.runs, 1);
  assert.equal(v.prison.away.energy, 1, 'plafonnée à 100');
  assert.equal(await energyOf(store, A.id), 100);
});

test('vue du groupe : « prison en cours » par membre (le chef et le membre sont prévenus avant un lancement)', async () => {
  const { game } = setup();
  let n = 0;
  const party = createPartyService({ game, clock: () => T0, getAccount: async () => null, newCode: () => ['K7Q4P2', 'H3XM9T'][n++ % 2] });
  await game.prisonStart(B);
  await party.create(A);
  await party.join(B, 'K7Q4P2');
  const of = async (who, id) => (await party.state(who)).party.members.find(m => m.account === id).prison;
  assert.equal(await of(A, B.id), true);
  assert.equal(await of(A, A.id), false);
  assert.equal(await of(B, B.id), true);
  await game.prisonStop(B);
  assert.equal(await of(A, B.id), false);
});

/* ---------- vitesse du mode dev (29/10/2026, Geoffrey) ---------- */
test('mode dev : vitesse au lancement et en direct, sans perdre le tick atteint', async () => {
  const { game, store, t } = setup({ dev: true });
  await game.prisonStart(A, null, { speed: 300 });
  let p = await prisonOf(store, A.id);
  assert.equal(p.speed, 300);
  t.now += 2000;                                                       // 2 s réelles à ×300 = 600 s de jeu
  const before = prisonTickAt(prisonDueMs(p, t.now), p.speed);
  assert.equal(before, 6000);
  assert.equal((await game.prisonClock(A, { speed: 1 })).prison.speed, 1);
  p = await prisonOf(store, A.id);
  assert.equal(prisonTickAt(prisonDueMs(p, t.now), p.speed), before);   // même tick juste après le changement
  t.now += 1000;
  assert.equal(prisonTickAt(prisonDueMs(p, t.now), p.speed), before + 10);   // puis ×1 : 1 s réelle = 10 ticks
  await assert.rejects(game.prisonClock(A, { speed: 7 }), { code: 'bad_request' });
  const prod = setup();
  await prod.game.prisonStart(A, null, { speed: 300 });
  assert.equal((await prisonOf(prod.store, A.id)).speed, GAME.speed);  // hors dev : la vitesse du jeu
  await assert.rejects(prod.game.prisonClock(A, { speed: 5 }), { code: 'forbidden' });
});

/* ---------- butin de la prison et Historique (29/10/2026, Geoffrey) ---------- */
test('butin de la prison : totaux (runs, XP, énergie, objets) envoyés au navigateur ; à la sortie, une ligne dans l\'Historique, une seule', async () => {
  const { game, store, t } = setup();
  await setEnergy(store, A.id, 50);
  await game.prisonStart(A);
  const p = await prisonOf(store, A.id);
  const G = replayRun(p), sum = G.summary, bag = sum.shares[0].bag;
  t.now = Math.max(runEndAt(p, G), p.lastSeenAt + PRISON.batchMs);
  await game.pump();                                                   // run 1 versé
  const v = await game.prisonView(A, null);
  assert.equal(v.prison.totals.runs, 1);
  assert.equal(v.prison.totals.xp, sum.shares[0].xp);
  assert.deepEqual(v.prison.totals.bag, bag);
  assert.ok(v.prison.totals.energy > 0);
  assert.equal(v.prison.totals.t, Math.round(sum.t * 10) / 10, 'temps de jeu du run versé');
  const r = await game.prisonStop(A);                                  // run 2 arrêté tout de suite
  assert.equal(r.prison.state, 'done');
  assert.ok(r.prison.totals.runs >= 1 && Number.isFinite(r.prison.endedAt));
  await game.prisonStop(A);                                            // rejoué : rien de plus
  const h = (await game.history(A)).sessions.filter(s => s.mode === 'prison');
  assert.equal(h.length, 1);
  assert.deepEqual(h[0].bag, r.prison.totals.bag);
  assert.equal(h[0].xp, r.prison.totals.xp);
  assert.equal(h[0].prison.runs, r.prison.totals.runs);
  assert.equal(h[0].prison.area, p.areaMax);
  assert.equal(h[0].prison.t, r.prison.totals.t);
  assert.ok(h[0].prison.t >= sum.t);
  const st = await game.state(A);
  assert.equal(st.ended, null, 'pas de bilan de fin de session pour la prison');
  assert.equal(st.session, null);
  await game.start(A, { mode: 'mine' });                               // une session se lance toujours
});

test('stuff relu à chaque run (30/10) : une pièce équipée pendant la prison compte au run suivant, pas au run en cours', async () => {
  const { game, store, t } = setup();
  await game.prisonStart(A);
  const p = await prisonOf(store, A.id);
  const disc = q => buildPrisonRun(runRecord(q)).miners[0].carac.discoverMax;
  const before = disc(p);
  await store.putInventoryAndStuff(A.id, JSON.parse(serialize(createInventory())), { worn: { casque: { item: 'Lunettes Gucci', uid: 1 } } });
  assert.equal(disc(await prisonOf(store, A.id)), before, 'run en cours : inchangé');
  t.now = Math.max(runEndAt(p), p.lastSeenAt + PRISON.batchMs);
  await game.pump();
  const p2 = await prisonOf(store, A.id);
  assert.equal(p2.run, 2);
  assert.equal(disc(p2), before + 1, 'run 2 : Découverte des lunettes');
  assert.equal(p2.specs.name, p.specs.name);
});

/* compos de prison (30/10/2026, Geoffrey) : actuelle (mines 1 à 10), ancienne (11 à 20), enregistrée */
test('compos : actuelle / ancienne / enregistrée ; enregistrer puis lancer avec, refus si absente', async () => {
  const { game, store } = setup();
  for(let i = 1; i <= 20; i++) await store.putGameSession({ id: 'old' + i, mode: 'mine', status: 'done', startedAt: T0 - 1e7 + i, endedAt: T0 - 1e6 + i,
    players: [{ account: A.id, name: 'Zoe' }], result: { areasUnlocked: i <= 10 ? 2 : 6, shares: [{ account: A.id, bag: { Fer: 5 } }], miners: [{ account: A.id, stats: {} }] } });
  let r = await game.prisonProfile(A);
  assert.equal(r.profile.area, 6); assert.equal(r.previous.area, 2); assert.equal(r.saved, null);
  await assert.rejects(game.prisonStart(A, null, { compo: 'saved' }), { code: 'no_compo' });
  await assert.rejects(game.prisonStart(A, null, { compo: 'nimporte' }), { code: 'bad_request' });
  await assert.rejects(game.prisonSaveCompo(A, { compo: 'saved' }), { code: 'bad_request' });
  r = await game.prisonSaveCompo(A, { compo: 'previous' });
  assert.equal(r.saved.area, 2);
  await game.prisonStart(A, null, { compo: 'saved' });
  assert.equal((await prisonOf(store, A.id)).areaMax, 2);
  assert.equal((await game.prisonProfile(A)).saved.area, 2, 'gardée après le lancement');
});
