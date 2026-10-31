/* Cases du stuff (31/10/2026) : un nom d'objet au mot très long ne doit pas sortir sa case de la grille */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8');

test('colonne du nom des cases du stuff : jamais un 1fr seul, qui grandit avec le mot le plus long', () => {
  const rules = [...css.matchAll(/\.stuffSlot[^{]*\{([^}]*grid-template-columns:[^;}]*)/g)].map(m => m[1].match(/grid-template-columns:([^;}]*)/)[1]);
  assert.ok(rules.length >= 3, 'règles retrouvées');
  for(const r of rules) assert.match(r, /minmax\(0,1fr\)/, r);
  for(const r of rules) assert.doesNotMatch(r.replace(/minmax\(0,1fr\)/g, ''), /1fr/, r);
  assert.match(css, /\.stuffSlot \.slbl,\.stuffSlot \.sname\{[^}]*overflow-wrap:anywhere/);
});
