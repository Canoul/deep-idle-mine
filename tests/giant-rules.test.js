/* Bloc géant : règles pures (src/shared/giant.js) : jour de Paris, délai, paliers cumulés, classement. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GIANT, MINE_MODES } from '../src/config.js';
import { dayOf, dayEnd, dayStart, nextEntry, canEnter, tiersReached, rewardFor, tierItemsKnown, ranking, shownPoints } from '../src/shared/giant.js';

const H = 3600e3;

test('jour de Paris : minuit local, heure d\'été comme d\'hiver', () => {
  const t = Date.UTC(2026, 9, 26, 22, 30);                 // 23 h 30 à Paris (UTC+1, hiver)
  assert.equal(dayOf(t), '2026-10-26');
  assert.equal(dayEnd(t), Date.UTC(2026, 9, 26, 23, 0));    // minuit à Paris
  assert.equal(dayOf(dayEnd(t)), '2026-10-27');
  assert.equal(dayStart(t), Date.UTC(2026, 9, 25, 23, 0));
  const summer = Date.UTC(2026, 6, 14, 12, 0);             // été : UTC+2
  assert.equal(dayEnd(summer), Date.UTC(2026, 6, 14, 22, 0));
  const dst = Date.UTC(2026, 9, 25, 12, 0);                // jour du passage à l'heure d'hiver : 25 h
  assert.equal(dayEnd(dst) - dayStart(dst), 25 * H);
});

test('entrer : une fois toutes les 3 h, comptées depuis la dernière entrée', () => {
  assert.equal(GIANT.cooldownMs, 3 * H);
  assert.ok(canEnter(null, 0));
  const last = 1_000_000;
  assert.equal(nextEntry(last), last + 3 * H);
  assert.ok(!canEnter(last, last + 3 * H - 1));
  assert.ok(canEnter(last, last + 3 * H));
});

test('récompense : les paliers s\'additionnent', () => {
  assert.ok(tierItemsKnown(), 'les objets des paliers existent');
  assert.deepEqual(rewardFor(999), {});
  assert.deepEqual(rewardFor(1000), { 'Treasure T1': 1 });
  assert.deepEqual(rewardFor(5000), { 'Treasure T1': 2, 'Blueprint parts': 15 });
  assert.deepEqual(rewardFor(10000), { 'Treasure T1': 2, 'Blueprint parts': 15, 'Treasure T2': 1 });
  assert.deepEqual(rewardFor(19999), { 'Treasure T1': 2, 'Blueprint parts': 45, 'Treasure T2': 2 });
  assert.deepEqual(rewardFor(1e9), { 'Treasure T1': 2, 'Blueprint parts': 45, 'Treasure T2': 2, 'Treasure T3': 1 });
  assert.equal(tiersReached(15000).length, 4);
  for(const bad of [NaN, -1, Infinity * -1, undefined]) assert.deepEqual(rewardFor(bad), {});
});

test('classement : du plus haut au plus bas, top 10, ma ligne si je n\'y suis pas', () => {
  const scores = {};
  for(let i = 0; i < 15; i++) scores['A' + i] = { points: 100 * i + 0.7, visits: 1, name: 'J' + i };
  const r = ranking(scores, 'A0');
  assert.equal(r.list.length, 10); assert.equal(r.players, 15);
  assert.equal(r.list[0].name, 'J14'); assert.equal(r.list[0].points, 1400);
  assert.equal(r.me.rank, 15); assert.equal(r.me.points, 0);
  assert.equal(ranking(scores, 'A14').me, null, 'déjà dans le top');
  assert.equal(shownPoints(12.9), 12);
});

test('mode Bloc géant listé, à part des lancements de groupe', () => {
  const m = MINE_MODES.find(x => x.id === 'giant');
  assert.ok(m?.giant); assert.ok(!m.tower); assert.ok(!m.scheduled);
});

test('carte du lobby : textes de durée, objets, bouton d\'entrée', async () => {
  const { durText, clockText, itemsText, entryState } = await import('../src/ui/giant.js');
  assert.equal(durText(45e3), '45 s'); assert.equal(durText(12 * 60e3), '12 min'); assert.equal(durText(9 * H + 12 * 60e3), '9 h 12 min');
  assert.equal(clockText(62e3), '1:02');
  assert.equal(itemsText({ 'Treasure T1': 2, 'Blueprint parts': 15 }), '2 Treasure T1, 15 Blueprint parts');
  const base = { visit: null, present: 0, max: 30, nextEntry: 0 };
  assert.deepEqual(entryState(base, 1000), { can: true, label: 'Entrer' });
  assert.equal(entryState({ ...base, nextEntry: 1000 + 2 * H }, 1000).label, 'Prochaine entrée dans 2 h 00 min');
  assert.equal(entryState({ ...base, present: 30 }, 1000).can, false);
  assert.equal(entryState({ ...base, visit: { endsAt: 5 } }, 1000).inVisit, true);
});
