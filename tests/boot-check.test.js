/* Démarrage raté (src/boot-check.js) : lecture des imports et recherche du fichier du jeu qui ne se charge pas. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { URL };   // le navigateur a URL ; le contexte vide de vm non
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/boot-check.js'), 'utf8'), ctx);
const { specifiers, findMissing } = ctx.DIM_BOOT;
const readUrl = async url => fs.readFileSync(fileURLToPath(url), 'utf8');
const MAIN = pathToFileURL(path.join(ROOT, 'src/main.js')).href;

test('boot-check : imports, ré-exports et imports sur plusieurs lignes', () => {
  const src = `import { a } from './a.js';\nimport {\n  b,\n  c } from "../b.js";\nexport { t } from './t.js';\nimport './side.js';\nconst from = 'x';`;
  assert.deepEqual([...specifiers(src)], ['./a.js', '../b.js', './t.js', './side.js']);
});

test('boot-check : depuis main.js, il retrouve tous les fichiers chargés par le jeu', async () => {
  assert.deepEqual([...await findMissing(MAIN, readUrl)], []);
  const seen = [];
  await findMissing(MAIN, async url => { seen.push(url); return readUrl(url); });
  /* chaque fichier de src/ importé quelque part depuis main.js doit être parcouru (sinon on ne saurait pas le nommer) */
  for(const f of ['src/config.js', 'src/ui/nav.js', 'src/sim/mobs.js', 'src/render/textures.js', 'src/core/rng.js'])
    assert.ok(seen.includes(pathToFileURL(path.join(ROOT, f)).href), `${f} parcouru`);
  assert.equal(new Set(seen).size, seen.length, 'chaque fichier lu une seule fois');
});

test('boot-check : nomme le fichier bloqué', async () => {
  const blocked = pathToFileURL(path.join(ROOT, 'src/ui/nav.js')).href;
  const miss = await findMissing(MAIN, async url => { if(url === blocked) throw new Error('bloqué'); return readUrl(url); });
  assert.deepEqual(Array.from(miss, m => [m.url, m.why]), [[blocked, 'bloqué']]);
});
