/* Administration : envoyer un joueur en prison (/api/admin/prison, scripts/send-to-prison.js, 01/11/2026). La prison se joue
   seul : il quitte son groupe, mais seulement si elle a bien démarré. Vrai serveur HTTP, stockages en mémoire. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createInlineRunner } from '../server/game/live.js';
import { createPartyService } from '../server/party/service.js';
import { ROOT, SERVER } from '../server/config.js';
import { FAST_SCRYPT } from './helpers.js';

const TOKEN = 'k'.repeat(40);
const ACC = [['C1', 'Crousti'], ['G1', 'canoul'], ['L1', 'Linoleom']].map(([id, name]) => ({ id, name, nameKey: name.toLowerCase(), guest: false }));
const [crousti, canoul, lino] = ACC;
let base, server, game, party;
before(async () => {
  const store = createMemoryStore();
  for(const a of ACC) await store.insertAccount(a);
  game = createGameService({ store: createMemoryGameStore(), dev: false, liveRunner: createInlineRunner });
  party = createPartyService({ game, getAccount: async id => ACC.find(a => a.id === id) ?? null });
  server = http.createServer(createApp({ store, service: createAccountService({ store, scrypt: FAST_SCRYPT }), game, party, root: ROOT,
    config: { ...SERVER, logProxyCheck: false, adminToken: TOKEN } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { game.close(); server.close(); });

const send = (body, headers = { authorization: `Bearer ${TOKEN}` }) => fetch(base + '/api/admin/prison', { method: 'POST',
  headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
  .then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));

test('sans la clé : la route n\'existe pas ; pseudo inconnu ou absent : refusé', async () => {
  assert.equal((await send({ name: 'Crousti' }, {})).status, 404);
  assert.equal((await send({ name: 'Personne' })).status, 404);
  assert.equal((await send({})).status, 400);
  assert.equal(await game.prisonActiveOf(crousti.id), false);
});

test('membre d\'un groupe : en prison, retiré du groupe ; le navigateur est prévenu ; deux fois : refusé', async () => {
  const { party:p } = await party.create(canoul);
  await party.join(crousti, p.code);
  const r = await send({ name: 'crousti' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { account: 'Crousti', left: true });
  assert.equal(await game.prisonActiveOf(crousti.id), true);
  assert.equal((await party.state(crousti)).party, null);
  assert.equal((await party.state(crousti)).inPrison, true);
  assert.equal((await party.state(canoul)).inPrison, false);
  assert.deepEqual((await party.state(canoul)).party.members.map(m => m.name), ['canoul'], 'le groupe continue');
  const again = await send({ name: 'Crousti' });
  assert.equal(again.status, 409);
  assert.match(again.data.error.message, /déjà en prison/);
  await game.prisonStop(crousti);
});

test('en session : refusé, il garde sa session et son groupe', async () => {
  await party.create(lino);
  await party.launch(lino, {});
  const r = await send({ name: 'Linoleom' });
  assert.equal(r.status, 409);
  assert.match(r.data.error.message, /en session.*end-session/);
  assert.equal(await game.prisonActiveOf(lino.id), false);
  assert.ok(await game.activeSessionId(lino.id));
  assert.ok((await party.state(lino)).party);
});
