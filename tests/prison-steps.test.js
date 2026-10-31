/* Compo de la prison par paliers de 10 mines, actuelle ou précédente (30/10/2026, Geoffrey) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisonSteps, prisonCompos, pickCompo } from '../src/meta/prison-profile.js';
import { PRISON } from '../src/config.js';

const A = 'acc';
/* mine n° i (date i), area a */
const mine = (i, a) => ({ mode: 'mine', status: 'done', endedAt: i, players: [{ account: A }],
  result: { areasUnlocked: a, shares: [{ account: A, bag: { Fer: 10 } }], miners: [{ account: A, stats: {} }] } });
const hist = list => list.map(([i, a]) => mine(i, a));
const range = (from, to, a) => Array.from({ length: to - from + 1 }, (_, k) => [from + k, a]);

test('premier calcul avec 20 mines : actuelle = mines 1 à 10, précédente = mines 11 à 20', () => {
  const s = prisonSteps(null, hist([...range(1, 10, 2), ...range(11, 20, 6)]), A);
  assert.equal(s.cur.area, 6); assert.equal(s.cur.n, 10); assert.equal(s.prev.area, 2); assert.equal(s.prev.n, 10);
});

test('moins de 10 mines : la compo suit les dernières mines, pas de précédente', () => {
  const s = prisonSteps(null, hist(range(1, 4, 3)), A);
  assert.equal(s.cur.n, 4); assert.equal(s.cur.area, 3); assert.equal(s.prev, null);
});

test('palier figé : 5 nouvelles mines ne changent rien, 10 nouvelles décalent (actuelle → précédente)', () => {
  let s = prisonSteps(null, hist(range(1, 10, 7)), A);
  assert.equal(s.cur.area, 7); assert.equal(s.cur.to, 10);
  const pl = [...range(1, 10, 7), ...range(11, 15, 2)];   // il PL des amis en area 2
  s = prisonSteps(s, hist(pl), A);
  assert.equal(s.cur.area, 7, '5 mines : rien ne bouge'); assert.equal(s.cur.to, 10);
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

test('compo enregistrée : gardée quand les paliers avancent ; pickCompo sans compteur', () => {
  let c = prisonCompos(null, hist([...range(1, 10, 3), ...range(11, 20, 8)]), A);
  assert.equal(pickCompo(c, 'current').area, 8); assert.equal(pickCompo(c, 'previous').area, 3);
  assert.equal(pickCompo(c, 'saved'), null);
  c.saved = pickCompo(c, 'previous');
  assert.ok(!('to' in c.saved));
  c = prisonCompos(c, hist([...range(1, 10, 3), ...range(11, 20, 8), ...range(21, 30, 9), ...range(31, 40, 9)]), A);
  assert.equal(pickCompo(c, 'current').area, 9); assert.equal(pickCompo(c, 'previous').area, 9);
  assert.equal(pickCompo(c, 'saved').area, 3, 'la compo enregistrée reste');
});

/* 31/10 : focus minerai retiré du jeu, les compos gardées qui en profitent sont refaites une seule fois */
const focused = (i, a) => ({ ...mine(i, a), focus: [{ account: 'autre', tick: 5, focus: { mithril: 'only' } }] });
const oldCompo = () => { const p = { n: 10, area: 7, ores: { mithril: 1 }, treasures: null, mobs: null }; return { cur: { ...p, to: 10 }, prev: null, saved: p }; };

test('compos d\'avant le 31/10 : joueur avec une mine au focus → refaites une fois, compo enregistrée effacée', () => {
  const h = Array.from({ length: 10 }, (_, k) => focused(k + 1, 7));
  let c = prisonCompos(oldCompo(), h, A);
  assert.equal(c.v, PRISON.compoVersion); assert.equal(c.saved, null);
  assert.ok(Math.abs(c.cur.ores.mithril - 24.4 / 1900.1) < 1e-9, 'référence');
  c.saved = pickCompo(c, 'current');
  const again = prisonCompos(c, h, A);
  assert.ok(again.saved, 'une seule fois : la compo enregistrée ensuite reste');
  assert.ok(Math.abs(again.cur.ores.mithril - c.cur.ores.mithril) < 1e-9);
});

test('compos d\'avant le 31/10 : aucune mine au focus (ou area basse) → rien ne change', () => {
  for(const h of [hist(range(1, 12, 7)), Array.from({ length: 12 }, (_, k) => focused(k + 1, PRISON.focusRef.area - 1))]){
    const c = prisonCompos(oldCompo(), h, A);
    assert.deepEqual(c.cur.ores, { mithril: 1 }); assert.ok(c.saved); assert.equal(c.v, PRISON.compoVersion);
  }
});
