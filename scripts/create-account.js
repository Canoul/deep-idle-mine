/* Outil d'administration : crée un compte (pseudo + mot de passe) directement dans la base en ligne, avec un niveau
   de départ (pour tester). Contourne la liste des pseudos réservés (ex. « admin ») : réservé au créateur du jeu.

     $env:DATABASE_URL="postgres://…"; node scripts/create-account.js --name admin --password … --level 72
     $env:DATABASE_URL="postgres://…"; node scripts/create-account.js --check --name admin --password …

   --check : ne change rien, dit ce que la base contient pour ce pseudo (compte, mot de passe, niveau).
   Le serveur en ligne charge la base au démarrage : redémarre-le (Render, « Restart service ») pour qu'il voie le
   compte. Le code de secours est affiché une seule fois. */
import { ACCOUNT } from '../src/config.js';
import { cleanName, nameKey, checkPassword, formatCode, formatAccountId } from '../src/shared/account.js';
import { xpForLevel, levelOf, sanitizeProgress } from '../src/meta/level.js';
import { randomCode, hashSecret, verifySecret } from '../server/accounts/secrets.js';
import { SCRYPT } from '../server/config.js';
import { openDatabase } from '../server/db/postgres.js';

const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
const check = process.argv.includes('--check');
const name = cleanName(arg('name') ?? ''), password = arg('password') ?? '', level = +(arg('level') ?? 1);
const stop = msg => { console.error(msg); process.exitCode = 1; return null; };
const url = process.env.DATABASE_URL;

/* ce que la base contient pour ce pseudo */
async function inspect(db){
  const { account, progress } = await db.load(['account', 'progress']);
  const found = Object.values(account).filter(a => a.nameKey === nameKey(name));
  console.log(`Base : ${url.replace(/\/\/[^@]*@/, '//…@')} · ${Object.keys(account).length} comptes`);
  if(!found.length) return stop(`Aucun compte « ${name} » dans cette base.`);
  for(const a of found){
    const lv = levelOf(sanitizeProgress(progress[a.id]).xp);
    const pw = password ? (await verifySecret(password, a.passHash) ? 'bon' : 'NE CORRESPOND PAS') : '(non testé)';
    console.log(`Compte « ${a.name} » · ID ${formatAccountId(a.id)} · invité : ${a.guest} · mot de passe : ${pw} · niveau ${lv.level}`);
  }
  return found;
}

async function create(db){
  const { account } = await db.load(['account']);
  if(Object.values(account).some(a => a.nameKey === nameKey(name))) return stop(`Le pseudo « ${name} » existe déjà (--check pour le voir).`);
  let id; do id = randomCode(ACCOUNT.idLength); while(account[id]);
  const recovery = randomCode(ACCOUNT.recoveryLength), now = Date.now();
  const acc = { id, createdAt: now, lastLoginAt: now, name, nameKey: nameKey(name), guest: false,
                passHash: await hashSecret(password, SCRYPT), recoveryHash: await hashSecret(recovery, SCRYPT) };
  await db.write([{ ns: 'account', key: id, value: acc }, { ns: 'progress', key: id, value: { xp: xpForLevel(level), credited: [] } }]);
  /* une écriture abandonnée ne lève pas d'erreur (voir postgres.js) : on relit avant d'annoncer quoi que ce soit */
  const found = await inspect(db);
  if(!found?.some(a => a.id === id)) return stop('ÉCHEC : le compte n\'a pas été enregistré dans la base.');
  console.log(`Code de secours (affiché une seule fois) : ${formatCode(recovery)}`);
  console.log('Redémarre le serveur sur Render pour qu\'il charge le compte.');
}

if(!url) stop('DATABASE_URL manquant (adresse de la base Neon).');
else if(name.length < ACCOUNT.nameMin) stop('Pseudo manquant ou trop court (--name).');
else if(!check && checkPassword(password, name)) stop(checkPassword(password, name));
else if(!check && (!Number.isSafeInteger(level) || level < 1)) stop('Niveau invalide (--level).');
/* le serveur n'accepte qu'une XP entière « sûre » (sinon il la remet à 0) : la courbe ×1,5 plafonne vers le niveau 72 */
else if(!check && (!Number.isSafeInteger(xpForLevel(level)) || levelOf(xpForLevel(level)).level !== level))
  stop(`Niveau ${level} impossible à stocker (XP trop grande) : prends un niveau plus bas.`);
else {
  const db = await openDatabase(url, { retries: [1e3, 2e3] });
  try { await (check ? inspect(db) : create(db)); } finally { await db.close(); }
}
