import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../src/config.js';
import { updateLight, lumAt } from '../src/sim/light.js';
import { worldFrom } from './helpers.js';

test('la lumière d\'une torche suit les galeries creusées et ne traverse pas les murs', () => {
  const G=worldFrom([
    '',
    '##########',
    '#     #  #',   // torche en x=1 ; mur en x=6 ; galerie isolée x=7..8
    '##########',
  ]);
  G.torches.push({x:1,y:2}); updateLight(G);
  assert.equal(lumAt(G,1,2), 1, 'pleine lumière sur la torche');
  assert.ok(lumAt(G,5,2)>0, 'éclaire jusqu\'à 4 cases dans la galerie');
  assert.equal(lumAt(G,7,2), 0, 'rien derrière le mur');
  assert.equal(lumAt(G,1,1), 0, 'un bloc plein n\'est pas « éclairé » (pas de découverte par la torche)');
});

test('portée de la torche : rayon de blocs creusés', () => {
  const G=worldFrom(['', '#'+' '.repeat(12)+'#', '#'.repeat(14)]);
  G.torches.push({x:1,y:1}); updateLight(G);
  assert.ok(lumAt(G,1+STATS.torchRadius,1)>0);
  assert.equal(lumAt(G,1+STATS.torchRadius+1,1), 0);
});

test('surface : toujours pleine lumière (le jour)', () => {
  const G=worldFrom(['', '###']);
  assert.equal(lumAt(G,0,0), 1);
});
