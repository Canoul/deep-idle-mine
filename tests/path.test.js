/* Itinéraire de retour au coffre guidé (A*, planReturn) : il doit trouver exactement le même temps de retour que la
   recherche classique (Dijkstra, sans estimation), dans de vraies sessions comme avec le treuil. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHEST_X, WINCH, W } from '../src/config.js';
import { worldFrom } from './helpers.js';
import { search, planReturn, returnH } from '../src/sim/path.js';
import { runSession } from '../src/sim/session.js';

/* temps de retour par Dijkstra classique (référence) */
const dijkstra = (G, m) => {
  const r = search(G, m, m.x, m.y, true, (x, y) => y === 0 && x === CHEST_X, Infinity, 1);
  return r && r.dist[r.n];
};
const same = (G, m, where) => {
  const p = planReturn(G, m), ref = dijkstra(G, m);
  if(ref === null) return assert.equal(p, null, where);
  assert.ok(p, where);
  assert.ok(Math.abs(p.cost - ref) < 1e-9, `${where} : A* ${p.cost} ≠ Dijkstra ${ref}`);
};

test('l\'estimation vaut 0 au coffre et ne dépasse jamais un pas ou une montée', () => {
  const G = worldFrom(['', '#'.repeat(W)]), m = G.miners[0], h = returnH(G, m);
  assert.equal(h(CHEST_X), 0);
  assert.ok(h(CHEST_X + 1) > 0 && h(W + CHEST_X) > 0);
});

for(const miners of [1, 3]) test(`sessions réelles à ${miners} mineur(s) : même temps de retour que Dijkstra`, () => {
  let checked = 0;
  runSession(15838, { miners, onTick: (G, i) => {
    if(i % 1500 !== 750 || i > 30000) return;   // ~20 instants répartis sur la session (jusqu'à grande profondeur)
    for(const m of G.miners) if(m.y > 0){ same(G, m, `tick ${i}, ${m.name} en (${m.x},${m.y})`); checked++; }
  } });
  assert.ok(checked >= 10, `${checked} positions vérifiées`);
});

test('avec le treuil (seau plus lent qu\'une échelle) : même temps de retour que Dijkstra', () => {
  const X = WINCH.x, G = worldFrom(['', ...Array.from({ length:44 }, () => '#'.repeat(W))]), m = G.miners[0];
  for(let y = 1; y <= 40; y++) G.tiles[y][X] = 0;
  for(let x = X + 1; x <= X + 6; x++) G.tiles[30][x] = 0;
  G.winch = { x:X, bottom:40 };
  for(const [x, y] of [[X, 40], [X + 6, 30], [X + 3, 43], [3, 20]]){ m.x = x; m.y = y; same(G, m, `(${x},${y})`); }
});
