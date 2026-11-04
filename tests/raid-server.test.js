/* Raid Cerbère (serveur, 04/11/2026) : lobby de raid de la guilde (server/guild/raid.js), lancement de la session
   (game.startRaid), partie en direct (mode 'raid'), vue (src/shared/raid-view.js), départ, fin réglée une seule fois. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createInlineRunner } from '../server/game/live.js';
import { createGuildService } from '../server/guild/service.js';
import { GAME, RAID, MINE_MODES, AREA_Y0, AREA_H, DT } from '../src/config.js';
import { nameKey } from '../src/shared/account.js';
import { raidDurationMs } from '../src/shared/raid.js';
import { createLiveGame } from '../server/game/live-game.js';
import { applyRaidView } from '../src/shared/raid-view.js';
import './helpers.js';

const acc = i => ({ id: String.fromCharCode(65 + i).repeat(8), name: 'Joueur' + i, guest: false });
const PEOPLE = Array.from({ length: 12 }, (_, i) => acc(i));
const [CHIEF, MAX, LEA] = PEOPLE;
const OUT = { id: 'Z'.repeat(8), name: 'Dehors', guest: false };

async function setup(n = 3){
  const store = createMemoryGameStore(), t = { now: Date.UTC(2026, 10, 4, 12, 0) };
  const game = createGameService({ store, liveRunner: createInlineRunner, clock: () => t.now, randomSeed: () => 4242 });
  const all = [...PEOPLE, OUT];
  let k = 0;
  const guild = createGuildService({ store, clock: () => t.now, makeId: () => `g${++k}`, game,
    accounts: { getAccount: async id => all.find(a => a.id === id) ?? null, findAccountByName: async key => all.find(a => nameKey(a.name) === key) ?? null },
    statusOf: async () => ({ status: 'offline' }) });
  await guild.create(CHIEF, 'Les Rois');
  for(const p of PEOPLE.slice(1, n)){ await guild.invite(CHIEF, p.name); await guild.acceptInvite(p, 'g1'); }
  return { store, game, guild, t };
}
const rejects = (p, code) => assert.rejects(p, e => e.code === code, code);
const raidOf = async (guild, me) => (await guild.view(me)).mine.raid;

test('le raid n\'est pas dans le lobby normal : start le refuse', async () => {
  assert.ok(!MINE_MODES.some(m => m.id === 'raid'));
  const { game } = await setup(1);
  await rejects(game.start(CHIEF, { mode: 'raid' }), 'bad_request');
});

test('lobby : membres de la guilde seulement, chef = premier arrivé, au plus RAID.maxPlayers', async () => {
  const { guild } = await setup(12);
  await rejects(guild.raidJoin(OUT), 'no_guild');
  let r = (await guild.raidJoin(MAX)).mine.raid;
  assert.equal(r.leader, MAX.id); assert.ok(r.isLeader); assert.ok(r.mine); assert.equal(r.max, RAID.maxPlayers);
  await guild.raidJoin(MAX);                                       // double clic : rien
  for(const p of PEOPLE.filter(p => p !== MAX).slice(0, RAID.maxPlayers - 1)) await guild.raidJoin(p);
  r = await raidOf(guild, MAX);
  assert.equal(r.size, RAID.maxPlayers);
  await rejects(guild.raidJoin(PEOPLE[11]), 'raid_full');
  /* le chef part : le suivant devient chef */
  r = (await guild.raidLeave(MAX)).mine.raid;
  assert.ok(!r.mine); assert.equal(r.leader, CHIEF.id);
  /* un membre qui quitte la guilde sort du lobby */
  await guild.leave(LEA);
  assert.ok(!(await raidOf(guild, CHIEF)).members.some(m => m.account === LEA.id));
});

test('lancement : seulement le chef du raid, et quand tous les autres sont prêts ; une arrivée remet « pas prêt »', async () => {
  const { guild, game } = await setup(3);
  await guild.raidJoin(CHIEF); await guild.raidJoin(MAX);
  await rejects(guild.raidLaunch(MAX), 'not_leader');
  await rejects(guild.raidLaunch(CHIEF), 'not_ready');
  await rejects(guild.raidReady(MAX, 'oui'), 'bad_request');
  let r = (await guild.raidReady(MAX, true)).mine.raid;
  assert.ok(r.members.find(m => m.account === MAX.id).ready);
  await guild.raidJoin(LEA);
  r = await raidOf(guild, CHIEF);
  assert.ok(!r.members.find(m => m.account === MAX.id).ready, 'arrivée de Lea : Max repasse pas prêt');
  assert.deepEqual(r.waiting.sort(), [MAX.name, LEA.name].sort());
  await rejects(guild.raidLaunch(CHIEF), 'not_ready');
  /* le chef sort Lea */
  await rejects(guild.raidKick(MAX, LEA.id), 'not_leader');
  await guild.raidKick(CHIEF, LEA.id);
  await guild.raidReady(MAX, true);
  assert.ok((await raidOf(guild, CHIEF)).canLaunch);
  const v = await guild.raidLaunch(CHIEF);
  assert.equal(v.session.mode, 'raid');
  assert.deepEqual(v.session.players.map(p => p.account), [CHIEF.id, MAX.id]);
  assert.equal(v.mine.raid.size, 0, 'lancé : le lobby est vidé');
  assert.equal(v.mine.raid.running.id, v.session.id); assert.ok(v.mine.raid.running.mine);
  assert.equal(await game.activeSessionId(MAX.id), v.session.id);
  assert.equal(await game.activeSessionId(LEA.id), null);
  /* déjà en session : ni rejoindre, ni lancer un autre raid */
  await rejects(guild.raidJoin(MAX), 'session_running');
  await guild.raidJoin(LEA);
  assert.ok((await raidOf(guild, LEA)).running, 'Lea voit le raid de sa guilde en cours');
});

test('session de raid : enregistrement, durée, vue de la mine avec l\'en-tête raid, départ appliqué', async () => {
  const { store, game, guild, t } = await setup(2);
  await guild.raidJoin(CHIEF); await guild.raidJoin(MAX); await guild.raidReady(MAX, true);
  const { session } = await guild.raidLaunch(CHIEF);
  const rec = await store.getGameSession(session.id);
  assert.equal(rec.mode, 'raid'); assert.equal(rec.guild, 'g1'); assert.equal(rec.status, 'running');
  assert.equal(rec.finishAt - rec.startedAt, raidDurationMs(GAME.speed));
  for(const k of ['prefs', 'looks', 'gear', 'skills', 'spells']) assert.ok(rec[k][CHIEF.id] !== undefined && rec[k][MAX.id] !== undefined, k);
  await rejects(game.focus(CHIEF, { focus: { area: 0 } }), 'bad_request');
  t.now += 5000; await game.pump();
  const { view } = await game.view(CHIEF);
  assert.equal(view.mode, 'raid'); assert.equal(view.phase, 'mine'); assert.ok(view.full && view.rows);
  assert.equal(view.raid.phase, 'mine'); assert.equal(view.raid.total, RAID.mine.clues);
  assert.ok(view.raid.timeLeft > 0 && view.raid.timeLeft <= RAID.duration);
  assert.equal(view.miners.length, 2);
  const M = applyRaidView(view, null, 0);
  assert.equal(M.phase, 'mine'); assert.ok(M.tiles.length > 0); assert.equal(M.raid.phase, 'mine');
  /* Max quitte : sorti de la partie, plus en session ; Zoe continue */
  await game.leave(MAX);
  assert.equal(await game.activeSessionId(MAX.id), null);
  const v2 = (await game.view(CHIEF)).view;
  assert.deepEqual(v2.miners.map(m => m.account), [CHIEF.id]);
  assert.equal((await store.getGameSession(session.id)).leaves[0].account, MAX.id);
});

test('fin : temps écoulé, réglée une seule fois (status done, aucun objet ni XP), dans l\'historique en mode raid', async () => {
  const { store, game, guild, t } = await setup(1);
  await guild.raidJoin(CHIEF);
  const { session } = await guild.raidLaunch(CHIEF);
  t.now += raidDurationMs(GAME.speed) + 1000;
  for(let i = 0; i < 80 && (await store.getGameSession(session.id)).status !== 'done'; i++) await game.pump();
  const rec = await store.getGameSession(session.id);
  assert.equal(rec.status, 'done'); assert.equal(rec.result.mode, 'raid'); assert.equal(rec.result.success, false);
  const ended = rec.endedAt;
  await game.settle(session.id); await game.pump();
  assert.equal((await store.getGameSession(session.id)).endedAt, ended, 'rejouée : rien ne change');
  assert.equal((await store.getProgress(CHIEF.id))?.xp ?? 0, 0, 'pas d\'XP');
  assert.equal(await store.getInventory(CHIEF.id), null, 'rien versé (récompense à définir)');
  const h = await game.history(CHIEF);
  assert.equal(h.sessions[0].mode, 'raid');
  assert.equal(await game.activeSessionId(CHIEF.id), null);
  assert.equal((await raidOf(guild, CHIEF)).running, null);
});

test('vue de l\'arène (phase boss) : boss, mineurs (pierre, morsure), en-tête raid', () => {
  const rec = { id: 'r1', mode: 'raid', seed: 7, players: [{ account: 'A', name: 'Zoe' }, { account: 'B', name: 'Max' }], prefs: {}, looks: {}, gear: {}, skills: {}, spells: {}, leaves: [] };
  const g = createLiveGame(rec), G = g.G;
  G.mine.chest.Indice = RAID.mine.clues;                            // tous les Indices rapportés
  g.advance(20);
  let v = g.view(null);
  assert.equal(v.phase, 'door'); assert.ok(v.raid.doorLeft > 0);
  g.advance(20 + Math.round(RAID.mine.gather / DT) + 2);
  assert.equal(G.phase, 'boss');
  G.boss.miners[1].stone = { hp: 30, max: 50 }; G.boss.miners[0].bitUntil = G.boss.t + 1;
  v = g.view(null);
  assert.equal(v.phase, 'boss'); assert.equal(v.raid.phase, 'boss');
  assert.equal(v.boss.name, RAID.cerbere.boss.name); assert.equal(v.w, RAID.cerbere.w);
  for(const k of ['hp', 'maxhp', 'x', 'y', 'w', 'h', 'rage', 'biteAgo', 'sweepAgo', 'magmaAgo', 'targets']) assert.ok(k in v.boss, k);
  assert.deepEqual(v.miners[1].stone, { hp: 30, max: 50 }); assert.ok(v.miners[0].bitten > 0.5);
  assert.ok(v.log.length <= 20);
  const A = applyRaidView(v, null, 0);
  assert.equal(A.phase, 'boss'); assert.equal(A.tiles.length, RAID.cerbere.h + 1);
  g.leave('B');
  assert.equal(g.view(null).miners.length, 1, 'départ appliqué dans l\'arène');
});

test('2 groupes de 5 : on choisit son groupe, le chef du raid déplace, groupe plein refusé, groupes gardés au lancement', async () => {
  const { guild, store } = await setup(12);
  let r = (await guild.raidJoin(CHIEF, 2)).mine.raid;
  assert.equal(r.groups, RAID.groups); assert.equal(r.groupSize, RAID.groupSize);
  assert.equal(r.members[0].group, 2, 'groupe choisi');
  for(const p of PEOPLE.slice(1, 5)) await guild.raidJoin(p, 2);
  await guild.raidJoin(PEOPLE[5], 2);                                // groupe 2 plein : il va dans le groupe 1
  r = await raidOf(guild, CHIEF);
  assert.equal(r.members.filter(m => m.group === 2).length, RAID.groupSize);
  assert.equal(r.members.find(m => m.account === PEOPLE[5].id).group, 1);
  await rejects(guild.raidMove(PEOPLE[5], 2), 'group_full');
  await rejects(guild.raidMove(PEOPLE[5], 3), 'bad_request');
  await rejects(guild.raidMove(PEOPLE[5], 1, PEOPLE[1].id), 'not_leader');
  await guild.raidMove(CHIEF, 1, PEOPLE[1].id);                      // le chef déplace
  await guild.raidMove(PEOPLE[5], 2);                                // une place s'est libérée
  r = await raidOf(guild, CHIEF);
  assert.equal(r.members.find(m => m.account === PEOPLE[1].id).group, 1);
  assert.equal(r.members.find(m => m.account === PEOPLE[5].id).group, 2);
  for(const p of PEOPLE.slice(1, 6)) await guild.raidReady(p, true);
  const { session } = await guild.raidLaunch(CHIEF);
  const rec = await store.getGameSession(session.id);
  assert.deepEqual(rec.players.map(p => [p.account, p.group]), r.members.map(m => [m.account, m.group]).sort((a, b) => (a[0] === CHIEF.id ? -1 : b[0] === CHIEF.id ? 1 : 0)));
});

test('bêta : inviter un joueur par son pseudo dans le lobby, même hors de la guilde ; il entre prêt et part au lancement', async () => {
  const { guild, store } = await setup(2);
  await rejects(guild.raidInvite(CHIEF, OUT.name), 'not_in_raid');
  await guild.raidJoin(CHIEF);
  await rejects(guild.raidInvite(CHIEF, 'Personne'), 'not_found');
  const r = await guild.raidInvite(CHIEF, OUT.name);
  assert.deepEqual(r.invited, { name: OUT.name, group: 1 });
  const m = r.mine.raid.members.find(x => x.account === OUT.id);
  assert.ok(m && m.ready && m.invited, 'dans le lobby, prêt');
  await rejects(guild.raidInvite(CHIEF, OUT.name), 'already_in_raid');
  assert.ok((await raidOf(guild, CHIEF)).members.some(x => x.account === OUT.id), 'pas retiré : il n\'est pas de la guilde');
  const { session } = await guild.raidLaunch(CHIEF);
  assert.ok((await store.getGameSession(session.id)).players.some(p => p.account === OUT.id));
});

test('lobby : chaque membre vient avec sa spé, son niveau de spé, son apparence et son aura', async () => {
  const { guild } = await setup(1);
  const m = (await guild.raidJoin(CHIEF)).mine.raid.members[0];
  for(const k of ['tree', 'specLevel', 'look', 'auras']) assert.ok(k in m, k);
});
