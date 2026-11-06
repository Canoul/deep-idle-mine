/* Menu des activités du lobby (06/11/2026) : les boutons sont en nowrap, la description d'une activité (Mine géante)
   doit pouvoir revenir à la ligne au lieu de sortir du bouton */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8');

test('texte des activités du lobby : revient à la ligne malgré le nowrap des boutons', () => {
  assert.match(css, /button\{[^}]*white-space:nowrap/, 'les boutons restent en nowrap');
  assert.match(css, /\.actText\{[^}]*white-space:normal/);
});
