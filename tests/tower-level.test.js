/* Tours du Jugement : niveau 2 (28/10/2026, Geoffrey). PV des mobs et du boss × 2, dureté des stonebricks × 2, poids des
   stonebricks × 1,5, rage du boss sous 50 %, recul des mobs × 2 ; niveau choisi dans le lobby ; chaque niveau se gagne
   une fois par ouverture. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWER, BLOCKS } from '../src/config.js';
import { newTower, bagFull, mineT, towerLevel } from '../src/sim/tower/session.js';
import { buildTower } from '../src/shared/tower.js';
import { createTowerViewer, applyTowerView } from '../src/shared/tower-view.js';
import { sanitizeJudgment, hasDone, markDone, doneLevels, publicJudgment } from '../src/meta/judgment.js';
import { towerLevelState } from '../src/ui/lobby.js';

const team = n => Array.from({ length: n }, (_, i) => ({ name: 'M' + i, account: 'A' + i }));

test('config : niveau 1 neutre, niveau 2 = PV × 2, dureté × 2, poids × 1,5, rage sous 50 %, recul des mobs × 2', () => {
  assert.deepEqual(TOWER.levels[1], { hp: 1, hard: 1, weight: 1, mobKnock: 1, rageBelow: TOWER.boss.rageBelow });
  assert.deepEqual(TOWER.levels[2], { hp: 2, hard: 2, weight: 1.5, mobKnock: 2, rageBelow: 0.5 });
});

test('niveau 2 : PV du boss et des mobs doublés ; niveau inconnu = 1', () => {
  const a = newTower(3, { side: 'demon', miners: team(2) }), b = newTower(3, { side: 'demon', level: 2, miners: team(2) });
  assert.equal(a.level, 1); assert.equal(b.level, 2);
  assert.equal(b.boss.maxhp, 2 * a.boss.maxhp); assert.equal(b.boss.hp, b.boss.maxhp);
  assert.ok(a.mobs.length > 0);
  assert.deepEqual(b.mobs.map(o => o.hp), a.mobs.map(o => 2 * o.hp));
  assert.deepEqual(a.tiles, b.tiles, 'même tour');
  for(const l of [0, 3, '2', null, undefined, 1.5]) assert.equal(towerLevel(l), 1);
  assert.equal(newTower(3, { level: 9 }).level, 1);
});

test('niveau 2 : une stonebrick prend 2 fois plus de temps et pèse 1,5 fois plus dans le sac', () => {
  const a = newTower(5, { miners: team(1) }), b = newTower(5, { level: 2, miners: team(1) });
  const brick = TOWER.sides.angel.brick, w = BLOCKS[brick].w;
  assert.equal(mineT(b, b.miners[0], brick), 2 * mineT(a, a.miners[0], brick));
  for(const G of [a, b]) Object.assign(G.miners[0], { load: w * 1.5 });
  a.miners[0].carac.pods = b.miners[0].carac.pods = w * 2.6;
  assert.equal(bagFull(a, a.miners[0]), false, 'niveau 1 : une brique de plus rentre');
  assert.equal(bagFull(b, b.miners[0]), true, 'niveau 2 : elle ne rentre plus');
});

test('niveau 2 : la partie du serveur et la copie d\'affichage connaissent le niveau', () => {
  const G = buildTower({ seed: 7, mode: 'tower_angel', level: 2, players: [{ account: 'A0', name: 'M0' }], prefs: {}, gear: {}, skills: {}, spells: {} });
  assert.equal(G.level, 2);
  assert.equal(buildTower({ seed: 7, mode: 'tower_angel', players: [{ account: 'A0', name: 'M0' }], prefs: {}, gear: {}, skills: {}, spells: {} }).level, 1, 'ancienne session : niveau 1');
  const view = applyTowerView(JSON.parse(JSON.stringify(createTowerViewer(G)())));
  assert.equal(view.level, 2);
});

test('une victoire par niveau et par ouverture ; un ancien « fait » (compte seul) vaut le niveau 1', () => {
  const j = sanitizeJudgment({ angel: { count: 0, openUntil: 1e12, opening: 4 }, done: { angel: { opening: 4, accounts: ['OLD'] } } });
  assert.equal(hasDone(j, 'angel', 'OLD'), true); assert.equal(hasDone(j, 'angel', 'OLD', 2), false);
  assert.equal(markDone(j, 'angel', 'ME', 2), true); assert.equal(markDone(j, 'angel', 'ME', 2), false, 'une seule fois');
  assert.deepEqual(doneLevels(j, 'angel', 'ME'), [2]);
  markDone(j, 'angel', 'ME', 1);
  const v = publicJudgment(j, 0, 'ME').sides.angel;
  assert.deepEqual(v.doneLevels, [1, 2]); assert.equal(v.done, true, 'tous les niveaux faits');
  assert.equal(publicJudgment(j, 0, 'OLD').sides.angel.done, false, 'il lui reste le niveau 2');
  const again = sanitizeJudgment(JSON.parse(JSON.stringify(j)));
  assert.deepEqual(doneLevels(again, 'angel', 'ME'), [1, 2], 'relu après un redémarrage');
});

test('lobby : choix du niveau pour celui qui lance ; un niveau fait est grisé, on passe au suivant', () => {
  const me = { id: 'ME' };
  let s = towerLevelState({ tower: 'angel', account: me, doneLevels: [] });
  assert.equal(s.show, true); assert.equal(s.level, 1); assert.deepEqual(s.levels.map(l => l.level), [1, 2]);
  s = towerLevelState({ tower: 'angel', account: me, doneLevels: [1], cur: 1 });
  assert.equal(s.level, 2); assert.equal(s.levels[0].done, true);
  assert.equal(towerLevelState({ tower: 'angel', account: me, doneLevels: [], cur: 2 }).level, 2, 'le choix reste');
  assert.equal(towerLevelState({ tower: 'angel', account: me, doneLevels: [1], dev: true, cur: 1 }).level, 1, 'mode dev : sans limite');
  assert.equal(towerLevelState({ tower: null, account: me }).show, false);
  assert.equal(towerLevelState({ tower: 'angel', account: me, locked: true }).show, false, 'pas pendant une session');
  assert.equal(towerLevelState({ tower: 'angel', account: me, party: { members: [{}, {}], leader: 'X' } }).show, false, 'un membre ne choisit pas');
});
