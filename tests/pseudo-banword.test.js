/* Pseudos interdits (31/10/2026) : refusés à la création ; un compte existant doit changer le sien, et ne peut rien faire d'autre. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService, publicAccount } from '../server/accounts/service.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { createPartyService } from '../server/party/service.js';
import { nameBanned } from '../server/moderation/filter.js';
import { ROOT, SERVER } from '../server/config.js';
import { checkForm } from '../src/ui/account.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

let base, server, store, service, party;
before(async () => {
  store = createMemoryStore();
  service = createAccountService({ store, scrypt: FAST_SCRYPT });
  const game = createGameService({ store: createMemoryGameStore(), dev: false, liveRunner: fakeLive(rec => ({ id: rec.id, shares: [] })) });
  party = createPartyService({ game, getAccount: async id => store.getAccount(id) });
  server = http.createServer(createApp({ store, service, game, party, root: ROOT, config: { ...SERVER, logProxyCheck: false } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const call = (route, body, cookie) => fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body ?? {}) })
  .then(async r => ({ status: r.status, data: await r.json().catch(() => null), cookie: r.headers.get('set-cookie')?.split(';')[0] }));
const PASS = 'motdepasse-solide';
/* compte à l'ancien pseudo interdit : il existait avant la règle */
async function oldAccount(name){
  const r = await service.register({ name: 'Provisoire' + name.length, password: PASS, ip: '9.9.9.' + name.length });
  const acc = await store.getAccount(r.account.id);
  Object.assign(acc, { name, nameKey: name.toLowerCase() });
  await store.updateAccount(acc);
  return { acc, cookie: `${SERVER.cookie.name}=${r.token}` };
}

test('filtre : la liste du chat, déguisée ou collée à un mot ; les pseudos innocents passent', () => {
  for(const n of ['Connard', 'c0nnard', 'SaleConnard', 'sale_connard', 'NIGGA', 'niiigger', 'Pute', 'Pédé']) assert.equal(nameBanned(n), true, n);
  for(const n of ['Conan', 'Falcon', 'Computer', 'Croustiflex', 'Infernatiwar', 'Monsta', 'canoul', 'Basile', 'Pierre', 'Test_Mineur', 'Sõnata', '', null])
    assert.equal(nameBanned(n), false, String(n));
});

test('création : pseudo interdit refusé avec un message, sécurisation d\'un invité aussi ; rien n\'est créé', async () => {
  const r = await call('/api/account/register', { name: 'Connard', password: PASS });
  assert.equal(r.status, 400); assert.equal(r.data.error.code, 'invalid_name');
  assert.match(r.data.error.message, /pas autorisé/);
  assert.equal(await store.findAccountByName('connard'), null);
  const g = await call('/api/account/guest');
  const c = await call('/api/account/claim', { name: 'c0nnard', password: PASS }, g.cookie);
  assert.equal(c.status, 400);
  assert.equal((await call('/api/account/register', { name: 'Basile', password: PASS })).status, 201);
});

test('compte existant : signalé, actions bloquées, lire reste permis, il choisit un pseudo valable et garde son ID', async () => {
  const { acc, cookie } = await oldAccount('Connard');
  assert.equal(publicAccount(acc).mustRename, true);
  const me = await fetch(base + '/api/account/me', { headers: { cookie } }).then(r => r.json());
  assert.equal(me.account.mustRename, true);
  const blocked = await call('/api/game/start', { mode: 'mine' }, cookie);
  assert.equal(blocked.status, 403); assert.equal(blocked.data.error.code, 'must_rename');
  assert.equal((await call('/api/party/create', {}, cookie)).status, 403);

  assert.equal((await call('/api/account/rename', { name: 'c0nnard' }, cookie)).status, 400, 'encore interdit');
  assert.equal((await call('/api/account/rename', { name: 'Basile' }, cookie)).data.error.code, 'name_taken');
  assert.equal((await call('/api/account/rename', { name: 'a' }, cookie)).status, 400);
  assert.equal((await call('/api/account/rename', {}, cookie)).status, 400);

  const ok = await call('/api/account/rename', { name: 'Gentil' }, cookie);
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.account.name, 'Gentil'); assert.equal(ok.data.account.id, acc.id);
  assert.equal(ok.data.account.mustRename, undefined);
  assert.equal((await store.findAccountByName('gentil')).id, acc.id);
  assert.equal(await store.findAccountByName('connard'), null, 'ancien pseudo libéré du nom');
  assert.equal((await call('/api/party/create', {}, cookie)).status, 200, 'il peut rejouer');
});

test('changement réservé aux pseudos interdits ; il faut être connecté ; le groupe affiche le nouveau pseudo', async () => {
  const r = await service.register({ name: 'Honnete', password: PASS, ip: '8.8.8.8' });
  const cookie = `${SERVER.cookie.name}=${r.token}`;
  const no = await call('/api/account/rename', { name: 'Autrenom' }, cookie);
  assert.equal(no.status, 409); assert.equal(no.data.error.code, 'rename_refused');
  assert.equal((await store.getAccount(r.account.id)).name, 'Honnete');
  assert.equal((await call('/api/account/rename', { name: 'Autrenom' })).status, 401);

  const a = await service.register({ name: 'Chefdegroupe', password: PASS, ip: '8.8.8.9' });
  const lead = { ...a.account, id: a.account.id };
  await party.create(lead);
  await party.rename(a.account.id, 'Nouveauchef');
  assert.equal((await party.state(lead)).party.members[0].name, 'Nouveauchef');
});

test('formulaire : mêmes règles de longueur et de caractères avant envoi', () => {
  assert.equal(checkForm('rename', { name: 'Gentil' }), null);
  assert.match(checkForm('rename', { name: 'a' }), /au moins/);
});
