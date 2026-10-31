/* Administration des lobbies (/api/admin/party-move, /api/admin/party-ready, 29/10/2026) : mettre un joueur dans le
   lobby d'un autre, le mettre prêt ou « prêt tout le temps ». Vrai serveur HTTP, stockages en mémoire. */
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
import { GAME } from '../src/config.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const TOKEN = 'k'.repeat(40);
const ACC = [['C1', 'Crousti'], ['G1', 'canoul'], ['I1', 'Infernatiwar'], ['M1', 'Monsta'], ['L1', 'LeTaz'], ['A1', 'Akake']]
  .map(([id, name]) => ({ id, name, nameKey: name.toLowerCase(), guest: false }));
const [crousti, canoul, inferna, monsta, letaz] = ACC;   // Akake : celui qui ne trouve plus de place
let base, server, party;
before(async () => {
  const store = createMemoryStore();
  for(const a of ACC) await store.insertAccount(a);
  const service = createAccountService({ store, scrypt: FAST_SCRYPT });
  const game = createGameService({ store: createMemoryGameStore(), dev: false,
    liveRunner: fakeLive(rec => ({ id: rec.id, shares: rec.players.map(p => ({ account: p.account, left: false, bag: {} })) })) });
  party = createPartyService({ game, getAccount: async id => ACC.find(a => a.id === id) ?? null });
  server = http.createServer(createApp({ store, service, game, party, root: ROOT, config: { ...SERVER, logProxyCheck: false, adminToken: TOKEN } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = (route, body, headers = {}) => fetch(base + '/api/admin/' + route, { method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, ...headers }, body: JSON.stringify(body) })
  .then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));
const move = (name, to) => post('party-move', { name, to });
const setReady = (name, ready, always) => post('party-ready', { name, ready, always });
const lobby = async me => (await party.state(me)).party;
const member = async (me, who) => (await lobby(me)).members.find(m => m.account === who.id);

test('move : crousti entre dans le lobby de canoul (sans groupe : canoul en devient le chef), il quitte son ancien groupe', async () => {
  await party.create(crousti); await party.join(inferna, (await lobby(crousti)).code);
  const r = await move('CROUSTI', 'Canoul');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.moved, true);
  assert.equal(r.data.party.leader, 'canoul');
  assert.deepEqual(r.data.party.members.map(m => m.name), ['canoul', 'Crousti']);
  assert.equal((await lobby(crousti)).code, (await lobby(canoul)).code);
  assert.deepEqual((await lobby(inferna)).members.map(m => m.name), ['Infernatiwar'], 'ancien groupe : il n\'y est plus');
  assert.equal((await move('crousti', 'canoul')).data.moved, false, 'déjà dedans : rien ne bouge');
});

test('move : un nouveau venu remet les autres « pas prêt » (sauf « prêt tout le temps »), comme une arrivée normale', async () => {
  await setReady('crousti', true);
  assert.equal((await member(canoul, crousti)).ready, true);
  await move('Monsta', 'canoul');
  assert.equal((await member(canoul, crousti)).ready, false);
  await party.leave(monsta);
});

test("ready : prêt → le chef lance ; « prêt tout le temps » se coche pendant la session et le met prêt ; « pas prêt » l'enlève, la case reste", async () => {
  await assert.rejects(party.launch(canoul, {}), /Pas encore prêt/);
  assert.equal((await setReady('crousti', true)).status, 200);
  const r = await party.launch(canoul, {});
  assert.ok(r.session, 'session lancée');
  assert.equal((await member(canoul, crousti)).ready, false, 'session lancée : il redira qu\'il est prêt');

  const a = await setReady('crousti', undefined, true);            // pendant la session : vaut pour la suivante
  assert.equal(a.status, 200, JSON.stringify(a.data));
  assert.equal((await member(canoul, crousti)).always, true);
  assert.equal((await member(canoul, crousti)).ready, true);
  const off = (await setReady('crousti', false)).data.party.members.find(m => m.name === 'Crousti');
  assert.deepEqual([off.ready, off.always], [false, true], 'comme son bouton');
});

test('move : refusé si l\'un des deux est en session ; lobby complet ; même joueur ; pseudo inconnu', async () => {
  assert.equal((await move('LeTaz', 'canoul')).data.error.code, 'friend_in_session');
  assert.equal((await move('crousti', 'LeTaz')).data.error.code, 'session_running');
  assert.equal((await move('LeTaz', 'letaz')).data.error.code, 'invalid_id');
  const r = await move('personne', 'canoul');
  assert.equal(r.status, 404); assert.equal(r.data.error.code, 'no_account');
  assert.equal((await move('LeTaz', undefined)).status, 400);
  /* lobby complet : Infernatiwar + Monsta + LeTaz = GAME.maxPlayers (3) */
  assert.equal(GAME.maxPlayers, 3);
  assert.equal((await move('Monsta', 'Infernatiwar')).status, 200);
  assert.equal((await move('LeTaz', 'Infernatiwar')).status, 200);
  const full = await move('Akake', 'Infernatiwar');
  assert.equal(full.status, 409); assert.equal(full.data.error.code, 'party_full');
  assert.equal((await lobby(inferna)).members.length, 3);
});

test('ready : « tout le temps » décoché → redevient « pas prêt » ; valeurs invalides et joueur sans groupe refusés', async () => {
  const lone = await post('party-ready', { name: 'Monsta', always: 'yes' });
  assert.equal(lone.status, 400);
  assert.equal((await post('party-ready', { name: 'Monsta' })).status, 400, 'rien à changer');
  await party.leave(monsta);
  const none = await setReady('Monsta', true);
  assert.equal(none.status, 404); assert.equal(none.data.error.code, 'no_party');
  await party.join(monsta, (await lobby(inferna)).code).catch(() => {});
  await setReady('Monsta', undefined, true);
  assert.equal((await member(inferna, monsta))?.always, true);
  await setReady('Monsta', undefined, false);
  assert.equal((await member(inferna, monsta)).always, false);
  assert.equal((await member(inferna, monsta)).ready, false);
});

test('fermées sans la clé ou derrière un relais : « route inconnue », rien ne bouge', async () => {
  const before = (await lobby(inferna)).members.map(m => m.name);
  for(const h of [{ authorization: 'Bearer ' + 'x'.repeat(40) }, { 'x-forwarded-for': '1.2.3.4' }]){
    assert.equal((await post('party-move', { name: 'Monsta', to: 'canoul' }, h)).status, 404);
    assert.equal((await post('party-ready', { name: 'Infernatiwar', ready: true }, h)).status, 404);
  }
  assert.deepEqual((await lobby(inferna)).members.map(m => m.name), before);
});

/* les scripts du VPS (clé lue dans le fichier de réglages, comme give-item.js) */
test('scripts : move-to-lobby.js puis set-ready.js --always on, et leurs erreurs', async () => {
  const envFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lobby-')), 'dim.env');
  fs.writeFileSync(envFile, `DIM_ADMIN_TOKEN=${TOKEN}
`);
  const run = (script, args) => new Promise(res => {
    const env = { ...process.env }; delete env.DIM_ADMIN_TOKEN;
    execFile(process.execPath, [script, '--url', base, '--env', envFile, ...args], { env, encoding: 'utf8' },
      (err, out, errOut) => res({ ok: !err, out: out + errOut }));
  });
  await party.leave(monsta);
  let r = await run('scripts/move-to-lobby.js', ['--name', 'monsta', '--to', 'akake']);
  assert.ok(r.ok, r.out);
  assert.match(r.out, /« Monsta » est maintenant dans le lobby de « Akake » : Akake \(chef\), Monsta\./);
  r = await run('scripts/set-ready.js', ['--name', 'monsta', '--always', 'on']);
  assert.ok(r.ok, r.out);
  assert.match(r.out, /« Monsta » : prêt tout le temps, lobby de « Akake »/);
  assert.equal((await member(ACC[5], monsta)).always, true);
  r = await run('scripts/set-ready.js', ['--name', 'monsta', '--always', 'oui']);
  assert.equal(r.ok, false); assert.match(r.out, /--always : on ou off/);
  r = await run('scripts/move-to-lobby.js', ['--name', 'monsta']);
  assert.equal(r.ok, false); assert.match(r.out, /--to/);
  r = await run('scripts/move-to-lobby.js', ['--name', 'personne', '--to', 'akake']);
  assert.equal(r.ok, false); assert.match(r.out, /Aucun compte « personne »/);
});

/* chef du lobby (/api/admin/party-lead) */
test('lead : un membre devient chef, l\'ancien chef reste membre ; déjà chef ou sans groupe', async () => {
  for(const a of ACC) await party.leave(a);
  await move('Monsta', 'Akake');
  const r = await post('party-lead', { name: 'monsta' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.changed, true);
  assert.equal(r.data.party.leader, 'Monsta');
  assert.deepEqual(r.data.party.members.map(m => [m.name, m.leader]), [['Akake', false], ['Monsta', true]]);
  assert.equal((await post('party-lead', { name: 'Monsta' })).data.changed, false);
  assert.equal((await post('party-lead', { name: 'Infernatiwar' })).data.error.code, 'no_party');
  assert.equal((await post('party-lead', { name: 'Monsta' }, { 'x-forwarded-for': '1.2.3.4' })).status, 404);
});
