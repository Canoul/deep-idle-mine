/* Bilan de fin de session (22/10) : le navigateur n'affiche que le résultat de la session qu'il vient de jouer.
   Bug : un bilan de tour jamais fermé (relance depuis le lobby) s'affichait à la fin de la mine suivante. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultChoice } from '../src/shared/game.js';

test('bilan : celui de la session attendue est affiché ; un plus ancien jamais vu est écarté ; rien → on attend', () => {
  assert.equal(resultChoice({ id:'mine-2', mode:'mine' }, 'mine-2'), 'show');
  assert.equal(resultChoice({ id:'tour-1', mode:'tower-demon' }, 'mine-2'), 'stale', 'la mine est encore en partage : pas son bilan');
  assert.equal(resultChoice(null, 'mine-2'), 'wait');
  assert.equal(resultChoice({ id:'tour-1' }, null), 'show', 'sans session attendue (page rechargée) : le bilan en attente s\'affiche');
});

test('bilan : le détail de ce que chacun portait encore à la fin (perdu)', async () => {
  const { newSession, endSession } = await import('../src/sim/session.js');
  const G = newSession(1, { miners:2 });
  G.miners[0].inv = { 'Cristal de pleine lune':4, Fer:12 };
  endSession(G);
  assert.deepEqual(G.summary.lostBags, [{ name:G.miners[0].name, items:{ 'Cristal de pleine lune':4, Fer:12 } }]);
  assert.deepEqual(G.summary.lost, [G.miners[0].name]);
});
