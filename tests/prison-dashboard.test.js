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

/* 07/11/2026 : mesure resserrée (fenêtre des 10 mines, minerais plafonnés hors du %, médiane des joueurs à 10 mines) */
import { inWindow, prisonSummary, CAPPED } from '../src/meta/prison-dashboard.js';

test('fenêtre : part d\'un séjour passée après le début', () => {
  assert.equal(inWindow(0, 100, 50), 0.5);
  assert.equal(inWindow(0, 40, 50), 0, 'fini avant : rien');
  assert.equal(inWindow(60, 100, 50), 1, 'commencé après : tout');
  assert.equal(inWindow(undefined, 100, 50), 1, 'début inconnu : tout');
  assert.equal(inWindow(0, 100, -Infinity), 1, 'pas de mine : tout');
});

test('seule la prison jouée depuis la plus ancienne des 10 mines compte (prorata du séjour à cheval)', () => {
  const sessions = Array.from({ length: 10 }, (_, i) => mine(i, { Fer: 100 }));   // mines finies à 1000…1009
  // séjour fini avant les mines : ignoré (ancien réglage, gros rendement qui ne doit pas compter)
  sessions.push({ id: 'prison:old', mode: 'prison', status: 'done', startedAt: 0, endedAt: 900, result: { prison: { t: 36000, runs: 50 }, shares: [{ account: A, bag: { Fer: 99999 } }] } });
  // séjour à cheval : de 800 à 1200, la moitié après 1000
  sessions.push({ id: 'prison:mid', mode: 'prison', status: 'done', startedAt: 800, endedAt: 1200, result: { prison: { t: 7200, runs: 10 }, shares: [{ account: A, bag: { Fer: 100 } }] } });
  // prison en cours depuis 1100 : entière
  const prison = { state: 'running', startedAt: 1100, totals: { t: 3600, runs: 4, bag: { Fer: 50 } } };
  const r = prisonRow({ account: A, name: 'x', prison, sessions, now: 1300 });
  assert.equal(r.since, 1000);
  assert.equal(r.prisonHours, 2);                    // 1 h (moitié de 2 h) + 1 h
  assert.equal(r.runs, 9);                           // 5 + 4
  assert.equal(r.ores.Fer.ratio, 0.5);               // (50 + 50) / 2 h contre 100 /h
  assert.equal(r.allHours, 13); assert.equal(r.allRuns, 64);   // total depuis le début, pour info
});

test('cobalt et thorium (plafonnés en prison) hors du %, affichés en gris', () => {
  assert.ok(CAPPED.has('Cobalt ore') && CAPPED.has('Thorium ore') && !CAPPED.has('Fer'));
  const sessions = Array.from({ length: 10 }, (_, i) => mine(i, { Fer: 100, 'Cobalt ore': 10 }));
  const prison = { state: 'running', totals: { t: 3600, bag: { Fer: 50, 'Cobalt ore': 1 } } };
  const r = prisonRow({ account: A, name: 'x', prison, sessions });
  assert.ok(Math.abs(r.ores['Cobalt ore'].ratio - 0.1) < 1e-9);
  assert.equal(r.ratio, 0.5, 'seul le fer compte');
  assert.match(renderPrisonDashboard([r]), /class="cap"[^>]*>10 %/);
});

test('résumé : médiane des joueurs à 10 mines, les autres à part', () => {
  const row = (ratio, mines) => ({ name: 'j' + ratio, mines, ratio, ores: {}, prisonHours: 1, runs: 1, time: {} });
  const rows = [row(0.2, 10), row(0.3, 10), row(0.5, 10), row(0.7, 10), row(7.2, 1)];
  const S = prisonSummary(rows);
  assert.equal(S.n, 4); assert.equal(S.median, 0.4); assert.equal(S.low, 2); assert.equal(S.ok, 1); assert.equal(S.high, 1);
  const html = renderPrisonDashboard(rows);
  assert.match(html, /Médiane <b>40 %<\/b>/);
  assert.ok(html.indexOf('j7.2') > html.indexOf('Moins de 10 mines'), 'le débutant est rangé à part');
});
