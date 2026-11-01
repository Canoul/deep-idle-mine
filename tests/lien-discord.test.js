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

test('téléphone : le bouton de prison passe à « Sortir » pour garder les liens visibles', () => {
  const css = readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8');
  const phone = css.slice(css.indexOf('@media (max-width:700px)'));
  assert.match(html, /id="navPrisonStop"[^>]*><span class="navLong">Sortir de prison<\/span><span class="navShort">Sortir<\/span>/);
  assert.match(css, /\.navShort\{display:none\}/);
  assert.match(phone, /\.navLong\{display:none\}/);
  assert.match(phone, /\.navShort\{display:inline\}/);
});

