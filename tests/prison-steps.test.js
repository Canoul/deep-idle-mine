/* Compo de la prison par paliers de 10 mines, actuelle ou précédente (30/10/2026, Geoffrey) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisonSteps, chooseCompo } from '../src/meta/prison-profile.js';

const A = 'acc';
/* mine n° i (date i), area a */
const mine = (i, a) => ({ mode: 'mine', status: 'done', endedAt: i, players: [{ account: A }],
  result: { areasUnlocked: a, shares: [{ account: A, bag: { Fer: 10 } }], miners: [{ account: A, stats: {} }] } });
const hist = list => list.map(([i, a]) => mine(i, a));
const range = (from, to, a) => Array.from({ length: to - from + 1 }, (_, k) => [from + k, a]);

test('moins de 10 mines : la compo suit les dernières mines, pas de précédente', () => {
  const s = prisonSteps(null, hist(range(1, 4, 3)), A);
  assert.equal(s.cur.n, 4); assert.equal(s.cur.area, 3); assert.equal(s.prev, null);
});

test('palier figé : 5 nouvelles mines ne changent rien, 10 nouvelles décalent (actuelle → précédente)', () => {
  let s = prisonSteps(null, hist(range(1, 10, 7)), A);
  assert.equal(s.cur.area, 7); assert.equal(s.cur.to, 10);
  const pl = [...range(1, 10, 7), ...range(11, 15, 2)];   // il PL des amis en area 2
  s = prisonSteps(s, hist(pl), A);
  assert.equal(s.cur.area, 7, '5 mines : rien ne bouge'); assert.equal(s.prev, null);
  s = prisonSteps(s, hist([...pl, ...range(16, 20, 2)]), A);
  assert.equal(s.cur.area, 2, 'palier suivant : les 10 mines de PL'); assert.equal(s.prev.area, 7, 'il peut reprendre son ancienne compo');
});

test('25 mines d\'un coup : deux paliers, les 5 dernières attendent', () => {
  let s = prisonSteps(null, hist(range(1, 10, 1)), A);
  s = prisonSteps(s, hist([...range(1, 10, 1), ...range(11, 20, 4), ...range(21, 30, 6), ...range(31, 35, 9)]), A);
  assert.equal(s.cur.area, 6); assert.equal(s.prev.area, 4); assert.equal(s.cur.to, 30);
});

test('mines supprimées de l\'historique (30 jours) : le palier enregistré reste', () => {
  let s = prisonSteps(null, hist(range(1, 10, 5)), A);
  s = prisonSteps(s, hist(range(11, 14, 1)), A);
  assert.equal(s.cur.area, 5);
});

test('choisir la précédente : elle devient l\'actuelle et survit au palier suivant', () => {
  let s = prisonSteps(null, hist(range(1, 10, 3)), A);
  const h20 = [...range(1, 10, 3), ...range(11, 20, 8)];   // 10 mines portées par un ami fort
  s = prisonSteps(s, hist(h20), A);
  assert.equal(s.cur.area, 8);
  s = chooseCompo(s, 'previous');
  assert.equal(s.cur.area, 3); assert.equal(s.prev.area, 8); assert.equal(s.cur.to, 20, 'le palier en cours ne bouge pas');
  s = prisonSteps(s, hist([...h20, ...range(21, 30, 4)]), A);
  assert.equal(s.cur.area, 4); assert.equal(s.prev.area, 3, 'sa compo choisie reste disponible');
  assert.equal(chooseCompo(s, 'current'), s);
});
