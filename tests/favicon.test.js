/* Favicon : les icônes déclarées par les pages existent et sont servies par le serveur (liste blanche). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SERVER, ROOT } from '../server/config.js';
import { resolvePublic } from '../server/http/static.js';

for(const page of ['index.html', 'wiki.html']){
  test(`favicon : ${page} déclare des icônes PNG présentes et publiques`, () => {
    const html = fs.readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    const hrefs = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map(m => m[1]);
    assert.equal(hrefs.length, 3);
    for(const href of hrefs){
      const file = resolvePublic(ROOT, SERVER.publicPaths, '/' + href);
      assert.ok(file, href + ' doit être servi');
      const png = fs.readFileSync(file);
      assert.equal(png.subarray(1, 4).toString(), 'PNG', href);
      const size = Number(href.match(/favicon-(\d+)\.png$/)[1]);
      assert.equal(png.readUInt32BE(16), size, href + ' : largeur');
      assert.equal(png.readUInt32BE(20), size, href + ' : hauteur');
    }
  });
}
