/* Administration : vitesse de la session d'un joueur (/api/admin/session-speed, scripts/session-speed.js, 01/11/2026). Le groupe
   suit, puisqu'il joue la même session ; la partie reste au même tick et finit normalement. Vrai serveur HTTP. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createPartyService } from '../server/party/service.js';
import { ROOT, SERVER } from '../server/config.js';
import { tickAt } from '../src/shared/game.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const TOKEN = 'k'.repeat(40);
const ACC = [['C1', 'Crousti'], ['G1', 'canoul'], ['L1', 'Linoleom']].map(([id, name]) => ({ id, name, nameKey: name.toLowerCase(), guest: false }));
const [crousti, canoul, lino] = ACC;
let base, server, game, party, gs, now = 5_000_000;
before(async () => {
  const store = createMemoryStore();
  for(const a of ACC) await store.insertAccount(a);
  gs = createMemoryGameStore();
  game = createGameService({ store: gs, dev: false, clock: () => now,
    liveRunner: opts => Object.assign(fakeLive(rec => ({ id: rec.id, shares: rec.players.map(p => ({ account: p.account, left: false, bag: { Charbon: 5 } })) }))(opts), { view: async () => ({}) }) });
  party = createPartyService({ game, clock: () => now, getAccount: async id => ACC.find(a => a.id === id) ?? null });
  server = http.createServer(createApp({ store, service: createAccountService({ store, scrypt: FAST_SCRYPT }), game, party, root: ROOT,
    config: { ...SERVER, logProxyCheck: false, adminToken: TOKEN } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const speed = (body, headers = { authorization: `Bearer ${TOKEN}` }) => fetch(base + '/api/admin/session-speed', { method: 'POST',
  headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
  .then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));

test('sans la clé : la route n\'existe pas ; pseudo inconnu, pas de session, vitesse invalide : refusé', async () => {
  assert.equal((await speed({ name: 'Crousti' }, {})).status, 404);
  assert.equal((await speed({ name: 'Personne' })).status, 404);
  assert.equal((await speed({ name: 'Crousti' })).data.error.code, 'no_session');
  await party.create(lino); await party.launch(lino, {});
  for(const v of [3, -1, 1e9, 'vite', null]) assert.equal((await speed({ name: 'Linoleom', speed: v })).status, v === null ? 200 : 400, String(v));
  assert.equal((await speed({ name: 'Linoleom', speed: 2 })).status, 200);
});

test('×300 sur un membre : toute la session suit, au même tick ; elle finit normalement ; le navigateur reçoit la vitesse', async () => {
  await party.create(canoul);
  const { party:p } = await party.state(canoul);
  await party.join(crousti, p.code); await party.ready(crousti, true);
  const id = (await party.launch(canoul, {})).session.id;
  now += 60_000;
  const before = await gs.getGameSession(id), tick = tickAt(now - before.startedAt, before.speed), left = before.finishAt - now;
  const r = await speed({ name: 'Crousti' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.players.sort(), ['Crousti', 'canoul']);
  assert.equal(r.data.from, 2);
  assert.equal(r.data.speed, 300);
  const rec = await gs.getGameSession(id);
  assert.ok(Math.abs(tickAt(now - rec.startedAt, rec.speed) - tick) <= 3, 'même tick');
  assert.ok(Math.abs(rec.finishAt - now - left / 150) <= 1, 'temps restant divisé par 150');
  const view = await game.view(canoul);
  assert.deepEqual([view.speed, view.startedAt, view.finishAt], [300, rec.startedAt, rec.finishAt]);
  now = rec.finishAt + 1;
  await game.pump();
  assert.equal(await game.activeSessionId(canoul.id), null);
  assert.equal(await game.activeSessionId(crousti.id), null);
  assert.equal((await speed({ name: 'canoul' })).data.error.code, 'no_session');
});

test('script : ×300 par défaut, --speed pour revenir, message clair sans session ou sans pseudo', async () => {
  const envFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'speed-')), 'dim.env');
  fs.writeFileSync(envFile, `DIM_ADMIN_TOKEN=${TOKEN}\n`);
  const run = args => new Promise(res => {
    const env = { ...process.env }; delete env.DIM_ADMIN_TOKEN;
    execFile(process.execPath, ['scripts/session-speed.js', '--url', base, '--env', envFile, ...args], { env, encoding: 'utf8' },
      (err, out, errOut) => res({ ok: !err, out: out + errOut }));
  });
  let r = await run(['--name', 'linoleom']);
  assert.ok(r.ok, r.out);
  assert.match(r.out, /Session de Linoleom : ×2 → ×300, fin dans \d+ s\./);
  r = await run(['--name', 'linoleom', '--speed', '2']);
  assert.ok(r.ok, r.out);
  assert.match(r.out, /×300 → ×2/);
  r = await run(['--name', 'canoul']);
  assert.equal(r.ok, false); assert.match(r.out, /pas en session/);
  r = await run([]);
  assert.equal(r.ok, false); assert.match(r.out, /--name/);
});
