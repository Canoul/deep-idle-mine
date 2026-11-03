/* Bulle d'info (src/ui/tooltip.js) : placement (03/11/2026 : au doigt, un grand tableau de butin tient entre les barres
   et défile au lieu de cacher l'écran et le bouton « Ouvrir »). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tipPlace } from '../src/ui/tooltip.js';

const r = { top: 400, bottom: 440 };

test('petite bulle : au-dessus de l\'élément, sinon en dessous ; jamais de défilement', () => {
  assert.deepEqual(tipPlace({ r, h: 100, view: 900 }), { top: 292, maxHeight: null, scroll: false });
  assert.deepEqual(tipPlace({ r: { top: 50, bottom: 90 }, h: 100, view: 900 }), { top: 98, maxHeight: null, scroll: false });
  assert.equal(tipPlace({ r, h: 100, view: 900, touch: true }).scroll, false, 'au doigt aussi');
});

test('au doigt, bulle plus haute que la place (tableau du Treasure T4 sur un téléphone) : entre les barres, elle défile', () => {
  const p = tipPlace({ r, h: 1500, view: 900, top: 60, bottom: 840, touch: true });
  assert.deepEqual(p, { top: 68, maxHeight: 764, scroll: true });
  assert.ok(p.top >= 60 && p.top + p.maxHeight <= 840, 'ni sous la barre du haut, ni sous celle du bas');
});

test('à la souris : trop haute, collée en haut sans limite (comme avant)', () => {
  assert.deepEqual(tipPlace({ r, h: 1500, view: 900 }), { top: 8, maxHeight: null, scroll: false });
});

test('au doigt, assez de place au total mais ni au-dessus ni en dessous : en haut de la zone libre, limitée', () => {
  const p = tipPlace({ r: { top: 300, bottom: 340 }, h: 500, view: 900, top: 60, bottom: 840, touch: true });
  assert.equal(p.top, 68); assert.equal(p.maxHeight, 764); assert.equal(p.scroll, true);
});
