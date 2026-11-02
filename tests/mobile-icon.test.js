/* Icône de l'appli mobile : source en pixel art (scripts/gen_app_icon.py → mobile/assets/logo.png), puis icônes Android
   et iPhone tirées du logo (cd mobile && npm run assets) : tailles attendues et couleur de fond. */
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

test('icône : logo 1024 × 1024 sans transparence, source des icônes Android et iPhone', () => {
  assert.deepEqual(pngSize('mobile/assets/logo.png'), [1024, 1024]);
  assert.equal(fs.readFileSync(path.join(ROOT, 'mobile/assets/logo.png'))[25], 2);   // type de couleur 2 : RVB, sans alpha
});

test('icône : fond de l’icône adaptative sombre, comme le bord de l’icône', () => {
  const xml = fs.readFileSync(path.join(ROOT, `${RES}/values/ic_launcher_background.xml`), 'utf8');
  const hex = xml.match(/#([0-9a-f]{6})/i);
  assert.ok(hex, xml);
  for(const i of [0, 2, 4]) assert.ok(parseInt(hex[1].slice(i, i + 2), 16) < 0x30, hex[0]);
});
