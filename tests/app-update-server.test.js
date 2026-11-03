/* Mises à jour à chaud de l'appli (02/11/2026) : le serveur publie le paquet du jeu, ses fichiers et note les retours en arrière.
   Le site ne voit aucune différence. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAppUpdate, appUpdateRoutes } from '../server/app-update/routes.js';
import { sha256 } from '../server/app-update/bundle.js';
import { ROOT, SERVER } from '../server/config.js';

const APP = 'https://localhost', IOS = 'capacitor://localhost', EVIL = 'https://mechant.example';
const files = new Map([['index.html', Buffer.from('<p>jeu</p>')], ['src/main.js', Buffer.from('console.log(1)')], ['textures/a b.png', Buffer.from([0, 1, 2, 255])]]);
const update = createAppUpdate({ files, minNative: '1.1.0' });
const V = update.manifest.version;
let base, server;
before(async () => {
  server = http.createServer(createApp({ store: createMemoryStore(), root: ROOT, appUpdate: update, config: { ...SERVER, logProxyCheck: false } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const raw = (method, path, { origin, body } = {}) => new Promise((ok, ko) => {
  const data = body === undefined ? null : JSON.stringify(body);
  const req = http.request(base + path, { method, headers: { ...(origin ? { origin } : {}), ...(data ? { 'content-type': 'application/json' } : {}) } }, res => {
    const chunks = []; res.on('data', d => chunks.push(d));
    res.on('end', () => ok({ status: res.statusCode, headers: res.headers, buf: Buffer.concat(chunks) }));
  });
  req.on('error', ko); if(data) req.write(data); req.end();
});
const json = r => JSON.parse(r.buf.toString());

test('manifeste : version, version minimale de la coque, empreinte de chaque fichier ; CORS pour l\'appli seulement', async () => {
  for(const origin of [APP, IOS]){
    const r = await raw('GET', '/api/app/update', { origin });
    assert.equal(r.status, 200);
    assert.equal(r.headers['access-control-allow-origin'], origin);
    const m = json(r);
    assert.equal(m.version, V); assert.equal(m.minNative, '1.1.0');
    assert.equal(m.files['src/main.js'], sha256(files.get('src/main.js')));
  }
  assert.equal((await raw('GET', '/api/app/update', { origin: EVIL })).headers['access-control-allow-origin'], undefined);
});

test('manifeste : l\'appli qui a déjà la version reçoit une réponse courte', async () => {
  assert.deepEqual(json(await raw('GET', `/api/app/update?have=${V}`, { origin: APP })), { version: V, minNative: '1.1.0', same: true });
  assert.ok(json(await raw('GET', '/api/app/update?have=0000', { origin: APP })).files);
});

test('fichiers : ceux du paquet en cours, octets exacts, cache long ; rien d\'autre', async () => {
  const r = await raw('GET', `/app-bundle/${V}/textures/a%20b.png`, { origin: APP });
  assert.equal(r.status, 200);
  assert.deepEqual(r.buf, files.get('textures/a b.png'));
  assert.equal(r.headers['content-type'], 'application/octet-stream');
  assert.match(r.headers['cache-control'], /immutable/);
  assert.equal(r.headers['access-control-allow-origin'], APP);
  for(const p of [`/app-bundle/0123456789abcdef/src/main.js`, `/app-bundle/${V}/src/autre.js`, `/app-bundle/${V}/../server/config.js`,
                  `/app-bundle/${V}/%2e%2e/package.json`, `/app-bundle/${V}`, '/app-bundle/', `/app-bundle/${V}/%E0%A4%A`])
    assert.equal((await raw('GET', p)).status, 404, p);
  assert.equal((await raw('POST', `/app-bundle/${V}/src/main.js`, { body: {} })).status, 405);
});

test('site : rien ne change (page, fichiers, pas de CORS)', async () => {
  const r = await raw('GET', '/src/main.js');
  assert.equal(r.status, 200);
  assert.equal(r.headers['access-control-allow-origin'], undefined);
});

test('retour en arrière : noté dans le journal, champs nettoyés, plafonné par heure', async () => {
  const lines = []; let t = 0;
  const routes = appUpdateRoutes(update, { log: l => lines.push(l), now: () => t, perHour: 2 });
  const post = body => routes['POST /api/app/rollback']({ body });
  assert.deepEqual(await post({ from: 'abc', to: 'def', why: 'timeout', platform: 'ios', native: '1.1.0' }), [204]);
  assert.match(lines[0], /abc → def \(timeout, ios, coque 1\.1\.0\)/);
  await post({ from: 'x\n[faux] ligne', to: 42, why: '<script>' });
  assert.match(lines[1], /\? → \? \(\?, \?, coque \?\)/);
  await post({}); assert.equal(lines.length, 2, 'plafond atteint');
  t = 3600e3; await post({}); assert.equal(lines.length, 3, 'nouvelle heure');
  assert.equal((await raw('POST', '/api/app/rollback', { origin: APP, body: { from: 'a' } })).status, 204);
});

test('serveur sans paquet (raté au démarrage) : les routes n\'existent pas, le jeu tourne', async () => {
  const s = http.createServer(createApp({ store: createMemoryStore(), root: ROOT, config: { ...SERVER, logProxyCheck: false } }));
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  try {
    const r = await fetch(`http://127.0.0.1:${s.address().port}/api/app/update`);
    assert.equal(r.status, 404);
    assert.equal((await fetch(`http://127.0.0.1:${s.address().port}/app-bundle/x/index.html`)).status, 404);
  } finally { s.close(); }
});

test('paquet réel : construit depuis le dépôt', () => {
  const real = createAppUpdate();
  assert.ok(Object.keys(real.manifest.files).length > 100);
  assert.ok(real.file(real.manifest.version, 'src/main.js'));
});

test('relevé (03/11) : demandes de version et fichiers notés ; route réservée à l\'équipe ; page du relevé', async () => {
  await raw('GET', '/api/app/update?have=abc', { origin: APP });
  await raw('GET', `/api/app/update?have=${V}`, { origin: APP });
  await raw('GET', `/app-bundle/${V}/index.html`, { origin: APP });
  const [same, upd] = update.trace.checks;
  assert.equal(same.have, V); assert.equal(same.answer, 'même version');
  assert.equal(upd.have, 'abc'); assert.equal(upd.answer, 'mise à jour proposée'); assert.equal(upd.origin, APP);
  assert.ok(update.trace.files[V].ok >= 1);
  assert.equal((await raw('GET', '/api/app/update/trace')).status, 404, 'sans compte : route inconnue');
  const routes = appUpdateRoutes(update);
  await assert.rejects(routes['GET /api/app/update/trace']({ me: { name: 'Zoe' } }), e => e.status === 404);
  const t = await routes['GET /api/app/update/trace']({ me: { name: 'admin' } });
  assert.equal(t.version, V); assert.ok(t.checks.length >= 2);
  const { renderAppTrace } = await import('../src/ui/app-trace.js');
  const html = renderAppTrace(t);
  assert.ok(html.includes(V) && html.includes('mise à jour proposée'));
});
