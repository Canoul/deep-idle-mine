/* Stockage du jeu : inventaires, fours, concasseur, stuff, préférences, progression (XP), skills et sessions de jeu, rangés par ID de compte.
   Même principe que server/accounts/store.js : petite interface asynchrone, en mémoire pour les tests,
   fichier JSON (data/game.json) écrit de façon atomique en local, PostgreSQL en ligne (une ligne par objet).

   Groupe (lobby) : { code, leader, members:[{account, name, graceUntil}], invites:[…], createdAt } (sans les signes de vie).
   Session de jeu : { id, mode ('mine' | 'mi' = mine instantanée), seed, players:[{account, name}],
                      bots, prefs, overrides, dev, speed, startedAt, finishAt,
                      leaves:[{account, tick, at}], status:'running'|'settling'|'done', result, seen:[compte], endedAt }
   Inscription à la mine instantanée (server/instant/) : { account, name, at }, par compte.
   Jugement (ns judgment, clé 'state') : jauges Ange / Démon communes à tous (src/meta/judgment.js).
   He's coming (01/11/2026) : ns hc_day et hc_player, mêmes fiches que le Bloc géant, séparées.
   Bloc géant (server/giant/service.js) : ns giant_day, clé = jour (« 2026-10-26 ») : { day, total, scores:{ compte:
   { points, visits, name } } } ; ns giant_player, clé = compte : { lastEntry, visit:{ day, startedAt, endsAt, points,
   name } | null, claimed:[jour] }. Une entrée et une fin de visite écrivent le jour et le joueur ensemble ; une
   récompense écrit l'inventaire et le joueur ensemble.
   Stats de session (ns session_stat, clé 'session:compte') : une ligne par joueur et par mine classique terminée, gardée
   sans limite (les sessions, elles, sont effacées après 30 jours) ; lue par le tableau de bord (server/admin/dashboard.js).
   Record de tour (ns tower_record, clé = compte, 27/10/2026) : meilleur temps de victoire dans une tour céleste,
   { t, at, side, team, session } (src/meta/leaderboard.js) ; gardé sans limite. Lu par les classements (onglet Social).
   Record d'instance (ns instance_record, clé = compte, 29/10/2026) : meilleur temps pour vaincre le roi gobelin,
   { t, fight, at, instance, team, session } (src/meta/leaderboard.js) ; gardé sans limite, lu par les classements.
   Énergie (ns energy, clé = compte, 29/10/2026) : { value, keys } (src/meta/energy.js) ; un lancement de mine classique
   en débite une fois (clé = id de session), écrit avec la session sous le verrou 'energy:compte'.
   Prison (ns prison, clé = compte, 29/10/2026) : la prison du joueur, en cours ou la dernière terminée (src/shared/prison.js) ;
   ses runs versés sont retenus par les clés « prison:<id>:<run> » de l'inventaire, de la progression et de l'énergie.
   Chat global (ns chat_global, clé 'state', 28/10/2026) : { next, msgs:[{ id, at, account, name, text, channel, to?, toName? }] }, les CHAT.keep
   derniers messages, gardés pour survivre aux redémarrages (server/social/service.js).
   Modération (ns moderation, clé = compte, 30/10/2026) : { warnings:[{ at, channel, motif, words, text, masked, with }],
   bans:[{ at, until, motif }], bannedUntil, countFrom, mutedUntil, suspended:{ at, until, reason } } (server/moderation/service.js).
   Signalements (ns report, clé = numéro, 01/11/2026) : voir server/moderation/reports.js. Journal des actions admin (ns mod_log, clé = numéro) :
   { id, at, by, action, target, detail } ; jamais effacés. */
import fs from 'node:fs/promises';
import path from 'node:path';

/* toutes les sortes de données du jeu (chargées au démarrage) */
export const GAME_NS = ['inventory', 'furnace', 'crusher', 'stuff', 'prefs', 'progress', 'skills', 'spells', 'sets', 'game_session', 'party', 'always_ready', 'mi_signup', 'social', 'judgment', 'giant_day', 'giant_player', 'hc_day', 'hc_player', 'discovered', 'session_stat', 'tower_record', 'instance_record', 'shrine', 'energy', 'prison', 'prison_compo', 'chat_global', 'chat_prefs', 'moderation', 'report', 'mod_log', 'raffle', 'guilds', 'guild_log', 'app_latest', 'daily'];
/* Suppression d'un compte (01/11/2026, server/accounts/erase.js) : toute nouvelle sorte de données doit dire ici ce qu'elle devient
   (tests/account-delete.test.js échoue sinon).
   ACCOUNT_NS : une ligne par compte, effacée (clé = compte, ou « compte#niveau » pour les records). SHARED_NS : données communes,
   nettoyées (identifiant et pseudo retirés). KEPT_NS : gardées exprès (signalements, journal). FREE_NS : aucun compte dedans. */
export const ACCOUNT_NS = ['inventory', 'furnace', 'crusher', 'stuff', 'prefs', 'progress', 'skills', 'spells', 'sets', 'shrine', 'always_ready', 'mi_signup',
                           'giant_player', 'hc_player', 'tower_record', 'instance_record', 'energy', 'prison', 'prison_compo', 'chat_prefs'];
export const SHARED_NS = ['social', 'moderation', 'game_session', 'party', 'giant_day', 'hc_day', 'session_stat', 'judgment', 'guilds', 'guild_log', 'chat_global', 'raffle'];
export const KEPT_NS = ['report', 'mod_log'];
export const FREE_NS = ['discovered', 'app_latest', 'daily'];   // daily : événement du jour (05/11)
export const DELETED_NAME = 'Joueur supprimé';

/* copie de v où ce compte n'apparaît plus : son identifiant devient anon (valeurs et clés, y compris « compte#2 » et « session:compte »),
   son pseudo devient DELETED_NAME, seulement là où un pseudo est rangé : jamais dans les objets (un joueur peut s'appeler Charbon) */
const NAME_FIELDS = new Set(['name', 'toName', 'byName', 'targetName', 'from']);
export function scrub(v, who, field = null){
  const id = s => s.includes(who.id) ? s.replaceAll(who.id, who.anon) : s;
  if(typeof v === 'string') return (NAME_FIELDS.has(field) || field === 'team') && who.names.includes(v) ? DELETED_NAME : id(v);
  if(Array.isArray(v)) return v.map(x => scrub(x, who, field));
  if(v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [id(k), scrub(x, who, k)]));
  return v;
}

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
  const discovered = new Map(Object.entries(initial.discovered ?? {}));
  const appLatest = new Map(Object.entries(initial.appLatest ?? {}));   // dernière appli sur les stores, clé 'state' (04/11, server/app-update/latest.js)   // wiki : objets secrets déjà trouvés (WIKI.secret)
  const judgments = new Map(Object.entries(initial.judgments ?? {}));  // jauges de l'onglet Jugement (src/meta/judgment.js), clé 'state'
  const sessionStats = new Map(Object.entries(initial.sessionStats ?? {}));   // tableau de bord : 'session:compte' → ligne
  const giantDays = new Map(Object.entries(initial.giantDays ?? {}));       // Bloc géant : scores du jour, par jour
  const giantPlayers = new Map(Object.entries(initial.giantPlayers ?? {})); // Bloc géant : délai, visite en cours, récompenses prises
  const hcDays = new Map(Object.entries(initial.hcDays ?? {}));             // He's coming : les mêmes
  const hcPlayers = new Map(Object.entries(initial.hcPlayers ?? {}));
  const towerRecords = new Map(Object.entries(initial.towerRecords ?? {})); // classements : meilleur temps de tour, par compte
  const instanceRecords = new Map(Object.entries(initial.instanceRecords ?? {})); // classements : meilleur temps contre le roi gobelin, par compte
  const energies = new Map(Object.entries(initial.energies ?? {}));   // énergie du compte (src/meta/energy.js)
  const prisons = new Map(Object.entries(initial.prisons ?? {}));
  const prisonCompos = new Map(Object.entries(initial.prisonCompos ?? {}));   // compos de prison du compte : { cur, prev, saved } (30/10)     // prison du compte (src/shared/prison.js)
  const chats = new Map(Object.entries(initial.chats ?? {}));
  const raffles = new Map(Object.entries(initial.raffles ?? {}));
  const dailies = new Map(Object.entries(initial.dailies ?? {}));   // événement du jour (05/11/2026), clé 'state'
  const guilds = new Map(Object.entries(initial.guilds ?? {}));
  const guildLogs = new Map(Object.entries(initial.guildLogs ?? {}));   // journal des bâtiments, jamais effacé : 'guilde:page' → lignes
  const alwaysReady = new Map(Object.entries(initial.alwaysReady ?? {}));   // comptes qui ont coché « Prêt tout le temps »
  const chatPrefs = new Map(Object.entries(initial.chatPrefs ?? {}));   // réglages du chat par compte (31/10/2026)
  const reports = new Map(Object.entries(initial.reports ?? {}));
  const modLogs = new Map(Object.entries(initial.modLogs ?? {}));
  const moderations = new Map(Object.entries(initial.moderations ?? {}));   // modération du chat, par compte (server/moderation/, 30/10)         // chat global du lobby, clé 'state'
  const copy = o => o && structuredClone(o);
  const allMaps = () => ({ inventory: inventories, furnace: furnaces, crusher: crushers, stuff, prefs, progress, skills, spells, sets, game_session: sessions, party: parties,
                           always_ready: alwaysReady, mi_signup: signups, social: socials, judgment: judgments, giant_day: giantDays, giant_player: giantPlayers, hc_day: hcDays, hc_player: hcPlayers,
                           discovered, session_stat: sessionStats, tower_record: towerRecords, instance_record: instanceRecords, shrine: shrines, energy: energies, prison: prisons, prison_compo: prisonCompos,
                           chat_global: chats, chat_prefs: chatPrefs, moderation: moderations, report: reports, mod_log: modLogs, raffle: raffles, guilds, guild_log: guildLogs, app_latest: appLatest, daily: dailies });

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
    /* sessions où ce compte joue, les plus récentes d'abord ; keep : tri fait avant la copie (04/11/2026 : copier tout
       l'historique de chaque ami à chaque vue du Social saturait le serveur) */
    async sessionsOf(accountId, keep = null){
      return [...sessions.values()].filter(s => s.players.some(p => p.account === accountId) && (!keep || keep(s)))
        .sort((a, b) => b.startedAt - a.startedAt).map(copy);
    },
    /* heure de fin la plus récente de ses sessions retenues par keep (0 si aucune), sans rien copier */
    async lastEndOf(accountId, keep = () => true){
      let end = 0;
      for(const s of sessions.values())
        if(s.players.some(p => p.account === accountId) && keep(s) && Number.isFinite(s.endedAt)) end = Math.max(end, s.endedAt);
      return end;
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
    async getAlwaysReady(){ return [...alwaysReady.keys()]; },
    async setAlwaysReady(accountId, on){
      if(on === alwaysReady.has(accountId)) return;
      if(on) alwaysReady.set(accountId, true); else alwaysReady.delete(accountId);
      await store.changed([{ ns: 'always_ready', key: accountId, value: on ? true : null }]);
    },

    /* inscriptions à la mine instantanée : gardées pour survivre à un redémarrage du serveur */
    async getInstantSignups(){ return [...signups.values()].map(copy); },
    async putInstantSignup(account, v){ signups.set(account, copy(v)); await store.changed([{ ns: 'mi_signup', key: account, value: v }]); },
    async deleteInstantSignup(account){ if(signups.delete(account)) await store.changed([{ ns: 'mi_signup', key: account, value: null }]); },

    /* Jugement (Ange vs Démon) : un seul état commun à tous les joueurs */
    async getJudgment(){ return copy(judgments.get('state')) ?? null; },
    async putJudgment(j){ judgments.set('state', copy(j)); await store.changed([{ ns: 'judgment', key: 'state', value: j }]); },

    /* chat global (lobby) : un seul salon commun à tous les joueurs */
    /* Raffle (31/10/2026, server/social/raffle.js) : le raffle en cours et l'heure du prochain */
    async getRaffle(){ return copy(raffles.get('state')) ?? null; },
    async putRaffle(r){ raffles.set('state', copy(r)); await store.changed([{ ns: 'raffle', key: 'state', value: r }]); },
    /* événement du jour (05/11/2026, src/shared/daily.js) */
    async getDaily(){ return copy(dailies.get('state')) ?? null; },
    async putDaily(d){ dailies.set('state', copy(d)); await store.changed([{ ns: 'daily', key: 'state', value: d }]); },
    /* Guildes (31/10/2026, server/guild/service.js) : une seule fiche pour toutes */
    async getGuilds(){ return copy(guilds.get('state')) ?? null; },
    async putGuilds(g){ guilds.set('state', copy(g)); await store.changed([{ ns: 'guilds', key: 'state', value: g }]); },
    async getGuildLog(guildId, page){ return copy(guildLogs.get(`${guildId}:${page}`)) ?? []; },
    async putGuildLog(guildId, page, rows){ const key = `${guildId}:${page}`; guildLogs.set(key, copy(rows)); await store.changed([{ ns: 'guild_log', key, value: rows }]); },
    async getGlobalChat(){ return copy(chats.get('state')) ?? null; },
    async putGlobalChat(c){ chats.set('state', copy(c)); await store.changed([{ ns: 'chat_global', key: 'state', value: c }]); },

    async getChatPrefs(accountId){ return copy(chatPrefs.get(accountId)) ?? null; },
    async putChatPrefs(accountId, p){ chatPrefs.set(accountId, copy(p)); await store.changed([{ ns: 'chat_prefs', key: accountId, value: p }]); },

    /* modération du chat (30/10/2026) : avertissements et bans d'un compte */
    async getModeration(accountId){ return copy(moderations.get(accountId)) ?? null; },
    async listModerations(){ return [...moderations.entries()].map(([account, m]) => ({ account, value: copy(m) })); },
    async putModeration(accountId, m){ moderations.set(accountId, copy(m)); await store.changed([{ ns: 'moderation', key: accountId, value: m }]); },
    /* signalements et journal des actions admin (01/11/2026) */
    async listReports(){ return [...reports.values()].map(copy).sort((a, b) => a.id - b.id); },
    async putReport(r){ reports.set(String(r.id), copy(r)); await store.changed([{ ns: 'report', key: String(r.id), value: r }]); },
    async listModLog(){ return [...modLogs.values()].map(copy).sort((a, b) => a.id - b.id); },
    async addModLog(entry){ const e = { id: modLogs.size + 1, ...entry }; modLogs.set(String(e.id), copy(e)); await store.changed([{ ns: 'mod_log', key: String(e.id), value: e }]); return e; },

    /* tableau de bord : lignes de stats ; une ligne déjà écrite n'est jamais remplacée (fin de session rejouée) */
    async putSessionStats(rows){
      const fresh = rows.filter(r => !sessionStats.has(r.key));
      for(const r of fresh) sessionStats.set(r.key, copy(r.value));
      if(fresh.length) await store.changed(fresh.map(r => ({ ns: 'session_stat', key: r.key, value: r.value })));
      return fresh.length;
    },
    async allSessionStats(){ return [...sessionStats.values()].map(copy); },

    /* Bloc géant */
    async getHcDay(day){ return copy(hcDays.get(day)) ?? null; },
    async listHcDays(){ return [...hcDays.values()].map(copy); },
    async getHcPlayer(accountId){ return copy(hcPlayers.get(accountId)) ?? null; },
    async listHcPlayers(){ return [...hcPlayers.entries()].map(([account, p]) => ({ account, ...copy(p) })); },
    async putHcPlayer(accountId, p){ hcPlayers.set(accountId, copy(p)); await store.changed([{ ns: 'hc_player', key: accountId, value: p }]); },
    async putHcDayAndPlayer(d, accountId, p){
      hcDays.set(d.day, copy(d)); hcPlayers.set(accountId, copy(p));
      await store.changed([{ ns: 'hc_day', key: d.day, value: d }, { ns: 'hc_player', key: accountId, value: p }]);
    },
    async putInventoryAndHcPlayer(accountId, inv, p){
      inventories.set(accountId, copy(inv)); hcPlayers.set(accountId, copy(p));
      await store.changed([{ ns: 'inventory', key: accountId, value: inv }, { ns: 'hc_player', key: accountId, value: p }]);
    },
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
    /* classements : meilleur temps contre le roi gobelin par compte (29/10) ; même forme que les records de tour */
    async getInstanceRecord(accountId){ return copy(instanceRecords.get(accountId)) ?? null; },
    async listInstanceRecords(){ return [...instanceRecords.entries()].map(([account, r]) => ({ account, value: copy(r) })); },
    async putInstanceRecords(entries){
      for(const [id, r] of entries) instanceRecords.set(id, copy(r));
      if(entries.length) await store.changed(entries.map(([id, r]) => ({ ns: 'instance_record', key: id, value: r })));
    },

    /* énergie du compte (29/10) : { value, keys } */
    async getEnergy(accountId){ return copy(energies.get(accountId)) ?? null; },
    async putEnergy(accountId, e){ energies.set(accountId, copy(e)); await store.changed([{ ns: 'energy', key: accountId, value: e }]); },

    /* prison du compte (29/10) */
    async getPrison(accountId){ return copy(prisons.get(accountId)) ?? null; },
    async putPrison(accountId, p){ prisons.set(accountId, copy(p)); await store.changed([{ ns: 'prison', key: accountId, value: p }]); },
    async getPrisonCompo(accountId){ return copy(prisonCompos.get(accountId)) ?? null; },
    async putPrisonCompo(accountId, c){ prisonCompos.set(accountId, copy(c)); await store.changed([{ ns: 'prison_compo', key: accountId, value: c }]); },
    async listPrisons(){ return [...prisons.entries()].map(([account, p]) => ({ account, value: copy(p) })); },

    /* wiki : objets secrets trouvés en jeu (WIKI.secret) ; clé = nom de l'objet, valeur = { at } (premier trouvé) */
    async getAppLatest(){ return copy(appLatest.get('state')) ?? null; },
    async putAppLatest(v){ appLatest.set('state', copy(v)); await store.changed([{ ns: 'app_latest', key: 'state', value: v }]); },
    async listDiscovered(){ return [...discovered.keys()]; },
    /* renvoie true si c'est la première fois (annonce Discord d'un BP, 27/10), false si l'objet était déjà trouvé */
    async putDiscovered(item, v){ if(discovered.has(item)) return false; discovered.set(item, copy(v)); await store.changed([{ ns: 'discovered', key: item, value: v }]); return true; },

    /* toutes les sortes de données (renommage d'objets, server/game/rename-items.js) */
    nsList: () => Object.keys(allMaps()),
    eachRow(fn){ for(const [ns, map] of Object.entries(allMaps())) for(const [k, v] of map) fn(ns, k, v); },
    /* réécrit clés et valeurs (sauf les sortes de skip) ; met la mémoire à jour et renvoie les changements, sans les écrire */
    rewrite(keyFn, valueFn, skip = []){
      const out = [];
      for(const [ns, map] of Object.entries(allMaps())){
        if(skip.includes(ns)) continue;
        for(const [k, v] of [...map]){
          const nk = keyFn(k), nv = valueFn(v);
          if(nk === k && nv === v) continue;
          if(nk !== k){ map.delete(k); out.push({ ns, key: k, value: null }); }
          map.set(nk, nv);
          out.push({ ns, key: nk, value: copy(nv) });
        }
      }
      return out;
    },

    /* Suppression d'un compte : met tout à jour en mémoire et renvoie les changements, SANS les écrire : l'appelant les écrit en une
       fois avec ceux du compte. who : { id, names, anon } ; line : la ligne du journal, seule trace gardée. */
    eraseAccount(who, line){
      const out = [];
      const drop = (map, ns, key) => { if(map.delete(key)) out.push({ ns, key, value: null }); };
      const put = (map, ns, key, value) => { map.set(key, value); out.push({ ns, key, value }); };
      const owned = k => k === who.id || k.startsWith(who.id + '#');
      /* ses lignes */
      const mine = { inventory: inventories, furnace: furnaces, crusher: crushers, stuff, prefs, progress, skills, spells, sets, shrine: shrines, always_ready: alwaysReady,
                     mi_signup: signups, giant_player: giantPlayers, hc_player: hcPlayers, tower_record: towerRecords, instance_record: instanceRecords, energy: energies,
                     prison: prisons, prison_compo: prisonCompos, chat_prefs: chatPrefs, social: socials, moderation: moderations };
      for(const [ns, map] of Object.entries(mine)) for(const k of [...map.keys()]) if(owned(k)) drop(map, ns, k);
      /* amis, demandes et blocages des autres : il en sort */
      for(const [k, s] of socials){
        const next = { ...s, friends: (s.friends ?? []).filter(x => x !== who.id), incoming: (s.incoming ?? []).filter(r => r.from !== who.id),
                       outgoing: (s.outgoing ?? []).filter(r => r.to !== who.id), blocked: (s.blocked ?? []).filter(x => x !== who.id) };
        if(JSON.stringify(next) !== JSON.stringify(s)) put(socials, 'social', k, next);
      }
      /* scores du jour (Bloc géant, He's coming) : sa ligne part, le total reste : les récompenses des autres ne bougent pas */
      for(const [ns, map] of [['giant_day', giantDays], ['hc_day', hcDays]]) for(const [k, d] of map) if(d.scores?.[who.id]){
        const { [who.id]: _gone, ...scores } = d.scores;
        put(map, ns, k, { ...d, scores });
      }
      /* sessions : celle où il était seul part ; une session en cours d'autres joueurs est notée, nettoyée à sa fin (service de jeu) */
      for(const [k, rec] of sessions) if(rec.players?.some(p => p.account === who.id)){
        if(rec.players.length === 1) drop(sessions, 'game_session', k);
        else if(rec.status !== 'done') put(sessions, 'game_session', k, { ...rec, erased: [...(rec.erased ?? []), who] });
      }
      /* statistiques : gardées, sous un faux compte ; la clé contient le compte */
      for(const [k, v] of [...sessionStats]) if(k.includes(who.id)){
        drop(sessionStats, 'session_stat', k);
        put(sessionStats, 'session_stat', k.replaceAll(who.id, who.anon), scrub(v, who));
      }
      /* tout le reste de ce qui est commun : relu valeur par valeur, rien n'y échappe (un champ ajouté demain non plus) */
      const shared = { game_session: sessions, party: parties, giant_day: giantDays, hc_day: hcDays, judgment: judgments, guilds, guild_log: guildLogs, chat_global: chats, raffle: raffles,
                       moderation: moderations, tower_record: towerRecords, instance_record: instanceRecords };
      for(const [ns, map] of Object.entries(shared)) for(const [k, v] of map){
        if(ns === 'game_session' && v.status !== 'done') continue;
        const next = scrub(v, who), a = JSON.stringify(v), b = JSON.stringify(next);
        if(a !== b) put(map, ns, k, next);
      }
      /* signalements : ceux qui le visent restent entiers (sécurité des joueurs) ; ceux qu'il a envoyés perdent son nom */
      for(const [k, r] of reports) if(r.by === who.id) put(reports, 'report', k, { ...r, by: who.anon, byName: DELETED_NAME });
      /* journal : plus son pseudo dans les lignes d'avant ; une dernière ligne, sans autre donnée */
      for(const [k, l] of modLogs) if(who.names.includes(l.target) || who.names.some(n => l.detail?.includes(n)))
        put(modLogs, 'mod_log', k, { ...l, target: who.names.includes(l.target) ? DELETED_NAME : l.target, detail: who.names.reduce((d, n) => d.replaceAll(n, DELETED_NAME), l.detail ?? '') });
      const e = { id: modLogs.size + 1, ...line };
      put(modLogs, 'mod_log', String(e.id), e);
      return out.map(c => ({ ...c, value: copy(c.value) ?? null }));
    },
    /* session terminée : elle peut enfin perdre les joueurs supprimés pendant la partie */
    scrubSession(rec){
      let out = rec;
      for(const who of rec.erased ?? []) out = scrub(out, who);
      const { erased: _gone, ...clean } = out;
      return clean;
    },

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
                         judgments: Object.fromEntries(judgments), discovered: Object.fromEntries(discovered), appLatest: Object.fromEntries(appLatest),
                         giantDays: Object.fromEntries(giantDays), giantPlayers: Object.fromEntries(giantPlayers), hcDays: Object.fromEntries(hcDays), hcPlayers: Object.fromEntries(hcPlayers), sessionStats: Object.fromEntries(sessionStats),
                         towerRecords: Object.fromEntries(towerRecords), instanceRecords: Object.fromEntries(instanceRecords), energies: Object.fromEntries(energies), alwaysReady: Object.fromEntries(alwaysReady), chatPrefs: Object.fromEntries(chatPrefs), prisons: Object.fromEntries(prisons), prisonCompos: Object.fromEntries(prisonCompos), chats: Object.fromEntries(chats), raffles: Object.fromEntries(raffles), dailies: Object.fromEntries(dailies), guilds: Object.fromEntries(guilds), guildLogs: Object.fromEntries(guildLogs), moderations: Object.fromEntries(moderations), reports: Object.fromEntries(reports), modLogs: Object.fromEntries(modLogs) }; },
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
  const rows = await db.load(GAME_NS);
  const store = createMemoryGameStore({ guildLogs: rows.guild_log, inventories: rows.inventory, furnaces: rows.furnace, crushers: rows.crusher, stuff: rows.stuff, prefs: rows.prefs,
                                        progress: rows.progress, skills: rows.skills, spells: rows.spells, sets: rows.sets,
                                        sessions: rows.game_session, parties: rows.party, signups: rows.mi_signup, socials: rows.social,
                                        judgments: rows.judgment, giantDays: rows.giant_day, giantPlayers: rows.giant_player, hcDays: rows.hc_day, hcPlayers: rows.hc_player, discovered: rows.discovered, appLatest: rows.app_latest, sessionStats: rows.session_stat,
                                        towerRecords: rows.tower_record, instanceRecords: rows.instance_record, shrines: rows.shrine, energies: rows.energy, alwaysReady: rows.always_ready, chatPrefs: rows.chat_prefs, prisons: rows.prison, prisonCompos: rows.prison_compo, chats: rows.chat_global, raffles: rows.raffle, dailies: rows.daily, guilds: rows.guilds, moderations: rows.moderation, reports: rows.report, modLogs: rows.mod_log });
  store.changed = changes => db.write(changes);
  store.close = () => db.flush();
  store.file = 'PostgreSQL';
  store.db = db;       // base partagée avec les comptes : une suppression de compte y écrit tout en une fois
  return store;
}
