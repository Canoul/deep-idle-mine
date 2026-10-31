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
