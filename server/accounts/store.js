/* Stockage des comptes et des connexions.
   Interface volontairement petite et asynchrone. Les données sont gardées en mémoire (un seul serveur) et chaque
   modification est enregistrée : dans un fichier JSON (data/accounts.json, en local) ou dans PostgreSQL (en ligne,
   server/db/postgres.js), une ligne par compte et par connexion.

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
      await store.changed([{ ns: 'account', key: acc.id, value: acc }]);
    },
    async updateAccount(acc){
      const old = accounts.get(acc.id);
      if(!old) throw new Error(`compte inconnu : ${acc.id}`);
      checkFree(acc);
      if(old.nameKey && old.nameKey !== acc.nameKey) byName.delete(old.nameKey);
      accounts.set(acc.id, copy(acc));
      if(acc.nameKey) byName.set(acc.nameKey, acc.id);
      await store.changed([{ ns: 'account', key: acc.id, value: acc }]);
    },
    async countAccounts(){ return accounts.size; },

    async getSession(hash){ return copy(sessions.get(hash)) ?? null; },
    async putSession(hash, s){ sessions.set(hash, copy(s)); await store.changed([{ ns: 'session', key: hash, value: s }]); },
    async deleteSession(hash){ if(sessions.delete(hash)) await store.changed([{ ns: 'session', key: hash, value: null }]); },
    async deleteSessionsOf(accountId){
      const gone = [];
      for(const [h, s] of sessions) if(s.accountId === accountId){ sessions.delete(h); gone.push({ ns: 'session', key: h, value: null }); }
      if(gone.length) await store.changed(gone);
      return gone.length;
    },
    async purgeExpired(now){
      const gone = [];
      for(const [h, s] of sessions) if(s.expiresAt <= now){ sessions.delete(h); gone.push({ ns: 'session', key: h, value: null }); }
      if(gone.length) await store.changed(gone);
      return gone.length;
    },

    /* appelé après chaque modification avec la liste des changements [{ ns, key, value (null = supprimé) }] :
       le stockage fichier réécrit tout le fichier, PostgreSQL n'écrit que ces lignes */
    async changed(changes){},
    async close(){},
    snapshot(){ return { version: 1, accounts: Object.fromEntries(accounts), sessions: Object.fromEntries(sessions) }; },
  };
  return store;
}

/* Stockage dans PostgreSQL (en ligne : rien n'est perdu au redéploiement ni à la mise en veille).
   db : base ouverte par server/db/postgres.js, partagée avec le stockage du jeu. */
export async function createPgStore(db){
  const rows = await db.load(['account', 'session']);
  const store = createMemoryStore({ accounts: rows.account, sessions: rows.session });
  store.changed = changes => db.write(changes);
  store.close = () => db.flush();
  store.file = 'PostgreSQL';
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
