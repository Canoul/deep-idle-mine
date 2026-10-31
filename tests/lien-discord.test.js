/* Lien du Discord dans le bandeau du haut (31/10/2026) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('le bandeau a un lien « Discord du jeu » qui ouvre un nouvel onglet', () => {
  const top = html.slice(html.indexOf('<header class="topbar">'), html.indexOf('</header>'));
  const a = top.match(/<a [^>]*href="https:\/\/discord\.gg\/waGJg9RJDy"[^>]*>.*?<\/a>/)?.[0];
  assert.ok(a, 'lien présent dans le bandeau');
  assert.match(a, /target="_blank" rel="noopener"/);
  assert.match(a, /<span>Discord du jeu<\/span>/);
});
