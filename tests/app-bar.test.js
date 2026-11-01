/* Couche appli (src/app/) : barre des familles et sous-onglets. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { barHtml, subHtml } from '../src/app/bar.js';
import { phoneMode } from '../src/ui/nav.js';

test('barre : 5 boutons, famille active, pastille', () => {
  const h = barHtml({ active:'sac', marks:new Set(['social']) });
  assert.equal(h.match(/data-family=/g).length, 5);
  assert.match(h, /class="on"[^>]*data-family="sac"/);
  assert.match(h, /data-family="social"[\s\S]*class="dot"/);
});

test('sous-onglets : rien pour une famille d\'un seul onglet', () => {
  assert.equal(subHtml({ family:'accueil', current:'lobby', marks:new Set(), inSession:false }), '');
});

test('sous-onglets : la pastille est sur le bon onglet', () => {
  const h = subHtml({ family:'social', current:'social', marks:new Set(['guilde']), inSession:false });
  assert.equal(h.match(/data-subtab=/g).length, 3);
  assert.match(h, /data-subtab="guilde"[\s\S]*class="dot"/);
});

test('hors session, Session n\'a pas de sous-onglet à afficher', () => {
  assert.equal(subHtml({ family:'session', current:'historique', marks:new Set(), inSession:false }), '');
});

test('Chat s\'ouvre dans l\'appli sur un grand écran', () => {
  const body = { classList:{ contains: c => c === 'app' } };
  assert.equal(phoneMode({ matches:false }, body), true);
  assert.equal(phoneMode({ matches:false }, { classList:{ contains: () => false } }), false);
});
