/* Tableau de bord de l'équipe (server/admin/dashboard.js) : ilvl, lignes de fin de session, moyennes, page HTML ;
   côté serveur : photo au lancement, une ligne par joueur présent, écrite une seule fois, mine classique seulement. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DASHBOARD } from '../src/config.js';
import { itemValue } from '../src/meta/piece.js';
import { ilvlOf, launchSnapshot, statRows, meanBy, charts, dashboardData, renderDashboard, withGroupIlvl } from '../server/admin/dashboard.js';
import { realDurationMs } from '../src/shared/game.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { fakeLive } from './helpers.js';
import { newSession, tick } from '../src/sim/session.js';

const SWORD = 'Épée en fer', PICK = 'Pioche en fer';

test('ilvl : somme des valeurs en x des pièces portées (nom ou pièce identifiée), objets inconnus = 0', () => {
  assert.equal(ilvlOf({}), 0);
  assert.equal(ilvlOf(null), 0);
  const want = Math.round(itemValue(SWORD) + itemValue(PICK));
  assert.ok(want > 0, 'les pièces en fer ont une valeur');
  assert.equal(ilvlOf({ weapon: SWORD, pick: { item: PICK, q: 5, plus: 2 } }), want);
  assert.equal(ilvlOf({ a: 'Objet inconnu', b: { item: 42 }, c: null }), 0);
});

test('photo au lancement : niveau (depuis l\'XP), arbre, ilvl', () => {
  assert.deepEqual(launchSnapshot({ xp: 0, tree: 'barbare', gear: {} }), { level: 1, tree: 'barbare', ilvl: 0 });
  assert.equal(launchSnapshot({ xp: 0, tree: undefined, gear: {} }).tree, null);
});

const rec = (over = {}) => ({ id: 'S1', mode: 'mine', dev: false, startedAt: 10, endedAt: 99,
  players: [{ account: 'A', name: 'Zoe' }, { account: 'B', name: 'Max' }],
  statsAt: { A: { level: 3, tree: 'mineur', ilvl: 500 }, B: { level: 5, tree: 'barbare', ilvl: 900 } }, ...over });
const summary = { maxDepth: 140, areasUnlocked: 3,
  miners: [{ account: 'A', stats: { mined: 400, hitTime: 12.34 } }, { account: 'B', stats: { mined: 150, hitTime: 300 } }],
  shares: [{ account: 'A', left: false }, { account: 'B', left: false }] };

test('lignes : une par joueur présent, avec ses blocs, son temps à frapper et la profondeur du groupe', () => {
  const rows = statRows(rec(), summary);
  assert.deepEqual(rows.map(r => r.key), ['S1:A', 'S1:B']);
  assert.deepEqual(rows[0].value, { session: 'S1', account: 'A', name: 'Zoe', at: 99, level: 3, tree: 'mineur', ilvl: 500,
                                    mined: 400, hitTime: 12.3, depth: 140, areas: 3, players: 2 });
  assert.equal(rows[1].value.hitTime, 300);
});

test('lignes : rien pour les tours, la MI, le mode dev, une session sans photo ou abandonnée ; partis exclus', () => {
  for(const r of [rec({ mode: 'tower_angel' }), rec({ mode: 'mi' }), rec({ dev: true }), rec({ statsAt: undefined })])
    assert.deepEqual(statRows(r, summary), [], r.mode);
  assert.deepEqual(statRows(rec(), { ...summary, abandoned: true }), []);
  const one = statRows(rec(), summary, a => a === 'B');
  assert.deepEqual(one.map(r => [r.value.account, r.value.players]), [['A', 1]]);
});

test('moyennes : par niveau et par tranche d\'ilvl, triées, valeurs invalides ignorées', () => {
  const rows = [{ level: 2, v: 10 }, { level: 1, v: 4 }, { level: 2, v: 20 }, { level: NaN, v: 1 }];
  assert.deepEqual(meanBy(rows, r => r.level, r => r.v), [{ x: 1, y: 4, n: 1 }, { x: 2, y: 15, n: 2 }]);
  const s = DASHBOARD.ilvlStep;
  const c = charts([{ tree: 'mineur', level: 1, ilvl: 0, depth: 50, mined: 10, hitTime: 0 },
                    { tree: 'barbare', level: 1, ilvl: s + 1, depth: 90, mined: 30, hitTime: 120 }]);
  const by = Object.fromEntries(c.map(x => [x.id, x.series[0].points]));
  assert.deepEqual(by.depth_ilvl, [{ x: 0, y: 50, n: 1 }, { x: s, y: 90, n: 1 }]);
  assert.deepEqual(by.barbare_mobs, [{ x: 1, y: 2, n: 1 }], 'minutes');
  assert.deepEqual(by.mineur, [{ x: 1, y: 10, n: 1 }]);
  assert.deepEqual(by.logisticien, []);
});

test('page : autonome, données intégrées sans pouvoir fermer le script, une vue par joueur', () => {
  const rows = statRows(rec({ players: [{ account: 'A', name: '</script><b>$&' }, { account: 'B', name: 'Max' }] }), summary).map(r => r.value);
  const d = dashboardData(rows, 1);
  assert.deepEqual(Object.keys(d.views).sort(), ['A', 'B', 'all']);
  const html = renderDashboard(rows, 1);
  assert.ok(html.startsWith('<!doctype html>'));
  assert.equal(html.split('</script>').length, 2, 'un seul </script> : celui de la page');
  assert.ok(!html.includes('/*DATA*/null'));
  assert.ok(html.includes('$&'), 'le pseudo est gardé tel quel');
  assert.ok(!/https?:\/\//.test(html), 'aucun appel réseau');
});

test('simulation : le temps passé à frapper est compté par mineur', () => {
  const G = newSession(7, { miners: 1 });
  const m = G.miners[0];
  m.action = { type: 'attack', data: { done: true, mob: {} }, t: 0, dur: 1 };
  const before = m.stats.hitTime;
  tick(G);
  assert.ok(m.stats.hitTime > before);
});

test('serveur : photo au lancement, une ligne par joueur à la fin, une seule fois ; rien pour une session dev', async () => {
  let now = 1_000_000;
  const sum = r => ({ id: r.id, areasUnlocked: 2, maxDepth: 120,
    miners: r.players.map(p => ({ account: p.account, stats: { mined: 77, hitTime: 30 } })),
    shares: r.players.map(p => ({ account: p.account, left: false, bag: {}, xp: 0 })) });
  const store = createMemoryGameStore();
  const game = createGameService({ store, liveRunner: fakeLive(sum), clock: () => now, randomSeed: () => 4242 });
  const A = { id: 'AAAA1111', name: 'Zoe' };
  await game.start(A, {});
  const [s] = await store.sessionsOf(A.id);
  assert.deepEqual(s.statsAt[A.id], { level: 1, tree: null, ilvl: 0 });
  now += realDurationMs() + 1000; await game.pump(); await game.pump();
  const rows = await game.adminStats();
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].name, rows[0].mined, rows[0].hitTime, rows[0].depth], ['Zoe', 77, 30, 120]);
  assert.equal(await store.putSessionStats(statRows({ ...s, endedAt: now }, sum(s))), 0, 'déjà écrite : pas de doublon');

  const devGame = createGameService({ store: createMemoryGameStore(), liveRunner: fakeLive(sum), clock: () => now, dev: true, randomSeed: () => 1 });
  await devGame.start(A, {});
  assert.equal((await devGame.state(A)).session.statsAt, undefined);
});

test('profondeur par ilvl du groupe : ilvl moyen des présents, une seule fois par session, aussi dans la vue d\'un joueur', () => {
  const st = DASHBOARD.ilvlStep;
  const rows = [
    { session: 'S1', account: 'A', name: 'Zoe', tree: 'mineur', level: 1, ilvl: 0, depth: 100, mined: 1, hitTime: 0, at: 2 },
    { session: 'S1', account: 'B', name: 'Max', tree: 'barbare', level: 1, ilvl: 2 * st, depth: 100, mined: 1, hitTime: 0, at: 2 },
    { session: 'S2', account: 'A', name: 'Zoe', tree: 'mineur', level: 1, ilvl: 0, depth: 60, mined: 1, hitTime: 0, at: 1 },
  ];
  assert.deepEqual(withGroupIlvl(rows).map(r => r.groupIlvl), [st, st, 0]);
  const d = dashboardData(rows, 1);
  const pts = v => d.views[v].find(c => c.id === 'depth_group_ilvl').series[0].points;
  assert.deepEqual(pts('all'), [{ x: 0, y: 60, n: 1 }, { x: st, y: 100, n: 1 }], 'S1 comptée une fois');
  assert.deepEqual(pts('A'), [{ x: 0, y: 60, n: 1 }, { x: st, y: 100, n: 1 }], 'ilvl de tout le groupe, pas seulement de Zoe');
  assert.deepEqual(pts('B'), [{ x: st, y: 100, n: 1 }]);
  assert.equal(d.history[0].groupIlvl, st);
});
