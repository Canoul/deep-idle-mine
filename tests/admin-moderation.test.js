/* Administration (/api/admin/moderation, scripts/moderation.js) : fiche d'un joueur avec motifs et messages d'origine,
   lever un ban, retirer un avertissement, derniers avertissements de tous ; fermée sans la clé. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createModerationService } from '../server/moderation/service.js';
import { ROOT, SERVER } from '../server/config.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const TOKEN = 'k'.repeat(40);
let base, server, moderation;
before(async () => {
  const store = createMemoryStore();
  await store.insertAccount({ id: 'C1', name: 'Crousti', nameKey: 'crousti', guest: false });
  const service = createAccountService({ store, scrypt: FAST_SCRYPT });
  const gameStore = createMemoryGameStore();
  moderation = createModerationService({ store: gameStore });
  const game = createGameService({ store: gameStore, liveRunner: fakeLive(() => ({ shares: [] })), dev: false, moderation });
  server = http.createServer(createApp({ store, service, game, moderation, root: ROOT, config: { ...SERVER, logProxyCheck: false, adminToken: TOKEN } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
const post = (body, headers = {}) => fetch(base + '/api/admin/moderation', { method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, ...headers }, body: JSON.stringify(body) })
  .then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));

test('fiche, retirer, lever le ban, derniers avertissements ; sans la clé : route inconnue', async () => {
  for(const text of ['connard', 'salope', 'fdp']) await moderation.warn('C1', { channel: 'global', text, masked: '***', hits: [{ word: text, motif: 'Insulte' }] });
  let r = await post({ name: 'crousti', action: 'show' });
  assert.equal(r.status, 200); assert.equal(r.data.account, 'Crousti');
  assert.deepEqual(r.data.warnings.map(w => [w.text, w.motif]), [['connard', 'Insulte'], ['salope', 'Insulte'], ['fdp', 'Insulte']]);
  assert.ok(r.data.bannedUntil > r.data.now); assert.equal(r.data.bans.length, 1);
  assert.equal((await post({ name: 'crousti', action: 'unban' })).status, 200);
  assert.equal(await moderation.bannedUntil('C1'), 0);
  assert.equal((await post({ name: 'crousti', action: 'forgive', index: 2 })).data.ok, true);
  assert.equal((await post({ name: 'crousti', action: 'forgive', index: 7 })).status, 400);
  r = await post({ action: 'recent' });
  assert.equal(r.data.rows.length, 3); assert.equal(r.data.rows[0].name, 'Crousti');
  assert.equal((await post({ name: 'personne', action: 'show' })).status, 404);
  assert.equal((await post({ name: 'crousti' }, { authorization: 'Bearer ' + 'x'.repeat(40) })).status, 404);
});
