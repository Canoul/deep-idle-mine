/* Classements (onglet Social → Classements, 27/10/2026, Geoffrey) : GS, XP, XP de spécialisation par arbre, meilleur
   temps de tour céleste. Logique pure (src/meta/leaderboard.js), records de tour et classement côté serveur. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUDGMENT, TOWER, GAME, LEADERBOARD, SKILLS } from '../src/config.js';
import { BOARDS, isBoard, specTree, rankBoard, sanitizeTowerRecord, betterTower, towerTime } from '../src/meta/leaderboard.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createPartyService } from '../server/party/service.js';
import { createSocialService } from '../server/social/service.js';
import { SOCIAL_SERVER } from '../server/config.js';
import { realDurationMs } from '../src/shared/game.js';
import { fakeLive } from './helpers.js';
import { BOARD_INFO, towerDetail, rankText } from '../src/ui/social.js';

/* ---------- logique pure ---------- */

test('classements : GS, XP, une XP de spé par arbre, tour ; un nom inconnu est refusé', () => {
  assert.deepEqual(BOARDS, ['gs', 'xp', ...SKILLS.trees.map(t => 'spec:' + t.id), 'tower']);
  assert.ok(isBoard('spec:barbare') && !isBoard('spec:') && !isBoard('inventaire') && !isBoard(undefined));
  assert.equal(specTree('spec:barbare'), 'barbare'); assert.equal(specTree('xp'), null);
});

test('rang : plus grand d\'abord (tour : plus court d\'abord), ex aequo au même rang, 0 et invalides pas classés', () => {
  const e = [{ id:'a', value:10 }, { id:'b', value:30 }, { id:'c', value:30 }, { id:'d', value:0 }, { id:'e', value:NaN }, { id:'f', value:5 }];
  const r = rankBoard('xp', e, 'f');
  assert.deepEqual(r.rows.map(x => [x.id, x.rank]), [['b', 1], ['c', 1], ['a', 3], ['f', 4]]);
  assert.equal(r.total, 4); assert.equal(r.me, null, 'dans le top : pas de ligne en plus');
  assert.equal(r.rows.find(x => x.id === 'f').me, true);
  const t = rankBoard('tower', [{ id:'a', value:400, at:2 }, { id:'b', value:300, at:5 }, { id:'c', value:400, at:1 }], 'a');
  assert.deepEqual(t.rows.map(x => [x.id, x.rank]), [['b', 1], ['c', 2], ['a', 2]], 'égalité : le plus ancien d\'abord');
});

test('top `size` : ma ligne s\'ajoute avec mon rang si je n\'y suis pas', () => {
  const e = Array.from({ length: 80 }, (_, i) => ({ id: 'p' + i, value: 1000 - i }));
  const r = rankBoard('gs', e, 'p70');
  assert.equal(r.rows.length, LEADERBOARD.size); assert.equal(r.total, 80);
  assert.deepEqual([r.me.id, r.me.rank, r.me.me], ['p70', 71, true]);
  assert.equal(rankBoard('gs', e, 'inconnu').me, null);
});

test('record de tour : revérifié, plus rapide seulement, temps affiché m:ss.d', () => {
  const ok = sanitizeTowerRecord({ t: 432.46, at: 5, side: 'demon', team: ['Zoe', 'Max', 'Lou', 'Trop'], session: 's1' });
  assert.deepEqual(ok, { t: 432.5, at: 5, side: 'demon', team: ['Zoe', 'Max', 'Lou'], session: 's1' });
  for(const bad of [null, { t: 0, at: 1, side: 'angel' }, { t: 10, at: 1, side: 'nul' }, { t: Infinity, at: 1, side: 'angel' }, { t: 10, side: 'angel' }])
    assert.equal(sanitizeTowerRecord(bad), null);
  assert.ok(betterTower(null, ok)); assert.ok(betterTower({ t: 500 }, ok));
  assert.ok(!betterTower({ t: 432.5 }, ok), 'égalité : l\'ancien garde sa place'); assert.ok(!betterTower(ok, null));
  assert.equal(towerTime(432.5), '7:12.5'); assert.equal(towerTime(65), '1:05.0'); assert.equal(towerTime(599.96), '10:00.0');
});

test('affichage : valeurs, détail d\'un record de tour, rang', () => {
  assert.equal(BOARD_INFO.gs.value({ value: 1234 }), `${(1234).toLocaleString('fr-FR')} GS`);
  assert.equal(BOARD_INFO.tower.value({ value: 432.5 }), '7:12.5');
  assert.equal(towerDetail({ name: 'Zoe', side: 'angel', team: ['Zoe', 'Max'] }), 'Ange · avec Max');
  assert.equal(towerDetail({ name: 'Zoe', side: 'demon', team: ['Zoe'] }), 'Démon');
  assert.equal(rankText(1, 9), '1er sur 9'); assert.equal(rankText(12, 340), '12e sur 340');
});

/* ---------- serveur ---------- */

const A = { id:'AAAA1111', name:'Zoe' }, B = { id:'BBBB2222', name:'Max' }, C = { id:'CCCC3333', name:'Lou' };
const ACCOUNTS = Object.fromEntries([A, B, C].map(a => [a.id, a]));
const accounts = { getAccount: async id => ACCOUNTS[id] ?? null, findAccountByName: async () => null };
const team = [A, B].map(a => ({ account: a.id, name: a.name }));

function setup({ dev = false } = {}){
  let now = 5_000_000, towerT = 400;
  const clock = () => now;
  const store = createMemoryGameStore();
  /* une mine qui remplit la jauge de l'Ange ; une tour gagnée en towerT secondes de jeu */
  const summary = rec => rec.mode === 'tower_angel'
    ? { id: rec.id, mode: 'tower', side: 'angel', success: true, t: towerT, loot: {},
        shares: rec.players.map(p => ({ account: p.account, left: rec.leaves.some(l => l.account === p.account), bag: {} })) }
    : { id: rec.id, shares: rec.players.map(p => ({ account: p.account, left: false, bag: { [JUDGMENT.sides.angel.item]: JUDGMENT.cap }, xp: 0 })) };
  const game = createGameService({ store, liveRunner: fakeLive(summary), clock, randomSeed: () => 7, dev });
  const party = createPartyService({ game, clock, getAccount: accounts.getAccount });
  const social = createSocialService({ store, accounts, party, game, clock, config: SOCIAL_SERVER });
  const advance = ms => { now += ms; };
  const tower = async (players, t) => { towerT = t; await game.start({ id: players[0].account, name: players[0].name }, { mode: 'tower_angel' }, players);
    advance(TOWER.duration / GAME.speed * 1000); await game.pump(); };
  return { store, game, social, advance, tower, clock };
}

test('tour gagnée : chaque présent garde son meilleur temps, avec l\'équipe ; un temps plus lent ne remplace rien', async () => {
  const { game, social, advance, tower, store } = setup();
  await game.start(A, {}); advance(realDurationMs()); await game.pump();       // ouvre la tour de l'Ange
  await tower(team, 432.46);
  const r = await social.leaderboard(A, 'tower');
  assert.deepEqual(r.rows.map(x => [x.rank, x.name, x.value, x.side, x.team]),
    [[1, 'Zoe', 432.5, 'angel', ['Zoe', 'Max']], [1, 'Max', 432.5, 'angel', ['Zoe', 'Max']]]);
  assert.equal(r.rows[0].me, true); assert.equal(r.me, null);
  assert.equal((await store.getTowerRecord(A.id)).t, 432.5);
  /* nouvelle ouverture : C seul, plus rapide ; puis A plus lent (son record reste) */
  await game.start(C, {}); advance(realDurationMs()); await game.pump();
  advance(JUDGMENT.openHours * 3600e3);
  await game.start(C, {}); advance(realDurationMs()); await game.pump();
  await tower([{ account: C.id, name: C.name }], 300);
  await game.start(A, {}); advance(realDurationMs()); await game.pump();
  advance(JUDGMENT.openHours * 3600e3);
  await game.start(A, {}); advance(realDurationMs()); await game.pump();
  await tower([{ account: A.id, name: A.name }], 500);
  advance(LEADERBOARD.cacheMs);
  const r2 = await social.leaderboard(B, 'tower');
  assert.deepEqual(r2.rows.map(x => [x.rank, x.name, x.value]), [[1, 'Lou', 300], [2, 'Zoe', 432.5], [2, 'Max', 432.5]]);
});

test('tour : un joueur parti avant la victoire n\'est pas classé ; une session en mode dev ne compte pas', async () => {
  const { game, social, advance, store } = setup();
  await game.start(A, {}); advance(realDurationMs()); await game.pump();
  await game.start(A, { mode: 'tower_angel' }, team);
  advance(60_000); await game.leave(B, {});
  advance(TOWER.duration / GAME.speed * 1000); await game.pump();
  assert.ok(await store.getTowerRecord(A.id)); assert.equal(await store.getTowerRecord(B.id), null);
  assert.deepEqual((await social.leaderboard(A, 'tower')).rows[0].team, ['Zoe']);
  const d = setup({ dev: true });
  await d.tower(team, 200);
  assert.equal((await d.social.leaderboard(A, 'tower')).total, 0);
});

test('rattrapage : les victoires en tour gardées d\'avant les records deviennent des records', async () => {
  const store = createMemoryGameStore();
  const done = (id, t, players, extra = {}) => store.putGameSession({ id, mode: 'tower_demon', status: 'done', dev: false, players, leaves: [], endedAt: 1000,
    result: { success: true, t, shares: players.map(p => ({ account: p.account, left: false, bag: {} })) }, ...extra });
  await done('s1', 380, team);
  await done('s2', 350, [{ account: B.id, name: 'Max' }]);
  await done('s3', 100, [{ account: C.id, name: 'Lou' }], { result: { success: false, t: 100, shares: [] } });   // échec
  const game = createGameService({ store, liveRunner: fakeLive(() => ({})), clock: () => 9e6 });
  const social = createSocialService({ store, accounts, party: createPartyService({ game, getAccount: accounts.getAccount }), game, config: SOCIAL_SERVER });
  const r = await social.leaderboard(C, 'tower');
  assert.deepEqual(r.rows.map(x => [x.name, x.value, x.side]), [['Max', 350, 'demon'], ['Zoe', 380, 'demon']]);
  assert.equal(r.me, null, 'pas classé : pas de ligne');
});

test('GS, XP et XP de spé : tous les comptes, classés par le serveur ; classement inconnu refusé', async () => {
  const { store, social } = setup();
  await store.putProgress(A.id, { xp: 5000, spec: { barbare: 900 }, credited: [] });
  await store.putProgress(B.id, { xp: 8000, spec: { mineur: 400, barbare: 100 }, credited: [] });
  await store.putProgress(C.id, { xp: -5, spec: { barbare: 'x' }, credited: [] });             // invalide : pas classé
  await store.putInventoryAndStuff(A.id, null, { worn: { pioche: { item: 'Pioche en acier', uid: 1 } }, ops: [] });
  await store.putInventoryAndStuff(B.id, null, { worn: { pioche: { item: 'Objet inventé', uid: 2 } }, ops: [] });   // ignoré : GS 0
  const xp = await social.leaderboard(A, 'xp');
  assert.deepEqual(xp.rows.map(x => [x.rank, x.name, x.value, x.level]), [[1, 'Max', 8000, xp.rows[0].level], [2, 'Zoe', 5000, xp.rows[1].level]]);
  assert.ok(xp.rows[0].level > 1);
  assert.deepEqual((await social.leaderboard(A, 'spec:barbare')).rows.map(x => [x.name, x.value]), [['Zoe', 900], ['Max', 100]]);
  assert.deepEqual((await social.leaderboard(A, 'spec:mineur')).rows.map(x => x.name), ['Max']);
  const gs = await social.leaderboard(B, 'gs');
  assert.deepEqual(gs.rows.map(x => x.name), ['Zoe']); assert.ok(gs.rows[0].value > 0); assert.equal(gs.me, null);
  for(const bad of ['', 'inventaire', 'spec:', null]) await assert.rejects(social.leaderboard(A, bad), { code: 'bad_request' });
});
