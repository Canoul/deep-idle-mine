/* Outil d'administration scripts/give-item.js : donne un objet à un joueur (stockage fichier, dossier temporaire).
   Refuse les objets inconnus et les quantités invalides ; lit DATABASE_URL / DIM_DATA_DIR depuis --env. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFileStore } from '../server/accounts/store.js';
import { createFileGameStore } from '../server/game/store.js';
import { deserialize, countOf } from '../src/meta/inventory.js';

const run = (dir, args) => {
  try { return { ok: true, out: execFileSync(process.execPath, ['scripts/give-item.js', ...args],
    { env: { ...process.env, DIM_DATA_DIR: dir, DATABASE_URL: '' }, encoding: 'utf8', stdio: 'pipe' }) }; }
  catch(e){ return { ok: false, out: String(e.stderr) + String(e.stdout) }; }
};
async function setup(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'give-item-'));
  const acc = await createFileStore(dir);
  await acc.insertAccount({ id: 'C1', name: 'Crousti', nameKey: 'crousti', guest: false });
  await acc.close?.();
  return dir;
}
const invOf = async dir => { const g = await createFileGameStore(dir); const raw = await g.getInventory('C1'); await g.close?.();
  return raw ? deserialize(JSON.stringify(raw)) : null; };

test('donne 1 Treasure T3 à un joueur (pseudo sans tenir compte des majuscules), puis 2 de plus', async () => {
  const dir = await setup();
  const r = run(dir, ['--name', 'crousti', '--item', 'Treasure T3']);
  assert.ok(r.ok, r.out);
  assert.equal(countOf(await invOf(dir), 'Treasure T3'), 1);
  assert.ok(run(dir, ['--name', 'CROUSTI', '--item', 'Treasure T3', '--qty', '2']).ok);
  assert.equal(countOf(await invOf(dir), 'Treasure T3'), 3);
});

test('refus : objet inconnu, quantités invalides, compte inconnu ; rien n\'est donné', async () => {
  const dir = await setup();
  for(const args of [['--item', 'Treasure T9'], ['--item', 'treasure t3'], ['--item', 'Treasure T3', '--qty', '0'],
                     ['--item', 'Treasure T3', '--qty', '-1'], ['--item', 'Treasure T3', '--qty', '1.5'],
                     ['--item', 'Treasure T3', '--qty', '1001'], ['--item', 'Treasure T3', '--qty', 'beaucoup']]){
    const r = run(dir, ['--name', 'crousti', ...args]);
    assert.equal(r.ok, false, args.join(' '));
  }
  assert.equal(run(dir, ['--name', 'personne', '--item', 'Treasure T3']).ok, false);
  assert.equal(run(dir, ['--item', 'Treasure T3']).ok, false, 'sans --name');
  const inv = await invOf(dir);
  assert.equal(inv ? countOf(inv, 'Treasure T3') : 0, 0);
});

test('--env : lit les réglages (format systemd) ; l\'environnement déjà défini l\'emporte', async () => {
  const dir = await setup(), other = fs.mkdtempSync(path.join(os.tmpdir(), 'give-item-env-'));
  const env = path.join(other, 'dim.env');
  fs.writeFileSync(env, `# réglages\nDIM_DATA_DIR=${other}\n`);
  /* DIM_DATA_DIR déjà fourni (dir) : le fichier ne le remplace pas */
  assert.ok(run(dir, ['--env', env, '--name', 'crousti', '--item', 'Treasure T3']).ok);
  assert.equal(countOf(await invOf(dir), 'Treasure T3'), 1);
});
