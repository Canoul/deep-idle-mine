/* Stockage PostgreSQL : une ligne par objet, écritures en file, retentées, rien de perdu au redémarrage.
   Avec une fausse base (toujours lancé) ; avec une vraie base si TEST_DATABASE_URL est défini
   (ex. TEST_DATABASE_URL=postgres://dim@localhost:55432/dimtest). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, DB_TABLE } from '../server/db/postgres.js';
import { createPgStore } from '../server/accounts/store.js';
import { createPgGameStore } from '../server/game/store.js';

/* fausse base : comprend les 4 requêtes du module ; fail = nombre d'écritures qui échouent d'abord */
function fakePool({ fail = 0 } = {}){
  const rows = new Map(), log = [];
  return {
    rows, log,
    async query(sql, p = []){
      log.push(sql.trim().split(/\s+/)[0]);
      if(/^CREATE/.test(sql.trim())) return { rows: [] };
      if(/^SELECT/.test(sql.trim()))
        return { rows: [...rows.values()].filter(r => p[0].includes(r.ns)).map(r => ({ ...r, value: JSON.parse(r.json) })) };
      if(fail > 0){ fail--; throw new Error('base injoignable'); }
      if(/^DELETE/.test(sql.trim())){ rows.delete(p[0] + '/' + p[1]); return { rows: [] }; }
      for(let i = 0; i < p.length; i += 3){               // une ou plusieurs lignes (ns, key, value) par requête
        JSON.parse(p[i+2]);                               // la valeur envoyée est du JSON valide
        rows.set(p[i] + '/' + p[i+1], { ns: p[i], key: p[i+1], json: p[i+2] });
      }
      return { rows: [] };
    },
    async end(){},
  };
}
const quiet = { warn(){}, error(){} };

test('les modifications des comptes et du jeu deviennent des lignes, relues au redémarrage', async () => {
  const pool = fakePool();
  const db = await openDatabase('', { pool, log: quiet });
  const acc = await createPgStore(db), game = await createPgGameStore(db);
  await acc.insertAccount({ id: 'A1', name: 'Zoé', nameKey: 'zoe', guest: false });
  await acc.putSession('h1', { accountId: 'A1', expiresAt: 10 });
  await acc.putSession('h2', { accountId: 'A1', expiresAt: 99 });
  await game.putInventory('A1', { slots: [{ item: 'Charbon', qty: 3 }] });
  await game.putPrefs('A1', { priority: 'ore' });
  await game.putGameSession({ id: 'S1', players: [{ account: 'A1' }], status: 'running', startedAt: 1 });
  await acc.purgeExpired(50);                           // h1 supprimée
  assert.deepEqual([...pool.rows.keys()].sort(),
    ['account/A1', 'game_session/S1', 'inventory/A1', 'prefs/A1', 'session/h2']);

  /* « redémarrage » : nouveaux stockages sur la même base */
  const db2 = await openDatabase('', { pool, log: quiet });
  const acc2 = await createPgStore(db2), game2 = await createPgGameStore(db2);
  assert.equal((await acc2.findAccountByName('zoe')).id, 'A1', 'index des pseudos reconstruit');
  assert.equal(await acc2.getSession('h1'), null);
  assert.equal((await acc2.getSession('h2')).expiresAt, 99);
  assert.equal((await game2.getInventory('A1')).slots[0].qty, 3);
  assert.equal((await game2.sessionsOf('A1')).length, 1);
});

test('la valeur écrite est celle du moment de la modification', async () => {
  const pool = fakePool();
  const db = await openDatabase('', { pool, log: quiet });
  const inv = { slots: [{ item: 'Fer', qty: 1 }] };
  const p = db.write([{ ns: 'inventory', key: 'A1', value: inv }]);
  inv.slots[0].qty = 999;                               // modifié avant que l'écriture parte
  await p;
  assert.equal(JSON.parse(pool.rows.get('inventory/A1').json).slots[0].qty, 1);
});

test('écriture en échec : retentée, dans l\'ordre ; abandonnée seulement après plusieurs échecs', async () => {
  const pool = fakePool({ fail: 2 });
  const db = await openDatabase('', { pool, retries: [1, 1, 1], log: quiet });
  db.write([{ ns: 'prefs', key: 'A', value: { v: 1 } }]);
  await db.write([{ ns: 'prefs', key: 'A', value: { v: 2 } }]);
  assert.equal(JSON.parse(pool.rows.get('prefs/A').json).v, 2, 'la dernière valeur gagne');

  const errors = [];
  const down = fakePool({ fail: 99 });
  const db2 = await openDatabase('', { pool: down, retries: [1, 1], log: { warn(){}, error: m => errors.push(m) } });
  await db2.write([{ ns: 'prefs', key: 'B', value: { v: 1 } }]);
  assert.equal(errors.length, 1, 'un message dans le journal, le serveur continue');
  assert.match(errors[0], /prefs\/B/);
});

test('vraie base PostgreSQL (si TEST_DATABASE_URL)', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const url = process.env.TEST_DATABASE_URL;
  const db = await openDatabase(url, { log: quiet });
  try {
    await db.write([{ ns: 'test', key: 'k1', value: { a: 'é', n: 1 } }, { ns: 'test', key: 'k2', value: [1, 2] }]);
    await db.write([{ ns: 'test', key: 'k1', value: { a: 'é', n: 2 } }, { ns: 'test', key: 'k2', value: null }]);
    const rows = await db.load(['test']);
    assert.deepEqual(rows.test, { k1: { a: 'é', n: 2 } });
    const acc = await createPgStore(db);
    await acc.insertAccount({ id: 'T-1', name: 'Test', nameKey: 'test', guest: false });
    const again = await createPgStore(db);
    assert.equal((await again.getAccount('T-1')).name, 'Test');
  } finally {
    await db.write([{ ns: 'test', key: 'k1', value: null }, { ns: 'account', key: 'T-1', value: null }]);
    await db.close();
  }
  assert.ok(DB_TABLE);
});

test('four : inventaire et four écrits ensemble, en une seule requête, et relus au redémarrage', async () => {
  const pool = fakePool();
  const db = await openDatabase('', { pool, log: quiet });
  const game = await createPgGameStore(db);
  const before = pool.log.length;
  await game.putInventoryAndFurnaces('A1', { slots: [{ item: 'Fer', qty: 5 }] }, { list: [{ ore: { item: 'Fer', qty: 10 } }], ops: ['x'] });
  await game.close();
  assert.deepEqual(pool.log.slice(before), ['INSERT'], 'une seule requête pour les deux lignes');
  const again = await createPgGameStore(await openDatabase('', { pool, log: quiet }));
  assert.deepEqual((await again.getInventory('A1')).slots, [{ item: 'Fer', qty: 5 }]);
  assert.deepEqual((await again.getFurnaces('A1')).list[0].ore, { item: 'Fer', qty: 10 });
});

test('une écriture de plusieurs lignes qui échoue est retentée en entier (jamais à moitié)', async () => {
  const pool = fakePool({ fail: 1 });
  const db = await openDatabase('', { pool, log: quiet, retries: [1] });
  const game = await createPgGameStore(db);
  await game.putInventoryAndFurnaces('A1', { slots: [] }, { list: [], ops: [] });
  await game.close();
  assert.ok(pool.rows.has('inventory/A1') && pool.rows.has('furnace/A1'));
});

test('stuff : inventaire et stuff écrits ensemble, en une seule requête, et relus au redémarrage', async () => {
  const pool = fakePool();
  const game = await createPgGameStore(await openDatabase('', { pool, log: quiet }));
  const before = pool.log.length;
  await game.putInventoryAndStuff('A1', { slots: [] }, { worn: { pioche: { item: 'Pioche en pierre', uid: 3 } }, ops: [] });
  await game.close();
  assert.deepEqual(pool.log.slice(before), ['INSERT']);
  const again = await createPgGameStore(await openDatabase('', { pool, log: quiet }));
  assert.deepEqual((await again.getStuff('A1')).worn.pioche, { item: 'Pioche en pierre', uid: 3 });
});
