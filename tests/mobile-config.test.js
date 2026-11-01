/* Appli mobile (mobile/) : réglages de Capacitor, et le serveur qui reste sans dépendance
   ni chemin public vers mobile/. Lit les fichiers, aucun réseau. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVER } from '../server/config.js';
import { APP_UA } from '../src/app/mode.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const json = f => JSON.parse(read(f));

test('appli : réglages Capacitor (identité, fichiers du jeu dans l\'appli, jamais le site à distance)', () => {
  const c = json('mobile/capacitor.config.json');
  assert.equal(c.appId, 'fr.deepmineidle.app');
  assert.equal(c.appName, 'Deep Mine Idle MMO');
  assert.equal(c.webDir, 'www');
  assert.equal(c.server?.url, undefined, 'les stores refusent un simple navigateur ouvert sur le site');
  assert.ok(!c.server?.cleartext, 'jamais de http en clair');
});

test('appli : la coque ajoute la marque que src/app/mode.js reconnaît', () => {
  assert.equal(json('mobile/capacitor.config.json').appendUserAgent, APP_UA);
});

test('appli : la page copiée dans l\'appli vise le serveur en https', () => {
  assert.match(read('mobile/scripts/copy-web.js'), /API_URL = 'https:\/\/deepmineidle\.fr'/);
});

test('appli : la racine garde pg comme seule dépendance', () => {
  assert.deepEqual(Object.keys(json('package.json').dependencies), ['pg']);
});

test('appli : mobile/ ne dépend que de Capacitor 8 et de ses plugins officiels', () => {
  const p = json('mobile/package.json');
  for(const [name, v] of Object.entries(p.dependencies ?? {})){
    assert.ok(['@capacitor/core', '@capacitor/android', '@capacitor/local-notifications', '@capacitor/app', '@capacitor/app-launcher', '@capacitor/preferences', '@capacitor/ios', '@capacitor/keyboard'].includes(name), name);
    assert.match(v, /^\^8\./, name);
  }
  for(const [name, v] of Object.entries(p.devDependencies ?? {})){
    assert.ok(['@capacitor/cli', '@capacitor/assets'].includes(name), name);
    assert.match(v, name === '@capacitor/assets' ? /^\^4\./ : /^\^8\./, name);
  }
});

test('coque : plugin des notifications dans mobile/, jamais à la racine', () => {
  assert.ok(json('mobile/package.json').dependencies['@capacitor/local-notifications']);
  assert.ok(!json('package.json').dependencies['@capacitor/local-notifications']);
  assert.match(read('mobile/android/capacitor.settings.gradle'), /capacitor-local-notifications/);
  assert.match(read('mobile/android/app/src/main/AndroidManifest.xml'), /android\.permission\.POST_NOTIFICATIONS/);
});

/* ---- projet iOS (mobile/ios, repris de jules/appli-ios) ---- */
const plist = read('mobile/ios/App/App/Info.plist');
const pbx = read('mobile/ios/App/App.xcodeproj/project.pbxproj');
const plistArray = key => [...(plist.match(new RegExp(`<key>${key}</key>\\s*<array>([\\s\\S]*?)</array>`))?.[1] ?? '')
  .matchAll(/<string>([^<]*)<\/string>/g)].map(m => m[1]);
const plistValue = key => plist.match(new RegExp(`<key>${key}</key>\\s*<(?:string>([^<]*)</string|(true|false)/)>`))?.slice(1).find(v => v !== undefined);

test('appli iOS : même identité que capacitor.config.json, version 1.0.0', () => {
  const c = json('mobile/capacitor.config.json');
  const ids = [...pbx.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map(m => m[1]);
  assert.deepEqual(ids, [c.appId, c.appId]);
  assert.equal(plistValue('CFBundleDisplayName'), c.appName);
  assert.deepEqual([...new Set([...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map(m => m[1]))], ['1.0.0']);
});

test('appli iOS : iPhone seul, écran vertical', () => {
  assert.deepEqual(plistArray('UISupportedInterfaceOrientations'), ['UIInterfaceOrientationPortrait']);
  assert.ok(!plist.includes('UISupportedInterfaceOrientations~ipad'));
  assert.deepEqual([...new Set([...pbx.matchAll(/TARGETED_DEVICE_FAMILY = ([^;]+);/g)].map(m => m[1]))], ['1']);
});

test('appli iOS : chiffrement déclaré une fois pour toutes (seulement HTTPS), aucun suivi, aucune description d\'usage', () => {
  assert.equal(plistValue('ITSAppUsesNonExemptEncryption'), 'false');
  assert.doesNotMatch(plist, /NSUserTrackingUsageDescription|UsageDescription/);
});

test('appli iOS : notifications locales seulement, donc pas d\'entitlement push', () => {
  assert.doesNotMatch(pbx, /CODE_SIGN_ENTITLEMENTS/);
  assert.doesNotMatch(json('mobile/package.json').dependencies['@capacitor/push-notifications'] ?? '', /./);
  assert.doesNotMatch(plist, /remote-notification/);
});

test('appli iOS : manifeste de confidentialité dans l\'appli, sans suivi', () => {
  const p = read('mobile/ios/App/App/PrivacyInfo.xcprivacy');
  assert.match(p, /<key>NSPrivacyTracking<\/key>\s*<false\/>/);
  assert.match(p, /NSPrivacyAccessedAPICategoryUserDefaults/);
  assert.match(p, /CA92\.1/);
  for(const type of ['UserID', 'GameplayContent', 'OtherUserContent']) assert.match(p, new RegExp('NSPrivacyCollectedDataType' + type));
  assert.equal([...pbx.matchAll(/PrivacyInfo\.xcprivacy in Resources/g)].length, 2, 'déclaré puis ajouté aux ressources');
});

test('appli iOS : pas de rebond, clavier qui pousse le chat, zones de sécurité', () => {
  const scene = read('mobile/ios/App/App/SceneDelegate.swift');
  assert.match(scene, /bounces = false/); assert.match(scene, /MainViewController\(\)/);
  assert.equal(json('mobile/capacitor.config.json').plugins.Keyboard.resize, 'native');
  assert.match(read('src/app/app.css'), /env\(safe-area-inset-top\)/);
});

test('appli iOS : chaque plugin de mobile/package.json est dans Package.swift (sinon : cd mobile && npm run sync, et commiter)', () => {
  const swift = read('mobile/ios/App/CapApp-SPM/Package.swift');
  const plugins = Object.keys(json('mobile/package.json').dependencies)
    .filter(n => !['@capacitor/core', '@capacitor/android', '@capacitor/ios'].includes(n));
  for(const name of plugins) assert.ok(swift.includes(`node_modules/${name}"`), name);
});

test('appli iOS : workflow par clé d\'API seule, sans certificat ni profil, secrets jamais affichés', () => {
  const w = read('.github/workflows/ios.yml');
  assert.match(w, /^name: Appli iPhone$/m);
  assert.match(w, /allowProvisioningUpdates/); assert.match(w, /authenticationKeyPath/); assert.match(w, /CODE_SIGNING_ALLOWED=NO/);
  assert.doesNotMatch(w, /P12|PROFILE_BASE64|security import/);
  for(const name of ['ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_P8', 'IOS_TEAM_ID']) assert.match(w, new RegExp('secrets\\.' + name));
  assert.doesNotMatch(w, /set -x/);
  assert.match(w, /github\.run_number \* 100|run_number\)\*100|RUN_NUMBER \* 100/, 'numéro de build : jamais deux fois le même, relance comprise');
});

test('dépôt : clés et profils Apple ignorés par git', () => {
  const ignore = read('.gitignore');
  for(const p of ['*.p8', '*.cer', '*.mobileprovision', '*.ipa']) assert.ok(ignore.includes(p), p);
});

test('appli : le serveur ne sert jamais mobile/', () => {
  assert.ok(SERVER.publicPaths.every(p => !p.startsWith('/mobile')));
});
