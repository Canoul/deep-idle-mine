/* Renommage d'objets (01/11/2026, marques refusées par les stores) : tous les exemplaires, chez tous les joueurs, sans rien perdre. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, STUFF, WIKI } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { sanitizePiece } from '../src/meta/piece.js';
import { createMemoryGameStore, GAME_NS } from '../server/game/store.js';
import { migrateItemNames, ITEM_RENAMES, renameText, countOldNames } from '../server/game/rename-items.js';

const OLD_G = 'Lunettes Gucci', OLD_D = 'Doc Martins', NEW_G = 'Lunettes de luxe', NEW_D = 'Bottes de chantier';

test('table : les nouveaux noms existent dans le jeu, les anciens n\'y sont plus', () => {
  assert.deepEqual(ITEM_RENAMES, { [OLD_G]: NEW_G, [OLD_D]: NEW_D });
  for(const n of [NEW_G, NEW_D, `${NEW_G} BP`, `${NEW_D} BP`]) assert.ok(ITEMS[n], n);
  for(const n of [OLD_G, OLD_D, `${OLD_G} BP`, `${OLD_D} BP`]) assert.equal(ITEMS[n], undefined, n);
  assert.ok(STUFF.items[NEW_G] && STUFF.items[NEW_D]);
  assert.equal(RECIPES[NEW_G].unlock, `${NEW_G} BP`); assert.equal(RECIPES[NEW_D].unlock, `${NEW_D} BP`);
  assert.ok(WIKI.secret.includes(NEW_G) && WIKI.secret.includes(NEW_D));
  assert.ok(!JSON.stringify([ITEMS, STUFF, RECIPES, WIKI]).match(/gucci|martin/i), 'ni clé ni texture ne porte encore la marque');
});

test('une pièce améliorée garde tout : qualité, amélioration, lignes, rune', async () => {
  const piece = { uid: 7, item: OLD_D, q: 5, s: 2, up: 3, lines: [{ stat: 'knockRes', pct: 80 }], rune: { q: 2, s: 1, stat: 'attackSpeed', pct: 40 } };
  const store = createMemoryGameStore({ stuff: { A: { worn: { pieds: piece }, gen: 3 } } });
  await migrateItemNames(store);
  const got = (await store.getStuff('A')).worn.pieds;
  assert.deepEqual(got, { ...piece, item: NEW_D });
  assert.equal(sanitizePiece(got)?.item, NEW_D, 'le jeu la reconnaît');
  assert.equal(sanitizePiece(piece), null, 'sans migration, le jeu l\'aurait écartée : d\'où le passage au démarrage, avant tout service');
});

test('partout : sac, plans, sets, recettes, wiki (clés comprises), session en cours, four, prison, raffle', async () => {
  const store = createMemoryGameStore({
    inventories: { A: { slots: [{ item: `${OLD_G} BP`, qty: 2 }, { item: 'Charbon', qty: 9 }, { uid: 9, item: OLD_G, q: 3 }], known: [OLD_D], credited: ['s1'] } },
    sets: { A: { list: [{ id: 1, name: 'mon set', worn: { casque: { uid: 9, item: OLD_G } } }] } },
    discovered: { [OLD_G]: { at: 5 }, [`${OLD_D} BP`]: { at: 6 }, 'Charbon': { at: 7 } },
    sessions: { s: { id: 's', status: 'running', players: [{ account: 'A' }], gear: { A: { casque: { item: OLD_G, q: 3 } } }, result: null } },
    prisons: { A: { bag: { [`${OLD_D} BP`]: 1 } } },
    raffles: { state: { current: { lot: { item: `${OLD_G} BP`, qty: 1 } } } },
  });
  const r = await migrateItemNames(store);
  assert.ok(r.rows >= 5);
  const inv = await store.getInventory('A');
  assert.deepEqual(inv.slots, [{ item: `${NEW_G} BP`, qty: 2 }, { item: 'Charbon', qty: 9 }, { uid: 9, item: NEW_G, q: 3 }]);
  assert.deepEqual(inv.known, [NEW_D]);
  assert.equal((await store.getSets('A')).list[0].worn.casque.item, NEW_G);
  assert.deepEqual((await store.listDiscovered()).sort(), ['Charbon', NEW_G, `${NEW_D} BP`].sort());
  assert.equal((await store.getGameSession('s')).gear.A.casque.item, NEW_G);
  assert.deepEqual((await store.getPrison('A')).bag, { [`${NEW_D} BP`]: 1 });
  assert.equal(countOldNames(store).total, 0);
});

test('rejouée : ne change plus rien ; ni signalements ni journal (preuves), ni chat (mots des joueurs)', async () => {
  const store = createMemoryGameStore({ inventories: { A: { slots: [{ item: OLD_G, qty: 1 }] } },
    reports: { 1: { id: 1, message: { text: `mes ${OLD_D}` } } }, modLogs: { 1: { id: 1, detail: OLD_G } }, chats: { state: { msgs: [{ id: 1, text: `vends ${OLD_G}` }] } } });
  const writes = []; store.changed = async c => { writes.push(c); };
  assert.equal((await migrateItemNames(store)).rows, 1);
  assert.equal((await migrateItemNames(store)).rows, 0);
  assert.equal(writes.length, 1, 'une seule écriture, rien au démarrage suivant');
  assert.equal((await store.listReports())[0].message.text, `mes ${OLD_D}`);
  assert.equal((await store.listModLog())[0].detail, OLD_G);
  assert.equal((await store.getGlobalChat()).msgs[0].text, `vends ${OLD_G}`);
});

test('toute sorte de données est couverte, y compris les prochaines', () => {
  const store = createMemoryGameStore();
  assert.deepEqual([...store.nsList()].sort(), [...GAME_NS].sort());
  assert.equal(renameText(`${OLD_G} BP`), `${NEW_G} BP`);
  assert.equal(renameText('Charbon'), 'Charbon');
});
