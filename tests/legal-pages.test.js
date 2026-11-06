/* Pages légales (01/11/2026) : texte publié tel quel, crochets visibles, aucun HTML du fichier interprété, liens partout. */
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { mdToHtml, placeholders, pageHtml, LEGAL_PAGES, LEGAL_PAGES_EN } from '../scripts/build-legal.js';
import { resolvePublic } from '../server/http/static.js';
import { SERVER, ROOT } from '../server/config.js';
import { RULES } from '../src/config.js';
import { legalLinks, legalUrl, createAccountUI } from '../src/ui/account.js';
import { setLang } from '../src/i18n/index.js';

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

test('crochets écrits \\[ \\] : affichés [ ] et listés', () => {
  const md = 'Mise à jour : \\[date de mise en ligne\\]';
  assert.match(mdToHtml(md), /\[date de mise en ligne\]/); assert.doesNotMatch(mdToHtml(md), /\\\\/);
  assert.deepEqual(placeholders(md), ['[date de mise en ligne]']);
});

test('les trois vraies pages sont publiées, à partir du texte reçu', () => {
  for(const [page, title] of Object.entries(LEGAL_PAGES)){
    const html = fs.readFileSync(path.join(ROOT, page + '.html'), 'utf8');
    assert.ok(html.includes(title), page); assert.doesNotMatch(html, /<script/);
    assert.doesNotMatch(html, /\\\[/, 'pas de barre oblique visible');
  }
});

/* pages en anglais (06/11/2026) : servies, chacune dit que la version française fait foi et y renvoie ; liens selon la langue */
test('anglais : les quatre pages sont servies, en anglais, avec « la version française fait foi » et le lien vers elle', () => {
  for(const [page, { title, fr }] of Object.entries(LEGAL_PAGES_EN)){
    assert.equal(SERVER.pages['/' + page], `/${page}.html`);
    assert.ok(resolvePublic(ROOT, SERVER.publicPaths, `/${page}.html`), page);
    const html = fs.readFileSync(path.join(ROOT, page + '.html'), 'utf8');
    assert.match(html, /<html lang="en">/); assert.ok(html.includes(title), page); assert.doesNotMatch(html, /<script/);
    assert.ok(html.includes('la version française fait foi'), page); assert.ok(html.includes(`href="/${fr}"`), page);
    assert.ok(Object.hasOwn(LEGAL_PAGES, fr), fr);
  }
  assert.equal(SERVER.pages['/delete-account'], '/delete-account.html');
  const del = fs.readFileSync(path.join(ROOT, 'delete-account.html'), 'utf8');
  assert.ok(del.includes('la version française fait foi') && del.includes('href="/suppression-compte"'));
});

test('liens légaux : pages françaises en français, anglaises en anglais', () => {
  setLang('fr');
  assert.equal(legalUrl('terms'), RULES.terms);
  setLang('en');
  for(const k of ['terms', 'privacy', 'notice', 'deletion']) assert.equal(legalUrl(k), RULES.en[k]);
  assert.ok(legalLinks().includes(`href="${RULES.en.privacy}"`));
  setLang('fr');
});
