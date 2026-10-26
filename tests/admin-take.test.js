/* Administration (/api/admin/take) : retirer un objet à un joueur sans redémarrer (inventaire, ou glyphe posé sur son
   skill). Vrai serveur HTTP sur la machine, stockages en mémoire. Tout ou rien, garde-fous, fermée sans la clé. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { ROOT, SERVER } from '../server/config.js';
import { deserialize, countOf } from '../src/meta/inventory.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const TOKEN = 'k'.repeat(40);
let base, server, gameStore, gameService;
before(async () => {
  const store = createMemoryStore();
  await store.insertAccount({ id: 'C1', name: 'Crousti', nameKey: 'crousti', guest: false });
  const service = createAccountService({ store, scrypt: FAST_SCRYPT });
  gameStore = createMemoryGameStore();
  gameService = createGameService({ store: gameStore, liveRunner: fakeLive(() => ({ shares: [], chest: {} })), dev: false });
  server = http.createServer(createApp({ store, service, game: gameService, root: ROOT, config: { ...SERVER, logProxyCheck: false, adminToken: TOKEN } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = (route, body, headers = {}) => fetch(base + route, { method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, ...headers }, body: JSON.stringify(body) })
  .then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));
const take = (body, headers) => post('/api/admin/take', body, headers);
const count = async item => { const raw = await gameStore.getInventory('C1'); return raw ? countOf(deserialize(JSON.stringify(raw)), item) : 0; };
const posed = async () => (await gameStore.getSkills('C1'))?.glyphs ?? {};

test('retire un objet de l\'inventaire, sans redémarrage ; tout ou rien s\'il en manque', async () => {
  await post('/api/admin/give', { name: 'crousti', item: 'Treasure T3', qty: 3 });
  const r = await take({ name: 'CROUSTI', item: 'Treasure T3', qty: 2 });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data, { account: 'Crousti', item: 'Treasure T3', qty: 2, fromInventory: 2, fromSkill: 0, before: 3, after: 1 });
  assert.equal(await count('Treasure T3'), 1);
  const no = await take({ name: 'crousti', item: 'Treasure T3', qty: 2 });
  assert.equal(no.status, 409);
  assert.equal(no.data.error.code, 'not_owned');
  assert.equal(await count('Treasure T3'), 1, 'refus : rien retiré');
});

test('un glyphe posé sur son skill est retiré de la case quand l\'inventaire n\'en a plus', async () => {
  /* skill Échelle de 2 au rang max avec son glyphe posé, plus un exemplaire dans l'inventaire */
  await post('/api/admin/give', { name: 'crousti', item: 'Glyphe Échelle de 2', qty: 2 });
  const st = (await gameStore.getSkills('C1')) ?? {};
  await gameStore.putSkills('C1', { ...st, glyphs: { tall_ladder: 'Glyphe Échelle de 2' } });
  await take({ name: 'crousti', item: 'Glyphe Échelle de 2' });   // l'exemplaire en trop de l'inventaire
  assert.equal(await count('Glyphe Échelle de 2'), 1);
  assert.deepEqual(await posed(), { tall_ladder: 'Glyphe Échelle de 2' }, 'l\'inventaire passe avant la case');
  const r = await take({ name: 'crousti', item: 'Glyphe Échelle de 2', qty: 2 });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data, { account: 'Crousti', item: 'Glyphe Échelle de 2', qty: 2, fromInventory: 1, fromSkill: 1, before: 2, after: 0 });
  assert.equal(await count('Glyphe Échelle de 2'), 0);
  assert.deepEqual(await posed(), {});
  assert.equal((await take({ name: 'crousti', item: 'Glyphe Échelle de 2' })).status, 409, 'plus rien à retirer');
});

test('garde-fous : objet inconnu, quantité invalide, compte inconnu, pseudo manquant ; fermée sans la clé ou via un relais', async () => {
  await post('/api/admin/give', { name: 'crousti', item: 'Treasure T3', qty: 5 });
  const before = await count('Treasure T3');
  for(const [body, status] of [[{ name: 'crousti', item: 'treasure t3' }, 400], [{ name: 'crousti', item: 'Treasure T9' }, 400],
                               [{ name: 'crousti', item: 'Treasure T3', qty: 0 }, 400], [{ name: 'crousti', item: 'Treasure T3', qty: -1 }, 400],
                               [{ name: 'crousti', item: 'Treasure T3', qty: 1.5 }, 400], [{ name: 'crousti', item: 'Treasure T3', qty: '2' }, 400],
                               [{ name: 'crousti', item: 'Treasure T3', qty: 1001 }, 400],
                               [{ name: 'personne', item: 'Treasure T3' }, 404], [{ item: 'Treasure T3' }, 400]])
    assert.equal((await take(body)).status, status, JSON.stringify(body));
  for(const h of [{ authorization: 'Bearer ' + 'x'.repeat(40) }, { authorization: '' }, { 'x-forwarded-for': '1.2.3.4' }])
    assert.equal((await take({ name: 'crousti', item: 'Treasure T3' }, h)).status, 404, JSON.stringify(h));
  assert.equal(await count('Treasure T3'), before);
});
