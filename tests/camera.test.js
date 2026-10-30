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

test('caméra : le nombre de lignes visibles suit la hauteur de la fenêtre (surface visible en haut, mineur au milieu)', () => {
  const cam = createCamera(ROWS);
  cam.setRows(22);
  assert.equal(cam.rows, 22);
  assert.equal(settle(cam, 3), CAMERA.top, 'mineur près de la surface : la vue part du ciel, rien n\'est rogné');
  const y = settle(cam, 100);
  assert.ok(Math.abs(y - (100 - 22/2 + 2)) < 0.01, `mineur au milieu des 22 lignes (caméra à ${y})`);
  cam.setRows(0); cam.setRows(2.5); cam.setRows(NaN);
  assert.equal(cam.rows, 22, 'valeurs invalides ignorées');
});

/* zoom (30/10/2026, Geoffrey) : pincer sur mobile */
test('caméra : zoom ×2 autour d\'un point qui ne bouge pas, borné à ×1 et CAMERA.maxZoom, retour ×1 avec 0', () => {
  const cam = createCamera(ROWS, 40);
  settle(cam, 100, 20);
  cam.pan(0, LAST);                                   // rien
  const y = cam.y, wy = y + 0.5 * ROWS;               // ligne au milieu de l'écran
  cam.zoomBy(2, 0.5, 0.5);
  assert.equal(cam.zoom, 2);
  assert.ok(Math.abs(cam.y + 0.5 * ROWS/2 - wy) < 1e-9, 'le milieu de l\'écran reste sur la même ligne');
  assert.equal(cam.x, 10);                            // 40 colonnes, 20 visibles, centrées
  cam.zoomBy(100); assert.equal(cam.zoom, CAMERA.maxZoom);
  cam.zoomBy(0); assert.equal(cam.zoom, 1); assert.equal(cam.x, 0);
});

test('caméra zoomée : suit le mineur aussi à l\'horizontale ; glissée, elle reste dans la mine', () => {
  const cam = createCamera(ROWS, 40);
  cam.zoomBy(2);
  for(let i = 0; i < 300; i++) cam.update(100, LAST, 35);
  assert.ok(Math.abs(cam.x - 20) < 0.01, `x = ${cam.x}`);  // collée au bord droit (40 − 20)
  cam.pan(0, LAST, -100);
  assert.equal(cam.free, true); assert.equal(cam.x, 0);
  cam.pan(0, LAST, 3); assert.equal(cam.x, 3);
});
