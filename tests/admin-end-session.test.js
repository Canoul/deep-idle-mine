/* Administration : forcer la fin de session d'un joueur (/api/admin/end-session, scripts/end-session.js, 29/10/2026).
   Comme son bouton « Quitter » : rien pour lui, les autres continuent ; dernier joueur : partie arrêtée, rien pour
   personne. Vrai serveur HTTP, stockages en mémoire. */
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
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const TOKEN = 'k'.repeat(40);
const ACC = [['C1', 'Crousti'], ['G1', 'canoul'], ['L1', 'Linoleom']].map(([id, name]) => ({ id, name, nameKey: name.toLowerCase(), guest: false }));
const [crousti, canoul, lino] = ACC;
let base, server, game, party, gs;
before(async () => {
  const store = createMemoryStore();
  for(const a of ACC) await store.insertAccount(a);
  gs = createMemoryGameStore();
  game = createGameService({ store: gs, dev: false,
    liveRunner: fakeLive(rec => ({ id: rec.id, shares: rec.players.map(p => ({ account: p.account, left: false, bag: { Charbon: 5 } })) })) });
  party = createPartyService({ game, getAccount: async id => ACC.find(a => a.id === id) ?? null });
  server = http.createServer(createApp({ store, service: createAccountService({ store, scrypt: FAST_SCRYPT }), game, party, root: ROOT,
    config: { ...SERVER, logProxyCheck: false, adminToken: TOKEN } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const end = (name, headers = {}) => fetch(base + '/api/admin/end-session', { method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, ...headers }, body: JSON.stringify({ name }) })
  .then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));

test('en groupe : crousti est sorti de la session, canoul continue ; crousti est libre tout de suite', async () => {
  await party.create(canoul); await party.join(crousti, (await party.state(canoul)).party.code);
  await party.ready(crousti, true);
  const { session } = await party.launch(canoul, {});
  assert.ok(await game.activeSessionId(crousti.id));
  const r = await end('CROUSTI');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual({ ...r.data, session: undefined }, { account: 'Crousti', left: true, session: undefined, mode: 'mine', ended: false });
  assert.equal(r.data.session, session.id);
  assert.equal(await game.activeSessionId(crousti.id), null, 'plus de session : il peut relancer, rejoindre un lobby');
  assert.ok(await game.activeSessionId(canoul.id), 'canoul continue');
  const rec = await gs.getGameSession(session.id);
  assert.equal(rec.status, 'running');
  assert.ok(rec.leaves.some(l => l.account === crousti.id), 'compté comme parti : rien à la fin');
  assert.equal((await end('crousti')).data.error.code, 'no_session', 'deux fois : rien de plus');
});

test('dernier joueur : la partie s\'arrête, personne ne reçoit rien', async () => {
  const r = await end('canoul');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.ended, true);
  const rec = await gs.getGameSession(r.data.session);
  assert.equal(rec.status, 'done');
  assert.equal(rec.result.abandoned, true);
  assert.ok(rec.result.shares.every(s => s.left && !Object.keys(s.bag).length));
  assert.equal(await game.activeSessionId(canoul.id), null);
});

test('refus : pseudo inconnu, joueur sans session ; fermée sans la clé ou derrière un relais', async () => {
  assert.equal((await end('personne')).data.error.code, 'no_account');
  assert.equal((await end('Linoleom')).data.error.code, 'no_session');
  await game.start(lino, {});
  for(const h of [{ authorization: 'Bearer ' + 'x'.repeat(40) }, { 'x-forwarded-for': '1.2.3.4' }])
    assert.equal((await end('Linoleom', h)).status, 404);
  assert.ok(await game.activeSessionId(lino.id), 'toujours en session');
});

test('script : end-session.js sort Linoleom de sa session (clé lue dans le fichier de réglages)', async () => {
  const envFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'end-')), 'dim.env');
  fs.writeFileSync(envFile, `DIM_ADMIN_TOKEN=${TOKEN}\n`);
  const run = args => new Promise(res => {
    const env = { ...process.env }; delete env.DIM_ADMIN_TOKEN;
    execFile(process.execPath, ['scripts/end-session.js', '--url', base, '--env', envFile, ...args], { env, encoding: 'utf8' },
      (err, out, errOut) => res({ ok: !err, out: out + errOut }));
  });
  let r = await run(['--name', 'linoleom']);
  assert.ok(r.ok, r.out);
  assert.match(r.out, /« Linoleom » est sorti de sa session \(mine\), sans butin\. Il était le dernier : la partie est arrêtée\./);
  assert.equal(await game.activeSessionId(lino.id), null);
  r = await run(['--name', 'linoleom']);
  assert.equal(r.ok, false); assert.match(r.out, /Aucune session en cours/);
  r = await run([]);
  assert.equal(r.ok, false); assert.match(r.out, /--name/);
});

/* lancement forcé d'un lobby (/api/admin/party-launch, scripts/launch-lobby.js) */
const launch = name => fetch(base + '/api/admin/party-launch', { method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ name }) })
  .then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));

test('launch : un membre (pas le chef) suffit ; le lobby part dans la mine même si personne n\'est prêt', async () => {
  for(const a of ACC) await party.leave(a);
  await party.create(canoul); await party.join(crousti, (await party.state(canoul)).party.code);
  await assert.rejects(party.launch(canoul, {}), /Pas encore prêt/);
  const r = await launch('crousti');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual({ leader: r.data.leader, members: r.data.members }, { leader: 'canoul', members: ['canoul', 'Crousti'] });
  const rec = await gs.getGameSession(r.data.session);
  assert.equal(rec.mode ?? 'mine', 'mine');
  assert.deepEqual(rec.players.map(p => p.account), [canoul.id, crousti.id]);
  assert.equal((await launch('canoul')).status, 409, 'déjà en session : refusé');
  await end('crousti'); await end('canoul');
});

test('launch : seul (sans groupe) → sa session solo ; pseudo inconnu refusé', async () => {
  await party.leave(lino);
  const r = await launch('Linoleom');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.members, ['Linoleom']);
  assert.ok(await game.activeSessionId(lino.id));
  assert.equal((await launch('personne')).data.error.code, 'no_account');
  await end('Linoleom');
});
