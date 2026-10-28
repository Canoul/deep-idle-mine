/* Icône de l'appli mobile (scripts/gen_app_icon.py → mobile/) : tailles Android attendues et couleur de fond. */
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

test('icône : grande image pour iOS et les stores', () => {
  assert.deepEqual(pngSize('mobile/assets/icon-1024.png'), [1024, 1024]);
});

test('icône : fond de l’icône adaptative aux couleurs de la Forge noire', () => {
  assert.match(fs.readFileSync(path.join(ROOT, `${RES}/values/ic_launcher_background.xml`), 'utf8'), /#191310/);
});
