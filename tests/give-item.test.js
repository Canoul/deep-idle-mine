/* scripts/give-item.js : appelle le serveur qui tourne (/api/admin/give), clé lue dans le fichier de réglages.
   Vrai serveur HTTP sur la machine, stockages en mémoire. */
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
import { ROOT, SERVER } from '../server/config.js';
import { deserialize, countOf } from '../src/meta/inventory.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const TOKEN = 'z'.repeat(48);
let server, url, gs, envFile;
before(async () => {
  const store = createMemoryStore();
  await store.insertAccount({ id: 'C1', name: 'Crousti', nameKey: 'crousti', guest: false });
  gs = createMemoryGameStore();
  const game = createGameService({ store: gs, liveRunner: fakeLive(() => ({ shares: [], chest: {} })), dev: false });
  server = http.createServer(createApp({ store, service: createAccountService({ store, scrypt: FAST_SCRYPT }), game, root: ROOT,
    config: { ...SERVER, logProxyCheck: false, adminToken: TOKEN } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${server.address().port}`;
  envFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'give-')), 'dim.env');
  fs.writeFileSync(envFile, `# réglages\nDATABASE_URL=postgres://x:y@h/db?sslmode=require&a=b\nDIM_ADMIN_TOKEN=${TOKEN}\n`);
});
after(() => server.close());

/* sans DIM_ADMIN_TOKEN dans l'environnement : la clé vient du fichier */
const run = args => new Promise(res => {
  const env = { ...process.env }; delete env.DIM_ADMIN_TOKEN;
  execFile(process.execPath, ['scripts/give-item.js', '--url', url, ...args], { env, encoding: 'utf8' },
    (err, out, errOut) => res({ ok: !err, out: out + errOut }));
});
const t3 = async () => { const raw = await gs.getInventory('C1'); return raw ? countOf(deserialize(JSON.stringify(raw)), 'Treasure T3') : 0; };

test('donne un Treasure T3 à crousti par le serveur qui tourne (clé lue dans le fichier de réglages)', async () => {
  const r = await run(['--env', envFile, '--name', 'crousti', '--item', 'Treasure T3']);
  assert.ok(r.ok, r.out);
  assert.match(r.out, /\+1 Treasure T3 pour « Crousti » \(0 → 1\)/);
  assert.equal(await t3(), 1);
});

test('refus clairs : mauvaise clé, objet inconnu, quantité invalide, compte inconnu ; rien donné', async () => {
  const before = await t3();
  const bad = path.join(path.dirname(envFile), 'bad.env');
  fs.writeFileSync(bad, `DIM_ADMIN_TOKEN=${'w'.repeat(48)}\n`);
  const wrong = await run(['--env', bad, '--name', 'crousti', '--item', 'Treasure T3']);
  assert.ok(!wrong.ok && /Administration fermée/.test(wrong.out), wrong.out);
  for(const args of [['--item', 'Treasure T9'], ['--item', 'Treasure T3', '--qty', '0'], ['--item', 'Treasure T3', '--qty', '2.5']]){
    const r = await run(['--env', envFile, '--name', 'crousti', ...args]);
    assert.equal(r.ok, false, args.join(' '));
  }
  const nobody = await run(['--env', envFile, '--name', 'personne', '--item', 'Treasure T3']);
  assert.ok(!nobody.ok && /Aucun compte/.test(nobody.out), nobody.out);
  const noKey = await run(['--env', path.join(path.dirname(envFile), 'absent.env'), '--name', 'crousti', '--item', 'Treasure T3']);
  assert.ok(!noKey.ok && /DIM_ADMIN_TOKEN/.test(noKey.out), noKey.out);
  assert.equal(await t3(), before);
});
