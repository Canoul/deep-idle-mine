/* Caméra de la session : suivi d'un mineur, défilement libre dans la mine, retour au mineur suivi. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCamera, followedMiner } from '../src/render/camera.js';
import { CAMERA } from '../src/config.js';

const ROWS = 34, LAST = 200;   // lignes visibles, dernière ligne de la mine connue
const settle = (cam, fy, n = 200) => { for(let i = 0; i < n; i++) cam.update(fy, LAST); return cam.y; };

test('caméra : suit le mineur (il reste vers le milieu de l\'écran)', () => {
  const cam = createCamera(ROWS);
  assert.equal(cam.y, CAMERA.top);
  const y = settle(cam, 100);
  assert.ok(Math.abs(y - (100 - ROWS/2 + 2)) < 0.01, `caméra à ${y}`);
  assert.equal(cam.free, false);
});

test('caméra : déplacée par le joueur, elle ne suit plus le mineur, puis Suivre la ramène', () => {
  const cam = createCamera(ROWS);
  settle(cam, 100);
  cam.pan(-30, LAST);
  assert.equal(cam.free, true);
  const y = cam.y;
  settle(cam, 150);                                  // le mineur descend : la caméra reste où le joueur l'a mise
  assert.equal(cam.y, y);
  cam.follow();
  settle(cam, 150);
  assert.ok(Math.abs(cam.y - (150 - ROWS/2 + 2)) < 0.01);
});

test('caméra : bornée entre le ciel et le fond de la mine connue', () => {
  const cam = createCamera(ROWS);
  cam.pan(-1000, LAST);
  assert.equal(cam.y, CAMERA.top);
  cam.pan(1e6, LAST);
  assert.equal(cam.y, LAST + 1 + CAMERA.margin - ROWS);
  cam.pan(NaN, LAST); cam.pan(Infinity, LAST);      // valeurs invalides ignorées
  assert.equal(cam.y, LAST + 1 + CAMERA.margin - ROWS);
  /* mine plus petite que l'écran : on ne descend pas sous le ciel */
  const small = createCamera(ROWS);
  small.pan(50, 10);
  assert.equal(small.y, CAMERA.top);
});

test('mineur suivi : par son id, même quand un autre joueur quitte la partie', () => {
  const a = { id:0 }, b = { id:1 }, c = { id:2 };
  assert.equal(followedMiner([a, b, c], 2), c);
  assert.equal(followedMiner([b, c], 2), c);         // a est parti : on suit toujours c (avant : l'index 2 n'existait plus)
  assert.equal(followedMiner([a, b], 2), a);         // le mineur suivi est parti : repli sur le premier
  assert.equal(followedMiner([a, b], null), a);
});
