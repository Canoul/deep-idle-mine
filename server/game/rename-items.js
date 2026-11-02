/* Renommage d'objets (01/11/2026, Geoffrey : les stores refusent les noms de marques ; 02/11, Jules : noms venus de
   League of Legends, vérification Google Play). Le nom d'un objet sert de clé partout (sac,
   pièces portées, sets, plans, wiki, sessions) : une pièce au nom inconnu serait écartée à la relecture. migrateItemNames passe donc
   au démarrage, AVANT tout service (server/main.js). Sans rien à faire, elle n'écrit rien : on peut la laisser en place.
   Une chaîne contient un ancien nom : il est remplacé (les plans « … BP » suivent). Le reste de la pièce ne bouge pas.
   Jamais touchés : signalements et journal (preuves), chat global (les mots des joueurs, effacés en 18 h). */
export const ITEM_RENAMES = { 'Lunettes Gucci': 'Lunettes de luxe', 'Doc Martins': 'Bottes de chantier',
  'Parchemin « Ulti shen »': 'Parchemin « Ralliement »', 'Glyphe Braum': 'Glyphe Garde du corps' };
const SKIP = ['report', 'mod_log', 'chat_global'];

const OLD = Object.keys(ITEM_RENAMES);
export const renameText = s => OLD.reduce((t, o) => t.includes(o) ? t.replaceAll(o, ITEM_RENAMES[o]) : t, s);
function renameDeep(v){
  if(typeof v === 'string') return renameText(v);
  if(Array.isArray(v)) return v.map(renameDeep);
  if(v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [renameText(k), renameDeep(x)]));
  return v;
}

/* combien d'anciens noms restent : { total, names: { nom: nombre }, ns: { sorte: lignes } } (ne change rien) */
export function countOldNames(store){
  const out = { total: 0, names: Object.fromEntries(OLD.map(n => [n, 0])), ns: {} };
  store.eachRow((ns, key, value) => {
    if(SKIP.includes(ns)) return;
    const json = JSON.stringify([key, value]);
    let hit = 0;
    for(const n of OLD){ const c = json.split(n).length - 1; out.names[n] += c; hit += c; }
    if(hit){ out.total += hit; out.ns[ns] = (out.ns[ns] ?? 0) + 1; }
  });
  return out;
}

/* renomme tout, en une seule écriture ; { rows : lignes changées, ns : par sorte } */
export async function migrateItemNames(store){
  const changes = store.rewrite(key => renameText(key), value => OLD.some(n => JSON.stringify(value).includes(n)) ? renameDeep(value) : value, SKIP);
  if(!changes.length) return { rows: 0, ns: {} };
  await store.changed(changes);
  const ns = {};
  for(const c of changes) if(c.value !== null) ns[c.ns] = (ns[c.ns] ?? 0) + 1;
  return { rows: Object.values(ns).reduce((a, b) => a + b, 0), ns };
}
