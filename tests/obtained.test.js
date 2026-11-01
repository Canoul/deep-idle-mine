/* Pop-up « Tu as obtenu » (src/ui/obtained.js, 28/10/2026) : les lignes affichées sous l'objet */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obtainedLines } from '../src/ui/obtained.js';
import { statLines } from '../src/meta/stuff.js';
import { RECIPES } from '../src/recipes.js';

test('stuff crafté : ses stats de base puis son GS', () => {
  const l = obtainedLines('Pioche en pierre');
  assert.deepEqual(l.slice(0, -1), statLines('Pioche en pierre'));
  assert.match(l.at(-1), /^GS \d+/);
});

test('pièce améliorée : les stats suivent le niveau', () => {
  const a = obtainedLines({ item:'Pioche en pierre', plus:0 }), b = obtainedLines({ item:'Pioche en pierre', plus:3 });
  assert.notDeepEqual(a, b);
});

test('anneau : ses effets, sans GS', () => {
  const l = obtainedLines('Anneau du rat');
  assert.ok(l.length > 0);
  assert.ok(!l.some(x => x.startsWith('GS')));
});

test('blueprint : la recette débloquée et les stats de l\'objet', () => {
  const [item, r] = Object.entries(RECIPES).find(([, r]) => r.unlock);
  const l = obtainedLines(r.unlock);
  assert.equal(l[0], `Débloque la recette : ${item}`);
});

test('objet sans stats ni objet inconnu : aucune ligne', () => {
  assert.deepEqual(obtainedLines('Lingot de fer'), []);
  assert.deepEqual(obtainedLines('Objet qui n\'existe pas'), []);
  assert.deepEqual(obtainedLines(null), []);
});
