/* Outil du mode développeur (29/10/2026, Geoffrey) : importe l'historique d'un vrai joueur dans l'historique LOCAL
   (data/) d'un compte de test, pour que sa prison tire son contenu des mêmes 10 dernières mines (src/meta/prison-profile.js).

     node scripts/dev-history.js --from data/presets/history-canoul.json --name Test_Canoul

   --from : ce que le jeu en ligne renvoie au joueur sur /api/game/history ({ sessions: [...] }, récupéré depuis son
   navigateur) · --name : le compte local qui reçoit ces mines (il doit exister : npm run dev:presets).
   Seules les mines classiques où le joueur était là à la fin sont importées (ce que lit la prison) ; elles gardent leur
   date, leur area atteinte et sa part du butin (pas les kills par type : l'historique ne les donne pas). Réimporter le
   même fichier remplace les mêmes sessions (id « import:<id> »). Les mines de plus de 30 jours sont effacées par le
   serveur au démarrage, comme les autres.
   Le serveur garde tout en mémoire : ARRÊTE-LE avant, sinon il réécrit l'ancien état par-dessus. */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { nameKey } from '../src/shared/account.js';

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const cleanBag = b => Object.fromEntries(Object.entries(isObj(b) ? b : {}).filter(([k, n]) => typeof k === 'string' && Number.isSafeInteger(n) && n > 0));

/* sessions de l'historique → enregistrements de session terminés pour ce compte (pur, exporté pour les essais) */
export function importedSessions(history, account, name){
  const list = Array.isArray(history?.sessions) ? history.sessions : [];
  return list.filter(s => isObj(s) && (s.mode ?? 'mine') === 'mine' && !s.dev && !s.left && typeof s.id === 'string')
    .map(s => {
      const endedAt = Number.isFinite(s.endedAt) ? s.endedAt : Number.isFinite(s.startedAt) ? s.startedAt : Date.now();
      return { id: 'import:' + s.id, mode: 'mine', status: 'done', dev: false, imported: true, seed: Number.isSafeInteger(s.seed) ? s.seed : 0,
               players: [{ account, name }], leaves: [], focus: [], seen: [account],
               startedAt: Number.isFinite(s.startedAt) ? s.startedAt : endedAt, endedAt,
               result: { areasUnlocked: Number.isSafeInteger(s.areas) ? s.areas : 0, maxDepth: Number.isSafeInteger(s.depth) ? s.depth : 0,
                         shares: [{ account, left: false, bag: cleanBag(s.bag), xp: Number.isFinite(s.xp) ? s.xp : 0 }], miners: [] } };
    });
}

async function main(){
  if(process.env.DATABASE_URL) throw new Error('DATABASE_URL présent : ce script ne touche QUE les données locales (data/).');
  const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
  const from = arg('from'), name = arg('name');
  if(!from || !name) throw new Error('Usage : node scripts/dev-history.js --from <historique.json> --name <compte local>');
  const { SERVER } = await import('../server/config.js');
  const { createFileStore } = await import('../server/accounts/store.js');
  const { createFileGameStore } = await import('../server/game/store.js');
  const accounts = await createFileStore(SERVER.dataDir), game = await createFileGameStore(SERVER.dataDir);
  try {
    const acc = await accounts.findAccountByName(nameKey(name));
    if(!acc) throw new Error(`Compte local « ${name} » introuvable (crée-le avec npm run dev:presets).`);
    const recs = importedSessions(JSON.parse(fs.readFileSync(from, 'utf8')), acc.id, name);
    for(const r of recs) await game.putGameSession(r);
    console.log(`${recs.length} mine(s) classique(s) importée(s) dans l'historique de « ${name} ». Relance npm run dev.`);
  } finally { await game.close?.(); await accounts.close?.(); }
}

if(import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(e => { console.error(e.message); process.exitCode = 1; });
