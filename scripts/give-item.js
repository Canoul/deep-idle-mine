/* Outil d'administration : donne un objet du jeu à un joueur (ex. un Treasure T3). Réservé aux créateurs du jeu.

     node scripts/give-item.js --name crousti --item "Treasure T3" --qty 1          → en local (data/)
     sur le serveur OVH (base en ligne), avec les réglages du jeu :
       sudo systemctl stop deep-idle-mine
       cd /opt/deep-idle-mine && sudo node scripts/give-item.js --env /etc/deep-idle-mine.env --name crousti --item "Treasure T3"
       sudo systemctl start deep-idle-mine

   --name : pseudo du compte (majuscules et accents ignorés) · --item : nom exact d'un objet du jeu (ITEMS) ·
   --qty : 1 à 1000 (1 par défaut) · --env : fichier de réglages (KEY=valeur par ligne) d'où lire DATABASE_URL.
   Le serveur garde les inventaires en mémoire : ARRÊTE-LE avant et relance-le après, sinon il peut réécrire l'ancien
   inventaire par-dessus (le joueur perdrait le cadeau). */
import fs from 'node:fs';
import { ITEMS } from '../src/config.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const fail = msg => { console.error(msg); process.exit(1); };

/* réglages au format systemd (KEY=valeur, # commentaires) : seules les clés absentes de l'environnement sont prises */
function loadEnvFile(file){
  for(const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)){
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if(!m || line.trim().startsWith('#')) continue;
    const v = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    if(process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
/* demande valide ? null si oui, sinon le message d'erreur */
function checkGift(item, qty){
  if(typeof item !== 'string' || !Object.hasOwn(ITEMS, item)) return `« ${item} » n'est pas un objet du jeu (nom exact, majuscules comprises).`;
  if(!Number.isSafeInteger(qty) || qty < 1 || qty > 1000) return '--qty : un entier de 1 à 1000.';
  return null;
}

const name = arg('name'), item = arg('item'), qty = Number(arg('qty', '1')), envFile = arg('env');
if(!name) fail('--name : le pseudo du joueur.');
const bad = checkGift(item, qty); if(bad) fail(bad);
if(envFile) loadEnvFile(envFile);

/* chargés après --env : DATABASE_URL et DIM_DATA_DIR sont lus au chargement */
const { SERVER } = await import('../server/config.js');
const { createFileStore, createPgStore } = await import('../server/accounts/store.js');
const { createFileGameStore, createPgGameStore } = await import('../server/game/store.js');
const { openDatabase } = await import('../server/db/postgres.js');
const { nameKey } = await import('../src/shared/account.js');
const { createInventory, deserialize, serialize, addItem, countOf } = await import('../src/meta/inventory.js');
const { sanitizeStuff } = await import('../src/meta/stuff.js');

const db = process.env.DATABASE_URL ? await openDatabase(process.env.DATABASE_URL, { retries: [1e3, 2e3] }) : null;
const accounts = db ? await createPgStore(db) : await createFileStore(SERVER.dataDir);
const game = db ? await createPgGameStore(db) : await createFileGameStore(SERVER.dataDir);
try {
  const acc = await accounts.findAccountByName(nameKey(name));
  if(!acc){ console.error(`Aucun compte « ${name} » (${db ? 'base en ligne' : SERVER.dataDir}).`); process.exitCode = 1; }
  else {
    const raw = await game.getInventory(acc.id);
    const inv = raw ? deserialize(JSON.stringify(raw)) : createInventory();
    if(ITEMS[item].cat === 'stuff') sanitizeStuff(await game.getStuff(acc.id), inv);   // pièces : identifiants à la suite
    const before = countOf(inv, item);
    addItem(inv, item, qty);
    await game.putInventory(acc.id, JSON.parse(serialize(inv)));
    console.log(`+${qty} ${item} pour « ${acc.name} » (${before} → ${countOf(inv, item)}) · ${db ? 'base en ligne' : SERVER.dataDir}.`);
  }
} finally { await game.close?.(); await accounts.close?.(); if(db) await db.close(); }
