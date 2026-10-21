/* Outil d'administration : met dans l'inventaire d'un compte une pièce de chaque qualité (R1 à R7, déjà identifiées) et
   des matériaux d'amélioration, pour tester l'onglet Amélioration. Réservé au créateur du jeu.

     node scripts/give-admin.js --name admin                         → en local (data/)
     $env:DATABASE_URL="postgres://…"; node scripts/give-admin.js --name admin   → base en ligne
     options : --item "Pioche en pierre" (pièce donnée) · --mats 50 (Plumes d'ange et Cristaux de pleine lune)

   Les lignes de stats sont tirées comme au jeu (src/meta/piece.js), seule la qualité est imposée.
   Le serveur garde tout en mémoire : ARRÊTE-LE avant (en local), ou REDÉMARRE-LE après (en ligne), sinon il réécrit
   l'ancien inventaire par-dessus. */
import crypto from 'node:crypto';
import { SERVER } from '../server/config.js';
import { createFileStore, createPgStore } from '../server/accounts/store.js';
import { createFileGameStore, createPgGameStore } from '../server/game/store.js';
import { openDatabase } from '../server/db/postgres.js';
import { nameKey } from '../src/shared/account.js';
import { createInventory, deserialize, serialize, addItem, addAll } from '../src/meta/inventory.js';
import { sanitizeStuff } from '../src/meta/stuff.js';
import { rollIdentity, isStuff, pieceName, sanitizePiece } from '../src/meta/piece.js';
import { statLines } from '../src/meta/stuff.js';
import { UPGRADE } from '../src/config.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const name = arg('name', 'admin'), item = arg('item', 'Pioche en pierre'), mats = +arg('mats', 50);
const random = () => crypto.randomBytes(6).readUIntBE(0, 6) / 2**48;

if(!isStuff(item)) { console.error(`« ${item} » n'est pas une pièce de stuff.`); process.exit(1); }
if(!Number.isSafeInteger(mats) || mats < 0) { console.error('--mats : un entier positif.'); process.exit(1); }

const db = process.env.DATABASE_URL ? await openDatabase(process.env.DATABASE_URL, { retries: [1e3, 2e3] }) : null;
const accounts = db ? await createPgStore(db) : await createFileStore(SERVER.dataDir);
const game = db ? await createPgGameStore(db) : await createFileGameStore(SERVER.dataDir);
try {
  const acc = await accounts.findAccountByName(nameKey(name));
  if(!acc){ console.error(`Aucun compte « ${name} » (${db ? 'base en ligne' : accounts.file}).`); process.exitCode = 1; }
  else {
    const raw = await game.getInventory(acc.id);
    const inv = raw ? deserialize(JSON.stringify(raw)) : createInventory();
    sanitizeStuff(await game.getStuff(acc.id), inv);           // uid toujours plus grands que ceux des pièces portées
    for(const d of UPGRADE.qualities){
      const [i] = addItem(inv, item, 1);
      /* qualité imposée, lignes tirées comme au jeu : on retire jusqu'à tomber sur la qualité voulue */
      let id; do id = rollIdentity(item, random); while(id.q !== d.q);
      Object.assign(inv.slots[i], id);
      const p = sanitizePiece(inv.slots[i]);
      console.log(`+ ${pieceName(p)} : ${statLines(p).join(' · ')}`);
    }
    if(mats) addAll(inv, { 'Plume d\'ange': mats, 'Cristal de pleine lune': mats });
    await game.putInventory(acc.id, JSON.parse(serialize(inv)));
    await game.close();
    console.log(`Inventaire de « ${acc.name} » mis à jour (${db ? 'base en ligne : redémarre le serveur' : game.file}) · +${mats} de chaque matériau.`);
  }
} finally { await accounts.close?.(); if(db) await db.close(); }
