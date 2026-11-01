/* Contrôle du renommage d'objets (01/11/2026) : compte les anciens noms, SANS RIEN CHANGER. Le renommage lui-même se fait au démarrage
   du jeu (server/game/rename-items.js). Avant la mise en ligne, sur le VPS (la base est lue, jamais écrite) :

     sudo sh -c 'set -a; . /etc/deep-idle-mine.env; set +a; node /opt/deep-idle-mine/scripts/migrate-item-names.js'

   Sur une copie locale : node scripts/migrate-item-names.js --file data/game.json */
import fs from 'node:fs';
import { createMemoryGameStore, createPgGameStore } from '../server/game/store.js';
import { migrateItemNames, countOldNames } from '../server/game/rename-items.js';
import { openDatabase } from '../server/db/postgres.js';
import { arg, fail } from './admin-client.js';

const file = arg('file');
if(!file && !process.env.DATABASE_URL) fail('--file data/game.json, ou DATABASE_URL (voir l\'en-tête de ce script).');
const db = file ? null : await openDatabase(process.env.DATABASE_URL);
const store = file ? createMemoryGameStore(JSON.parse(fs.readFileSync(file, 'utf8'))) : await createPgGameStore(db);
store.changed = async () => {};           // même après le calcul à blanc ci-dessous : jamais une écriture

const before = countOldNames(store);
console.log('Anciens noms trouvés :', before.names);
console.log('Lignes concernées, par sorte de données :', before.ns);
const r = await migrateItemNames(store);  // en mémoire seulement
console.log(`Le démarrage renommerait ${r.rows} ligne(s). Restant ensuite : ${countOldNames(store).total}.`);
await db?.close();
