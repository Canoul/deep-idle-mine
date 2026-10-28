/* Coque de l'appli mobile (mobile/) : réglages de Capacitor, page hors ligne, et le serveur qui reste sans dépendance
   ni chemin public vers mobile/. Lit les fichiers, aucun réseau. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVER } from '../server/config.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const json = f => JSON.parse(read(f));

test('appli : réglages Capacitor (identité, jeu chargé depuis deepmineidle.fr, page hors ligne)', () => {
  const c = json('mobile/capacitor.config.json');
  assert.equal(c.appId, 'fr.deepmineidle.app');
  assert.equal(c.appName, 'Deep Mine Idle');
  assert.equal(c.webDir, 'www');
  assert.equal(c.server.url, 'https://deepmineidle.fr');
  assert.equal(c.server.errorPath, 'offline.html');
  assert.ok(!c.server.cleartext, 'jamais de http en clair');
});

test('appli : page hors ligne avec un lien Réessayer vers le jeu, sans script', () => {
  const html = read('mobile/www/offline.html');
  assert.match(html, /href="https:\/\/deepmineidle\.fr\/"/);
  assert.doesNotMatch(html, /<script/i);
});

test('appli : la racine garde pg comme seule dépendance', () => {
  assert.deepEqual(Object.keys(json('package.json').dependencies), ['pg']);
});

test('appli : mobile/ ne dépend que de Capacitor 8', () => {
  const p = json('mobile/package.json');
  for(const [name, v] of Object.entries(p.dependencies ?? {})){
    assert.ok(['@capacitor/core', '@capacitor/android'].includes(name), name);
    assert.match(v, /^\^8\./, name);
  }
  for(const [name, v] of Object.entries(p.devDependencies ?? {})){
    assert.ok(['@capacitor/cli'].includes(name), name);
    assert.match(v, /^\^8\./, name);
  }
});

test('appli : le serveur ne sert jamais mobile/', () => {
  assert.ok(SERVER.publicPaths.every(p => !p.startsWith('/mobile')));
});
