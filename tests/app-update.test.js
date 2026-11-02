/* Appli mobile, mises à jour à chaud (02/11/2026) : logique pure (src/app/update.js), empreinte (src/app/sha256.js), et
   l'assemblage (src/app/updater.js) sur un faux téléphone : fichiers, WebView de Capacitor et serveur simulés. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readState, writeState, startupStep, confirmTrial, failTrial, decide, fileSteps, safePath, cmpVersion, keepDirs, STATE_KEY } from '../src/app/update.js';
import { sha256js, sha256 } from '../src/app/sha256.js';
import { guardStart, startUpdater, check, build } from '../src/app/updater.js';
import { bundleFiles, manifestOf } from '../server/app-update/bundle.js';
import { APP_UPDATE } from '../src/config.js';

const H = s => crypto.createHash('sha256').update(s).digest('hex');
const V1 = '1111111111111111', V2 = '2222222222222222', V3 = '3333333333333333';
const memStore = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };

/* ---- logique pure ---- */
test('versions de la coque : comparées morceau par morceau', () => {
  assert.equal(cmpVersion('1.10.0', '1.9.2'), 1);
  assert.equal(cmpVersion('1.1', '1.1.0'), 0);
  assert.equal(cmpVersion('1.0.0', '1.1.0'), -1);
  assert.equal(cmpVersion('', '1.1.0'), -1, 'version inconnue : trop ancienne');
});

test('état : relu prudemment (illisible = vide, versions invalides écartées)', () => {
  assert.deepEqual(readState(memStore({ [STATE_KEY]: '{oups' })), { good: null, trying: null, ready: null, bad: [] });
  const s = readState(memStore({ [STATE_KEY]: JSON.stringify({ good: { v: '../x' }, trying: { v: V1, at: 5 }, bad: [V2, 'zz', 3] }) }));
  assert.deepEqual(s, { good: null, trying: { v: V1, at: 5 }, ready: null, bad: [V2] });
});

test('démarrage : version en essai reconnue ; essai jamais confirmé = refusé ; nouvelle coque = on oublie la version gardée', () => {
  const base = { good: { v: V1 }, trying: { v: V2, at: 0 }, ready: null, bad: [] };
  assert.deepEqual(startupStep(base, V2), { state: base, trial: true, failed: null });
  const r = startupStep(base, V1);
  assert.equal(r.trial, false); assert.equal(r.failed, V2);
  assert.deepEqual(r.state, { good: { v: V1 }, trying: null, ready: null, bad: [V2] });
  assert.equal(startupStep({ ...base, trying: null }, V3).state.good, null, 'tourne sur autre chose que la version gardée');
  assert.equal(startupStep({ ...base, trying: null, ready: { v: V1 } }, V1).state.ready, null, 'déjà appliquée');
});

test('essai : confirmé = version gardée ; raté = refusé pour toujours, liste bornée', () => {
  const s = { good: { v: V1 }, trying: { v: V2, at: 0 }, ready: { v: V2 }, bad: [] };
  assert.deepEqual(confirmTrial(s), { good: { v: V2 }, trying: null, ready: null, bad: [] });
  assert.deepEqual(failTrial(s), { good: { v: V1 }, trying: null, ready: null, bad: [V2] });
  const many = Array.from({ length: 30 }, (_, i) => i.toString(16).padStart(16, '0'));
  assert.equal(failTrial({ ...s, bad: many }).bad.length, APP_UPDATE.keepBad);
  assert.equal(failTrial({ ...s, bad: many }).bad.at(-1), V2);
});

test('décision : coque trop ancienne d\'abord, puis même version, version refusée, mise à jour', () => {
  const remote = { version: V2, minNative: '1.1.0', files: {} };
  assert.equal(decide({ current: V1, remote, native: '1.0.0', bad: [] }), 'tooOld');
  assert.equal(decide({ current: V2, remote: { version: V2, minNative: '1.2.0', same: true }, native: '1.1.0', bad: [] }), 'tooOld');
  assert.equal(decide({ current: V2, remote, native: '1.1.0', bad: [] }), 'same');
  assert.equal(decide({ current: V1, remote, native: '1.1.0', bad: [V2] }), 'bad');
  assert.equal(decide({ current: V1, remote, native: '1.1.0', bad: [] }), 'update');
  assert.equal(decide({ current: V1, remote: null, native: '1.1.0', bad: [] }), 'same', 'pas de réponse : on garde');
  assert.equal(decide({ current: V1, remote: { version: '../../x', files: {} }, native: '1.1.0', bad: [] }), 'same');
});

test('fichiers : inchangés recopiés, autres téléchargés ; un chemin dangereux rend le manifeste invalide', () => {
  assert.deepEqual(fileSteps({ 'a.js': H('a'), 'b.js': H('b') }, { 'a.js': H('a'), 'b.js': H('B'), 'c.js': H('c') }), { reuse: ['a.js'], fetch: ['b.js', 'c.js'] });
  for(const p of ['../x.js', '/etc/x', 'a//b', 'a/./b', 'a\\b', '', 'src/../../x']) assert.equal(safePath(p), false, p);
  assert.equal(fileSteps({}, { '../x.js': H('x') }), null);
  assert.equal(fileSteps({}, { 'a.js': 'pas une empreinte' }), null);
  assert.equal(fileSteps({}, {}), null);
  for(const p of Object.keys(manifestOf(bundleFiles()).files)) assert.ok(safePath(p), `chemin réel refusé : ${p}`);
});

test('dossiers gardés : version gardée, en essai, prête', () => {
  assert.deepEqual([...keepDirs({ good: { v: V1 }, trying: null, ready: { v: V3 }, bad: [V2] })], [V1, V3]);
});

test('empreinte en JavaScript = celle de Node, toutes tailles (blocs, remplissage)', async () => {
  for(const n of [0, 1, 55, 56, 63, 64, 65, 1000, 70000]){
    const b = crypto.randomBytes(n);
    assert.equal(sha256js(new Uint8Array(b)), H(b), `${n} octets`);
  }
  assert.equal(await sha256(new Uint8Array(Buffer.from('abc'))), H('abc'), 'crypto.subtle');
  assert.equal(await sha256(new Uint8Array(Buffer.from('abc')), { digest: () => Promise.reject(new Error('non')) }), H('abc'), 'refusé : JavaScript');
});

/* ---- faux téléphone ---- */
const API = 'https://deepmineidle.fr';
const files = obj => new Map(Object.entries(obj).map(([p, s]) => [p, Buffer.from(s)]));
const manifest = (m, v) => ({ version: v, minNative: '1.1.0', files: Object.fromEntries([...m].map(([p, b]) => [p, H(b)])) });

function phone({ local, localV = V1, remote, remoteV = V2, native = '1.1.0', state, serverFiles, slow = 0, down = false }){
  const disk = new Map(), calls = [], listeners = {}, posted = [];
  const resp = (status, body) => ({ ok: status === 200, status, json: async () => JSON.parse(body), arrayBuffer: async () => { const b = Buffer.from(body); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } });
  const under = p => [...disk.keys()].filter(k => k === p || k.startsWith(p + '/'));
  const fs = {
    getUri: async ({ path }) => ({ uri: 'file:///data/lib/' + encodeURI(path) }),
    rmdir: async ({ path }) => { for(const k of under(path)) disk.delete(k); },
    mkdir: async () => {},
    readdir: async ({ path }) => ({ files: [...new Set(under(path).filter(k => k !== path).map(k => k.slice(path.length + 1).split('/')[0]))].map(name => ({ name })) }),
    copy: async ({ from, to }) => { for(const k of under(from)) disk.set(to + k.slice(from.length), disk.get(k)); },
    deleteFile: async ({ path }) => { if(!disk.delete(path)) throw new Error('absent'); },
    stat: async ({ path }) => { if(!disk.has(path)) throw new Error('absent'); return {}; },
    writeFile: async ({ path, data, encoding }) => { disk.set(path, encoding ? Buffer.from(data) : Buffer.from(data, 'base64')); },
  };
  const io = {
    fs, store: memStore(state ? { [STATE_KEY]: JSON.stringify(state) } : {}), platform: 'android', api: API, now: () => Date.now(),
    webview: { setServerBasePath: async o => calls.push(['base', o.path]), setServerAssetPath: async o => calls.push(['asset', o.path]), persistServerBasePath: async () => calls.push(['persist']) },
    app: { getInfo: async () => ({ version: native }), addListener: (e, f) => { listeners[e] = f; } },
    launcher: { openUrl: async o => calls.push(['store', o.url]) },
    fetch: async (url, opt = {}) => {
      if(url === 'bundle.json') return resp(200, JSON.stringify(manifest(local, localV)));
      if(url.startsWith(`${API}/api/app/rollback`)){ posted.push(JSON.parse(opt.body)); return resp(204, ''); }
      if(down) throw new Error('réseau');
      if(url.startsWith(`${API}/api/app/update`)){
        const have = new URL(url).searchParams.get('have'), m = manifest(remote, remoteV);
        return resp(200, JSON.stringify(have === remoteV ? { version: remoteV, minNative: m.minNative, same: true } : m));
      }
      if(url.startsWith(`${API}/app-bundle/${remoteV}/`)){
        if(slow) await new Promise(r => setTimeout(r, slow));
        const p = decodeURIComponent(url.slice(`${API}/app-bundle/${remoteV}/`.length)), b = (serverFiles ?? remote).get(p);
        return b ? resp(200, b) : resp(404, '');
      }
      const b = local.get(decodeURIComponent(url));
      return b ? resp(200, b) : resp(404, '');
    },
  };
  return { io, disk, calls, listeners, posted, state: () => readState(io.store) };
}
const ui = () => { const seen = []; return { seen, updating: () => seen.push('updating'), hide: () => seen.push('hide'), tooOld: () => seen.push('tooOld') }; };
const fast = { ...APP_UPDATE, checkTimeout: 1, applyWithin: 1 };
const L = files({ 'index.html': '<p>1</p>', 'src/main.js': 'un', 'textures/a b.png': '\x00\x01' });
const R = files({ 'index.html': '<p>1</p>', 'src/main.js': 'deux', 'textures/a b.png': '\x00\x01', 'src/new.js': 'nouveau' });

test('mise à jour depuis la copie embarquée : dossier complet et vérifié, bascule en essai', async () => {
  const t = phone({ local: L, remote: R }), u = ui();
  assert.equal(await check(t.io, u, { limits: fast }), 'applying');
  const dir = `NoCloud/ionic_built_snapshots/${V2}`;
  for(const [p, b] of R) assert.deepEqual(t.disk.get(`${dir}/${p}`), b, p);
  assert.equal(JSON.parse(t.disk.get(`${dir}/bundle.json`)).version, V2);
  assert.deepEqual(t.calls, [['base', `/data/lib/${dir}`]]);
  assert.equal(t.state().trying.v, V2);
  assert.deepEqual(u.seen, ['updating']);
});

test('mise à jour depuis une version téléchargée : copie du dossier, seules les différences passent par le réseau', async () => {
  const t = phone({ local: L, remote: R, state: { good: { v: V1 }, bad: [] } });
  for(const [p, b] of L) t.disk.set(`NoCloud/ionic_built_snapshots/${V1}/${p}`, b);
  t.disk.set(`NoCloud/ionic_built_snapshots/${V1}/bundle.json`, Buffer.from('{}'));
  const asked = [], f = t.io.fetch;
  t.io.fetch = (url, o) => { asked.push(url); return f(url, o); };
  await build(t.io, manifest(L, V1), manifest(R, V2));
  assert.deepEqual(asked.filter(u => u.includes('/app-bundle/')).sort(), [`${API}/app-bundle/${V2}/src/main.js`, `${API}/app-bundle/${V2}/src/new.js`]);
  for(const [p, b] of R) assert.deepEqual(t.disk.get(`NoCloud/ionic_built_snapshots/${V2}/${p}`), b, p);
  assert.ok(t.disk.has(`NoCloud/ionic_built_snapshots/${V1}/src/main.js`), 'la version gardée n\'est pas touchée');
});

test('copie native du dossier refusée par le téléphone : on construit fichier par fichier', async () => {
  const t = phone({ local: L, remote: R, state: { good: { v: V1 }, bad: [] } });
  t.disk.set(`NoCloud/ionic_built_snapshots/${V1}/index.html`, Buffer.from('x'));
  t.io.fs.copy = async () => { t.disk.set(`NoCloud/ionic_built_snapshots/${V2}/morceau`, Buffer.from('?')); throw new Error('non pris en charge'); };
  assert.equal(await build(t.io, manifest(L, V1), manifest(R, V2)), true);
  for(const [p, b] of R) assert.deepEqual(t.disk.get(`NoCloud/ionic_built_snapshots/${V2}/${p}`), b, p);
  assert.ok(!t.disk.has(`NoCloud/ionic_built_snapshots/${V2}/morceau`), 'copie interrompue effacée');
});

test('fichier modifié en route (empreinte différente) : rien n\'est appliqué, le jeu démarre', async () => {
  const t = phone({ local: L, remote: R, serverFiles: files({ 'src/main.js': 'pirate', 'src/new.js': 'nouveau' })}), u = ui();
  assert.equal(await check(t.io, u, { limits: fast }), 'continue');
  assert.deepEqual(t.calls, []);
  assert.equal(t.state().trying, null); assert.equal(t.state().ready, null);
  assert.equal(t.disk.has(`NoCloud/ionic_built_snapshots/${V2}/bundle.json`), false, 'jamais marqué complet');
});

test('pas de réseau, ou déjà à jour : le jeu démarre sans rien changer', async () => {
  for(const t of [phone({ local: L, remote: R, down: true }), phone({ local: L, localV: V2, remote: R })]){
    assert.equal(await check(t.io, ui(), { limits: fast }), 'continue');
    assert.deepEqual(t.calls, []);
  }
});

test('version déjà refusée : jamais retéléchargée', async () => {
  const t = phone({ local: L, remote: R, state: { bad: [V2] } });
  assert.equal(await check(t.io, ui(), { limits: fast }), 'continue');
  assert.equal(t.disk.size, 0);
});

test('coque trop ancienne : écran « Mets à jour l\'appli », le jeu ne démarre pas', async () => {
  const t = phone({ local: L, remote: R, native: '1.0.0' }), u = ui();
  assert.equal(await check(t.io, u, { limits: fast }), 'tooOld');
  assert.deepEqual(u.seen, ['tooOld']);
  assert.equal(t.disk.size, 0);
});

test('téléchargement trop long : le jeu démarre, la version est prête pour la prochaine fois, appliquée au démarrage suivant', async () => {
  const t = phone({ local: L, remote: R, slow: 1300 }), u = ui();
  assert.equal(await check(t.io, u, { limits: fast }), 'continue');
  assert.deepEqual(u.seen, ['updating', 'hide']);
  assert.deepEqual(t.calls, [], 'jamais pendant que le joueur joue');
  await t.io.downloading;
  assert.equal(t.state().ready.v, V2);
  assert.equal(await check(t.io, ui(), { limits: fast }), 'applying', 'prochaine occasion : tout de suite, sans réseau');
  assert.equal(t.calls[0][0], 'base');
});

test('gardien : la version en essai démarre → gardée par Capacitor, les vieux dossiers partent', async () => {
  const t = phone({ local: R, localV: V2, remote: R, state: { good: { v: V1 }, trying: { v: V2, at: 0 }, bad: [] } });
  for(const v of [V1, V2, V3]) t.disk.set(`NoCloud/ionic_built_snapshots/${v}/index.html`, Buffer.from('x'));
  const boot = {};
  const g = await guardStart(t.io, { boot, poll: 5 });
  assert.equal(g.trial, true);
  setTimeout(() => { boot.started = true; }, 20);
  assert.equal(await g.outcome, 'confirmed');
  assert.deepEqual(t.calls, [['persist']]);
  assert.deepEqual(t.state().good, { v: V2 });
  assert.deepEqual([...t.disk.keys()].map(k => k.split('/')[2]).sort(), [V2], 'V1 et V3 effacés, jamais la version gardée');
});

test('gardien : la version en essai plante → retour à la version gardée (ou à la copie embarquée), refusée, signalée', async () => {
  for(const good of [{ v: V1 }, null]){
    const t = phone({ local: R, localV: V2, remote: R, state: { good, trying: { v: V2, at: 0 }, bad: [] } });
    const boot = {};
    const g = await guardStart(t.io, { boot, poll: 5 });
    boot.failed = 'Le jeu a planté au démarrage.';
    assert.equal(await g.outcome, 'rolledBack');
    assert.deepEqual(t.calls, [good ? ['base', `/data/lib/NoCloud/ionic_built_snapshots/${V1}`] : ['asset', 'public']]);
    assert.deepEqual(t.state().bad, [V2]);
    assert.deepEqual(t.posted.map(p => [p.from, p.why]), [[V2, 'erreur']]);
  }
});

test('gardien : essai jamais confirmé avant que l\'appli soit fermée → refusé au lancement suivant', async () => {
  const t = phone({ local: L, localV: V1, remote: R, state: { good: { v: V1 }, trying: { v: V2, at: 0 }, bad: [] } });
  const g = await guardStart(t.io, { boot: {} });
  assert.equal(g.trial, false);
  assert.deepEqual(t.state().bad, [V2]);
  assert.deepEqual(t.posted.map(p => [p.from, p.to, p.why]), [[V2, V1, 'relance']]);
});

test('démarrage complet : en essai, pas de vérification ; retour au premier plan après un moment : nouvelle vérification', async () => {
  const t = phone({ local: R, localV: V2, remote: R, state: { trying: { v: V2, at: 0 }, bad: [] } });
  const g = await guardStart(t.io, { boot: { started: true }, poll: 5 });
  await startUpdater({ doc: null, win: {}, io: t.io, guard: Promise.resolve(g), limits: fast });
  await g.outcome;
  assert.deepEqual(t.calls, [['persist']]);

  const t2 = phone({ local: L, remote: R, down: true });
  let now = 0, checks = 0; t2.io.now = () => now;
  const f = t2.io.fetch; t2.io.fetch = (url, o) => { if(url.includes('/api/app/update')) checks++; return f(url, o); };
  await startUpdater({ doc: null, win: {}, io: t2.io, guard: Promise.resolve({ trial: false }), limits: fast });
  assert.equal(checks, 1, 'au démarrage');
  t2.listeners.pause(); now = 10e3; t2.listeners.resume();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(checks, 1, 'trop tôt : rien');
  t2.listeners.pause(); now += fast.resumeAfter * 1000; t2.listeners.resume();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(checks, 2, 'après un moment en arrière-plan');
});

test('hors de l\'appli (site, ?app dans un navigateur, coque 1.0.0 sans les plugins) : rien', async () => {
  assert.equal(await startUpdater({ doc: null, win: { Capacitor: { Plugins: { App: {} } } } }), undefined);
});
