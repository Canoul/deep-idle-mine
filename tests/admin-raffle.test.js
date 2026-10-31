/* Administration : forcer un raffle (/api/admin/raffle, scripts/force-raffle.js, 31/10/2026). Vrai serveur HTTP, stockages en mémoire. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createSocialService } from '../server/social/service.js';
import { ROOT, SERVER } from '../server/config.js';
import { RAFFLE } from '../src/config.js';
import { raffleOpen } from '../src/shared/raffle.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const TOKEN = 'k'.repeat(40);
const NIGHT = Date.UTC(2026, 9, 29, 3);        // 4 h à Paris : créneau fermé
let base, server, gs, social, now = NIGHT;
before(async () => {
  const store = createMemoryStore();
  gs = createMemoryGameStore();
  const clock = () => now;
  const game = createGameService({ store: gs, dev: false, clock, liveRunner: fakeLive(rec => ({ id: rec.id, shares: [] })) });
  social = createSocialService({ store: gs, accounts: store, game, party: null, clock });
  server = http.createServer(createApp({ store, service: createAccountService({ store, scrypt: FAST_SCRYPT }), game, social, root: ROOT,
    config: { ...SERVER, logProxyCheck: false, adminToken: TOKEN } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const force = (headers = {}) => fetch(base + '/api/admin/raffle', { method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, ...headers }, body: '{}' })
  .then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));

test('sans la bonne clé : 404, aucun raffle', async () => {
  assert.equal((await force({ authorization: 'Bearer faux' })).status, 404);
  assert.equal((await force({ 'x-forwarded-for': '1.2.3.4' })).status, 404);
  assert.equal(await gs.getRaffle(), null);
});

test('part tout de suite, même la nuit ; refusé si un raffle est en cours ; le suivant est reprogrammé après', async () => {
  assert.ok(!raffleOpen(now));
  const r = await force();
  assert.equal(r.status, 200);
  assert.equal(r.data.seconds, RAFFLE.joinMs / 1000);
  assert.equal(typeof r.data.lot, 'string');
  assert.ok((await gs.getRaffle()).current);

  const again = await force();
  assert.equal(again.status, 409);
  assert.match(again.data.error?.message ?? again.data.message ?? '', /déjà/);

  now += RAFFLE.joinMs;
  await social.raffleTick();
  const s = await gs.getRaffle();
  assert.equal(s.current, null);
  assert.ok(s.nextAt > now);
});
