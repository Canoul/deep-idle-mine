/* Routes du jeu (/api/game/…) de bout en bout : vrai serveur HTTP sur un port libre, stockages en mémoire,
   rejeu factice. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { ROOT } from '../server/config.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

let server, base, now = 5_000_000;
before(async () => {
  const store = createMemoryStore();
  const service = createAccountService({ store, scrypt: FAST_SCRYPT });
  const summary = rec => ({ shares: rec.players.map(p => ({ account:p.account, left:false, bag:{ Fer:4 } })), chest:{ Fer:4 } });
  const game = createGameService({ store: createMemoryGameStore(), liveRunner: fakeLive(summary), clock: () => now, dev: false });
  server = http.createServer(createApp({ store, service, game, root: ROOT }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

function browser(){
  let cookie = '';
  return async function call(method, p, body){
    const res = await fetch(base + p, {
      method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    for(const c of res.headers.getSetCookie()){ const v = c.split(';')[0]; cookie = v.endsWith('=') ? '' : v; }
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null, retryAfter: res.headers.get('retry-after') };
  };
}

test('sans compte : on ne peut pas jouer', async () => {
  const b = browser();
  assert.equal((await b('GET', '/api/game/state')).status, 401);
  assert.equal((await b('POST', '/api/game/start', {})).status, 401);
  assert.equal((await b('GET', '/api/game/info')).status, 200, 'info est publique');
});

test('parcours : invité, préférences, lancement, fin refusée avant l\'heure, fin, inventaire', async () => {
  const b = browser();
  await b('POST', '/api/account/guest', {});
  const info = (await b('GET', '/api/game/info')).data;
  assert.deepEqual([info.dev, info.speed], [false, 2]);

  assert.deepEqual((await b('POST', '/api/game/prefs', { priority:'descendre' })).data.prefs, { priority:'descendre', fightMobs:true, helpAllies:false, helpIgnore:[] });
  const start = await b('POST', '/api/game/start', {});
  assert.equal(start.status, 201);
  assert.equal(start.data.session.prefs[start.data.session.players[0].account].priority, 'descendre');
  assert.equal((await b('POST', '/api/game/start', {})).status, 409);

  const early = await b('POST', '/api/game/finish', {});
  assert.equal(early.status, 409);
  assert.equal(early.data.error.code, 'too_early');
  assert.equal(early.retryAfter, '1800');

  now += 1800e3;
  assert.equal((await b('POST', '/api/game/finish', {})).status, 200);
  const st = (await b('GET', '/api/game/state')).data;
  assert.deepEqual(st.inventory.slots, [{ item:'Fer', qty:4 }]);
  assert.equal(st.ended.status, 'done');
  assert.equal((await b('POST', '/api/game/ack', { id: st.ended.id })).status, 204);
  assert.equal((await b('GET', '/api/game/state')).data.ended, null);
});

test('aucune route ne permet d\'écrire dans un inventaire', async () => {
  const b = browser();
  await b('POST', '/api/account/guest', {});
  /* /api/game/inventory existe depuis le 25/10 (trier, déplacer : src/meta/inventory.js) : il refuse ce corps (400) */
  for(const p of ['/api/game/inventory', '/api/game/credit', '/api/game/state'])
    assert.ok([400, 404, 405].includes((await b('POST', p, { slots:[{ item:'Diamant', qty:1e6 }] })).status), p);
  assert.deepEqual((await b('GET', '/api/game/state')).data.inventory.slots, []);
});

test('corps invalides : pas de plantage', async () => {
  const b = browser();
  await b('POST', '/api/account/guest', {});
  assert.equal((await b('POST', '/api/game/prefs', [1, 2])).status, 400, 'tableau refusé');
  assert.equal((await b('POST', '/api/game/ack', { id: 12 })).status, 400);
  assert.equal((await b('POST', '/api/game/leave', {})).status, 404);
});

test('chat de session : connecté seulement ; écrire puis relire après un numéro', async () => {
  assert.equal((await browser()('GET', '/api/game/chat')).status, 401);
  assert.equal((await browser()('POST', '/api/game/chat', { text:'x' })).status, 401);
  const b = browser();
  await b('POST', '/api/account/guest', {});
  assert.equal((await b('GET', '/api/game/chat')).status, 404, 'pas de session : pas de chat');
  await b('POST', '/api/game/start', {});
  const sent = await b('POST', '/api/game/chat', { text:'  hello <b>mine</b> ' });
  assert.equal(sent.status, 200);
  assert.equal(sent.data.message.text, 'hello <b>mine</b>');
  assert.deepEqual((await b('GET', '/api/game/chat')).data.messages.map(m => m.text), ['hello <b>mine</b>']);
  assert.deepEqual((await b('GET', `/api/game/chat?after=${sent.data.message.id}`)).data.messages, []);
  assert.equal((await b('GET', '/api/game/chat?after=abc')).data.messages.length, 1, 'numéro invalide : tout');
  assert.equal((await b('POST', '/api/game/chat', { text:'vite' })).status, 429);
  assert.equal((await b('POST', '/api/game/chat', { text:'' })).status, 400);
  await b('POST', '/api/game/leave', {});
});
