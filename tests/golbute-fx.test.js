/* Animations du Golbute (31/10/2026) : les rochers vont jusqu'au sol même sortis de la vue, le coup lève les bras puis frappe */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armPose, trackRocks, ROCK_MS, ROCK_DUST_MS } from '../src/render/golbute-fx.js';

test('rocher : il finit sa chute quand le serveur ne l\'envoie plus, puis soulève de la poussière et disparaît', () => {
  const seen = new Map(), R = [{ at: 600, x: 4 }];
  assert.deepEqual(trackRocks(seen, R, 1000), [{ x: 4, fall: 0, dust: 0 }]);
  const late = trackRocks(seen, [], 1000 + ROCK_MS * 0.9);          // sorti de la vue, encore en l'air
  assert.equal(late.length, 1); assert.ok(Math.abs(late[0].fall - 0.9) < 1e-9);
  const ground = trackRocks(seen, [], 1000 + ROCK_MS + 10);
  assert.equal(ground[0].fall, 1); assert.ok(ground[0].dust > 0.9);
  assert.deepEqual(trackRocks(seen, [], 1000 + ROCK_MS + ROCK_DUST_MS + 1), []);
});

test('rocher : pas de seconde chute s\'il est encore dans la vue ; deux colonnes = deux rochers ; la mémoire se vide', () => {
  const seen = new Map();
  trackRocks(seen, [{ at: 1, x: 1 }, { at: 1, x: 2 }], 0);
  assert.equal(trackRocks(seen, [{ at: 1, x: 1 }, { at: 1, x: 2 }], 100).length, 2);
  assert.deepEqual(trackRocks(seen, [{ at: 1, x: 1 }], 5000), []);
  trackRocks(seen, [], 61e3);
  assert.equal(seen.size, 0);
});

test('coup : repos, bras levés, puis au sol et étirés avec la poussière, retour au repos', () => {
  assert.deepEqual(armPose(0), { angle: 0, stretch: 1, dip: 0, dust: 0 });
  assert.deepEqual(armPose(1), { angle: 0, stretch: 1, dip: 0, dust: 0 });
  assert.ok(armPose(0.29).angle > 2, 'levés');
  assert.equal(armPose(0.29).dust, 0, 'pas de poussière avant de toucher le sol');
  const hit = armPose(0.45);
  assert.ok(hit.angle < armPose(0.29).angle && hit.stretch > 1.5 && hit.dust > 0);
  const end = armPose(0.99);
  assert.ok(end.angle < 0.05 && end.stretch < 1.05);
  /* le poing touche le sol : épaule à 56 px du sol, bras de 56 px */
  assert.ok(Math.abs(Math.cos(hit.angle) * 56 * hit.stretch - 56) < 4);
});
