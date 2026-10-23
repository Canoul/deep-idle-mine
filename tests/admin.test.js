/* Administration (/api/admin/give) : donner un objet à un joueur sans redémarrer le serveur. Vrai serveur HTTP sur la
   machine, stockages en mémoire. Fermée sans la bonne clé, hors de la machine ou derrière un relais (Caddy). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { adminAllowed } from '../server/admin/routes.js';
import { ROOT, SERVER } from '../server/config.js';
import { deserialize, countOf } from '../src/meta/inventory.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const TOKEN = 'k'.repeat(40);
let base, servers = [], gameStore;
async function start(token){
  const store = createMemoryStore();
  await store.insertAccount({ id: 'C1', name: 'Crousti', nameKey: 'crousti', guest: false });
  const service = createAccountService({ store, scrypt: FAST_SCRYPT });
  const gs = createMemoryGameStore();
  const game = createGameService({ store: gs, liveRunner: fakeLive(() => ({ shares: [], chest: {} })), dev: false });
  const server = http.createServer(createApp({ store, service, game, root: ROOT, config: { ...SERVER, logProxyCheck: false, adminToken: token } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  servers.push(server);
  return { url: `http://127.0.0.1:${server.address().port}`, gs, game };
}
before(async () => { const s = await start(TOKEN); base = s.url; gameStore = s.gs; });
after(() => { for(const s of servers) s.close(); });

const give = (body, headers = {}, url = base) => fetch(url + '/api/admin/give', { method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, ...headers }, body: JSON.stringify(body) })
  .then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));
const t3 = async () => { const raw = await gameStore.getInventory('C1'); return raw ? countOf(deserialize(JSON.stringify(raw)), 'Treasure T3') : 0; };

test('donne un Treasure T3 à crousti (pseudo sans majuscules), sans redémarrage : mémoire du serveur à jour', async () => {
  const r = await give({ name: 'CROUSTI', item: 'Treasure T3' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data, { account: 'Crousti', item: 'Treasure T3', qty: 1, before: 0, after: 1 });
  assert.equal(await t3(), 1);
  assert.equal((await give({ name: 'crousti', item: 'Treasure T3', qty: 2 })).data.after, 3);
  assert.equal(await t3(), 3);
});

test('fermée : mauvaise clé, sans clé, ou requête passée par un relais (Caddy) → « route inconnue », rien donné', async () => {
  const before = await t3();
  for(const h of [{ authorization: 'Bearer ' + 'x'.repeat(40) }, { authorization: '' }, { authorization: TOKEN },
                  { 'x-forwarded-for': '1.2.3.4' }, { forwarded: 'for=1.2.3.4' }, { 'x-real-ip': '1.2.3.4' }]){
    const r = await give({ name: 'crousti', item: 'Treasure T3' }, h);
    assert.equal(r.status, 404, JSON.stringify(h));
    assert.equal(r.data.error.code, 'not_found');
  }
  assert.equal(await t3(), before);
});

test('fermée si la clé du serveur manque ou est trop courte, même avec la « bonne » clé', async () => {
  for(const token of ['', 'court']){
    const s = await start(token);
    const r = await give({ name: 'crousti', item: 'Treasure T3' }, { authorization: `Bearer ${token}` }, s.url);
    assert.equal(r.status, 404);
  }
});

test('garde-fous : objet inconnu, quantité invalide, compte inconnu, pseudo manquant', async () => {
  const before = await t3();
  for(const [body, status] of [[{ name: 'crousti', item: 'treasure t3' }, 400], [{ name: 'crousti', item: 'Treasure T9' }, 400],
                               [{ name: 'crousti', item: 'Treasure T3', qty: 0 }, 400], [{ name: 'crousti', item: 'Treasure T3', qty: 1.5 }, 400],
                               [{ name: 'crousti', item: 'Treasure T3', qty: 1001 }, 400], [{ name: 'crousti', item: 'Treasure T3', qty: '2' }, 400],
                               [{ name: 'personne', item: 'Treasure T3' }, 404], [{ item: 'Treasure T3' }, 400]]){
    assert.equal((await give(body)).status, status, JSON.stringify(body));
  }
  assert.equal(await t3(), before);
});

test('adminAllowed : seulement depuis la machine elle-même', () => {
  const req = (ip, headers = {}) => ({ socket: { remoteAddress: ip }, headers: { authorization: `Bearer ${TOKEN}`, ...headers } });
  for(const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) assert.equal(adminAllowed(req(ip), TOKEN), true, ip);
  for(const ip of ['10.0.0.2', '1.2.3.4', '::ffff:1.2.3.4', '', undefined]) assert.equal(adminAllowed(req(ip), TOKEN), false, String(ip));
});
