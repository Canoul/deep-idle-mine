/* Comptes : de bout en bout par HTTP (vrai serveur sur un port libre, stockage en mémoire),
   fichiers servis (liste blanche) et stockage sur disque. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { createMemoryStore, createFileStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { resolvePublic } from '../server/http/static.js';
import { SERVER, ROOT } from '../server/config.js';
import { FAST_SCRYPT } from './helpers.js';

let server, base;
before(async () => {
  const store = createMemoryStore();
  const service = createAccountService({ store, scrypt: FAST_SCRYPT });
  server = http.createServer(createApp({ store, service, root: ROOT }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

/* un « navigateur » minimal qui garde son cookie */
function browser(){
  let cookie = '';
  return async function call(method, p, body, headers = {}){
    const res = await fetch(base + p, {
      method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie();
    for(const c of set){ const v = c.split(';')[0]; cookie = v.endsWith('=') ? '' : v; }
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null, setCookie: set };
  };
}

test('parcours complet : inscription, qui suis-je, déconnexion, connexion', async () => {
  const b = browser();
  assert.deepEqual((await b('GET', '/api/account/me')).data, { account: null }, 'personne : pas une erreur');
  const reg = await b('POST', '/api/account/register', { name: 'Zoé', password: 'motdepasse' });
  assert.equal(reg.status, 201);
  assert.match(reg.data.recoveryCode, /^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
  const cookie = reg.setCookie[0];
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /Max-Age=2592000/);
  const me = await b('GET', '/api/account/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.account.id, reg.data.account.id);
  assert.equal((await b('POST', '/api/account/logout', {})).status, 204);
  assert.equal((await b('GET', '/api/account/me')).data.account, null);
  const login = await b('POST', '/api/account/login', { name: 'zoe', password: 'motdepasse' });
  assert.equal(login.status, 200);
  assert.equal(login.data.account.id, reg.data.account.id);
});

test('erreurs lisibles en JSON', async () => {
  const b = browser();
  const r = await b('POST', '/api/account/login', { name: 'Personne', password: 'mauvais!!' });
  assert.equal(r.status, 401);
  assert.deepEqual(Object.keys(r.data.error), ['code', 'message']);
  assert.equal((await b('POST', '/api/account/register', { name: 'x', password: 'motdepasse' })).data.error.code, 'invalid_name');
  assert.equal((await b('GET', '/api/nimportequoi')).status, 404);
  assert.equal((await b('GET', '/api/account/login')).status, 405);
});

test('invité puis sécurisation, sans perdre l\'ID', async () => {
  const b = browser();
  const g = await b('POST', '/api/account/guest', {});
  assert.equal(g.status, 201);
  assert.match(g.setCookie[0], /Max-Age=31536000/, 'un an pour un invité');
  const c = await b('POST', '/api/account/claim', { name: 'InviteSecu', password: 'motdepasse' });
  assert.equal(c.status, 200);
  assert.equal(c.data.account.id, g.data.account.id);
  assert.equal((await b('GET', '/api/account/me')).data.account.name, 'InviteSecu');
});

test('sécuriser ou changer de mot de passe demande d\'être connecté', async () => {
  const b = browser();
  assert.equal((await b('POST', '/api/account/claim', { name: 'Qui', password: 'motdepasse' })).status, 401);
  assert.equal((await b('POST', '/api/account/password', { oldPassword: 'a', newPassword: 'b' })).status, 401);
});

test('protection CSRF : les écritures exigent du JSON', async () => {
  const res = await fetch(base + '/api/account/guest', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'a=1' });
  assert.equal(res.status, 415);
  const bad = await fetch(base + '/api/account/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{pas du json' });
  assert.equal(bad.status, 400);
});

test('un cookie périmé est effacé', async () => {
  const r = await fetch(base + '/api/account/me', { headers: { cookie: `${SERVER.cookie.name}=faux` } });
  assert.equal((await r.json()).account, null);
  assert.match(r.headers.getSetCookie()[0], /Max-Age=0/);
});

test('fichiers : le jeu est servi, jamais les comptes ni le code serveur', async () => {
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/src/main.js')).status, 200);
  assert.equal((await fetch(base + '/textures/coal.png')).headers.get('content-type'), 'image/png');
  for(const p of ['/data/accounts.json', '/server/config.js', '/package.json', '/.git/config', '/src/../data/accounts.json'])
    assert.equal((await fetch(base + p)).status, 404, p);
});

test('liste blanche : remontées de dossier refusées', () => {
  const pub = SERVER.publicPaths;
  assert.equal(resolvePublic(ROOT, pub, '/'), path.join(ROOT, 'index.html'));
  assert.equal(resolvePublic(ROOT, pub, '/src/%2e%2e/data/accounts.json'), null);
  assert.equal(resolvePublic(ROOT, pub, '/src/..%2f..%2fetc/passwd'), null);
  assert.equal(resolvePublic(ROOT, pub, '/%E0%A4%A'), null, 'adresse mal encodée');
  assert.equal(resolvePublic(ROOT, pub, '/srcx/a.js'), null);
});

test('stockage fichier : les comptes survivent au redémarrage', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dim-'));
  try {
    const s1 = await createFileStore(dir);
    const svc1 = createAccountService({ store: s1, scrypt: FAST_SCRYPT });
    const r = await svc1.register({ name: 'Zoé', password: 'motdepasse' });
    await s1.close();

    const s2 = await createFileStore(dir);                 // « redémarrage »
    const svc2 = createAccountService({ store: s2, scrypt: FAST_SCRYPT });
    assert.equal((await svc2.authenticate(r.token)).account.name, 'Zoé', 'toujours connecté');
    assert.equal((await svc2.login({ name: 'zoe', password: 'motdepasse' })).account.id, r.account.id);
    await assert.rejects(svc2.register({ name: 'ZOE', password: 'motdepasse' }), /pris/, 'unicité rechargée');
    await s2.close();
    const files = await fs.readdir(dir);
    assert.deepEqual(files, ['accounts.json'], 'pas de fichier temporaire qui traîne');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('stockage fichier : deux inscriptions simultanées au même pseudo, une seule passe', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dim-'));
  try {
    const s = await createFileStore(dir);
    const svc = createAccountService({ store: s, scrypt: FAST_SCRYPT });
    const res = await Promise.allSettled([1, 2, 3].map(() => svc.register({ name: 'Zoé', password: 'motdepasse' })));
    assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(await s.countAccounts(), 1);
    await s.close();
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
