/* Couche appli : onglets Équipement | Stats de l'onglet Stuff (src/app/perso.js, 03/11/2026). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { stuffTabsHtml } from '../src/app/perso.js';
import { renderSlotsHtml } from '../src/ui/stuff.js';

test('onglets du Stuff : Équipement ou Stats, celui choisi est marqué', () => {
  const g = stuffTabsHtml('gear'), s = stuffTabsHtml('stats');
  assert.match(g, /data-stab="gear" class="on">Équipement/); assert.doesNotMatch(g, /data-stab="stats" class="on"/);
  assert.match(s, /data-stab="stats" class="on">Stats/); assert.doesNotMatch(s, /data-stab="gear" class="on"/);
});

test('mannequin : gear score sous le portrait, +N sur la case améliorée (cachés sur le site par style.css)', () => {
  const html = renderSlotsHtml({ casque:{ item:'Casque en acier', uid:1, plus:3 } });
  assert.match(html, /class="stuffHeroGs">[\d\s ]+ GS</);
  assert.match(html, /class="splus">\+3</);
  assert.equal((html.match(/class="splus"/g) || []).length, 1, 'seulement la case améliorée');
});
