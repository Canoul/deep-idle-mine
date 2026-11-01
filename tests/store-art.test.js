/* Visuels des fiches des stores (scripts/gen_store_art.py → mobile/store/) : tailles et transparence exigées par
   Google Play et l'App Store, et pas de fabrication de l'appli quand seuls ces visuels changent. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORE = 'mobile/store';

/* en-tête du PNG (bloc IHDR) : largeur, hauteur, type de couleur (2 = RVB sans transparence, 6 = RVBA), et bloc tRNS
   (transparence ajoutée à une image RVB) */
function png(f){
  const b = fs.readFileSync(path.join(ROOT, STORE, f));
  return { size: [b.readUInt32BE(16), b.readUInt32BE(20)], color: b[25], trns: b.includes('tRNS') };
}

test('stores : icône Google Play en 512 × 512', () => {
  assert.deepEqual(png('icon-google-512.png').size, [512, 512]);
});

test('stores : icône App Store en 1024 × 1024, sans transparence', () => {
  const p = png('icon-apple-1024.png');
  assert.deepEqual(p.size, [1024, 1024]);
  assert.equal(p.color, 2);
  assert.equal(p.trns, false);
});

test('stores : bannière Google Play en 1024 × 500, sans transparence', () => {
  const p = png('banner-google-1024x500.png');
  assert.deepEqual(p.size, [1024, 500]);
  assert.equal(p.color, 2);
  assert.equal(p.trns, false);
});

test('stores : changer les visuels ne relance pas la fabrication de l’appli', () => {
  const dir = path.join(ROOT, '.github/workflows');
  const builds = fs.readdirSync(dir).map(f => [f, fs.readFileSync(path.join(dir, f), 'utf8')])
    .filter(([, y]) => y.includes("'mobile/**'"));
  assert.ok(builds.length > 0);
  for(const [f, y] of builds) assert.ok(y.includes("'!mobile/store/**'"), f);
});
