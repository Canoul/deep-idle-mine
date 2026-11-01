/* Icône de l'appli mobile (scripts/gen_app_icon.py → mobile/) : source en pixel art, tailles Android attendues et couleur
   de fond. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RES = 'mobile/android/app/src/main/res';

/* largeur et hauteur lues dans l'en-tête du PNG (bloc IHDR) */
function pngSize(f){
  const b = fs.readFileSync(path.join(ROOT, f));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

const DENSITIES = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };

test('icône : tailles des icônes Android par densité', () => {
  for(const [d, [icon, fg]] of Object.entries(DENSITIES)){
    assert.deepEqual(pngSize(`${RES}/mipmap-${d}/ic_launcher.png`), [icon, icon], d);
    assert.deepEqual(pngSize(`${RES}/mipmap-${d}/ic_launcher_round.png`), [icon, icon], d);
    assert.deepEqual(pngSize(`${RES}/mipmap-${d}/ic_launcher_foreground.png`), [fg, fg], d);
  }
});

test('icône : la source est une grille de 64 × 64 pixels', () => {
  assert.deepEqual(pngSize('mobile/assets/icon-art.png'), [64, 64]);
});

test('icône : grande image pour iOS et les stores', () => {
  assert.deepEqual(pngSize('mobile/assets/icon-1024.png'), [1024, 1024]);
});

test('icône : fond de l’icône adaptative sombre, comme le bord de l’icône', () => {
  const xml = fs.readFileSync(path.join(ROOT, `${RES}/values/ic_launcher_background.xml`), 'utf8');
  const hex = xml.match(/#([0-9a-f]{6})/i);
  assert.ok(hex, xml);
  for(const i of [0, 2, 4]) assert.ok(parseInt(hex[1].slice(i, i + 2), 16) < 0x30, hex[0]);
});
