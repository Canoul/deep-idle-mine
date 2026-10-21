/* Sécurité du serveur : en-têtes sur toutes les réponses (pages, fichiers, API, erreurs), HSTS seulement en https,
   fichiers non publics (ancien prototype), limiteur de tentatives à mémoire bornée. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/accounts/store.js';
import { createAccountService } from '../server/accounts/service.js';
import { createLimiter } from '../server/accounts/ratelimit.js';
import { SERVER, ROOT } from '../server/config.js';
import { FAST_SCRYPT } from './helpers.js';

async function start(config){
  const store = createMemoryStore();
  const service = createAccountService({ store, scrypt: FAST_SCRYPT });
  const server = http.createServer(createApp({ store, service, root: ROOT, config }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

let plain, https;
before(async () => {
  plain = await start(SERVER);
  https = await start({ ...SERVER, cookie: { ...SERVER.cookie, secure: true } });
});
after(() => { plain.server.close(); https.server.close(); });

test('en-têtes de sécurité : sur la page, un fichier, l\'API et une erreur', async () => {
  for(const p of ['/', '/src/main.js', '/api/account/me', '/api/nimportequoi', '/data/accounts.json']){
    const h = (await fetch(plain.base + p)).headers;
    const csp = h.get('content-security-policy') ?? '';
    assert.match(csp, /script-src 'self'(;|$)/, `${p} : seuls les scripts du jeu`);
    assert.match(csp, /frame-ancestors 'none'/, `${p} : pas d'affichage dans un cadre d'un autre site`);
    assert.doesNotMatch(csp, /script-src[^;]*unsafe/, `${p} : aucun script en ligne autorisé`);
    assert.equal(h.get('x-content-type-options'), 'nosniff', p);
    assert.equal(h.get('x-frame-options'), 'DENY', p);
    assert.equal(h.get('referrer-policy'), 'same-origin', p);
  }
});

test('HSTS : seulement quand le jeu est servi en https (cookie « Secure »)', async () => {
  assert.equal((await fetch(plain.base + '/')).headers.get('strict-transport-security'), null);
  assert.match((await fetch(https.base + '/')).headers.get('strict-transport-security') ?? '', /max-age=\d{7,}/);
});

test('l\'ancien prototype et le reste du dépôt ne sont pas servis', async () => {
  for(const p of ['/prototype/deep-idle-mine.html', '/scripts/give-admin.js', '/deploy/ovh/install.sh', '/.gitignore', '/CLAUDE.md'])
    assert.equal((await fetch(plain.base + p)).status, 404, p);
});

test('limiteur de tentatives : les adresses sans coup récent sont oubliées (mémoire bornée)', () => {
  let now = 0;
  const lim = createLimiter({ max: 3, window: 1000 }, () => now);
  for(let i = 0; i < 6000; i++) lim.hit('ip' + i);
  now = 5000;                                   // toutes les fenêtres sont passées
  for(let i = 0; i < 6000; i++) lim.hit('new' + i);
  assert.ok(lim.size() <= 6000, `${lim.size()} clés gardées`);
  assert.equal(lim.check('new1').ok, true);
  lim.hit('x'); lim.hit('x'); lim.hit('x');
  assert.equal(lim.check('x').ok, false, 'la limite elle-même marche toujours');
});
