/* Stockage des comptes et des connexions.
   Interface volontairement petite et asynchrone : on pourra passer à une vraie base (SQLite intégré à Node,
   PostgreSQL…) en réécrivant seulement ce fichier.

   Compte : { id, name, nameKey, guest, passHash, recoveryHash, createdAt, lastLoginAt }
   Connexion (session) : indexée par l'empreinte du jeton → { accountId, createdAt, expiresAt, lastSeenAt } */
import fs from 'node:fs/promises';
import path from 'node:path';

export class ConflictError extends Error {
  constructor(field){ super(`${field} déjà utilisé`); this.field = field; }
}

/* Stockage en mémoire : pour les tests, et base du stockage fichier. */
export function createMemoryStore(initial = {}){
  const accounts = new Map(Object.entries(initial.accounts ?? {}));
  const sessions = new Map(Object.entries(initial.sessions ?? {}));
  const byName = new Map();
  for(const a of accounts.values()) if(a.nameKey) byName.set(a.nameKey, a.id);
  const copy = o => o && structuredClone(o);

  /* l'unicité (ID, pseudo) est vérifiée ici, sans attente entre le test et l'écriture :
     deux inscriptions simultanées au même pseudo ne peuvent pas passer toutes les deux */
  function checkFree(acc){
    if(acc.nameKey && byName.has(acc.nameKey) && byName.get(acc.nameKey) !== acc.id) throw new ConflictError('name');
  }

  const store = {
    async getAccount(id){ return copy(accounts.get(id)) ?? null; },
    async findAccountByName(key){ const id = byName.get(key); return id ? copy(accounts.get(id)) : null; },
    async insertAccount(acc){
      if(accounts.has(acc.id)) throw new ConflictError('id');
      checkFree(acc);
      accounts.set(acc.id, copy(acc));
      if(acc.nameKey) byName.set(acc.nameKey, acc.id);
      await store.changed();
    },
    async updateAccount(acc){
      const old = accounts.get(acc.id);
      if(!old) throw new Error(`compte inconnu : ${acc.id}`);
      checkFree(acc);
      if(old.nameKey && old.nameKey !== acc.nameKey) byName.delete(old.nameKey);
      accounts.set(acc.id, copy(acc));
      if(acc.nameKey) byName.set(acc.nameKey, acc.id);
      await store.changed();
    },
    async countAccounts(){ return accounts.size; },

    async getSession(hash){ return copy(sessions.get(hash)) ?? null; },
    async putSession(hash, s){ sessions.set(hash, copy(s)); await store.changed(); },
    async deleteSession(hash){ if(sessions.delete(hash)) await store.changed(); },
    async deleteSessionsOf(accountId){
      let n = 0;
      for(const [h, s] of sessions) if(s.accountId === accountId){ sessions.delete(h); n++; }
      if(n) await store.changed();
      return n;
    },
    async purgeExpired(now){
      let n = 0;
      for(const [h, s] of sessions) if(s.expiresAt <= now){ sessions.delete(h); n++; }
      if(n) await store.changed();
      return n;
    },

    /* appelé après chaque modification (le stockage fichier s'en sert pour écrire sur disque) */
    async changed(){},
    async close(){},
    snapshot(){ return { version: 1, accounts: Object.fromEntries(accounts), sessions: Object.fromEntries(sessions) }; },
  };
  return store;
}

/* Stockage dans un fichier JSON (data/accounts.json). Suffisant pour un prototype et quelques milliers de
   joueurs. Écriture atomique (fichier temporaire puis renommage) : un arrêt brutal ne corrompt pas le fichier. */
export async function createFileStore(dir){
  const file = path.join(dir, 'accounts.json');
  await fs.mkdir(dir, { recursive: true });
  let initial = {};
  try { initial = JSON.parse(await fs.readFile(file, 'utf8')); }
  catch(e){ if(e.code !== 'ENOENT') throw new Error(`Lecture impossible de ${file} : ${e.message}`); }

  const store = createMemoryStore(initial);
  let writing = Promise.resolve();
  /* les écritures sont mises en file : jamais deux en même temps sur le même fichier */
  store.changed = () => {
    const next = writing.catch(() => {}).then(async () => {   // un échec d'écriture ne bloque pas les suivantes
      const tmp = file + '.tmp';
      await fs.writeFile(tmp, JSON.stringify(store.snapshot()));
      await fs.rename(tmp, file);
    });
    writing = next;
    return next;
  };
  store.close = () => writing;
  store.file = file;
  return store;
}
