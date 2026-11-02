/* Paquet du jeu de l'appli (mises à jour à chaud, 02/11/2026) : une seule recette pour la copie embarquée et pour le serveur,
   version = empreinte du contenu. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { bundleFiles, manifestOf, sha256, appIndex, MANIFEST, API_URL } from '../server/app-update/bundle.js';
import { copyWeb } from '../mobile/scripts/copy-web.js';
import { ROOT } from '../server/config.js';
import { APP_UPDATE } from '../src/config.js';

const files = bundleFiles();

test('paquet : le jeu de l\'appli, sans wiki, sans serveur ni données', () => {
  for(const f of ['index.html', 'app-config.js', 'src/main.js', 'src/boot-check.js', 'src/app/guard.js', 'fonts/fonts.css', 'textures/favicon-192.png']) assert.ok(files.has(f), f);
  for(const f of files.keys()){
    assert.ok(/^(src|textures|fonts)\/|^(index\.html|app-config\.js)$/.test(f), f);
    assert.ok(!f.startsWith('src/wiki/'), f);
    assert.ok(!f.includes('\\'), 'chemins en /');
  }
  assert.deepEqual([...files.keys()], [...files.keys()].sort(), 'ordre fixe');
  assert.match(files.get('app-config.js').toString(), new RegExp(API_URL.replace(/\./g, '\\.')));
});

test('page de l\'appli : le gardien des mises à jour se charge avant le jeu', () => {
  const h = files.get('index.html').toString();
  assert.ok(h.indexOf('app-config.js') < h.indexOf('src/boot-check.js'));
  assert.ok(h.indexOf('src/boot-check.js') < h.indexOf('src/app/guard.js'));
  assert.ok(h.indexOf('src/app/guard.js') < h.indexOf('<script type="module" src="src/main.js">'));
  assert.equal(appIndex('<script src="src/boot-check.js"></script>').match(/guard\.js/g).length, 1);
});

test('manifeste : empreinte SHA-256 de chaque fichier, version = empreinte du contenu', () => {
  const m = manifestOf(files);
  assert.match(m.version, /^[0-9a-f]{16}$/);
  assert.equal(m.minNative, APP_UPDATE.minNative);
  assert.equal(Object.keys(m.files).length, files.size);
  assert.equal(m.files['src/main.js'], sha256(files.get('src/main.js')));
  assert.equal(manifestOf(bundleFiles()).version, m.version, 'même contenu, même version');
  const changed = new Map(files); changed.set('src/main.js', Buffer.from('autre'));
  assert.notEqual(manifestOf(changed).version, m.version, 'un fichier change : la version change');
  const renamed = new Map([...files].map(([p, b]) => [p === 'src/main.js' ? 'src/main2.js' : p, b]));
  assert.notEqual(manifestOf(renamed).version, m.version, 'un fichier renommé : la version change');
  assert.notEqual(manifestOf(bundleFiles({ api: 'http://localhost:8000' })).version, m.version, 'autre serveur : autre paquet');
});

test('copie embarquée = paquet du serveur, manifeste compris', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dim-bundle-'));
  try {
    copyWeb({ out });
    const m = JSON.parse(fs.readFileSync(path.join(out, MANIFEST), 'utf8'));
    assert.equal(m.version, manifestOf(bundleFiles({ root: ROOT })).version);
    for(const [p, h] of Object.entries(m.files)) assert.equal(sha256(fs.readFileSync(path.join(out, p))), h, p);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
