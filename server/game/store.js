/* Stockage du jeu : inventaires, fours, concasseur, stuff, préférences, progression (XP), skills et sessions de jeu, rangés par ID de compte.
   Même principe que server/accounts/store.js : petite interface asynchrone, en mémoire pour les tests,
   fichier JSON (data/game.json) écrit de façon atomique en local, PostgreSQL en ligne (une ligne par objet).

   Groupe (lobby) : { code, leader, members:[{account, name, graceUntil}], invites:[…], createdAt } (sans les signes de vie).
   Session de jeu : { id, mode ('mine' | 'mi' = mine instantanée), seed, players:[{account, name}],
                      bots, prefs, overrides, dev, speed, startedAt, finishAt,
                      leaves:[{account, tick, at}], status:'running'|'settling'|'done', result, seen:[compte], endedAt }
   Inscription à la mine instantanée (server/instant/) : { account, name, at }, par compte.
   Jugement (ns judgment, clé 'state') : jauges Ange / Démon communes à tous (src/meta/judgment.js). */
import fs from 'node:fs/promises';
import path from 'node:path';

export function createMemoryGameStore(initial = {}){
  const inventories = new Map(Object.entries(initial.inventories ?? {}));
  const prefs = new Map(Object.entries(initial.prefs ?? {}));
  const furnaces = new Map(Object.entries(initial.furnaces ?? {}));
  const crushers = new Map(Object.entries(initial.crushers ?? {}));   // concasseur (src/meta/crusher.js)
  const stuff = new Map(Object.entries(initial.stuff ?? {}));
  const progress = new Map(Object.entries(initial.progress ?? {}));   // { xp, credited } (src/meta/level.js)
  const skills = new Map(Object.entries(initial.skills ?? {}));       // { tree, ranks, ops } (src/meta/skills.js)
  const sessions = new Map(Object.entries(initial.sessions ?? {}));
  const parties = new Map(Object.entries(initial.parties ?? {}));     // groupes (server/party/service.js), par code
  const signups = new Map(Object.entries(initial.signups ?? {}));     // inscrits à la mine instantanée, par compte
  const socials = new Map(Object.entries(initial.socials ?? {}));     // amis et demandes (server/social/service.js)
  const judgments = new Map(Object.entries(initial.judgments ?? {}));  // jauges de l'onglet Jugement (src/meta/judgment.js), clé 'state'
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

    /* concasseur : même principe que les fours (des blocs y entrent, du butin en sort) */
    async getCrusher(accountId){ return copy(crushers.get(accountId)) ?? null; },
    async putInventoryAndCrusher(accountId, inv, c){
      inventories.set(accountId, copy(inv)); crushers.set(accountId, copy(c));
      await store.changed([{ ns: 'inventory', key: accountId, value: inv }, { ns: 'crusher', key: accountId, value: c }]);
    },

    /* stuff (pièces portées) : même principe que les fours, une pièce passe de l'inventaire au stuff et inversement */
    async getStuff(accountId){ return copy(stuff.get(accountId)) ?? null; },
    async putInventoryAndStuff(accountId, inv, st){
      inventories.set(accountId, copy(inv)); stuff.set(accountId, copy(st));
      await store.changed([{ ns: 'inventory', key: accountId, value: inv }, { ns: 'stuff', key: accountId, value: st }]);
    },

    async getProgress(accountId){ return copy(progress.get(accountId)) ?? null; },
    async putProgress(accountId, p){ progress.set(accountId, copy(p)); await store.changed([{ ns: 'progress', key: accountId, value: p }]); },

    /* skills : à part de la progression (un versement d'XP en fin de session n'écrase jamais un point dépensé) */
    async getSkills(accountId){ return copy(skills.get(accountId)) ?? null; },
    async putSkills(accountId, s){ skills.set(accountId, copy(s)); await store.changed([{ ns: 'skills', key: accountId, value: s }]); },

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

    /* amis : une demande touche deux comptes, écrits en une seule fois ; entries = [[accountId, social]…] */
    async getSocial(accountId){ return copy(socials.get(accountId)) ?? null; },
    async putSocial(entries){
      for(const [id, s] of entries) socials.set(id, copy(s));
      await store.changed(entries.map(([id, s]) => ({ ns: 'social', key: id, value: s })));
    },

    /* groupes : gardés pour survivre à un redémarrage du serveur (mise à jour automatique) */
    async getParties(){ return [...parties.values()].map(copy); },
    async putParty(code, p){ parties.set(code, copy(p)); await store.changed([{ ns: 'party', key: code, value: p }]); },
    async deleteParty(code){ if(parties.delete(code)) await store.changed([{ ns: 'party', key: code, value: null }]); },

    /* inscriptions à la mine instantanée : gardées pour survivre à un redémarrage du serveur */
    async getInstantSignups(){ return [...signups.values()].map(copy); },
    async putInstantSignup(account, v){ signups.set(account, copy(v)); await store.changed([{ ns: 'mi_signup', key: account, value: v }]); },
    async deleteInstantSignup(account){ if(signups.delete(account)) await store.changed([{ ns: 'mi_signup', key: account, value: null }]); },

    /* Jugement (Ange vs Démon) : un seul état commun à tous les joueurs */
    async getJudgment(){ return copy(judgments.get('state')) ?? null; },
    async putJudgment(j){ judgments.set('state', copy(j)); await store.changed([{ ns: 'judgment', key: 'state', value: j }]); },

    /* changements [{ ns, key, value (null = supprimé) }] : voir server/accounts/store.js */
    async changed(changes){},
    async close(){},
    snapshot(){ return { version: 1, inventories: Object.fromEntries(inventories), furnaces: Object.fromEntries(furnaces),
                         crushers: Object.fromEntries(crushers),
                         stuff: Object.fromEntries(stuff), progress: Object.fromEntries(progress), skills: Object.fromEntries(skills),
                         prefs: Object.fromEntries(prefs),
                         sessions: Object.fromEntries(sessions), parties: Object.fromEntries(parties),
                         signups: Object.fromEntries(signups), socials: Object.fromEntries(socials),
                         judgments: Object.fromEntries(judgments) }; },
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
  const rows = await db.load(['inventory', 'furnace', 'crusher', 'stuff', 'prefs', 'progress', 'skills', 'game_session', 'party', 'mi_signup', 'social', 'judgment']);
  const store = createMemoryGameStore({ inventories: rows.inventory, furnaces: rows.furnace, crushers: rows.crusher, stuff: rows.stuff, prefs: rows.prefs,
                                        progress: rows.progress, skills: rows.skills,
                                        sessions: rows.game_session, parties: rows.party, signups: rows.mi_signup, socials: rows.social,
                                        judgments: rows.judgment });
  store.changed = changes => db.write(changes);
  store.close = () => db.flush();
  store.file = 'PostgreSQL';
  return store;
}
