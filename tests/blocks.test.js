import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKS, BLOCK_TYPES, BUILDS, IDS, BARRIER, BRIDGE } from '../src/config.js';
import { typeOf, isOre } from '../src/sim/world.js';

test('catégories : chaque bloc a un type connu', () => {
  for(const id in BLOCKS) assert.ok(BLOCK_TYPES.includes(BLOCKS[id].type), `${BLOCKS[id].name} : ${BLOCKS[id].type}`);
  for(const n in BUILDS) assert.equal(BUILDS[n].type, 'build', n);
});

test('catégories : minerais, constructions, blocs spéciaux', () => {
  for(const n of ['coal','iron','gold','diamond']){ assert.equal(typeOf(IDS[n]), 'ore', n); assert.ok(isOre(IDS[n])); }
  for(const n of ['dirt','stone']){ assert.equal(typeOf(IDS[n]), 'terrain', n); assert.ok(!isOre(IDS[n])); }
  assert.equal(typeOf(BRIDGE), 'build');
  assert.equal(BUILDS.bridge.block, BRIDGE);
  assert.equal(typeOf(BARRIER), 'special');
  assert.equal(typeOf(0), null, 'case vide : aucune catégorie');
  assert.ok(!isOre(0));
});

test('seuls les minerais ont une valeur pour l\'IA', () => {
  for(const id in BLOCKS) if(BLOCKS[id].type==='ore') assert.ok(BLOCKS[id].val>0, BLOCKS[id].name);
});

test('socle du coffre (23/10) : la case sous le coffre est incassable dès le départ, le reste de la couche est de la terre', async () => {
  const { CHEST_X, CHEST_BASE, W } = await import('../src/config.js');
  const { newSession, runSession } = await import('../src/sim/session.js');
  const G = newSession(7919, { miners:3 });
  assert.equal(G.tiles[1][CHEST_X], CHEST_BASE);
  assert.ok(BLOCKS[CHEST_BASE].unbreakable && BLOCKS[CHEST_BASE].noDrop);
  assert.equal([...G.tiles[1]].filter(t => t === IDS.dirt).length, W - 1);
  const end = runSession(7919, { miners:3 });
  assert.equal(end.tiles[1][CHEST_X], CHEST_BASE, 'toujours là après 1 h de jeu');
});
