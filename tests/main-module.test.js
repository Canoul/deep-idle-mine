/* src/main.js charge tout le jeu : une erreur de syntaxe (deux déclarations du même nom, 01/11/2026) empêche le site de démarrer. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('src/main.js est un module valide', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dim-main-')), copy = path.join(dir, 'main.mjs');
  try {
    fs.copyFileSync(new URL('../src/main.js', import.meta.url), copy);
    const r = spawnSync(process.execPath, ['--check', copy], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('src/main.js : toute variable affectée au premier niveau est déclarée', () => {
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  for(const [, name] of src.matchAll(/^([A-Za-z_$][\w$]*) = /gm))
    assert.match(src, new RegExp(`^(?:let|var|const)\\s[^\\n]*\\b${name}\\b`, 'm'), `${name} n'est déclarée nulle part : le jeu ne démarrerait pas`);
});
