/* Dernière appli sur les stores (04/11/2026) : réglée sur le VPS (/api/admin/app-latest, scripts/set-app-latest.js), gardée en base,
   lue par l'appli (GET /api/app/latest, src/app/store-nudge.js). Vrai serveur HTTP, stockages en mémoire. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createAppLatest } from '../server/app-update/latest.js';
import { appUpdateRoutes } from '../server/app-update/routes.js';
import { latestOf } from '../src/app/store-nudge.js';
import { storeNudge } from '../src/app/update.js';
import { ROOT, SERVER } from '../server/config.js';
import { APP_UPDATE } from '../src/config.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const TOKEN = 'k'.repeat(40);
let base, server, gs;
before(async () => {
  const store = createMemoryStore();
  gs = createMemoryGameStore();
  const game = createGameService({ store: gs, dev: false, liveRunner: fakeLive(rec => ({ id: rec.id, shares: [] })) });
  const appUpdate = { manifest: { version: 'v1', minNative: APP_UPDATE.minNative, files: {} }, latest: createAppLatest({ store: gs }) };
  server = http.createServer(createApp({ store, service: createAccountService({ store, scrypt: FAST_SCRYPT }), game, appUpdate, root: ROOT,
    config: { ...SERVER, logProxyCheck: false, adminToken: TOKEN } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const set = (body, headers = {}) => fetch(base + '/api/admin/app-latest', { method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, ...headers }, body: JSON.stringify(body) })
  .then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));
const latest = () => fetch(base + '/api/app/latest').then(r => r.json());

test('config : 1.1.5 en ligne sur Google Play', () => assert.equal(APP_UPDATE.latest.android, '1.1.5'));

test('sans réglage : la version de la config ; réglée : celle du VPS, gardée en base ; "" : retour à la config', async () => {
  assert.deepEqual(await latest(), { ...APP_UPDATE.latest });
  assert.equal((await set({ platform: 'android', version: '1.1.6' }, { authorization: 'Bearer faux' })).status, 404);
  assert.equal((await set({ platform: 'android', version: '1.1.6' }, { 'x-forwarded-for': '1.2.3.4' })).status, 404);
  const r = await set({ platform: 'android', version: '1.1.6' });
  assert.equal(r.status, 200); assert.deepEqual(r.data, { platform: 'android', before: APP_UPDATE.latest.android, after: '1.1.6' });
  assert.deepEqual(await latest(), { android: '1.1.6', ios: APP_UPDATE.latest.ios });
  assert.deepEqual(await gs.getAppLatest(), { android: '1.1.6' });
  for(const bad of [{ platform: 'web', version: '1.2' }, { platform: 'android', version: '1.1.6; rm' }, { platform: 'android' }])
    assert.equal((await set(bad)).status, 400, JSON.stringify(bad));
  assert.equal((await set({ platform: 'android', version: '' })).data.after, APP_UPDATE.latest.android);
  assert.deepEqual(await latest(), { ...APP_UPDATE.latest });
});

test('relu au redémarrage (même base)', async () => {
  const s = createMemoryGameStore();
  await createAppLatest({ store: s }).set('ios', '1.2.0');
  assert.equal((await createAppLatest({ store: s }).get()).ios, '1.2.0');
});

test('appli : demande au serveur ; sans réponse, la config ; la fenêtre part si sa version est plus ancienne', async () => {
  const ok = await latestOf({ api: 'x', fetch: async () => ({ ok: true, json: async () => ({ android: '1.1.7', ios: '' }) }) });
  assert.deepEqual(ok, { ...APP_UPDATE.latest, android: '1.1.7' });
  assert.deepEqual(await latestOf({ api: 'x', fetch: async () => { throw new Error('hors ligne'); } }), APP_UPDATE.latest);
  assert.deepEqual(await latestOf({ api: 'x', timeout: 0.01, fetch: () => new Promise(() => {}) }), APP_UPDATE.latest);
  assert.equal(storeNudge({ native: '1.1.4', platform: 'android', latest: ok }), '1.1.7');
  assert.equal(storeNudge({ native: '1.1.7', platform: 'android', latest: ok }), null);
});

test('route publique sans service branché : la config', async () => {
  const routes = appUpdateRoutes({ manifest: { version: 'v', minNative: '1.1.0', files: {} } });
  assert.deepEqual(await routes['GET /api/app/latest']({}), { ...APP_UPDATE.latest });
});
