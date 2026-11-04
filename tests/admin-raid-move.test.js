/* Administration du lobby de raid (/api/admin/raid-move, scripts/move-to-raid.js, 04/11/2026) : mettre un joueur dans le
   lobby de raid où se trouve un autre. Vrai serveur HTTP, stockages en mémoire. */
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
import { createGuildService } from '../server/guild/service.js';
import { ROOT, SERVER } from '../server/config.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const TOKEN = 'k'.repeat(40);
const ACC = [['CHIEFAAA', 'canoul'], ['CROUSTIA', 'Crousti'], ['MONSTAAA', 'Monsta']]
  .map(([id, name]) => ({ id, name, nameKey: name.toLowerCase(), guest: false }));
const [canoul, crousti, monsta] = ACC;
let base, server, guild;
before(async () => {
  const store = createMemoryStore();
  for(const a of ACC) await store.insertAccount(a);
  const service = createAccountService({ store, scrypt: FAST_SCRYPT });
  const gameStore = createMemoryGameStore();
  const game = createGameService({ store: gameStore, dev: false, liveRunner: fakeLive(rec => ({ id: rec.id, shares: [] })) });
  guild = createGuildService({ store: gameStore, accounts: store, statusOf: async () => ({ status: 'offline' }), game });
  await guild.create(canoul, 'Les Rois');
  await guild.raidJoin(canoul);
  server = http.createServer(createApp({ store, service, game, guild, root: ROOT, config: { ...SERVER, logProxyCheck: false, adminToken: TOKEN } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = (route, body, headers = {}) => fetch(base + '/api/admin/' + route, { method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, ...headers }, body: JSON.stringify(body) })
  .then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));

test('raid-move : clé exigée, pseudos vérifiés, hôte hors de tout lobby de raid refusé', async () => {
  assert.equal((await post('raid-move', { name: 'crousti', to: 'canoul' }, { authorization: 'Bearer ' + 'x'.repeat(40) })).status, 404);
  assert.equal((await post('raid-move', { name: 'personne', to: 'canoul' })).status, 404);
  const r = await post('raid-move', { name: 'canoul', to: 'monsta' });
  assert.equal(r.status, 404); assert.equal(r.data.error.code, 'host_not_in_raid');
});

test('raid-move : crousti (hors guilde) entre dans le lobby de raid de canoul, en invité prêt ; rejoué : rien', async () => {
  let r = await post('raid-move', { name: 'crousti', to: 'canoul' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.moved, true);
  assert.deepEqual(r.data.members.map(m => m.name), ['canoul', 'Crousti']);
  assert.ok(r.data.members[1].invited && r.data.members[1].ready);
  r = await post('raid-move', { name: 'crousti', to: 'canoul' });
  assert.equal(r.data.moved, false);
  assert.ok((await guild.view(canoul)).mine.raid.members.some(m => m.account === crousti.id));
});

test('script move-to-raid.js : message lisible, et ses erreurs', async () => {
  const envFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'raid-')), 'dim.env');
  fs.writeFileSync(envFile, `DIM_ADMIN_TOKEN=${TOKEN}\n`);
  const run = args => new Promise(res => {
    const env = { ...process.env }; delete env.DIM_ADMIN_TOKEN;
    execFile(process.execPath, ['scripts/move-to-raid.js', '--url', base, '--env', envFile, ...args], { env, encoding: 'utf8' },
      (err, out, errOut) => res({ ok: !err, out: out + errOut }));
  });
  let r = await run(['--name', 'monsta', '--to', 'crousti']);
  assert.ok(r.ok, r.out);
  assert.match(r.out, /« Monsta » est maintenant dans le lobby de raid de « Crousti » : canoul \(chef\) \[groupe 1\], Crousti \(invité\) \[groupe 1\], Monsta \(invité\) \[groupe 1\]\./);
  r = await run(['--name', 'monsta']);
  assert.equal(r.ok, false); assert.match(r.out, /--to/);
  r = await run(['--name', 'crousti', '--to', 'crousti']);
  assert.equal(r.ok, false); assert.match(r.out, /même joueur/);
});
