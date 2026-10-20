/* Stockage du jeu : inventaires, fours, préférences et sessions de jeu, rangés par ID de compte.
   Même principe que server/accounts/store.js : petite interface asynchrone, en mémoire pour les tests,
   fichier JSON (data/game.json) écrit de façon atomique en local, PostgreSQL en ligne (une ligne par objet).

   Session de jeu : { id, seed, players:[{account, name}], bots, prefs, overrides, dev, speed, startedAt, finishAt,
                      leaves:[{account, tick, at}], status:'running'|'settling'|'done', result, seen:[compte], endedAt } */
import fs from 'node:fs/promises';
import path from 'node:path';

export function createMemoryGameStore(initial = {}){
  const inventories = new Map(Object.entries(initial.inventories ?? {}));
  const prefs = new Map(Object.entries(initial.prefs ?? {}));
  const furnaces = new Map(Object.entries(initial.furnaces ?? {}));
  const sessions = new Map(Object.entries(initial.sessions ?? {}));
  const copy = o => o && structuredClone(o);

  const store = {
    async getInventory(accountId){ return copy(inventories.get(accountId)) ?? null; },
    async putInventory(accountId, inv){ inventories.set(accountId, copy(inv)); await store.changed([{ ns: 'inventory', key: accountId, value: inv }]); },

    /* fours : toujours écrits AVEC l'inventaire, en une seule écriture (des objets passent de l'un à l'autre :
       un arrêt entre deux écritures dupliquerait ou perdrait des objets) */
    async getFurnaces(accountId){ return copy(furnaces.get(accountId)) ?? null; },
    async putInventoryAndFurnaces(accountId, inv, f){
      inventories.set(accountId, copy(inv)); furnaces.set(accountId, copy(f));
      await store.changed([{ ns: 'inventory', key: accountId, value: inv }, { ns: 'furnace', key: accountId, value: f }]);
    },

    async getPrefs(accountId){ return copy(prefs.get(accountId)) ?? null; },
    async putPrefs(accountId, p){ prefs.set(accountId, copy(p)); await store.changed([{ ns: 'prefs', key: accountId, value: p }]); },

    async getGameSession(id){ return copy(sessions.get(id)) ?? null; },
    async putGameSession(rec){ sessions.set(rec.id, copy(rec)); await store.changed([{ ns: 'game_session', key: rec.id, value: rec }]); },
    /* sessions où ce compte joue, les plus récentes d'abord */
    async sessionsOf(accountId){
      return [...sessions.values()].filter(s => s.players.some(p => p.account === accountId))
        .sort((a, b) => b.startedAt - a.startedAt).map(copy);
    },
    async sessionsWithStatus(status){ return [...sessions.values()].filter(s => s.status === status).map(copy); },
    async deleteGameSession(id){ if(sessions.delete(id)) await store.changed([{ ns: 'game_session', key: id, value: null }]); },

    /* changements [{ ns, key, value (null = supprimé) }] : voir server/accounts/store.js */
    async changed(changes){},
    async close(){},
    snapshot(){ return { version: 1, inventories: Object.fromEntries(inventories), furnaces: Object.fromEntries(furnaces),
                         prefs: Object.fromEntries(prefs),
                         sessions: Object.fromEntries(sessions) }; },
  };
  return store;
}

export async function createFileGameStore(dir){
  const file = path.join(dir, 'game.json');
  await fs.mkdir(dir, { recursive: true });
  let initial = {};
  try { initial = JSON.parse(await fs.readFile(file, 'utf8')); }
  catch(e){ if(e.code !== 'ENOENT') throw new Error(`Lecture impossible de ${file} : ${e.message}`); }

  const store = createMemoryGameStore(initial);
  let writing = Promise.resolve();
  store.changed = () => {
    const next = writing.catch(() => {}).then(async () => {
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

/* PostgreSQL (en ligne) : db ouverte par server/db/postgres.js, partagée avec les comptes */
export async function createPgGameStore(db){
  const rows = await db.load(['inventory', 'furnace', 'prefs', 'game_session']);
  const store = createMemoryGameStore({ inventories: rows.inventory, furnaces: rows.furnace, prefs: rows.prefs,
                                        sessions: rows.game_session });
  store.changed = changes => db.write(changes);
  store.close = () => db.flush();
  store.file = 'PostgreSQL';
  return store;
}
