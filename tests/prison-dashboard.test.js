/* Tableau de bord de la prison (30/10/2026) : % minerai par minerai (prison ÷ mines, par heure de jeu), moyenne des minerais. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisonRow, renderPrisonDashboard } from '../src/meta/prison-dashboard.js';

const A = 'acc1';
const mine = (i, bag) => ({ id: 'm' + i, mode: 'mine', status: 'done', endedAt: 1000 + i, result: { areasUnlocked: 7, shares: [{ account: A, bag }], miners: [] } });

test('prison ÷ mines par minerai, moyenne des minerais des mines ; prison en cours comptée', () => {
  const sessions = Array.from({ length: 10 }, (_, i) => mine(i, { Fer: 100, 'Mithril ore': 10, Pierre: 500 }));
  sessions.push({ id: 'prison:x', mode: 'prison', status: 'done', result: { prison: { t: 3600, runs: 6 }, shares: [{ account: A, bag: { Fer: 40, 'Mithril ore': 6 } }] } });
  const prison = { state: 'running', areaMax: 7, totals: { t: 3600, runs: 5, bag: { Fer: 60, 'Mithril ore': 4 } } };
  const r = prisonRow({ account: A, name: 'canoul', prison, sessions });
  assert.equal(r.prisonHours, 2); assert.equal(r.runs, 11); assert.equal(r.mines, 10);
  assert.equal(r.ores.Fer.ratio, 0.5);                       // 50 /h contre 100 /h
  assert.equal(r.ores['Mithril ore'].ratio, 0.5);            // 5 /h contre 10 /h
  assert.equal(r.ratio, 0.5);
  assert.ok(!('Pierre' in r.ores), 'la pierre ne compte pas');
  assert.match(renderPrisonDashboard([r]), /canoul.*50 %/s);
});

test('pas de mine ou pas de prison : pas de %', () => {
  const r = prisonRow({ account: A, name: 'x', prison: { state: 'running', totals: { t: 3600, bag: { Fer: 10 } } }, sessions: [] });
  assert.equal(r.ratio, null);
});

test('temps par action (30/10) : mesuré à chaque tick (somme = durée du run), en % dans le tableau', async () => {
  const { newPrisonRun, tickPrison } = await import('../src/sim/prison.js');
  const G = newPrisonRun(3, { areaMax: 2 });
  while(!G.over) tickPrison(G);
  const t = G.summary.miners[0].stats.time, sum = Object.values(t).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - G.summary.t) < 1, `somme ${sum} contre ${G.summary.t} s`);
  assert.ok(t.mine > 0 && t.move > 0);
  const r = prisonRow({ account: A, prison: { state: 'running', totals: { t: 100, bag: {}, time: { mine: 60, move: 30, other: 10 } } }, sessions: [] });
  assert.deepEqual(r.time.prison, { mine: 0.6, move: 0.3, fight: 0, other: 0.1 });
  assert.equal(r.time.mines, null);
});
