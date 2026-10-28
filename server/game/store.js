/* Stockage du jeu : inventaires, fours, concasseur, stuff, préférences, progression (XP), skills et sessions de jeu, rangés par ID de compte.
   Même principe que server/accounts/store.js : petite interface asynchrone, en mémoire pour les tests,
   fichier JSON (data/game.json) écrit de façon atomique en local, PostgreSQL en ligne (une ligne par objet).

   Groupe (lobby) : { code, leader, members:[{account, name, graceUntil}], invites:[…], createdAt } (sans les signes de vie).
   Session de jeu : { id, mode ('mine' | 'mi' = mine instantanée), seed, players:[{account, name}],
                      bots, prefs, overrides, dev, speed, startedAt, finishAt,
                      leaves:[{account, tick, at}], status:'running'|'settling'|'done', result, seen:[compte], endedAt }
   Inscription à la mine instantanée (server/instant/) : { account, name, at }, par compte.
   Jugement (ns judgment, clé 'state') : jauges Ange / Démon communes à tous (src/meta/judgment.js).
   Bloc géant (server/giant/service.js) : ns giant_day, clé = jour (« 2026-10-26 ») : { day, total, scores:{ compte:
   { points, visits, name } } } ; ns giant_player, clé = compte : { lastEntry, visit:{ day, startedAt, endsAt, points,
   name } | null, claimed:[jour] }. Une entrée et une fin de visite écrivent le jour et le joueur ensemble ; une
   récompense écrit l'inventaire et le joueur ensemble.
   Stats de session (ns session_stat, clé 'session:compte') : une ligne par joueur et par mine classique terminée, gardée
   sans limite (les sessions, elles, sont effacées après 30 jours) ; lue par le tableau de bord (server/admin/dashboard.js).
   Record de tour (ns tower_record, clé = compte, 27/10/2026) : meilleur temps de victoire dans une tour céleste,
   { t, at, side, team, session } (src/meta/leaderboard.js) ; gardé sans limite. Lu par les classements (onglet Social).
   Chat global (ns chat_global, clé 'state', 28/10/2026) : { next, msgs:[{ id, at, account, name, text }] }, les CHAT.keep
   derniers messages, gardés pour survivre aux redémarrages (server/social/service.js). */
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
  const spells = new Map(Object.entries(initial.spells ?? {}));       // { learned, slots, ops } (src/meta/spells.js)
  const sets = new Map(Object.entries(initial.sets ?? {}));           // { list, nextId, ops } (src/meta/sets.js)
  const shrines = new Map(Object.entries(initial.shrines ?? {}));     // shrines d'un chef (src/meta/shrines.js, 28/10)
  const sessions = new Map(Object.entries(initial.sessions ?? {}));
  const parties = new Map(Object.entries(initial.parties ?? {}));     // groupes (server/party/service.js), par code
  const signups = new Map(Object.entries(initial.signups ?? {}));     // inscrits à la mine instantanée, par compte
  const socials = new Map(Object.entries(initial.socials ?? {}));     // amis et demandes (server/social/service.js)
  const discovered = new Map(Object.entries(initial.discovered ?? {}));   // wiki : objets secrets déjà trouvés (WIKI.secret)
  const judgments = new Map(Object.entries(initial.judgments ?? {}));  // jauges de l'onglet Jugement (src/meta/judgment.js), clé 'state'
  const sessionStats = new Map(Object.entries(initial.sessionStats ?? {}));   // tableau de bord : 'session:compte' → ligne
  const giantDays = new Map(Object.entries(initial.giantDays ?? {}));       // Bloc géant : scores du jour, par jour
  const giantPlayers = new Map(Object.entries(initial.giantPlayers ?? {})); // Bloc géant : délai, visite en cours, récompenses prises
  const towerRecords = new Map(Object.entries(initial.towerRecords ?? {})); // classements : meilleur temps de tour, par compte
  const chats = new Map(Object.entries(initial.chats ?? {}));         // chat global du lobby, clé 'state'
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
    async listStuff(){ return [...stuff.entries()].map(([account, st]) => ({ account, value: copy(st) })); },        // classements
    async putInventoryAndStuff(accountId, inv, st){
      inventories.set(accountId, copy(inv)); stuff.set(accountId, copy(st));
      await store.changed([{ ns: 'inventory', key: accountId, value: inv }, { ns: 'stuff', key: accountId, value: st }]);
    },

    async getProgress(accountId){ return copy(progress.get(accountId)) ?? null; },
    async listProgress(){ return [...progress.entries()].map(([account, p]) => ({ account, value: copy(p) })); },   // classements
    async putProgress(accountId, p){ progress.set(accountId, copy(p)); await store.changed([{ ns: 'progress', key: accountId, value: p }]); },

    /* skills : à part de la progression (un versement d'XP en fin de session n'écrase jamais un point dépensé) */
    async getSkills(accountId){ return copy(skills.get(accountId)) ?? null; },
    async putSkills(accountId, s){ skills.set(accountId, copy(s)); await store.changed([{ ns: 'skills', key: accountId, value: s }]); },

    /* sorts : un parchemin appris passe de l'inventaire aux sorts, en une seule écriture (comme les fours) */
    async getSpells(accountId){ return copy(spells.get(accountId)) ?? null; },
    async putSpells(accountId, s){ spells.set(accountId, copy(s)); await store.changed([{ ns: 'spells', key: accountId, value: s }]); },
    /* sets : la liste seule, ou un set équipé (inventaire, stuff, skills, sorts et sets en une seule écriture : une pièce
       passe de l'inventaire au stuff, un arrêt entre deux écritures la dupliquerait ou la perdrait) */
    async getSets(accountId){ return copy(sets.get(accountId)) ?? null; },
    /* shrines (28/10) : l'état d'un chef ; un don écrit en une fois l'inventaire du donneur et les shrines du chef */
    async getShrines(accountId){ return copy(shrines.get(accountId)) ?? null; },
    async putShrines(accountId, v){ shrines.set(accountId, copy(v)); await store.changed([{ ns: 'shrine', key: accountId, value: v }]); },
    async putShrinesAndInventory(leaderId, v, giverId, inv){
      shrines.set(leaderId, copy(v)); inventories.set(giverId, copy(inv));
      await store.changed([{ ns: 'shrine', key: leaderId, value: v }, { ns: 'inventory', key: giverId, value: inv }]);
    },
    async putSets(accountId, s){ sets.set(accountId, copy(s)); await store.changed([{ ns: 'sets', key: accountId, value: s }]); },
    async putLoadout(accountId, { inventory, stuff: st, skills: sk, spells: sp, sets: se }){
      inventories.set(accountId, copy(inventory)); stuff.set(accountId, copy(st)); skills.set(accountId, copy(sk));
      spells.set(accountId, copy(sp)); sets.set(accountId, copy(se));
      await store.changed([{ ns: 'inventory', key: accountId, value: inventory }, { ns: 'stuff', key: accountId, value: st },
                           { ns: 'skills', key: accountId, value: sk }, { ns: 'spells', key: accountId, value: sp },
                           { ns: 'sets', key: accountId, value: se }]);
    },
    async putInventoryAndSkills(accountId, inv, s){                     // glyphes (src/meta/glyphs.js)
      inventories.set(accountId, copy(inv)); skills.set(accountId, copy(s));
      await store.changed([{ ns: 'inventory', key: accountId, value: inv }, { ns: 'skills', key: accountId, value: s }]);
    },
    async putInventoryAndSpells(accountId, inv, s){
      inventories.set(accountId, copy(inv)); spells.set(accountId, copy(s));
      await store.changed([{ ns: 'inventory', key: accountId, value: inv }, { ns: 'spells', key: accountId, value: s }]);
    },

    async getPrefs(accountId){ return copy(prefs.get(accountId)) ?? null; },
    async putPrefs(accountId, p){ prefs.set(accountId, copy(p)); await store.changed([{ ns: 'prefs', key: accountId, value: p }]); },

    async getGameSession(id){ return copy(sessions.get(id)) ?? null; },
    /* lancement d'une instance (27/10) : la session et les inventaires (clés consommées) en une seule écriture : jamais
       une clé perdue sans session, ni une session sans clé ; entries = [[accountId, inv]…] */
    async putGameSessionAndInventories(rec, entries){
      sessions.set(rec.id, copy(rec));
      for(const [id, inv] of entries) inventories.set(id, copy(inv));
      await store.changed([{ ns: 'game_session', key: rec.id, value: rec }, ...entries.map(([id, inv]) => ({ ns: 'inventory', key: id, value: inv }))]);
    },
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

    /* chat global (lobby) : un seul salon commun à tous les joueurs */
    async getGlobalChat(){ return copy(chats.get('state')) ?? null; },
    async putGlobalChat(c){ chats.set('state', copy(c)); await store.changed([{ ns: 'chat_global', key: 'state', value: c }]); },

    /* tableau de bord : lignes de stats ; une ligne déjà écrite n'est jamais remplacée (fin de session rejouée) */
    async putSessionStats(rows){
      const fresh = rows.filter(r => !sessionStats.has(r.key));
      for(const r of fresh) sessionStats.set(r.key, copy(r.value));
      if(fresh.length) await store.changed(fresh.map(r => ({ ns: 'session_stat', key: r.key, value: r.value })));
      return fresh.length;
    },
    async allSessionStats(){ return [...sessionStats.values()].map(copy); },

    /* Bloc géant */
    async getGiantDay(day){ return copy(giantDays.get(day)) ?? null; },
    async listGiantDays(){ return [...giantDays.values()].map(copy); },
    async getGiantPlayer(accountId){ return copy(giantPlayers.get(accountId)) ?? null; },
    async listGiantPlayers(){ return [...giantPlayers.entries()].map(([account, p]) => ({ account, ...copy(p) })); },
    async putGiantPlayer(accountId, p){ giantPlayers.set(accountId, copy(p)); await store.changed([{ ns: 'giant_player', key: accountId, value: p }]); },
    /* entrée, fin de visite : le jour et le joueur en une seule écriture (jamais une visite comptée deux fois) */
    async putGiantDayAndPlayer(d, accountId, p){
      giantDays.set(d.day, copy(d)); giantPlayers.set(accountId, copy(p));
      await store.changed([{ ns: 'giant_day', key: d.day, value: d }, { ns: 'giant_player', key: accountId, value: p }]);
    },
    /* récompense : l'inventaire et le joueur (jours déjà réclamés) en une seule écriture */
    async putInventoryAndGiantPlayer(accountId, inv, p){
      inventories.set(accountId, copy(inv)); giantPlayers.set(accountId, copy(p));
      await store.changed([{ ns: 'inventory', key: accountId, value: inv }, { ns: 'giant_player', key: accountId, value: p }]);
    },

    /* classements : meilleur temps de tour par compte ; entries [[compte, record]…] écrits ensemble */
    async getTowerRecord(accountId){ return copy(towerRecords.get(accountId)) ?? null; },
    async listTowerRecords(){ return [...towerRecords.entries()].map(([account, r]) => ({ account, value: copy(r) })); },
    async putTowerRecords(entries){
      for(const [id, r] of entries) towerRecords.set(id, copy(r));
      if(entries.length) await store.changed(entries.map(([id, r]) => ({ ns: 'tower_record', key: id, value: r })));
    },

    /* wiki : objets secrets trouvés en jeu (WIKI.secret) ; clé = nom de l'objet, valeur = { at } (premier trouvé) */
    async listDiscovered(){ return [...discovered.keys()]; },
    /* renvoie true si c'est la première fois (annonce Discord d'un BP, 27/10), false si l'objet était déjà trouvé */
    async putDiscovered(item, v){ if(discovered.has(item)) return false; discovered.set(item, copy(v)); await store.changed([{ ns: 'discovered', key: item, value: v }]); return true; },

    /* changements [{ ns, key, value (null = supprimé) }] : voir server/accounts/store.js */
    async changed(changes){},
    async close(){},
    snapshot(){ return { version: 1, inventories: Object.fromEntries(inventories), furnaces: Object.fromEntries(furnaces),
                         crushers: Object.fromEntries(crushers),
                         stuff: Object.fromEntries(stuff), progress: Object.fromEntries(progress), skills: Object.fromEntries(skills),
                         spells: Object.fromEntries(spells), sets: Object.fromEntries(sets), shrines: Object.fromEntries(shrines),
                         prefs: Object.fromEntries(prefs),
                         sessions: Object.fromEntries(sessions), parties: Object.fromEntries(parties),
                         signups: Object.fromEntries(signups), socials: Object.fromEntries(socials),
                         judgments: Object.fromEntries(judgments), discovered: Object.fromEntries(discovered),
                         giantDays: Object.fromEntries(giantDays), giantPlayers: Object.fromEntries(giantPlayers), sessionStats: Object.fromEntries(sessionStats),
                         towerRecords: Object.fromEntries(towerRecords), chats: Object.fromEntries(chats) }; },
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
  const rows = await db.load(['inventory', 'furnace', 'crusher', 'stuff', 'prefs', 'progress', 'skills', 'spells', 'sets', 'game_session', 'party', 'mi_signup', 'social', 'judgment', 'giant_day', 'giant_player', 'discovered', 'session_stat', 'tower_record', 'shrine', 'chat_global']);
  const store = createMemoryGameStore({ inventories: rows.inventory, furnaces: rows.furnace, crushers: rows.crusher, stuff: rows.stuff, prefs: rows.prefs,
                                        progress: rows.progress, skills: rows.skills, spells: rows.spells, sets: rows.sets,
                                        sessions: rows.game_session, parties: rows.party, signups: rows.mi_signup, socials: rows.social,
                                        judgments: rows.judgment, giantDays: rows.giant_day, giantPlayers: rows.giant_player, discovered: rows.discovered, sessionStats: rows.session_stat,
                                        towerRecords: rows.tower_record, shrines: rows.shrine, chats: rows.chat_global });
  store.changed = changes => db.write(changes);
  store.close = () => db.flush();
  store.file = 'PostgreSQL';
  return store;
}
