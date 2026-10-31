/* Classements (onglet Social → Classements, 27/10/2026, Geoffrey) : GS, XP, XP de spécialisation par arbre, meilleur
   temps de tour céleste. Logique pure (src/meta/leaderboard.js), records de tour et classement côté serveur. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUDGMENT, TOWER, GAME, LEADERBOARD, SKILLS, INSTANCE } from '../src/config.js';
import { BOARDS, isBoard, specTree, rankBoard, sanitizeTowerRecord, betterTower, towerTime, sanitizeInstanceRecord, betterInstance } from '../src/meta/leaderboard.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createPartyService } from '../server/party/service.js';
import { createSocialService } from '../server/social/service.js';
import { SOCIAL_SERVER } from '../server/config.js';
import { realDurationMs } from '../src/shared/game.js';
import { fakeLive } from './helpers.js';
import { nameKey } from '../src/shared/account.js';
import { BOARD_INFO, towerDetail, instanceDetail, rankText, boardSubs } from '../src/ui/social.js';
import { createInventory, addItem, serialize } from '../src/meta/inventory.js';
import { instanceDurationMs } from '../src/shared/instances.js';

/* ---------- logique pure ---------- */

test('classements : GS, XP, une XP de spé par arbre, tour, roi gobelin ; un nom inconnu est refusé', () => {
  assert.deepEqual(BOARDS, ['gs', 'xp', ...SKILLS.trees.map(t => 'spec:' + t.id), 'tower', 'tower2', 'instance', 'instance2']);
  assert.ok(isBoard('instance'));
  assert.equal(BOARD_INFO.instance.value({ value: 612.3 }), '10:12.3');
  assert.equal(instanceDetail({ name: 'Zoe', fight: 130.4, team: ['Zoe', 'Max', 'Lou'] }), 'combat 2:10.4 · avec Max, Lou');
  assert.equal(instanceDetail({ name: 'Zoe', fight: null, team: ['Zoe', 'Max'] }), 'avec Max');
  assert.equal(instanceDetail({ name: 'Zoe', fight: 90, team: ['Zoe'] }), 'combat 1:30.0');
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
  assert.deepEqual(ok, { t: 432.5, at: 5, side: 'demon', level: 1, team: ['Zoe', 'Max', 'Lou'], session: 's1' });
  assert.equal(sanitizeTowerRecord({ t: 10, at: 1, side: 'angel', level: 2 }).level, 2, 'niveau gardé (29/10)');
  for(const level of [0, 9, 'x', 1.5, null]) assert.equal(sanitizeTowerRecord({ t: 10, at: 1, side: 'angel', level }), null, `niveau ${level}`);
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
const ADMIN = { id:'DDDD4444', name:'Admin' };
const ACCOUNTS = Object.fromEntries([A, B, C, ADMIN].map(a => [a.id, a]));
const accounts = { getAccount: async id => ACCOUNTS[id] ?? null,
                   findAccountByName: async key => Object.values(ACCOUNTS).find(a => nameKey(a.name) === key) ?? null };
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

test('compte « admin » (LEADERBOARD.hidden) : jamais classé, ni compté, même premier partout (27/10)', async () => {
  assert.ok(LEADERBOARD.hidden.includes('admin'));
  const { store, social } = setup();
  await store.putProgress(ADMIN.id, { xp: 99999, spec: { barbare: 9999 }, credited: [] });
  await store.putProgress(A.id, { xp: 5000, spec: { barbare: 900 }, credited: [] });
  await store.putInventoryAndStuff(ADMIN.id, null, { worn: { pioche: { item: 'Pioche en acier', uid: 1 } }, ops: [] });
  await store.putTowerRecords([[ADMIN.id, { t: 10, at: 1, side: 'angel', team: ['Admin'], session: 's' }]]);
  for(const b of ['xp', 'spec:barbare', 'gs', 'tower']){
    const r = await social.leaderboard(ADMIN, b);
    assert.ok(!r.rows.some(x => x.name === 'Admin'), b); assert.equal(r.me, null, b);
  }
  const xp = await social.leaderboard(A, 'xp');
  assert.deepEqual([xp.total, xp.rows[0].name, xp.rows[0].rank], [1, 'Zoe', 1]);
});

/* ---------- roi gobelin (Instance I, 29/10/2026) ---------- */

test('roi gobelin : record revérifié (temps, combat, instance prête) ; le plus court gagne', () => {
  const ok = sanitizeInstanceRecord({ t: 612.34, fight: 200.06, at: 5, instance: 'instance_1', team: ['Zoe', 'Max', 'Lou', 'Trop'], session: 's1' });
  assert.deepEqual(ok, { t: 612.3, fight: 200.1, at: 5, instance: 'instance_1', team: ['Zoe', 'Max', 'Lou'], session: 's1' });
  for(const bad of [null, 'x', { t: 0, at: 1, instance: 'instance_1' }, { t: 'a', at: 1, instance: 'instance_1' }, { t: 5, instance: 'instance_1' },
                    { t: 5, at: 1, instance: 'instance_2' }, { t: 5, at: 1, instance: 'mine' }])
    assert.equal(sanitizeInstanceRecord(bad), null, JSON.stringify(bad));
  assert.equal(sanitizeInstanceRecord({ t: 100, fight: 150, at: 1, instance: 'instance_1' }).fight, null, 'combat plus long que la partie : ignoré');
  assert.ok(betterInstance(null, ok)); assert.ok(betterInstance({ t: 700 }, ok)); assert.ok(!betterInstance({ t: 612.3 }, ok));
  const r = rankBoard('instance', [{ id: 'a', value: 700, at: 1 }, { id: 'b', value: 500, at: 2 }], 'a');
  assert.deepEqual(r.rows.map(x => [x.rank, x.id]), [[1, 'b'], [2, 'a']]);
});

function setupInstance({ dev = false } = {}){
  let now = 5_000_000, res = { success: true, t: 600, awake: 420 }, leftB = false;
  const store = createMemoryGameStore();
  const summary = rec => ({ id: rec.id, mode: 'instance', instance: rec.mode, ...res,
    shares: rec.players.map(p => ({ account: p.account, left: leftB && p.account === B.id, bag: {} })) });
  const game = createGameService({ store, liveRunner: fakeLive(summary), clock: () => now, randomSeed: () => 7, dev });
  const party = createPartyService({ game, clock: () => now, getAccount: accounts.getAccount });
  const social = createSocialService({ store, accounts, party, game, clock: () => now, config: SOCIAL_SERVER });
  const keys = async ids => { for(const id of ids){ const inv = createInventory(); addItem(inv, INSTANCE.list[0].key, 1); await store.putInventory(id, JSON.parse(serialize(inv))); } };
  /* une instance jouée par players (clé donnée à chacun) ; r : { success, t, awake } ; bLeaves : B part avant la fin */
  const play = async (players, r, bLeaves = false, level) => {
    res = r; leftB = bLeaves;
    await keys(players.map(p => p.account));
    const s = await game.start({ id: players[0].account, name: players[0].name }, { mode: 'instance_1', ...(level ? { level } : {}) }, players);
    if(bLeaves){ now += 5_000; await game.leave(B); }
    if(!dev) now += instanceDurationMs();          // l'heure de fin est passée : la partie se termine (settle)
    await game.settle(s.session.id);
    now += LEADERBOARD.cacheMs;
  };
  return { store, game, social, play };
}

test('roi gobelin vaincu : chaque présent garde son meilleur temps, avec l\'équipe et le temps du combat', async () => {
  const { social, play, store } = setupInstance();
  await play(team, { success: true, t: 612.34, awake: 400 });
  const r = await social.leaderboard(A, 'instance');
  assert.deepEqual(r.rows.map(x => [x.rank, x.name, x.value, x.fight, x.team]),
    [[1, 'Zoe', 612.3, 212.3, ['Zoe', 'Max']], [1, 'Max', 612.3, 212.3, ['Zoe', 'Max']]]);
  assert.equal(r.rows[0].me, true);
  assert.equal((await store.getInstanceRecord(A.id)).session.length > 0, true);
  /* Lou seul, plus rapide ; puis Zoe seule, plus lente (son record reste) ; un échec ne compte pas */
  await play([{ account: C.id, name: C.name }], { success: true, t: 500, awake: 300 });
  await play([{ account: A.id, name: A.name }], { success: true, t: 800, awake: 500 });
  await play([{ account: A.id, name: A.name }], { success: false, t: 100, awake: null });
  const r2 = await social.leaderboard(B, 'instance');
  assert.deepEqual(r2.rows.map(x => [x.rank, x.name, x.value]), [[1, 'Lou', 500], [2, 'Zoe', 612.3], [2, 'Max', 612.3]]);
  assert.equal(r2.rows[1].fight, 212.3, 'le record gardé garde son temps de combat');
});

test('roi gobelin : un joueur parti avant la victoire n\'est pas classé ; le mode dev ne compte pas', async () => {
  const { social, play, store } = setupInstance();
  await play(team, { success: true, t: 650, awake: 450 }, true);
  assert.ok(await store.getInstanceRecord(A.id)); assert.equal(await store.getInstanceRecord(B.id), null);
  assert.deepEqual((await social.leaderboard(A, 'instance')).rows.map(x => [x.name, x.team]), [['Zoe', ['Zoe']]]);
  const d = setupInstance({ dev: true });
  await d.play(team, { success: true, t: 300, awake: 200 });
  assert.equal((await d.social.leaderboard(A, 'instance')).total, 0);
});

test('roi gobelin : rattrapage des victoires gardées d\'avant le classement ; admin jamais classé', async () => {
  const store = createMemoryGameStore();
  const done = (id, t, players, extra = {}) => store.putGameSession({ id, mode: 'instance_1', status: 'done', dev: false, players, leaves: [], endedAt: 1000,
    result: { success: true, t, awake: t - 100, shares: players.map(p => ({ account: p.account, left: false, bag: {} })) }, ...extra });
  await done('s1', 700, team);
  await done('s2', 650, [{ account: C.id, name: 'Lou' }]);
  await done('s3', 100, [{ account: ADMIN.id, name: 'Admin' }]);
  await done('s4', 50, [{ account: B.id, name: 'Max' }], { result: { success: false, t: 50, shares: [] } });   // échec
  const game = createGameService({ store, liveRunner: fakeLive(() => ({})), clock: () => 9e6 });
  const social = createSocialService({ store, accounts, party: createPartyService({ game, getAccount: accounts.getAccount }), game, config: SOCIAL_SERVER });
  const r = await social.leaderboard(C, 'instance');
  assert.deepEqual(r.rows.map(x => [x.rank, x.name, x.value, x.fight]), [[1, 'Lou', 650, 100], [2, 'Zoe', 700, 100], [2, 'Max', 700, 100]]);
  assert.ok(await store.getInstanceRecord(ADMIN.id), 'admin : record gardé…');
  assert.ok(!r.rows.some(x => x.name === 'Admin'), '… mais jamais affiché');
});

test("roi gobelin II (29/10) : un classement par niveau ; le niveau 2 ne touche pas au record du niveau 1", async () => {
  const { social, play, store } = setupInstance();
  await play(team, { success: true, t: 612, awake: 400 });
  await play(team, { success: true, t: 580, awake: 380 }, false, 2);
  assert.deepEqual((await social.leaderboard(A, 'instance')).rows.map(x => [x.name, x.value]), [['Zoe', 612], ['Max', 612]]);
  const r2 = await social.leaderboard(A, 'instance2');
  assert.deepEqual(r2.rows.map(x => [x.name, x.value, x.fight, x.team]), [['Zoe', 580, 200, ['Zoe', 'Max']], ['Max', 580, 200, ['Zoe', 'Max']]]);
  assert.equal((await store.getInstanceRecord(A.id)).t, 612);
  assert.equal((await store.getInstanceRecord(A.id + '#2')).t, 580);
});

test("clé d'un record d'instance : compte au niveau 1, « compte#2 » au niveau 2 ; une clé abîmée n'est pas classée", async () => {
  const { instanceRecordKey, splitInstanceKey } = await import('../src/meta/leaderboard.js');
  assert.equal(instanceRecordKey('AB12', 1), 'AB12'); assert.equal(instanceRecordKey('AB12', 2), 'AB12#2'); assert.equal(instanceRecordKey('AB12'), 'AB12');
  assert.deepEqual(splitInstanceKey('AB12'), { account: 'AB12', level: 1 });
  assert.deepEqual(splitInstanceKey('AB12#2'), { account: 'AB12', level: 2 });
  for(const k of ['AB12#', 'AB12#x', 'AB12#0', 'AB12#-1']) assert.deepEqual(splitInstanceKey(k), { account: null, level: null }, k);
});

/* ---------- tour céleste II (29/10/2026) ---------- */

test('tour céleste II : un classement par niveau ; le niveau 2 ne touche pas au record du niveau 1', async () => {
  const { game, social, advance, store, tower } = setup();
  await game.start(A, {}); advance(realDurationMs()); await game.pump();   // jauge de l'Ange remplie : tour ouverte
  await tower(team, 432.5);
  /* Shrine héroïque (31/10) ; une nouvelle ouverture : une seule victoire par ouverture */
  await store.putShrines(A.id, { active: { heroique: 1 } });
  const j = await store.getJudgment(); j.done.angel.accounts = []; await store.putJudgment(j);
  await tower(team, 300);
  assert.deepEqual((await social.leaderboard(A, 'tower')).rows.map(x => [x.name, x.value]), [['Zoe', 432.5], ['Max', 432.5]]);
  const r2 = await social.leaderboard(A, 'tower2');
  assert.deepEqual(r2.rows.map(x => [x.name, x.value, x.side, x.team]), [['Zoe', 300, 'angel', ['Zoe', 'Max']], ['Max', 300, 'angel', ['Zoe', 'Max']]]);
  assert.deepEqual([(await store.getTowerRecord(A.id)).level, (await store.getTowerRecord(A.id + '#2')).level], [1, 2]);
  assert.equal(BOARD_INFO.tower2.value({ value: 300 }), '5:00.0');
});

test("tour céleste II : les records d'avant les niveaux prennent le niveau de leur session ; un niveau 2 quitte le niveau 1", async () => {
  const store = createMemoryGameStore();
  const done = (id, t, players, extra = {}) => store.putGameSession({ id, mode: 'tower_demon', status: 'done', dev: false, players, leaves: [], endedAt: 1000,
    result: { success: true, t, shares: players.map(p => ({ account: p.account, left: false, bag: {} })) }, ...extra });
  await done('s1', 500, [{ account: A.id, name: 'Zoe' }]);                  // niveau 1, plus lent
  await done('s2', 350, [{ account: A.id, name: 'Zoe' }], { level: 2 });    // niveau 2 : rangé au niveau 1 par l'ancien code
  /* anciens records (sans level) : Zoe = sa victoire du niveau 2, Lou = une session oubliée (niveau 1 par défaut) */
  await store.putTowerRecords([[A.id, { t: 350, at: 900, side: 'demon', team: ['Zoe'], session: 's2' }],
                               [C.id, { t: 420, at: 800, side: 'angel', team: ['Lou'], session: 'perdue' }]]);
  const game = createGameService({ store, liveRunner: fakeLive(() => ({})), clock: () => 9e6 });
  const social = createSocialService({ store, accounts, party: createPartyService({ game, getAccount: accounts.getAccount }), game, config: SOCIAL_SERVER });
  assert.deepEqual((await social.leaderboard(B, 'tower')).rows.map(x => [x.name, x.value]), [['Lou', 420], ['Zoe', 500]]);
  assert.deepEqual((await social.leaderboard(B, 'tower2')).rows.map(x => [x.name, x.value]), [['Zoe', 350]]);
  assert.deepEqual(await store.getTowerRecord(A.id), { t: 500, at: 1000, side: 'demon', level: 1, team: ['Zoe'], session: 's1' });
  assert.equal((await store.getTowerRecord(C.id)).level, 1);
});

/* sous-onglets (29/10) : Spécialisation (un par arbre), Tour céleste et Roi gobelin (un par niveau) ; chaque classement
   est atteignable par un bouton de index.html, ou un sous-onglet de son bouton */
test('sous-onglets des classements : un par arbre, un par niveau ; chaque classement a son bouton', async () => {
  assert.deepEqual(boardSubs('tower').map(s => [s.id, s.label]), [['tower', 'Normal'], ['tower2', 'Héroïque']]);
  assert.deepEqual(boardSubs('instance').map(s => s.id), ['instance', 'instance2']);
  assert.deepEqual(boardSubs('spec').map(s => s.id), SKILLS.trees.map(t => 'spec:' + t.id));
  assert.equal(boardSubs('gs'), null); assert.equal(boardSubs('xp'), null);
  const { readFileSync } = await import('node:fs');
  const groups = [...readFileSync(new URL('../index.html', import.meta.url), 'utf8').matchAll(/data-board="([^"]+)"/g)].map(m => m[1]);
  const reach = groups.flatMap(g => boardSubs(g)?.map(s => s.id) ?? [g]);
  assert.deepEqual([...reach].sort(), [...BOARDS].sort());
});
