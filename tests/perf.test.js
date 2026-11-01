/* Mesures d'affichage (?perf, 25/10) : images par seconde, délai entre deux envois, temps de réponse, ticks par envoi. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPerf, perfText } from '../src/ui/perf.js';

test('mesures : 60 img/s, un envoi toutes les 250 ms, réponse 40 ms, 5 ticks par envoi', () => {
  const p = createPerf();
  for(let t = 0; t <= 1000; t += 1000 / 60) p.frame(t);
  for(let i = 0; i < 5; i++) p.view(i * 250 - 40, i * 250, i * 5);
  const s = p.stats();
  assert.ok(Math.abs(s.fps - 60) < 1); assert.equal(s.every, 250); assert.equal(s.rtt, 40); assert.equal(s.ticks, 5);
  assert.match(perfText(s), /60 img\/s · envoi toutes les 250 ms · réponse 40 ms · 5\.0 ticks\/envoi/);
});

test('mesures : seulement les 2 dernières secondes ; rien de connu au départ', () => {
  const p = createPerf();
  assert.match(perfText(p.stats()), /– img\/s/);
  for(let t = 0; t <= 5000; t += 100) p.frame(t);   // 10 img/s
  for(let t = 5000; t <= 6000; t += 20) p.frame(t);  // puis 50 img/s
  assert.ok(p.stats().fps > 25, 'les anciennes images ne comptent plus');
});

test('la boîte de mesures est dans les barres de la mine et de la tour, cachée par défaut', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/class="mut small perfBox" hidden/g) || []).length, 2);
});

test('?perf mesure aussi les envois de la prison (30/10/2026)', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const at = main.indexOf('await gameApi.prisonView(');
  assert.ok(at > 0);
  assert.ok(main.slice(at, at + 150).includes('perf.view(t0'));
});

test('régularité : écart entre les envois, images où le mineur suivi reste sur place', () => {
  const p = createPerf();
  [[0, 0], [200, 2], [600, 4], [800, 6]].forEach(([at, tick]) => p.view(at - 40, at, tick));
  assert.ok(Math.abs(p.stats().jitter - 94.3) < 0.1);
  /* 7 images de marche, 2 à l'arrêt, puis un long arrêt (il mine) qui ne compte pas */
  const xs = [0, 1, 2, 3, 3, 3, 4, 5, 6, 7];
  xs.forEach((x, i) => p.step([x, 0], i * 16));
  for(let i = 10; i < 40; i++) p.step([7, 0], i * 16);
  p.step([8, 0], 40 * 16);
  assert.ok(Math.abs(p.stats().stops - 2 / 10 * 100) < 1e-9, String(p.stats().stops));
  assert.match(perfText(p.stats()), /écart 94 ms · micro-arrêts 20 %/);
});

