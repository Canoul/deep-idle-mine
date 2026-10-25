/* Combat dynamique (25/10) : portée d'attaque (écart bord à bord ≤ 0,5, jamais en diagonale ni à travers un bloc) et
   recul (décalage dans la case, passage à la case voisine, blocage contre un bloc, résistance au recul en %). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gap, inReach, push, knockOf, driftsAway } from '../src/sim/knock.js';
import { worldFrom } from './helpers.js';

const G = worldFrom(['', '          ', '##########']);   // ligne 1 : couloir vide de 10 cases
const free = () => true, wall = () => false;

test('portée : au contact, écart 0 ; à 0,5 on frappe encore ; au-delà non ; jamais en diagonale', () => {
  const a = { x:2, y:1 }, b = { x:3, y:1 };
  assert.equal(gap(a, b), 0); assert.ok(inReach(G, a, b));
  b.kx = 0.5; assert.ok(inReach(G, a, b), 'écart 0,5');
  b.kx = 0; b.x = 4; b.kx = -0.4; assert.ok(Math.abs(gap(a, b) - 0.6) < 1e-9); assert.ok(!inReach(G, a, b));
  b.kx = -0.5; assert.ok(inReach(G, a, b), 'deux cases plus loin mais décalé vers lui : 0,5');
  assert.equal(gap({ x:2, y:1 }, { x:3, y:2 }), Infinity, 'diagonale');
});

test('portée : jamais à travers un bloc', () => {
  const H = worldFrom(['', '  #       ', '##########']);
  assert.ok(!inReach(H, { x:1, y:1 }, { x:3, y:1, kx:-0.5 }));
});

test('recul : 0,25 par coup, la cible change de case après une demi-case, puis le décalage repart de l\'autre côté', () => {
  const from = { x:2, y:1, face:1 }, t = { x:3, y:1 };
  push(t, from, 0.25, free); assert.equal(t.kx, 0.25);
  push(t, from, 0.25, free); assert.equal(t.kx, 0.5); assert.equal(t.x, 3);
  assert.equal(push(t, from, 0.25, free), true); assert.equal(t.x, 4); assert.ok(Math.abs(t.kx + 0.25) < 1e-9);
});

test('recul : contre un bloc, la cible reste sur place (jamais à cheval sur le bloc)', () => {
  const t = { x:3, y:1 };
  for(let i=0;i<5;i++) push(t, { x:2, y:1 }, 0.25, wall);
  assert.equal(t.x, 3); assert.equal(t.kx, 0);
});

test('recul : sur l\'axe du coup (vertical si même colonne), du côté opposé à l\'attaquant', () => {
  const t = { x:3, y:5 };
  push(t, { x:3, y:6 }, 0.25, free); assert.equal(t.ky, -0.25, 'frappé par en dessous : poussé vers le haut');
  const u = { x:3, y:1 };
  push(u, { x:5, y:1 }, 0.25, free); assert.equal(u.kx, -0.25, 'frappé par la droite : poussé vers la gauche');
});

test('résistance au recul en % (stat du mineur ou du mob), bornée à 0–100', () => {
  assert.equal(knockOf({ carac:{ knockRes:50 } }, 0.25), 0.125);
  assert.equal(knockOf({ knockRes:100 }, 0.25), 0);
  assert.equal(knockOf({ knockRes:250 }, 0.25), 0);
  assert.equal(knockOf({ carac:{ knockRes:-30 } }, 0.25), 0.25);
  assert.equal(knockOf({ carac:{ knockRes:NaN } }, 0.25), 0.25);
  assert.equal(knockOf({}, 0), 0, 'sans poussée, rien');
  const t = { x:3, y:1, knockRes:100 }; assert.equal(push(t, { x:2, y:1 }, 0.25, free), false); assert.equal(t.kx ?? 0, 0);
});

test('se recentrer : décalage qui l\'éloigne de sa cible', () => {
  assert.ok(driftsAway({ x:3, y:1, kx:0.3 }, { x:2, y:1 }));
  assert.ok(!driftsAway({ x:3, y:1, kx:-0.3 }, { x:2, y:1 }));
});
