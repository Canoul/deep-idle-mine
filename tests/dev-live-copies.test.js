/* Mode dev : copier un vrai joueur depuis la base en ligne (31/10/2026) : uniquement la vue, en mode dev, rangé dans
   data/presets/ comme une copie ordinaire ; le serveur dev refuse l'adresse d'écriture de la base. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLiveCopies, COPY_VIEW } from '../server/game/dev-live-copies.js';
import { readDevCopies } from '../server/game/dev-copies.js';
import { loadDevEnv } from '../server/dev-env.js';
import { createGameService } from '../server/game/service.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { gameRoutes } from '../server/game/routes.js';
import { copyMiner } from '../src/shared/dev-presets.js';
import { minerSpecs } from '../src/shared/game.js';
import { createPartyService } from '../server/party/service.js';
import { fakeLive } from './helpers.js';

const ME = { id: 'AAAA1111', name: 'Zoe' };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'copies-'));
const ROWS = [
  { name: 'Sõnata', ns: 'stuff', value: { worn: { pioche: { item: 'Pioche en acier', uid: 1 } }, ops: ['x'] } },
  { name: 'Sõnata', ns: 'skills', value: { tree: 'mineur', ranks: {}, glyphs: {}, ops: ['y'] } },
  { name: 'Sõnata', ns: 'spells', value: { slots: ['dynamite'] } },
  { name: 'Sõnata', ns: 'progress', value: { xp: 5000, spec: { mineur: 100 } } },
];
const fakePool = rows => { const calls = []; return { calls, query: async (sql, args) => { calls.push({ sql, args }); return { rows }; } }; };

test('read : une seule requête, sur la vue, par pseudo normalisé ; copie rangée et relue par readDevCopies', async () => {
  const dir = tmp(), pool = fakePool(ROWS);
  const r = await createLiveCopies({ dir, pool }).read('SÕNATA');
  assert.deepEqual(r, { who: 'sonata', name: 'Sõnata' });
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].sql, /^SELECT /);
  assert.ok(pool.calls[0].sql.includes(`FROM ${COPY_VIEW} `));
  assert.ok(!pool.calls[0].sql.includes('dim_data'), 'jamais la table');
  assert.deepEqual(pool.calls[0].args, ['sonata']);
  const snap = readDevCopies(dir).sonata;
  assert.equal(snap.stuff.pioche.item, 'Pioche en acier');
  assert.deepEqual(snap.spells.slots, ['dynamite'], 'les vrais sorts');
  assert.equal(snap.skills.ops, undefined);
  assert.ok(copyMiner('sonata', snap), 'utilisable en session');
});

test('read : pseudo inconnu → null ; copie invalide → refusée, aucun fichier', async () => {
  const dir = tmp();
  assert.equal(await createLiveCopies({ dir, pool: fakePool([]) }).read('personne'), null);
  const r = await createLiveCopies({ dir, pool: fakePool([ROWS[0]]) }).read('Sõnata');   // sans skills
  assert.equal(r.refused, true);
  assert.deepEqual(fs.readdirSync(dir), []);
});

const service = (dev, live) => createGameService({ store: createMemoryGameStore(), dev, devLiveCopies: live, devCopies: () => ({ sonata: {} }) });

test('route : réservée au mode dev, réglage absent, pseudo invalide, panne de base sans détail', async () => {
  assert.ok(gameRoutes(service(true))['POST /api/game/dev/copy']);
  const live = { read: async () => ({ who: 'sonata', name: 'Sõnata' }) };
  await assert.rejects(service(false, live).devCopyPlayer(ME, { name: 'x' }), { code: 'forbidden' });
  await assert.rejects(service(true, null).devCopyPlayer(ME, { name: 'x' }), { code: 'no_copy_db' });
  for(const name of ['', '   ', 'x'.repeat(33), 3, null]) await assert.rejects(service(true, live).devCopyPlayer(ME, { name }), { code: 'bad_request' });
  assert.deepEqual(await service(true, live).devCopyPlayer(ME, { name: ' Sonata ' }), { who: 'sonata', name: 'Sõnata', copies: ['sonata'] });
  await assert.rejects(service(true, { read: async () => null }).devCopyPlayer(ME, { name: 'x' }), { code: 'not_found' });
  const err = console.error; console.error = () => {};
  try {
    await assert.rejects(service(true, { read: async () => { throw new Error('postgresql://secret'); } }).devCopyPlayer(ME, { name: 'x' }),
      e => e.code === 'copy_failed' && !e.message.includes('secret'));
  } finally { console.error = err; }
});

test("réglages : fichiers lus sans écraser ; DATABASE_URL refusé, même venu d'un fichier", () => {
  const f = path.join(tmp(), 'x.env');
  fs.writeFileSync(f, 'DIM_DEV_COPY_URL=postgres://lecture\nDIM_AUTRE=fichier\n');
  const env = loadDevEnv({ env: { DIM_AUTRE: 'deja' }, files: [f, f + '.absent'] });
  assert.equal(env.DIM_DEV_COPY_URL, 'postgres://lecture'); assert.equal(env.DIM_AUTRE, 'deja');
  fs.writeFileSync(f, 'DATABASE_URL=postgres://ecriture\n');
  assert.throws(() => loadDevEnv({ env: {}, files: [f] }), /DATABASE_URL/);
  assert.throws(() => loadDevEnv({ env: { DATABASE_URL: 'x' }, files: [] }), /DATABASE_URL/);
});

/* un preset par mineur, compte invité sans clé, choix fait par un membre du groupe (31/10) */
const SNAP = { name: 'Sõnata', stuff: { pioche: { item: 'Pioche en acier', uid: 1 } }, skills: { tree: 'logisticien', ranks: { travel_rush: 1 }, glyphs: {} }, spells: { slots: ['inspiration'] }, progress: { xp: 5e6, spec: { logisticien: 5e6 } } };
const devGame = (dev = true) => { const store = createMemoryGameStore(); return { store, game: createGameService({ store, dev, devCopies: () => ({ sonata: SNAP }), liveRunner: fakeLive(rec => ({ id: rec.id, shares: [] })) }) }; };
const GUEST = { id: 'GGGG1111', name: null, guest: true };

test('start : un preset par mineur ; un compte invité entre en instance sans clé ; ignoré hors mode dev', async () => {
  const { game, store } = devGame();
  const { session } = await game.start(GUEST, { mode: 'instance_2', presets: ['copy:sonata', 'copy:sonata', 'barbare'] });
  const rec = await store.getGameSession(session.id);
  assert.equal(rec.bots, 2, 'mineurs de test déduits des presets');
  const m = minerSpecs(rec);
  assert.equal(m.length, 3);
  assert.equal(m[1].name, 'Test_Sonata');
  assert.equal(m[0].look.pioche, 'Pioche en acier', 'le joueur porte le stuff de la copie');
  assert.deepEqual(m[0].spells, ['inspiration'], 'ses vrais sorts');
  const off = devGame(false);
  await assert.rejects(off.game.start(ME, { mode: 'instance_2', presets: ['copy:sonata'] }), { code: 'no_key' });
});

test('groupe : un membre choisit, le chef lance avec ce choix ; réservé au mode dev', async () => {
  const { game, store } = devGame();
  const A = { id: 'AAAA1111', name: 'Zoe' }, B = { id: 'BBBB2222', name: 'Max' };
  const party = createPartyService({ game, dev: true });
  await party.create(A);
  await party.join(B, (await party.state(A)).party.code);
  const r = await party.setDevPresets(B, [null, 'copy:sonata', 'barbare']);
  assert.deepEqual(r.party.devPresets, [null, 'copy:sonata', 'barbare']);
  assert.deepEqual((await party.state(A)).party.devPresets, r.party.devPresets, 'le chef le voit');
  await party.ready(B, true);
  const { session } = await party.launch(A, { mode: 'instance_2' });
  const rec = await store.getGameSession(session.id), m = minerSpecs(rec);
  assert.deepEqual(m.map(x => x.name), ['Zoe', 'Max', 'Test_Barbare']);
  assert.equal(m[1].look.pioche, 'Pioche en acier', 'le membre invité porte la copie');
  const off = createPartyService({ game: devGame(false).game });
  await off.create(A);
  await assert.rejects(off.setDevPresets(A, ['barbare']), { code: 'forbidden' });
});

