/* Shiny : un minerai qui a une recette de four (fer, or) a SHINY.chance de tomber déjà cuit, en objet qui scintille. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHINY, ITEMS, IDS, FURNACE, TEXTURES, XP } from '../src/config.js';
import { mineBlock } from '../src/sim/actions.js';
import { newSession } from '../src/sim/session.js';
import { worldFrom } from './helpers.js';

/* mine n blocs de `id` posés à côté du mineur ; rng : hasard des shiny imposé (sinon celui de la session) */
function mineMany(id, n, rng, seed=1){
  const G = worldFrom(['', 'd'.repeat(50), '#@ #', '#'.repeat(50)], { seed }), m = G.miners[0];
  if(rng) G.shinyRng = rng;
  for(let i=0;i<n;i++){ G.tiles[2][2] = id; mineBlock(G, m, 2, 2); }
  return { G, m };
}

test('shiny : chaque shiny vient d\'un minerai qui se fond, c\'est un lingot avec sa texture', () => {
  for(const [ore, s] of Object.entries(SHINY.items)){
    assert.ok(Object.hasOwn(FURNACE.recipes, ore), `${ore} a une recette de four`);
    assert.equal(ITEMS[s.item].cat, 'ingot');
    assert.equal(ITEMS[s.item].shiny, true);
    assert.equal(ITEMS[s.item].stack, true);
    assert.ok(TEXTURES.includes(s.tex), `texture ${s.tex}`);
  }
  assert.equal(SHINY.chance, 0.01);
});

test('shiny : tirage réussi → le shiny à la place du minerai (pas les deux), le bloc compte toujours', () => {
  const { G, m } = mineMany(IDS.iron, 1, () => 0);
  assert.deepEqual(m.inv, { 'Shiny iron': 1 });
  assert.equal(m.load, SHINY.w);
  assert.equal(m.stats.ore, 1, 'compte comme un minerai miné');
  assert.equal(G.stats.xp, XP.ore.iron, 'même XP qu\'un fer');
  assert.equal(G.stats.shiny, 1);
  assert.ok(G.log.some(l => String(l.msg ?? l).includes('Shiny iron')), 'annoncé dans le journal');

  const gold = mineMany(IDS.gold, 1, () => 0).m;
  assert.deepEqual(gold.inv, { 'Shiny gold': 1 });
});

test('shiny : tirage raté → le minerai normal', () => {
  const { G, m } = mineMany(IDS.iron, 1, () => 0.999);
  assert.deepEqual(m.inv, { Fer: 1 });
  assert.equal(G.stats.shiny, 0);
});

test('shiny : jamais pour le charbon, le diamant, la pierre (pas de recette de four), ni de tirage consommé', () => {
  let draws = 0;
  const rng = () => { draws++; return 0; };
  for(const id of [IDS.coal, IDS.diamond, IDS.stone, IDS.dirt]){
    const { m } = mineMany(id, 5, rng);
    assert.ok(!Object.keys(m.inv).some(k => ITEMS[k]?.shiny), `pas de shiny pour le bloc ${id}`);
  }
  assert.equal(draws, 0);
});

test('shiny : environ 1 % sur 20 000 fers, et toujours un objet par bloc (rien de créé ni perdu)', () => {
  const N = 20000, { m } = mineMany(IDS.iron, N, null, 4242);
  const shiny = m.inv['Shiny iron'] || 0;
  assert.equal(shiny + (m.inv.Fer || 0), N);
  assert.ok(shiny > 0.007*N && shiny < 0.013*N, `taux ${shiny/N}`);
});

test('shiny : même seed = mêmes shiny ; le hasard des mobs n\'est pas décalé', () => {
  const a = mineMany(IDS.iron, 3000, null, 77), b = mineMany(IDS.iron, 3000, null, 77);
  assert.deepEqual(a.m.inv, b.m.inv);
  const ref = newSession(77);
  assert.equal(a.G.rng(), ref.rng(), 'G.rng intact après 3000 tirages shiny');
});
