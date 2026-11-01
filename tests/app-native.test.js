/* Appli mobile : logique pure du bouton retour, des liens externes, de la copie des fichiers du jeu. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { backStep, externalUrl } from '../src/app/native.js';
import { appIndex, copyWeb } from '../mobile/scripts/copy-web.js';

const SITE = 'https://deepmineidle.fr/', HERE = 'https://localhost/index.html';

test('retour : fenêtre d\'abord, puis panneau, puis onglet précédent, puis accueil, et quitter seulement depuis l\'accueil', () => {
  assert.equal(backStep({ dialog: true, panel: true, previous: true }), 'dialog');
  assert.equal(backStep({ panel: true, previous: true }), 'panel');
  assert.equal(backStep({ previous: true }), 'tab');
  assert.equal(backStep({ home: false }), 'home');
  assert.equal(backStep({ home: true }), 'quit');
  assert.equal(backStep({ home: false, gate: true }), 'quit', 'écran de connexion : rien derrière');
});

test('liens : externe = navigateur du téléphone ; lien relatif du site = adresse du site ; interne = rien', () => {
  assert.equal(externalUrl('https://discord.gg/abc', SITE, HERE), 'https://discord.gg/abc');
  assert.equal(externalUrl('https://deepmineidle.fr/conditions', SITE, HERE), 'https://deepmineidle.fr/conditions');
  assert.equal(externalUrl('wiki.html', SITE, HERE), 'https://deepmineidle.fr/wiki.html');
  assert.equal(externalUrl('https://localhost/wiki.html', SITE, HERE), 'https://deepmineidle.fr/wiki.html');
  assert.equal(externalUrl('#', SITE, HERE), null);
  assert.equal(externalUrl('https://localhost/index.html#social', SITE, HERE), null);
  assert.equal(externalUrl('mailto:contact@deepmineidle.fr', SITE, HERE), 'mailto:contact@deepmineidle.fr');
  assert.equal(externalUrl('javascript:alert(1)', SITE, HERE), null);
});

const PAGE = `<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Deep Mine Idle</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jersey+15&family=VT323&display=swap" rel="stylesheet">
<link rel="stylesheet" href="src/ui/style.css">
</head><body><script src="src/boot-check.js"></script></body>`;

test('page de l\'appli : polices locales, plein écran sans zoom, adresse du serveur chargée avant le jeu', () => {
  const h = appIndex(PAGE);
  assert.doesNotMatch(h, /googleapis|gstatic/);
  assert.match(h, /href="fonts\/fonts\.css"/);
  assert.match(h, /viewport-fit=cover/); assert.match(h, /user-scalable=no/);
  assert.ok(h.indexOf('app-config.js') < h.indexOf('boot-check.js'));
  assert.match(h, /<title>Deep Mine Idle MMO<\/title>/);
});

test('copie : tout ce que le jeu importe est dans l\'appli, aucun fichier du serveur ni donnée', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dim-www-'));
  try {
    copyWeb({ out, api: 'https://deepmineidle.fr' });
    assert.match(fs.readFileSync(path.join(out, 'app-config.js'), 'utf8'), /https:\/\/deepmineidle\.fr/);
    for(const f of ['index.html', 'src/main.js', 'src/ui/style.css', 'src/app/app.css', 'fonts/fonts.css', 'textures/favicon-192.png']) assert.ok(fs.existsSync(path.join(out, f)), f);
    for(const f of ['server', 'data', 'package.json', 'mobile', 'docs', 'wiki.html']) assert.ok(!fs.existsSync(path.join(out, f)), f);
    /* suit les imports depuis src/main.js : aucun fichier manquant (dynamiques compris) */
    const seen = new Set(), todo = [path.join(out, 'src/main.js')];
    while(todo.length){
      const f = todo.pop();
      if(seen.has(f)) continue;
      seen.add(f);
      assert.ok(fs.existsSync(f), `manquant : ${f}`);
      for(const m of fs.readFileSync(f, 'utf8').matchAll(/(?:from\s*|import\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/g)) todo.push(path.resolve(path.dirname(f), m[1]));
    }
    assert.ok(seen.size > 50);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
