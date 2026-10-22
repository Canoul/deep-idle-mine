/* Mine instantanée côté serveur : inscriptions, ouverture à l'heure de Paris, répartition, partie en direct (vraie
   simulation, dans le fil principal), versement unique, Quitter = rien, redémarrage. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSTANT_MINE as MI } from '../src/config.js';
import { nextSlot, lastSlot, splitMines, instantDurationMs, localHour, signupOpen } from '../src/shared/instant.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createInlineRunner } from '../server/game/live.js';
import { createPartyService } from '../server/party/service.js';
import { createInstantService } from '../server/instant/service.js';
import { deserialize, countOf } from '../src/meta/inventory.js';

const T0 = Date.parse('2026-10-21T13:59:00Z');          // 15:59 à Paris : ouverture à 16:00
const SLOT = Date.parse('2026-10-21T14:00:00Z');
const acc = (i, name = 'J' + i) => ({ id:'ACC' + String(i).padStart(5, '0'), name, guest:false });
const ME = acc(1, 'Zoe'), OTHER = acc(2, 'Max');

async function setup({ store = createMemoryGameStore(), now = T0 } = {}){
  const t = { now };
  const clock = () => t.now;
  const game = createGameService({ store, liveRunner: createInlineRunner, clock, randomSeed: () => 4242 });
  const accounts = new Map([ME, OTHER].map(a => [a.id, a]));
  const party = createPartyService({ game, store, clock, getAccount: async id => accounts.get(id) ?? null });
  await party.load();
  const instant = createInstantService({ game, party, store, clock });
  await instant.load();
  return { store, game, party, instant, t, clock };
}
const inv = async (store, id) => deserialize(JSON.stringify(await store.getInventory(id) ?? {}));
const flush = () => new Promise(r => setTimeout(r, 0));

/* ---------- horaires ---------- */

test('MI horaires : toutes les 2 h pile heure de Paris, heure d\'été et d\'hiver ; l\'heure répétée ne compte qu\'une fois', () => {
  assert.equal(nextSlot(T0), SLOT);
  assert.equal(nextSlot(SLOT), SLOT + 2 * 3600e3);
  assert.equal(lastSlot(SLOT), SLOT); assert.equal(lastSlot(SLOT - 1), SLOT - 2 * 3600e3);
  assert.equal(localHour(nextSlot(Date.parse('2026-07-01T09:30:00Z'))), 12);      // été (UTC+2) : 10:00 UTC = 12 h
  assert.equal(localHour(nextSlot(Date.parse('2026-12-01T09:30:00Z'))), 12);      // hiver (UTC+1) : 11:00 UTC = 12 h
  let t = Date.parse('2026-10-24T20:00:00Z'), gaps = [];                         // nuit du passage à l'heure d'hiver
  for(let i = 0; i < 8; i++){ const n = nextSlot(t); gaps.push((n - t) / 3600e3); t = n; }
  assert.ok(gaps.slice(1).every(g => g >= 2), gaps.join(','));
  for(let i = 0, s = T0; i < 30; i++){ s = nextSlot(s); assert.equal(localHour(s) % 2, 0); }
});

test('MI répartition : au plus 20 par mine, tailles égales', () => {
  const sizes = n => splitMines([...Array(n).keys()]).map(g => g.length);
  assert.deepEqual(sizes(0), []); assert.deepEqual(sizes(1), [1]); assert.deepEqual(sizes(20), [20]);
  assert.deepEqual(sizes(21), [11, 10]); assert.deepEqual(sizes(41), [14, 14, 13]);
  assert.deepEqual(splitMines([...Array(21).keys()]).flat(), [...Array(21).keys()]);
});

/* ---------- inscriptions ---------- */

test('MI inscription : compte à rebours, inscrit, idempotent, se désinscrire', async () => {
  const { instant } = await setup();
  let s = await instant.state(ME);
  assert.equal(s.nextAt, SLOT); assert.equal(s.now, T0); assert.equal(s.registered, false); assert.equal(s.count, 0);
  s = await instant.join(ME); assert.equal(s.registered, true); assert.equal(s.count, 1);
  s = await instant.join(ME); assert.equal(s.count, 1, 'deux clics = une inscription');
  s = await instant.quit(ME); assert.equal(s.registered, false); assert.equal(s.count, 0);
  await instant.quit(ME);
});

test('MI inscription : seulement dans les 30 dernières minutes (11 h 29 fermée, 11 h 30 ouverte)', async () => {
  const { instant, t } = await setup({ now: SLOT - MI.signupBefore * 1000 - 60e3 });
  let st = await instant.state(ME);
  assert.equal(st.signupOpen, false); assert.equal(st.signupAt, SLOT - MI.signupBefore * 1000);
  await assert.rejects(instant.join(ME), e => e.status === 409 && e.code === 'signup_closed');
  assert.equal(instant.count(), 0);
  t.now = SLOT - MI.signupBefore * 1000;
  assert.equal((await instant.state(ME)).signupOpen, true);
  await instant.join(ME);
  assert.equal(instant.count(), 1);
  assert.equal(signupOpen(SLOT, SLOT), false, 'à l\'heure pile : fermé (la mine part)');
});

test('MI inscription en session : acceptée (le groupe est gardé) ; encore en session à l\'heure → mine ratée, session continue', async () => {
  const { instant, game, party, t } = await setup();
  const { party: p } = await party.create(ME);
  await party.join(OTHER, p.code);
  await party.launch(ME, {}); await flush();
  assert.ok(await game.activeSessionId(ME.id));
  await instant.join(ME);
  assert.equal(instant.count(), 1);
  assert.equal((await party.state(ME)).party.members.length, 2, 'en session : il reste dans son groupe');
  t.now = SLOT;
  assert.deepEqual(await instant.tick(), [], 'personne n\'entre : il est encore en session');
  assert.equal((await game.state(ME)).session.mode, 'mine', 'sa session normale continue');
  assert.equal(instant.count(), 0, 'son inscription est effacée');
});

test('MI : lancer une session normale ne désinscrit plus ; session finie avant l\'heure → il entre et quitte son groupe', async () => {
  const { instant, game, party, t } = await setup();
  const { party: p } = await party.create(ME);
  await party.join(OTHER, p.code);
  await party.launch(ME, {}); await flush();
  await instant.join(ME);
  await game.leave(ME);                                         // sa session est finie avant l'heure (il l'a quittée)
  assert.equal(await game.activeSessionId(ME.id), null);
  assert.equal(instant.count(), 1, 'toujours inscrit');
  t.now = SLOT;
  const opened = await instant.tick();
  assert.deepEqual(opened.map(s => s.players.map(x => x.account)), [[ME.id]]);
  assert.equal((await party.state(ME)).party, null, 'il a quitté son groupe en entrant dans la mine');
  /* s'inscrire hors session : on quitte son groupe tout de suite (comme avant) */
  const b = await setup();
  const { party: q } = await b.party.create(ME);
  await b.party.join(OTHER, q.code);
  await b.instant.join(OTHER);
  assert.equal((await b.party.state(OTHER)).party, null);
});

test('MI : inscriptions gardées après un redémarrage du serveur', async () => {
  const a = await setup();
  await a.instant.join(ME); await a.instant.join(OTHER);
  const b = await setup({ store: a.store, now: T0 + 1000 });
  assert.equal(b.instant.count(), 2);
  assert.equal((await b.instant.state(ME)).registered, true);
});

/* ---------- ouverture et partie ---------- */

test('MI ouverture : rien avant l\'heure ; à l\'heure, une mine (session « instant ») pour les inscrits, une seule fois', async () => {
  const { instant, game, t } = await setup();
  await instant.join(ME); await instant.join(OTHER);
  assert.deepEqual(await instant.tick(), []);
  t.now = SLOT + 150;
  const opened = await instant.tick();
  assert.equal(opened.length, 1);
  const s = opened[0];
  assert.equal(s.mode, 'mi'); assert.equal(s.id, `mi-${SLOT}-1`);
  assert.deepEqual(s.players.map(p => p.account), [ME.id, OTHER.id]);
  assert.equal(s.startedAt, SLOT); assert.equal(s.finishAt - s.startedAt, instantDurationMs(2));
  assert.equal(s.finishAt - s.startedAt, 150e3, '5 min de jeu = 2 min 30 réelles');
  assert.equal(instant.count(), 0, 'inscriptions vidées');
  assert.equal((await game.state(ME)).session.id, s.id);
  assert.deepEqual(await instant.tick(), [], 'pas deux fois');
  t.now = SLOT + 1000;
  assert.deepEqual(await instant.tick(), []);
  await assert.rejects(game.start(ME, {}), e => e.code === 'session_running');
  await assert.rejects(game.focus(ME, { focus:{} }), e => e.status === 400);
  await assert.rejects(instant.join(ME), e => e.code === 'signup_closed', 'prochaine mine dans 2 h : inscriptions fermées');
});

test('MI ouverture : 21 inscrits → 2 mines (11 + 10) ; un inscrit déjà en session est écarté', async () => {
  const { instant, game, t } = await setup();
  const list = Array.from({ length:21 }, (_, i) => acc(10 + i));
  for(const a of list){ await instant.join(a); t.now += 10; }
  t.now = SLOT;
  const opened = await instant.tick();
  assert.deepEqual(opened.map(s => s.players.length), [11, 10]);
  assert.equal(new Set(opened.flatMap(s => s.players.map(p => p.account))).size, 21);
  /* un joueur encore inscrit mais en session au moment de l'ouverture (inscription restée dans le stockage) */
  const b = await setup({ now: T0 });
  await b.instant.join(OTHER);
  await b.game.start(ME, {}); await flush();
  await b.store.putInstantSignup(ME.id, { account:ME.id, name:'Zoe', at:T0 });
  const c = await setup({ store: b.store, now: T0 + 5 });
  assert.equal(c.instant.count(), 2);
  c.t.now = SLOT;
  const o = await c.instant.tick();
  assert.deepEqual(o.map(s => s.players.map(p => p.account)), [[OTHER.id]]);
  assert.equal((await c.game.state(ME)).session.mode, 'mine', 'sa session normale continue');
});

test('MI partie complète : butin de chacun versé une fois, sans XP ; celui qui quitte ne reçoit rien', async () => {
  const { instant, game, store, t } = await setup();
  await instant.join(ME); await instant.join(OTHER);
  t.now = SLOT; const [s] = await instant.tick();
  t.now = SLOT + 30e3; await game.pump();
  assert.equal((await game.view(ME)).view.mode, 'mi');
  await game.leave(OTHER);
  t.now = s.finishAt + 1; await game.pump();
  const st = await game.state(ME);
  assert.equal(st.session, null);
  assert.equal(st.ended.id, s.id); assert.equal(st.ended.mode, 'mi');
  assert.equal(await game.activeSessionId(ME.id), null, 'après la MI : aucune session (ni MI ni mine)');
  assert.equal(await game.activeSessionId(OTHER.id), null);
  const res = st.ended.result, mine = res.shares.find(x => x.account === ME.id), his = res.shares.find(x => x.account === OTHER.id);
  assert.ok(mine.stats.mined > 50, `miné ${mine.stats.mined}`);
  assert.deepEqual(his.bag, {}); assert.equal(his.left, true);
  const I = await inv(store, ME.id), J = await inv(store, OTHER.id);
  for(const [k, n] of Object.entries(mine.bag)) assert.equal(countOf(I, k), n, k);
  assert.equal(J.slots.length, 0, 'quitter = rien');
  assert.equal((await store.getProgress(ME.id))?.xp ?? 0, 0, 'pas d\'XP');
  /* rien n'est versé deux fois */
  await game.settle(s.id); await game.pump();
  const I2 = await inv(store, ME.id);
  for(const [k, n] of Object.entries(mine.bag)) assert.equal(countOf(I2, k), n, k);
  assert.equal((await game.history(ME)).sessions[0].mode, 'mi');
});

test('MI : redémarrage pendant la mine → même partie reconstruite, pas de seconde mine, versement unique', async () => {
  const a = await setup();
  await a.instant.join(ME); await a.instant.join(OTHER);
  a.t.now = SLOT; const [s] = await a.instant.tick();
  a.t.now = SLOT + 40e3; await a.game.pump();
  await a.game.leave(OTHER);
  a.game.close();
  /* référence : même mine sans redémarrage */
  const ref = await setup();
  await ref.instant.join(ME); await ref.instant.join(OTHER);
  ref.t.now = SLOT; await ref.instant.tick();
  ref.t.now = SLOT + 40e3; await ref.game.pump(); await ref.game.leave(OTHER);
  ref.t.now = s.finishAt + 1; await ref.game.pump();
  const want = (await ref.game.state(ME)).ended.result.shares.find(x => x.account === ME.id).bag;
  assert.ok(Object.keys(want).length > 0);
  /* le serveur redémarre */
  const b = await setup({ store: a.store, now: SLOT + 60e3 });
  await b.game.recover();
  assert.deepEqual(await b.instant.tick(), [], 'la mine n\'est pas rouverte');
  b.t.now = s.finishAt + 1; await b.game.pump();
  const got = (await b.game.state(ME)).ended.result.shares.find(x => x.account === ME.id).bag;
  assert.deepEqual(got, want);
  const I = await inv(b.store, ME.id);
  for(const [k, n] of Object.entries(want)) assert.equal(countOf(I, k), n, k);
});

test('MI : serveur arrêté pendant l\'heure d\'ouverture → les inscrits partent quand même au redémarrage', async () => {
  const a = await setup();
  await a.instant.join(ME);
  const b = await setup({ store: a.store, now: SLOT + 20e3 });
  const o = await b.instant.tick();
  assert.equal(o.length, 1); assert.equal(o[0].startedAt, SLOT);
  assert.equal(b.instant.count(), 0);
});

test('MI dev : ouverture immédiate réservée au mode développeur', async () => {
  const { instant } = await setup();
  await assert.rejects(instant.devOpen(ME), e => e.status === 403);
  assert.equal(MI.maxPerMine, 20);
});
