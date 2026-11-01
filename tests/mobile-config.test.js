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
    assert.ok(['@capacitor/core', '@capacitor/android', '@capacitor/local-notifications', '@capacitor/app', '@capacitor/app-launcher', '@capacitor/preferences'].includes(name), name);
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

test('appli : le serveur ne sert jamais mobile/', () => {
  assert.ok(SERVER.publicPaths.every(p => !p.startsWith('/mobile')));
});
