/* Pages légales (01/11/2026) : texte publié tel quel, crochets visibles, aucun HTML du fichier interprété, liens partout. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mdToHtml, placeholders, pageHtml, LEGAL_PAGES } from '../scripts/build-legal.js';
import { resolvePublic } from '../server/http/static.js';
import { SERVER, ROOT } from '../server/config.js';
import { RULES } from '../src/config.js';
import { legalLinks, createAccountUI } from '../src/ui/account.js';

const SAMPLE = `# Titre\n\nUn **gras** et [votre nom] et [un lien](https://exemple.fr) et *italique*.\nSuite du paragraphe.\n\n## Sous-titre\n\n- un\n- deux\n\n1. premier\n2. second\n\n| A | B |\n|---|---|\n| 1 | [à compléter] |\n\n<script>alert(1)</script>\n[piège](javascript:alert(1))\n`;

test('mise en forme : titres, listes, tableau, liens ; le texte ne change pas', () => {
  const h = mdToHtml(SAMPLE);
  assert.match(h, /<h1>Titre<\/h1>/); assert.match(h, /<h2>Sous-titre<\/h2>/); assert.match(h, /<ul><li>un<\/li><li>deux<\/li><\/ul>/);
  assert.match(h, /<ol><li>premier<\/li><li>second<\/li><\/ol>/); assert.match(h, /<th>A<\/th>/); assert.match(h, /<td>1<\/td>/);
  assert.match(h, /<b>gras<\/b>/); assert.match(h, /<a href="https:\/\/exemple.fr">un lien<\/a>/);
  assert.match(h, /et Suite|italique<\/i>\. Suite du paragraphe/);
});

test('les crochets restent visibles et sont listés ; un vrai lien n\'en est pas un', () => {
  const h = mdToHtml(SAMPLE);
  assert.ok(h.includes('[votre nom]')); assert.ok(h.includes('[à compléter]'));
  assert.ok(placeholders(SAMPLE).includes('[votre nom]')); assert.ok(placeholders(SAMPLE).includes('[à compléter]'));
  assert.ok(!placeholders(SAMPLE).includes('[un lien]'));
});

test('aucun HTML du fichier n\'est interprété, aucun lien javascript, pas de script dans la page', () => {
  const h = pageHtml('Essai', mdToHtml(SAMPLE));
  assert.doesNotMatch(h, /<script/); assert.doesNotMatch(h, /href="javascript/); assert.ok(h.includes('&lt;script&gt;'));
  assert.match(h, /name="viewport"/);
});

test('les trois adresses sont prévues, en plus de /suppression-compte', () => {
  for(const page of Object.keys(LEGAL_PAGES)){
    assert.equal(SERVER.pages['/' + page], `/${page}.html`);
    assert.ok(resolvePublic(ROOT, SERVER.publicPaths, `/${page}.html`), page);
  }
  assert.equal(SERVER.pages['/suppression-compte'], '/suppression-compte.html');
});

test('liens : les quatre pages, ouverts à part', () => {
  const h = legalLinks();
  for(const u of [RULES.privacy, RULES.notice, RULES.terms, RULES.deletion]) assert.ok(h.includes(`href="${u}"`), u);
  assert.match(h, /target="_blank"/); assert.match(h, /rel="noopener"/);
  assert.equal(typeof createAccountUI, 'function');
});
