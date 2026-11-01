/* Appli mobile : elle tourne sur une autre origine que le site (fichiers dans l'appli). Le cookie SameSite=Strict n'y passe pas :
   jeton dans l'en-tête Authorization, CORS limité aux origines de l'appli. Le site, lui, ne doit voir aucune différence. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { ROOT, SERVER, LIMITS } from '../server/config.js';
import { FAST_SCRYPT, fakeLive } from './helpers.js';

const APP = 'https://localhost', IOS = 'capacitor://localhost', EVIL = 'https://mechant.example', PASS = 'motdepasse-solide', KEY = 'k'.repeat(40);
let base, server, n = 0;
before(async () => {
  const store = createMemoryStore();
  const service = createAccountService({ store, scrypt: FAST_SCRYPT, limits: { ...LIMITS, createPerIp: { max: 999, window: 1e3 } } });
  const game = createGameService({ store: createMemoryGameStore(), liveRunner: fakeLive(() => ({ shares: [] })), dev: false });
  server = http.createServer(createApp({ store, service, game, root: ROOT, config: { ...SERVER, logProxyCheck: false, adminToken: KEY } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

/* fetch de Node ne peut pas poser Origin : http.request */
const raw = (method, path, { origin, body, headers = {} } = {}) => new Promise((ok, ko) => {
  const data = body === undefined ? null : JSON.stringify(body);
  const req = http.request(base + path, { method, headers: { ...(origin ? { origin } : {}), ...(data ? { 'content-type': 'application/json' } : {}), ...headers } }, res => {
    let t = ''; res.on('data', d => t += d);
    res.on('end', () => ok({ status: res.statusCode, headers: res.headers, data: t ? JSON.parse(t) : null }));
  });
  req.on('error', ko); if(data) req.write(data); req.end();
});
const newName = () => 'Joueur' + (++n);
const appRegister = async (origin = APP) => { const name = newName(); return { name, ...(await raw('POST', '/api/account/register', { origin, body: { name, password: PASS, acceptRules: true } })) }; };

test('site (même origine) : cookie comme avant, aucun jeton dans la réponse, aucun en-tête CORS', async () => {
  const r = await raw('POST', '/api/account/register', { body: { name: newName(), password: PASS, acceptRules: true } });
  assert.equal(r.status, 201);
  assert.match(r.headers['set-cookie'][0], /HttpOnly; SameSite=Strict/);
  assert.equal(r.data.token, undefined);
  assert.equal(r.headers['access-control-allow-origin'], undefined);
  const me = await raw('GET', '/api/account/me', { headers: { cookie: r.headers['set-cookie'][0].split(';')[0] } });
  assert.ok(me.data.account);
});

test('appli : jeton dans la réponse, pas de cookie ; le jeton connecte ; déconnexion : il est mort', async () => {
  for(const origin of [APP, IOS]){
    const r = await appRegister(origin);
    assert.equal(r.status, 201); assert.ok(r.data.token?.length > 20); assert.equal(r.headers['set-cookie'], undefined);
    assert.equal(r.headers['access-control-allow-origin'], origin);
    const auth = { authorization: `Bearer ${r.data.token}` };
    assert.equal((await raw('GET', '/api/account/me', { origin, headers: auth })).data.account.name, r.name);
    assert.equal((await raw('POST', '/api/account/logout', { origin, headers: auth, body: {} })).status, 204);
    assert.equal((await raw('GET', '/api/account/me', { origin, headers: auth })).data.account, null);
  }
});

test('appli : connexion, invité, changement de mot de passe renvoient un jeton', async () => {
  const r = await appRegister();
  const login = await raw('POST', '/api/account/login', { origin: APP, body: { name: r.name, password: PASS } });
  assert.ok(login.data.token);
  const pw = await raw('POST', '/api/account/password', { origin: APP, headers: { authorization: `Bearer ${login.data.token}` }, body: { oldPassword: PASS, newPassword: 'nouveau-mot-solide' } });
  assert.ok(pw.data.token && pw.data.token !== login.data.token);
  assert.equal((await raw('GET', '/api/account/me', { origin: APP, headers: { authorization: `Bearer ${pw.data.token}` } })).data.account.name, r.name);
  assert.ok((await raw('POST', '/api/account/guest', { origin: APP, body: { acceptRules: true } })).data.token);
});

test('préflight : autorisé pour l\'appli seulement, sans autoriser les cookies', async () => {
  const ok = await raw('OPTIONS', '/api/social/chat', { origin: APP, headers: { 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' } });
  assert.equal(ok.status, 204);
  assert.equal(ok.headers['access-control-allow-origin'], APP);
  assert.match(ok.headers['access-control-allow-headers'], /authorization/i);
  assert.equal(ok.headers['access-control-allow-credentials'], undefined);
  assert.match(ok.headers.vary, /Origin/);
  const no = await raw('OPTIONS', '/api/social/chat', { origin: EVIL });
  assert.equal(no.headers['access-control-allow-origin'], undefined);
});

test('autre site : ni CORS ni jeton dans la réponse, même avec de bons identifiants', async () => {
  const r = await appRegister();
  const evil = await raw('POST', '/api/account/login', { origin: EVIL, body: { name: r.name, password: PASS } });
  assert.equal(evil.data.token, undefined); assert.equal(evil.headers['access-control-allow-origin'], undefined);
});

test('administration : jamais de CORS, et le jeton d\'un joueur n\'y ouvre rien ; la clé admin n\'est pas un jeton de joueur', async () => {
  const r = await appRegister();
  const pre = await raw('OPTIONS', '/api/admin/give', { origin: APP });
  assert.equal(pre.headers['access-control-allow-origin'], undefined);
  assert.equal((await raw('POST', '/api/admin/give', { origin: APP, headers: { authorization: `Bearer ${r.data.token}` }, body: {} })).status, 404);
  assert.equal((await raw('GET', '/api/account/me', { headers: { authorization: `Bearer ${KEY}` } })).data.account, null);
});

test('jeton invalide : pas connecté, pas d\'erreur, le cookie du site n\'est pas effacé', async () => {
  const site = await raw('POST', '/api/account/register', { body: { name: newName(), password: PASS, acceptRules: true } });
  const cookie = site.headers['set-cookie'][0].split(';')[0];
  const r = await raw('GET', '/api/account/me', { headers: { authorization: 'Bearer faux', cookie } });
  assert.ok(r.data.account, 'mauvais en-tête : on retombe sur le cookie'); assert.equal(r.headers['set-cookie'], undefined);
});

test('erreur vue par l\'appli : l\'en-tête CORS est là, sinon le navigateur cacherait le message', async () => {
  const r = await raw('POST', '/api/account/login', { origin: APP, body: { name: 'Personne', password: 'x' } });
  assert.equal(r.status, 401); assert.equal(r.headers['access-control-allow-origin'], APP);
  assert.match(r.headers['access-control-expose-headers'], /Retry-After/i);
});
