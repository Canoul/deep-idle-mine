/* 31/10/2026 (signalé par un joueur, seed 1832289715) : un mineur creusait des galeries à l'aveugle alors qu'il connaissait
   des résidus et des minerais rares à plus de CFG.oreReach cases. Il va maintenant les chercher avant de creuser. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDS, CFG, W } from '../src/config.js';
import { newSession, tick } from '../src/sim/session.js';
import { areaTop, tryUnlock } from '../src/sim/world.js';
import './helpers.js';

/* mineur en galerie en area 1, un puits avec échelles jusqu'à l'area 0, un bloc découvert au bord du puits, plus haut */
const setup = (block, at = areaTop(0) + 3) => {
  const G = newSession(2), m = G.miners[0];
  G.areas[0].oreMined = 1e9; assert.ok(tryUnlock(G));
  G.mobs = []; G.traps = []; G.dungeons = [];
  for(const row of G.seen) row.fill(0);
  const y = areaTop(1) + 10;
  for(let yy = 1; yy <= y; yy++){ G.tiles[yy][25] = 0; G.ladder[yy][25] = 1; }
  m.x = 25; m.y = y; m.mode = 'work'; m.exploring = true; m.exploreArea = 1; m.tripCap = Infinity;
  G.tiles[at][24] = block; G.seen[at][24] = 1;
  assert.ok(Math.abs(y - at) + 1 > CFG.oreReach, 'hors de portée');
  return { G, m, at };
};
const runUntil = (G, done, n = 4000) => { for(let i = 0; i < n && !G.over && !done(); i++) tick(G); return done(); };

for(const [name, block] of [['résidu', IDS.residueDemon], ['mithril', IDS.mithril]])
  test(`${name} découvert au loin : il va le chercher plutôt que creuser une galerie`, () => {
    const { G, m, at } = setup(block);
    assert.ok(runUntil(G, () => G.tiles[at][24] !== block), `${name} jamais miné (${m.status}, ligne ${m.y})`);
  });

test('charbon découvert au loin : pas d\'aller-retour, il reste à sa galerie', () => {
  const { G, m, at } = setup(IDS.coal);
  runUntil(G, () => false, 300);
  assert.equal(G.tiles[at][24], IDS.coal);
  assert.ok(m.y > at + 20, 'resté en bas');
});

test('fin de session : rien sous la profondeur maximale du trajet', () => {
  const { G, m } = setup(IDS.residueDemon);
  const deep = areaTop(1) + 25;
  for(let x = 0; x < W; x++) G.seen.forEach(r => { r[x] = 0; });
  G.tiles[deep][24] = IDS.residueDemon; G.seen[deep][24] = 1;
  m.tripCap = m.y + 2;
  runUntil(G, () => false, 300);
  assert.equal(G.tiles[deep][24], IDS.residueDemon);
  assert.ok(!m.target?.far);
});
