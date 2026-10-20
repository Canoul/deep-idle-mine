/* Adresse du joueur derrière un hébergeur (proxy) : X-Forwarded-For lu depuis la droite, jamais falsifiable. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { clientIp, normalizeIp } from '../server/http/http.js';
import { proxyHops, SERVER, ROOT } from '../server/config.js';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { FAST_SCRYPT } from './helpers.js';

const req = (xff, remote = '10.0.0.9') => ({ headers: xff === undefined ? {} : { 'x-forwarded-for': xff }, socket: { remoteAddress: remote } });

test('sans relais de confiance : adresse de la connexion, en-tête ignoré', () => {
  assert.equal(clientIp(req('6.6.6.6'), 0), '10.0.0.9');
  assert.equal(clientIp(req(undefined, '::ffff:192.168.1.4'), 0), '192.168.1.4');
});

test('un relais : la dernière adresse de l\'en-tête (celle ajoutée par le relais)', () => {
  assert.equal(clientIp(req('81.2.3.4'), 1), '81.2.3.4');
  assert.equal(clientIp(req('6.6.6.6, 81.2.3.4'), 1), '81.2.3.4', 'le début, écrit par le joueur, est ignoré');
  assert.equal(clientIp(req(' 6.6.6.6 ,  , 81.2.3.4 '), 1), '81.2.3.4');
  assert.equal(clientIp(req('6.6.6.6, 81.2.3.4'), true), '81.2.3.4', 'ancien réglage true = 1 relais');
});

test('deux relais : l\'avant-dernière ; en-tête trop court : la première ; absent : la connexion', () => {
  assert.equal(clientIp(req('6.6.6.6, 81.2.3.4, 172.16.0.1'), 2), '81.2.3.4');
  assert.equal(clientIp(req('81.2.3.4'), 2), '81.2.3.4');
  assert.equal(clientIp(req(undefined), 1), '10.0.0.9');
  assert.equal(clientIp(req(''), 1), '10.0.0.9');
});

test('IPv4 vue en IPv6 ramenée à la même clé', () => {
  assert.equal(normalizeIp('::ffff:81.2.3.4'), '81.2.3.4');
  assert.equal(normalizeIp('2001:db8::1'), '2001:db8::1');
});

test('réglage des relais : Render = 1 par défaut, forçable, valeurs folles refusées', () => {
  assert.equal(proxyHops({}), 0);
  assert.equal(proxyHops({ RENDER: 'true' }), 1);
  assert.equal(proxyHops({ RENDER: 'true', DIM_TRUST_PROXY: '0' }), 0);
  assert.equal(proxyHops({ DIM_TRUST_PROXY: '2' }), 2);
  assert.equal(proxyHops({ DIM_TRUST_PROXY: '1' }), 1, 'ancien réglage =1 garde son sens');
  assert.equal(proxyHops({ DIM_TRUST_PROXY: '99' }), 10);
  assert.equal(proxyHops({ DIM_TRUST_PROXY: 'oui' }), 0);
  assert.equal(proxyHops({ DIM_TRUST_PROXY: '-1' }), 0);
});

test('anti-triche : changer le début de X-Forwarded-For ne contourne pas la limite de créations par adresse', async () => {
  const store = createMemoryStore();
  const service = createAccountService({ store, scrypt: FAST_SCRYPT });
  const config = { ...SERVER, trustProxy: 1, logProxyCheck: false };
  const server = http.createServer(createApp({ store, service, root: ROOT, config }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const guest = fake => fetch(base + '/api/account/guest', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `${fake}, 81.2.3.4` }, body: '{}' });
    for(let i = 0; i < 10; i++) assert.equal((await guest(`6.6.6.${i}`)).status, 201);
    assert.equal((await guest('7.7.7.7')).status, 429, 'même vraie adresse : limite atteinte');
    const other = await fetch(base + '/api/account/guest', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '81.2.3.5' }, body: '{}' });
    assert.equal(other.status, 201, 'un autre joueur n\'est pas bloqué');
  } finally { server.close(); }
});
