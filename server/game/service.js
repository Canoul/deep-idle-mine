/* Sessions de jeu côté serveur : c'est le serveur qui fait foi (anti-triche).

   - Le serveur crée la session (seed, joueurs, préférences, heure de départ) et la FAIT TOURNER lui-même, en direct
     (server/game/live.js) : c'est la seule copie de la partie. Les navigateurs ne font que l'afficher.
   - Le navigateur ne peut que dire « je lance », « je quitte », « focus », écrire dans le chat, et lire l'état. Il n'écrit jamais dans un
     inventaire et ne calcule aucun résultat : il n'y a rien à vérifier.
   - Un choix (quitter, focus) s'applique tout de suite dans la partie ; il est enregistré avec son tick, ce qui
     permet de reconstruire la partie à l'identique après un redémarrage du serveur.
   - Fin de session (dernier tick) : le coffre est partagé entre les joueurs présents et versé aussitôt. Chaque
     versement est idempotent (creditSession) : rien n'est versé deux fois.
   - Mode normal : la partie suit le temps réel (GAME.speed). Mode dev : vitesse et pause réglables (horloge de la
     session, côté serveur), fin libre.
   - À plusieurs : le chef d'un groupe (server/party/) lance la session pour tous les membres.
   - Mine instantanée (GAME_DESIGN §6) : une session de type mode 'mi', ouverte à l'heure par le service des
     inscriptions (server/instant/) avec openInstant. Même vie qu'une session (partie en direct, départ = rien,
     versement idempotent, reprise après redémarrage), mais chacun son butin, sans XP ni focus.
   - Prison (29/10/2026, spec docs/superpowers/specs/2026-10-29-prison-energie-design.md) : une par compte, solo, sans
     fin. Chaque run est une partie du moteur (id « prison:<id>:<run> ») ; à sa fin, coffre, XP et énergie sont versés
     avec cette clé (une seule fois, même rejoué), puis le run suivant démarre. Arrêt (bouton, ou lancement d'une mine,
     d'une tour ou d'une instance) : le run est arrêté au tick atteint, son coffre (pas le sac du mineur) et son énergie
     sont versés, la prison est fermée. Rythme (pumpPrisons, seePrison) : en direct quand le joueur regarde, par paquets
     toutes les PRISON.batchMs quand il est absent (moteur fermé entre deux), arrêtée (waiting) 24 h après sa dernière
     visite ; à son retour, l'attente passe dans pausedMs et le run repart où il s'était arrêté.
   Testable seul : on lui passe un stockage, une horloge et la façon de faire tourner les parties (liveRunner). */
import crypto from 'node:crypto';
import { GAME, ENERGY, PRISON, PREFS, FOCUS, FURNACE, MINE_MODES, CHAT, ITEMS, JUDGMENT, KHOLE, TOWER, WIKI, LEADERBOARD, SKILLS, AREAS, treasureItem, goblinChestItem, golbuteChestItem } from '../../src/config.js';
import { sanitizeTowerRecord, betterTower, sanitizeInstanceRecord, betterInstance, recordKey, splitRecordKey } from '../../src/meta/leaderboard.js';
import { DT } from '../../src/config.js';
import { sanitizePrefs, sanitizeOverrides, sanitizeDevSpecs, tickAt, realDurationMs, TOTAL_TICKS } from '../../src/shared/game.js';
import { sanitizeBotPresets, isCopyPresetId, COPY_PREFIX } from '../../src/shared/dev-presets.js';
import { prisonCompos, pickCompo } from '../../src/meta/prison-profile.js';
import { sanitizeFocus } from '../../src/sim/focus.js';
import { displayName } from '../../src/shared/account.js';
import { createInventory, deserialize, serialize, creditSession, addItem, removeItem, countOf, sortInventory, moveSlot } from '../../src/meta/inventory.js';
import { sanitizeJudgment, addResidues, refresh as refreshJudgment, publicJudgment, isOpen as towerOpen, anyOpen as anyTowerOpen, hasWon, markDone,
         setCount as setJudgmentCount, SIDES as JUDGMENT_SIDES } from '../../src/meta/judgment.js';
import { towerSide, isTowerMode, towerDurationMs, splitTowerLoot } from '../../src/shared/tower.js';
import { instanceDef, instanceDurationMs, isInstanceMode, missingKeys, levelsOf } from '../../src/shared/instances.js';
import { rollChestQuality, rollRune, rolledSpec, rollStats, isRing, canIdentify, qualityDef } from '../../src/meta/piece.js';
import { sanitizeProgress, creditXp, raiseAreaMax, levelOf, specXpOf, specLevels } from '../../src/meta/level.js';
import { sanitizeSkills, skillOp, skillRanks, spentPoints } from '../../src/meta/skills.js';
import { glyphOp, sessionSkills, ownedGlyphs, nodeOfGlyph } from '../../src/meta/glyphs.js';
import { sanitizeSpells, spellOp, learnScroll, publicSpells, equippedSpells } from '../../src/meta/spells.js';
import { sanitizeSets, setOp, applySet, snapshot, publicSets, inSomeSet } from '../../src/meta/sets.js';
import { canOpen, openTreasure, openAll } from '../../src/meta/loot.js';
import { sanitizeFurnaces, furnaceOp, advance } from '../../src/meta/furnace.js';
import { sanitizeCrusher, crusherOp, advance as advanceCrusher, publicCrusher } from '../../src/meta/crusher.js';
import { craft, learn, recycleStuff } from '../../src/meta/craft.js';
import { research, recycle } from '../../src/meta/research.js';
import { sanitizeEnergy, canPay, rollCost, spendEnergy, creditEnergy, energyOfTicks, publicEnergy, settleIdle } from '../../src/meta/energy.js';
import { cleanTime, sanitizePrison, newPrisonRecord, runId, runRecord, prisonTickAt, publicPrison, prisonDueMs, touchPrison, isPresent, batchDue,
         addAway, endedAway, hasAway, clearAway } from '../../src/shared/prison.js';
import { sanitizeShrines, give as giveShrine, consume as consumeShrines, steleFor, heroicFor, setStele, spendStele, hasShrines, publicShrines, shrineOf } from '../../src/meta/shrines.js';
import { sanitizeStuff, stuffOp, lookOf, gearOf } from '../../src/meta/stuff.js';
import { gearScore } from '../../src/meta/gearscore.js';
import { aurasOf } from '../../src/meta/aura.js';
import { identify, upgrade, enchant, unenchant } from '../../src/meta/upgrade.js';
import { createLimiter } from '../accounts/ratelimit.js';
import { GAME_SERVER } from '../config.js';
import { prisonRow } from '../../src/meta/prison-dashboard.js';
import { treasureMessage, identifyMessage, towerOpenMessage, blueprintMessage, discoveryMessage } from '../social/discord.js';
import { RECIPES } from '../../src/recipes.js';
import { createLiveRunner } from './live.js';
import { createChat } from './chat.js';
import { instantDurationMs } from '../../src/shared/instant.js';
import { launchSnapshot, statRows } from '../admin/dashboard.js';

export class GameError extends Error {
  constructor(code, status, message, extra = {}){ super(message); this.code = code; this.status = status; Object.assign(this, extra); }
}
const fail = (code, status, message, extra) => { throw new GameError(code, status, message, extra); };

const ACTIVE = ['running', 'settling'];
const CRAFT_ERRORS = { unknown: 'Recette inconnue.', locked: 'Recette pas encore débloquée.',
                       not_enough: 'Il te manque des ingrédients.' };
const LEARN_ERRORS = { no_use: 'Ce blueprint ne débloque rien pour l\'instant.', known: 'Tu connais déjà cette recette : ton blueprint est gardé.',
                       not_owned: 'Tu n\'as pas ce blueprint.' };
const SKILL_ERRORS = { unknown: 'Skill inconnu.', other_tree: 'Tu as choisi un autre arbre : fais un reset pour changer.',
                       maxed: 'Ce skill est déjà au rang max.', needs_previous: 'Monte d\'abord l\'étape précédente au rang max.',
                       no_points: 'Plus de points de skill : gagne un niveau.', bad_request: 'Demande invalide.',
                       not_max: 'Le skill doit être au rang max pour recevoir son glyphe.', occupied: 'Un glyphe est déjà posé sur ce skill.',
                       not_owned: 'Tu n\'as pas ce glyphe.', empty: 'Aucun glyphe sur ce skill.', inventory_full: 'Plus de place dans l\'inventaire.' };
const SPELL_ERRORS = { unknown: 'Sort inconnu.', locked: 'Ce sort n\'est pas encore débloqué.',
                       wrong_tree: 'Ce sort est réservé à une autre spécialisation.', slot_locked: 'Cet emplacement est verrouillé.',
                       not_scroll: 'Cet objet n\'est pas un parchemin de sort.', already_learned: 'Tu connais déjà ce sort : ton parchemin est gardé.',
                       not_owned: 'Tu n\'as pas ce parchemin.', bad_request: 'Demande invalide.' };
const SHRINE_ERRORS = { bad_shrine: 'Shrine inconnu.', bad_item: 'Ce shrine ne demande pas cet objet.', bad_qty: 'Quantité invalide.',
  active: 'Ce shrine est déjà actif.', not_charged: 'Cette stèle n\'est pas chargée.', full: 'Cet objet est déjà entièrement donné.', not_owned: 'Tu n\'en as pas assez.' };
const SET_ERRORS = { unknown: 'Set introuvable.', too_many: 'Tu as déjà le nombre maximum de sets.',
                     bad_name: 'Nom vide ou trop long.', session_running: 'Impossible pendant une session : termine-la d\'abord.',
                     bad_request: 'Demande invalide.' };
const RESEARCH_ERRORS = { bad_tier: 'Tier de recherche inconnu.', tier_locked: 'Apprends d\'abord toutes les recettes des tiers inférieurs.', nothing_left: 'Tu as appris tous les blueprints de ce tier.',
                          not_enough: 'Il te faut plus de Blueprint parts.', bad_item: 'Seul un blueprint se recycle.',
                          not_owned: 'Tu n\'as pas ce blueprint.', bad_request: 'Demande invalide.' };
const RECYCLE_ERRORS = { not_owned: 'Cette pièce n\'est plus dans ton inventaire.', not_recyclable: 'Cette pièce ne se recycle pas.',
                         in_set: 'Cette pièce est dans un set : retire-la du set (ou supprime le set) avant de la recycler.', bad_request: 'Demande invalide.' };
const ARRANGE_ERRORS = { not_owned: 'Cet objet n\'est plus à cette place : l\'inventaire a été rechargé.', bad_request: 'Demande invalide.' };
/* ce que le navigateur voit de l'inventaire : les slots, et les recettes débloquées par blueprint */
const publicInventory = inv => ({ slots: inv.slots, unlocked: inv.unlocked });
const STUFF_ERRORS = { bad_slot: 'Case inconnue.', not_owned: 'Cette pièce n\'est pas dans ton inventaire.',
                       wrong_slot: 'Cette pièce ne va pas dans cette case.', same_ring: 'Tu portes déjà cet anneau.' };
const UPGRADE_ERRORS = { not_owned: 'Cette pièce n\'est pas dans ton inventaire (retire-la d\'abord si elle est équipée).',
                         same_piece: 'Il faut un deuxième exemplaire à sacrifier.', already_identified: 'Cette pièce est déjà identifiée.',
                         not_same_item: 'Le sacrifice doit être le même objet.', maxed: 'Cette pièce est déjà au niveau maximum.',
                         not_enough: 'Il te manque des matériaux.', bad_request: 'Demande invalide.',
                         not_stuff: 'Seule une pièce de stuff peut être identifiée, améliorée ou enchantée.',
                         not_rune: 'Il faut une rune pour enchanter.', already_enchanted: 'Cette pièce porte déjà une rune.',
                         not_identified: 'Identifie d\'abord cette pièce : sa qualité décide des runes qu\'elle accepte.',
                         rune_too_rare: 'Cette rune est de qualité trop élevée pour cette pièce (au plus la même qualité).',
                         no_rune: 'Cette pièce ne porte pas de rune.', fragment_locked: 'Un fragment de rune posé ne se retire plus.',
                         ring: 'Un anneau ne s\'identifie et ne s\'enchante pas (il s\'améliore avec un doublon).',
                         plain: 'Une boussole ou une torche ne s\'identifie, ne s\'améliore et ne s\'enchante pas.' };
const FURNACE_ERRORS = {
  bad_furnace: 'Ce four n\'existe pas.', bad_slot: 'Case inconnue.', bad_qty: 'Quantité invalide.',
  bad_item: 'Cet objet ne va pas dans cette case.', not_enough: 'Tu n\'en as pas assez.',
  slot_busy: 'La case contient déjà autre chose : vide-la d\'abord.', inventory_full: 'L\'inventaire ne peut pas recevoir ça.',
  bad_mode: 'Mode de four inconnu.', not_empty: 'Vide les cases d\'ingrédients avant de changer de mode.',
  no_recipe: 'Aucun alliage avec ces deux ingrédients.',
  already_unlocked: 'Ce four est déjà débloqué.', locked_before: 'Débloque d\'abord le four d\'avant.',
};
const CRUSHER_ERRORS = {
  bad_slot: 'Case inconnue.', bad_qty: 'Quantité invalide.', bad_item: 'Seuls les blocs (terre, pierre, pierre dure) se concassent.',
  not_enough: 'Tu n\'en as pas assez.', slot_busy: 'La case contient déjà un autre bloc : vide-la d\'abord.',
  inventory_full: 'L\'inventaire ne peut pas recevoir ça.',
};
const isInt = v => Number.isSafeInteger(v);

/* verrous par clé : deux actions sur le même compte (ou le même inventaire) ne s'entremêlent jamais,
   même avec des requêtes simultanées (double clic, deux onglets) */
function createLocks(){
  const tails = new Map();
  function withLock(key, fn){
    const prev = tails.get(key) ?? Promise.resolve();
    const run = prev.catch(() => {}).then(fn);
    const tail = run.catch(() => {});
    tails.set(key, tail);
    tail.then(() => { if(tails.get(key) === tail) tails.delete(key); });
    return run;
  }
  /* plusieurs verrous, toujours pris dans le même ordre (pas d'interblocage entre deux lancements) */
  withLock.many = (keys, fn) => [...new Set(keys)].sort().reduceRight((inner, key) => () => withLock(key, inner), fn)();
  return withLock;
}

/* quantité maximale d'un don d'administration (adminGive) */
export const ADMIN_MAX_QTY = 1000;

export function createGameService({ store, liveRunner = createLiveRunner, clock = Date.now, dev = GAME_SERVER.dev, speed = GAME.speed,
                                    config = GAME_SERVER, prison: cfg = PRISON, randomSeed = () => crypto.randomInt(2**31),
                                    /* mode dev : copies de vrais joueurs pour les mineurs de test, { pseudo: copie } (data/presets/) */
                                    devCopies = () => ({}),
                                    devLiveCopies = null,
                                    /* hasard du butin, imprévisible, dans [0, 1[ : 48 bits aléatoires (randomInt refuse 2**48) */
                                    random = () => crypto.randomBytes(6).readUIntBE(0, 6) / 2**48,
                                    /* modération du chat (server/moderation/service.js, 30/10) : avertit l'auteur d'un mot interdit ; absente = rien */
                                    moderation = null,
                                    /* XP d'un joueur tout juste créditée (server/guild/service.js), une seule fois par session */
                                    onXp = () => {},
                                    /* nom de guilde d'un joueur, figé au lancement : affiché sous son pseudo (server/guild/service.js) */
                                    guildNameOf = async () => null,
                                    /* annonces Discord (server/social/discord.js) : announce(texte), en tâche de fond */
                                    announce = () => {} }){
  /* nom de guilde d'un joueur au lancement ; une panne de ce côté n'empêche jamais de jouer */
  async function guildField(account){
    try { const guild = await guildNameOf(account); return guild ? { guild } : {}; } catch(e){ console.error(e); return {}; }
  }
  /* transmet l'XP créditée à la guilde : une panne de ce côté ne doit jamais bloquer la fin d'une session */
  async function shareXp(account, xp, isDev){
    if(isDev || !(xp > 0)) return;
    try { await onXp(account, xp); } catch(e){ console.error(e); }
  }
  /* copies (copy:<pseudo>) des mineurs de test, rangées dans la session au lancement : { botCopies: [copie | null] } ou rien */
  /* preset du joueur qui lance (mode dev) : { selfPreset, selfCopy? } ou rien ; une copie introuvable → rien */
  const selfPresetOf = id => {
    const t = sanitizeBotPresets([id])?.[0];
    if(!t) return {};
    if(!isCopyPresetId(t)) return { selfPreset: t };
    const snap = devCopies()[t.slice(COPY_PREFIX.length)];
    return snap ? { selfPreset: t, selfCopy: snap } : {};
  };
  const botCopiesOf = presets => {
    if(!presets?.some(isCopyPresetId)) return {};
    const all = devCopies();
    return { botCopies: presets.map(t => isCopyPresetId(t) ? all[t.slice(COPY_PREFIX.length)] ?? null : null) };
  };
  const withLock = createLocks();
  /* une annonce ne bloque ni ne fait jamais échouer l'action qui la déclenche */
  const shout = text => { if(text) Promise.resolve().then(() => announce(text)).catch(console.error); };
  const settling = new Map();      // id → promesse du versement en cours
  /* les parties en direct ; à la fin de l'une d'elles, son coffre est partagé et versé */
  const live = liveRunner({ onEnd: (id, summary) => { (runOwner.has(id) ? prisonEnded(id, summary) : settleWith(id, summary)).catch(console.error); } });
  const startLimit = createLimiter({ max: config.startsPerHour, window: 3600e3 }, clock);
  const prisonLimit = createLimiter({ max: config.startsPerHour, window: 3600e3 }, clock);   // lancements de prison
  const chat = createChat({ clock });   // chat des sessions, en mémoire (effacé à la fin de chaque session)
  const startHooks = [];           // appelés après le lancement d'une session normale (comptes des joueurs)
  /* Bloc géant (server/giant/service.js) : { busy(compte) → { mode, leftMs } | null, players() → [compte] } ; une visite
     en cours compte comme une session (une seule à la fois), sans être une session de ce service */
  let giant = null;
  const inGiant = async accountId => giant ? await giant.busy(accountId) : null;

  /* wiki (WIKI.secret) : un objet secret vient d'être trouvé en jeu (coffre, trésor, fin de session) : ses effets
     apparaissent dans le wiki. Une seule fois par objet ; une erreur ici ne bloque jamais le gain. */
  const SECRET = new Set(WIKI.secret);
  /* BP d'un objet secret (Treasure T4, 27/10/2026) : le premier BP trouvé révèle la pièce, et c'est annoncé sur Discord ;
     un objet secret trouvé lui-même pour la première fois (stuff du Roi Gobelin) aussi, avec ses stats */
  const BP_SECRET = new Map(Object.entries(RECIPES).filter(([n, r]) => r.unlock && SECRET.has(n)).map(([n, r]) => [r.unlock, n]));
  const markFound = (items, who) => {
    for(const it of items){
      const piece = SECRET.has(it) ? it : BP_SECRET.get(it);
      if(!piece) continue;
      Promise.resolve(store.putDiscovered?.(piece, { at: clock() }))
        .then(first => { if(first === true) shout(BP_SECRET.has(it) ? blueprintMessage(who, it, piece) : discoveryMessage(who, piece)); }).catch(console.error);
    }
  };

  /* ---------- lecture ---------- */

  async function loadInventory(accountId){
    const raw = await store.getInventory(accountId);
    return raw ? deserialize(JSON.stringify(raw)) : createInventory();   // relu et revérifié à chaque fois
  }
  const loadFurnaces = async accountId => sanitizeFurnaces(await store.getFurnaces(accountId));   // revérifié à chaque fois
  /* ce que le navigateur voit des fours : avancés jusqu'à maintenant, heure du serveur (pour la barre de progression) */
  const publicFurnaces = st => ({ list: st.list.map(f => advance(f, clock())), max: FURNACE.max, now: clock() });
  /* concasseur : relu, avancé jusqu'à maintenant avec le hasard du serveur, et ENREGISTRÉ s'il a concassé (un cycle
     n'est tiré qu'une fois). Toujours sous le verrou de l'inventaire (le butin et les blocs y passent). */
  const withCrusher = (accountId, fn) => withLock('inv:' + accountId, async () => {
    const inv = await loadInventory(accountId), c = sanitizeCrusher(await store.getCrusher(accountId));
    if(advanceCrusher(c, clock(), random) > 0) await store.putInventoryAndCrusher(accountId, JSON.parse(serialize(inv)), c);
    return fn(inv, c);
  });
  /* stuff : relu avec l'inventaire (une pièce présente des deux côtés est retirée du stuff ; les uid restent uniques) */
  const loadStuff = async (accountId, inv) => sanitizeStuff(await store.getStuff(accountId), inv);
  const loadPrefs = async accountId => sanitizePrefs(await store.getPrefs(accountId));
  /* Jugement : jauges communes, relues et revérifiées, sous le verrou 'judgment' ; fn(j) renvoie true pour enregistrer.
     Une tour dont la jauge est pleine s'ouvre à la lecture (refresh), et c'est enregistré. */
  /* Une tour qui vient de s'ouvrir (son numéro d'ouverture a avancé, quelle que soit la cause : résidus, réouverture,
     admin) est annoncée sur Discord une fois, après l'enregistrement (sous le verrou : jamais deux fois). */
  const withJudgment = fn => withLock('judgment', async () => {
    const j = sanitizeJudgment(await store.getJudgment());
    const openings = Object.fromEntries(JUDGMENT_SIDES.map(s => [s, j[s].opening]));
    const opened = refreshJudgment(j, clock());
    const r = await fn(j);
    if(opened || r?.save) await store.putJudgment(j);
    for(const s of JUDGMENT_SIDES) if(j[s].opening > openings[s]) shout(towerOpenMessage(s));
    return r?.value ?? r;
  });
  /* progression (XP totale) : relue et revérifiée à chaque fois ; le navigateur voit niveau, avancement et points */
  /* énergie relue et revérifiée à chaque fois (départ si absente) ; repos (30/10/2026) : sans session en cours ni prison
     (qui tourne ou attend), le temps depuis le dernier calcul ou la fin de la dernière activité rapporte ENERGY.idlePerHour
     par heure de jeu ; enregistré dès qu'il rapporte. Pendant une activité, rien (la prison recharge à sa façon). */
  const restedEnergy = async accountId => {
    const e = sanitizeEnergy(await store.getEnergy(accountId)), now = clock();
    const prisonRec = sanitizePrison(await store.getPrison?.(accountId));
    const busy = !!await activeOf(accountId) || prisonRec?.state === 'running' || prisonRec?.state === 'waiting';
    if(e.at == null){ e.at = now; return { e, changed: true }; }   // premier calcul : le repos compte à partir d'ici
    if(busy){ e.at = now; return { e, changed: false }; }
    const lastEnd = (await store.sessionsOf(accountId)).reduce((m, s) => Math.max(m, Number.isFinite(s?.endedAt) ? s.endedAt : 0), prisonRec?.endedAt ?? 0);
    return { e, changed: settleIdle(e, Math.max(e.at, lastEnd), now, GAME.speed) > 0 };
  };
  const loadEnergy = async accountId => {
    const { e, changed } = await restedEnergy(accountId);
    if(changed) await store.putEnergy(accountId, e);
    return e;
  };
  const loadProgress = async accountId => sanitizeProgress(await store.getProgress(accountId));
  /* Rattrapage : max des `areas` de l'historique (session_stat, gardé sans limite) pour ce compte. */
  const historyAreaMax = async accountId =>
    (await store.allSessionStats()).reduce((m, r) => r?.account === accountId && Number.isSafeInteger(r.areas) ? Math.max(m, r.areas) : m, 0);
  /* À appeler sous le verrou 'xp:'. areaMax 0 = « aucune ou pas encore connue » (pas de champ à part) : on recalcule alors
     depuis l'historique, ce qui ne coûte rien pour un nouveau joueur et ne peut que monter la valeur. */
  const catchUpAreaMax = async (accountId, pr) => { if(pr.areaMax === 0) raiseAreaMax(pr, await historyAreaMax(accountId)); };
  /* area max du joueur (contenu de la Prison) ; 0 pour un nouveau joueur */
  const areaMaxOf = accountId => withLock('xp:' + accountId, async () => {
    const pr = await loadProgress(accountId), before = pr.areaMax;
    await catchUpAreaMax(accountId, pr);
    if(pr.areaMax !== before) await store.putProgress(accountId, pr);
    return pr.areaMax;
  });
  const publicProgress = p => ({ xp: p.xp, ...levelOf(p.xp), spec: specLevels(p) });
  /* skills : revérifiés avec les points du niveau (jamais plus de rangs que de points) */
  const pointsOf = async accountId => levelOf((await loadProgress(accountId)).xp).talentPoints;
  const loadSkills = async accountId => sanitizeSkills(await store.getSkills(accountId), await pointsOf(accountId));
  const publicSkills = (st, points) => ({ ...skillRanks(st), points, spent: spentPoints(st), glyphs: { ...st.glyphs } });   // glyphes posés { nœud: objet }
  /* sorts : relus et revérifiés ; ctx = arbre de skills choisi et niveaux de spécialisation (déblocage, needTree) */
  const loadSpells = async accountId => sanitizeSpells(await store.getSpells(accountId));
  /* réponse d'une opération de set : la liste, et tout l'équipement relu (équiper change tout d'un coup) */
  const setsReply = async (accountId, sets) => {
    const inv = await loadInventory(accountId);
    return { sets: publicSets(sets), inventory: publicInventory(inv), stuff: (await loadStuff(accountId, inv)).worn,
             skills: publicSkills(await loadSkills(accountId), await pointsOf(accountId)),
             spells: publicSpells(await loadSpells(accountId), await spellCtx(accountId)) };
  };
  const spellCtx = async accountId => ({ tree: (await loadSkills(accountId)).tree,
    spec: Object.fromEntries(Object.entries(specLevels(await loadProgress(accountId))).map(([t, s]) => [t, s.level])) });
  /* le mineur d'un joueur, figé au lancement (session ou prison) : préférences, skills (glyphes actifs ; owned : glyphes
     possédés, pour le drop), sorts équipés encore valides, apparence (src/skins.js) et pièces portées avec leur qualité
     et leur niveau (gear) */
  async function freezePlayer(accountId){
    const sk = await loadSkills(accountId), inv = await loadInventory(accountId), st = await loadStuff(accountId, inv);
    return { prefs: await loadPrefs(accountId), skills: { ...sessionSkills(sk), owned: ownedGlyphs(sk, inv) },
             spells: equippedSpells(await loadSpells(accountId), await spellCtx(accountId)), look: lookOf(st), gear: gearOf(st) };
  }

  /* ce que le navigateur voit d'une session */
  function publicSession(rec){
    if(!rec) return null;
    return { id: rec.id, mode: rec.mode ?? 'mine', seed: rec.seed, players: rec.players, bots: rec.bots, prefs: rec.prefs, looks: rec.looks ?? {}, overrides: rec.overrides,
             dev: rec.dev, speed: rec.speed, startedAt: rec.startedAt, finishAt: rec.finishAt, now: clock(),
             tick: live.tickOf(rec.id), clock: rec.dev ? rec.clock : null,
             leaves: rec.leaves.map(({ account, tick }) => ({ account, tick })),
             focus: (rec.focus || []).map(({ account, tick, focus }) => ({ account, tick, focus })), status: rec.status,
             ...(rec.modulation ? { modulation: rec.modulation } : {}),
             ...(rec.level ? { level: rec.level } : {}),   // niveau de tour (28/10), d'instance (29/10)
             ...(rec.shrines ? { shrines: rec.shrines } : {}),   // shrines actifs au lancement (28/10)
             result: rec.status === 'done' ? rec.result : null };
  }
  const isDue = rec => rec.status === 'running' && !rec.dev && clock() >= rec.finishAt;
  const inSession = (rec, accountId) => rec.players.some(p => p.account === accountId);
  const hasLeft = (rec, accountId) => rec.leaves.some(l => l.account === accountId);

  async function activeOf(accountId){
    return (await store.sessionsOf(accountId)).find(s => ACTIVE.includes(s.status) && !hasLeft(s, accountId)) ?? null;
  }

  /* ---------- parties en direct ---------- */

  /* tick que la partie doit avoir atteint maintenant : temps réel (jeu normal), horloge de la session (dev) */
  function targetTick(rec){
    if(!rec.dev) return tickAt(clock() - rec.startedAt, rec.speed);
    const c = rec.clock;
    const t = c.paused ? c.tick : c.tick + Math.floor((clock() - c.at) / 1000 * c.speed / DT + 1e-9);
    return Math.min(TOTAL_TICKS, t);
  }
  /* la partie tourne (après un redémarrage du serveur : reconstruite depuis la seed et les choix enregistrés).
     Jamais pour une partie qui vient de se terminer et dont le coffre est en cours de partage : false. */
  function ensureLive(rec){
    if(settling.has(rec.id)) return false;
    if(!live.has(rec.id)) live.open(rec);
    return true;
  }
  /* session dont l'heure de fin est passée (elle n'a pas pu suivre : serveur arrêté, endormi ou trop chargé) */
  const overdue = rec => !rec.dev && clock() >= rec.finishAt;

  /* Fait avancer les sessions en cours (appelé en continu par le serveur, toutes les pumpEvery ms).
     Budget de calcul : au plus tickBudget ticks par seconde, toutes sessions confondues. Les parties tournent dans
     des fils d'exécution qui partagent le processeur du serveur : sans limite, une session en rattrapage (après un
     redémarrage) prendrait tout le processeur et le serveur ne répondrait plus aux joueurs. Priorité aux sessions à
     l'heure (joueurs devant leur écran), la moins en retard d'abord ; puis UNE session dépassée à la fois, la plus
     ancienne. Chaque partie avance par blocs de maxStep ticks : les demandes d'affichage passent entre deux. */
  const maxStep = config.maxStep ?? 200;
  const perPump = (config.tickBudget ?? Infinity) * (config.pumpEvery ?? 200) / 1000;
  const pumping = new Set();
  async function pump(){
    const running = (await store.sessionsWithStatus('running')).filter(r => !settling.has(r.id));
    const lag = r => targetTick(r) - (live.tickOf(r.id) ?? 0);
    const onTime = running.filter(r => !overdue(r)).sort((a, b) => lag(a) - lag(b));
    const late = running.filter(overdue).sort((a, b) => a.finishAt - b.finishAt);
    let left = perPump;
    const jobs = [];
    for(const rec of [...onTime, ...late.slice(0, 1)]){
      if(left < 1) break;
      if(pumping.has(rec.id) || !ensureLive(rec)) continue;
      const tick = live.tickOf(rec.id), target = targetTick(rec);
      if(tick >= target) continue;
      const share = Math.min(target - tick, Math.floor(left));
      left -= share;
      pumping.add(rec.id);
      jobs.push((async () => {
        const end = tick + share;
        while(live.has(rec.id) && live.tickOf(rec.id) < end)
          await live.advance(rec.id, Math.min(end, live.tickOf(rec.id) + maxStep));
      })().catch(e => { console.error(`Session ${rec.id} :`, e.message); live.close(rec.id); })   // relancée au prochain passage
        .finally(() => pumping.delete(rec.id)));
    }
    jobs.push(...await pumpPrisons(left));
    await Promise.all(jobs);
    await Promise.all(settling.values());
    await Promise.all(prisonSettling.values());
  }

  /* ---------- prison ---------- */

  /* verrous d'un versement de run : la prison et tout ce qu'un run crédite (pris ensemble, toujours dans le même ordre) */
  const prisonLocks = accountId => ['prison:' + accountId, 'inv:' + accountId, 'xp:' + accountId, 'energy:' + accountId];
  /* Présence (spec « Présence ») : la dernière visite est gardée en mémoire à chaque demande (seen) et écrite en base
     au plus toutes les seenWriteMs (seenWritten) ; la prison relue prend la plus récente des deux. */
  const seen = new Map(), seenWritten = new Map();
  /* énergie des joueurs d'une session à plusieurs, pour le panneau Équipe (31/10/2026) : { energies: { compte: { value, max } } }.
     Pas dans la mine instantanée (pas de panneau, beaucoup de joueurs). Relue au plus tous les teamEnergyFor : la lecture
     parcourt les sessions du joueur et chaque navigateur demande la vue très souvent. */
  const energyCache = new Map();
  const teamEnergies = async rec => {
    if(rec.mode === 'mi' || rec.players.length < 2) return {};
    const energies = {};
    for(const { account } of rec.players){
      let c = energyCache.get(account);
      if(!c || clock() - c.at >= (config.teamEnergyFor ?? 0)){ c = { at: clock(), energy: publicEnergy((await restedEnergy(account)).e) }; energyCache.set(account, c); }
      energies[account] = c.energy;
    }
    return { energies };
  };
  /* compos de prison du compte (30/10) : paliers avancés d'après l'historique, et gardés (ns prison_compo) */
  const advanceCompos = async accountId => {
    const old = await store.getPrisonCompo(accountId), c = prisonCompos(old, await store.sessionsOf(accountId), accountId, dev);
    if(JSON.stringify(c) !== JSON.stringify(old)) await store.putPrisonCompo(accountId, c);
    return c;
  };
  const publicCompos = c => ({ profile: pickCompo(c, 'current'), previous: pickCompo(c, 'previous'), saved: pickCompo(c, 'saved') });
  const loadPrison = async accountId => {        // revérifiée à chaque fois
    const p = sanitizePrison(await store.getPrison(accountId));
    if(p && seen.has(accountId)) p.lastSeenAt = Math.max(p.lastSeenAt, seen.get(accountId));
    return p;
  };
  const runEnded = new Map();      // id du run → bilan : run terminé dans le moteur, pas encore versé
  const payoutTries = new Map();   // id du run → versements relancés après un échec (au plus cfg.payoutRetries)
  const closedRun = new Map();     // id de la prison → dernier run versé (jamais rouvert) ; oublié quand elle est fermée
  const runOwner = new Map();      // id du run ouvert → compte (onEnd : un run de prison, pas une session)
  const prisonSettling = new Map();   // id du run → versement en cours
  const batching = new Set();      // comptes dont le paquet (joueur absent) a commencé et n'est pas fini
  const watching = new Map();      // compte → vues ou arrêts en cours (pump ne ferme pas le moteur sous eux)
  async function watch(accountId, fn){
    watching.set(accountId, (watching.get(accountId) ?? 0) + 1);
    try { return await fn(); }
    finally { const n = watching.get(accountId) - 1; n > 0 ? watching.set(accountId, n) : watching.delete(accountId); }
  }
  /* Index des prisons qui tournent (comptes), pour que pump ne relise qu'elles : bâti depuis le stockage au premier
     besoin (démarrage du serveur), complété au lancement et à la visite qui fait repartir une prison en attente
     (seePrison) ; une prison fermée ou en attente en sort (pump, endBatch). */
  let prisonIndex = null;
  const indexOfPrisons = () => prisonIndex ??= store.listPrisons()
    .then(list => new Set(list.filter(r => sanitizePrison(r.value)?.state === 'running').map(r => r.account)))
    .catch(e => { prisonIndex = null; throw e; });   // stockage en panne : relu au prochain besoin (pas d'index cassé à vie)
  /* Plantages du moteur (relecture finale, 29/10) : un run qui plante à chaque rejeu ne doit ni bloquer l'arrêt ni
     tourner sans fin. crashes : id du run → plantages ; au bout de cfg.crashMax, la prison est arrêtée (abandonPrison).
     Seules les erreurs du moteur comptent (marquées prisonRun), pas celles du stockage. */
  const crashes = new Map();
  const engineError = (e, id) => { if(e && typeof e === 'object') e.prisonRun ??= id; return e; };
  /* arrête la prison dont le run id plante : rien n'est versé sans bilan du moteur (sinon, ce bilan) ; journalisé */
  const abandonPrison = (accountId, id) => withLock.many(prisonLocks(accountId), async () => {
    const p = await loadPrison(accountId);
    if(!p || p.state === 'done' || runId(p) !== id) return;
    console.error(`Prison ${id} : le moteur plante à chaque rejeu (${cfg.crashMax} fois), prison arrêtée`);
    await settleRun(p, runEnded.get(id) ?? { shares: [], t: 0 }, { stopped: true });
  });
  /* une erreur du moteur sur un run : moteur fermé (rejoué au prochain passage), comptée ; au plafond, prison arrêtée.
     → la promesse de l'arrêt, ou null si l'erreur ne vient pas du moteur (à relancer) */
  function runCrashed(accountId, e){
    const id = e?.prisonRun;
    if(!id) return null;
    live.close(id);
    const n = (crashes.get(id) ?? 0) + 1;
    crashes.set(id, n);
    console.error(`Prison ${id} : erreur du moteur (${n}/${cfg.crashMax}) :`, e.message);
    return n >= cfg.crashMax ? abandonPrison(accountId, id) : Promise.resolve();
  }
  /* tick que le run doit avoir atteint maintenant (temps réel à la vitesse de la prison, plafonné : prisonDueMs) */
  const dueTick = p => prisonTickAt(prisonDueMs(p, clock(), cfg), p.speed);
  /* le run en cours tourne dans le moteur (après un redémarrage : rejoué depuis son début) ; false s'il est fini.
     Toujours appelé sous le verrou 'prison:' du compte, avec la prison relue (jamais un run déjà passé). */
  function openRun(p){
    const id = runId(p);
    if(p.run <= (closedRun.get(p.id) ?? 0) || runEnded.has(id)) return false;
    runOwner.set(id, p.account);
    if(!live.has(id)) live.open(runRecord(p));
    return true;
  }
  /* fin d'un run dans le moteur (objectif atteint ou temps max) : versé, sous les verrous du joueur, s'il est toujours
     le run en cours d'une prison qui tourne (sinon, un arrêt l'a déjà versé). Un échec laisse le bilan dans runEnded :
     pump relance le versement (retryPayout). */
  function prisonEnded(id, summary){
    runEnded.set(id, summary);
    const accountId = runOwner.get(id);
    const job = withLock.many(prisonLocks(accountId), async () => {
      const p = await loadPrison(accountId);
      if(p?.state === 'running' && runId(p) === id && runEnded.has(id)) await settleRun(p, runEnded.get(id), { stopped: false });
      else if(p?.state !== 'running' || runId(p) !== id){ runEnded.delete(id); runOwner.delete(id); payoutTries.delete(id); }   // déjà versé
    }).finally(() => prisonSettling.delete(id));
    prisonSettling.set(id, job);
    return job;
  }
  /* versement d'un run fini resté en échec : relancé, au plus cfg.payoutRetries fois (clé prison:<id>:<run> : jamais deux
     fois) ; ensuite, il attend l'arrêt de la prison (qui le verse avec ce même bilan) */
  function retryPayout(id){
    const n = payoutTries.get(id) ?? 0;
    if(n >= cfg.payoutRetries) return;
    payoutTries.set(id, n + 1);
    console.error(`Prison ${id} : versement relancé (${n + 1}/${cfg.payoutRetries})`);
    prisonEnded(id, runEnded.get(id)).catch(e => console.error(`Prison ${id} : versement en échec :`, e.message));
  }
  /* Verse un run (verrous prisonLocks déjà pris) : coffre (shares : coffre + glyphes trouvés, sans le sac du mineur),
     XP du mineur et de sa spécialisation, énergie au prorata du temps de jeu ; clé « prison:<id>:<run> » partout
     (rejoué : rien deux fois). Run fini pendant une absence (heure réelle de sa fin, endedAway) : ajouté au bilan
     (away). Puis : arrêt → prison fermée ;
     sinon run suivant, qui démarre où le précédent a fini. */
  async function settleRun(p, summary, { stopped }){
    const key = runId(p), share = (summary?.shares || []).find(s => s.account === p.account) ?? {};
    const bag = share.bag && typeof share.bag === 'object' ? share.bag : {};
    const inv = await loadInventory(p.account);
    const fresh = !!creditSession(inv, key, bag);
    if(fresh){ markFound(Object.keys(bag), p.specs?.name); await store.putInventory(p.account, JSON.parse(serialize(inv))); }
    const xp = Number.isSafeInteger(share.xp) && share.xp > 0 ? share.xp : 0;
    const pr = await loadProgress(p.account);
    if(creditXp(pr, key, xp, { tree: sanitizeSkills(p.specs?.skills).tree, xp: specXpOf(xp) })){ await store.putProgress(p.account, pr); await shareXp(p.account, xp, dev); }
    const t = Number.isFinite(summary?.t) && summary.t > 0 ? summary.t : 0, energy = energyOfTicks(t / DT);
    /* énergie réellement créditée (plafond ENERGY.max) : c'est elle que comptent le bandeau et le bilan d'absence */
    const e = await loadEnergy(p.account), before = e.value;
    let gained = 0;
    if(creditEnergy(e, key, energy)){ gained = Math.round((e.value - before) * 10) / 10; await store.putEnergy(p.account, e); }
    if(fresh){
      p.totals.runs++;
      p.totals.energy = Math.round((p.totals.energy + gained) * 10) / 10;
      p.totals.xp = (p.totals.xp || 0) + xp;   // XP versée (29/10) : panneau et bilan de sortie
      p.totals.t = Math.round(((p.totals.t || 0) + t) * 10) / 10;   // temps de jeu des runs (29/10)
      /* temps par action du run (30/10, tableau de bord) */
      const rt = cleanTime((summary?.miners || []).find(m => m.account === p.account)?.stats?.time);
      p.totals.time ??= {};
      for(const [k, v] of Object.entries(rt)) p.totals.time[k] = Math.round(((p.totals.time[k] || 0) + v) * 10) / 10;
      for(const [item, n] of Object.entries(bag)) p.totals.bag[item] = (p.totals.bag[item] || 0) + n;
      if(endedAway(p, p.runStartedAt + p.pausedMs + t / p.speed * 1000, cfg)) addAway(p, gained, bag);
    }
    if(stopped){ p.state = 'done'; p.endedAt = clock(); closedRun.delete(p.id); batching.delete(p.account); }
    else {
      p.runStartedAt += p.pausedMs + t / p.speed * 1000; p.pausedMs = 0; closedRun.set(p.id, p.run); p.run++;
      /* 30/10/2026 (Geoffrey) : stuff, skills, glyphes, sorts et préférences relus à chaque run (avant : figés à l'entrée
         pour toute la prison ; une pièce de Découverte équipée ensuite ne comptait jamais). Le pseudo reste celui de
         l'entrée. Rangés avec la prison : un run rejoué après un redémarrage garde les siens. */
      p.specs = { name: p.specs?.name, ...await freezePlayer(p.account) };
    }
    runEnded.delete(key); runOwner.delete(key); payoutTries.delete(key); crashes.delete(key); live.close(key);
    await store.putPrison(p.account, p);
  }
  /* Arrête la prison de ce compte (verrous prisonLocks déjà pris) : le run en cours est joué jusqu'au tick dû (plafonné :
     une prison qui attend s'arrête où elle s'était arrêtée) puis arrêté là (fin immédiate), et versé. Sans effet si la
     prison est absente ou fermée. Moteur en erreur : l'arrêt réussit quand même (rien n'est versé sans bilan, journalisé),
     sinon ni « Sortir de prison » ni un lancement de mine ne passeraient. → { prison, stopped } */
  const stopPrisonOf = accountId => watch(accountId, async () => {
    const p = await loadPrison(accountId);
    if(!p || p.state === 'done') return { prison: p, stopped: false };
    const id = runId(p);
    if(!runEnded.has(id)){
      try {
        if(openRun(p)){
          const target = dueTick(p);
          while(live.has(id) && live.tickOf(id) < target) await live.advance(id, Math.min(target, live.tickOf(id) + maxStep));
          if(live.has(id)) await live.finish(id);     // le bilan arrive par onEnd (runEnded)
        }
      } catch(e){                                     // fini entre-temps (pump, une vue) : son bilan est là
        if(!runEnded.has(id)){ live.close(id); console.error(`Prison ${id} : moteur en erreur à l'arrêt :`, e.message); }
      }
    }
    const summary = runEnded.get(id);
    if(!summary) console.error(`Prison ${id} : arrêt sans bilan du moteur, rien n'est versé`);
    await settleRun(p, summary ?? { shares: [], t: 0 }, { stopped: true });
    await store.putGameSession(prisonHistory(p));   // une ligne dans l'Historique (29/10)
    return { prison: p, stopped: true };
  });
  /* Historique (29/10/2026, Geoffrey) : une prison fermée y figure comme une session terminée (id « prison:<id> », le même
     si l'arrêt est rejoué) : sa durée, son area et tout ce que ses runs ont versé. Rien n'est crédité ici (les runs l'ont
     déjà été) ; seen : pas de bilan de fin de session à montrer. */
  const prisonHistory = p => ({
    id: 'prison:' + p.id, mode: 'prison', status: 'done', dev, seed: p.seed,
    players: [{ account: p.account, name: String(p.specs?.name ?? '') }], leaves: [], focus: [], seen: [p.account],
    startedAt: p.startedAt, endedAt: p.endedAt ?? clock(),
    result: { prison: { runs: p.totals.runs, energy: p.totals.energy, area: p.areaMax, t: p.totals.t || 0, time: { ...(p.totals.time || {}) } },
              shares: [{ account: p.account, left: false, bag: { ...p.totals.bag }, xp: p.totals.xp || 0 }], miners: [] },
  });
  /* avance le run jusqu'au tick end, par blocs de maxStep (les demandes d'affichage passent entre deux) */
  async function advanceRun(id, end){
    while(live.has(id) && live.tickOf(id) < end) await live.advance(id, Math.min(end, live.tickOf(id) + maxStep));
  }
  /* Joue la prison de ce compte vers le tick dû, run après run (un run fini est versé avant le suivant), en au plus
     budget ticks (un run rouvert se rejoue depuis son début : ces ticks comptent). Sans verrou pendant le calcul (le
     versement prend les verrous du joueur) ; la prison est relue sous le verrou 'prison:' avant chaque run.
     → { upToDate } : le run en cours a atteint le tick dû. */
  async function playPrison(accountId, budget = Infinity){
    let left = budget;
    while(true){
      const step = await withLock('prison:' + accountId, async () => {
        const p = await loadPrison(accountId);
        if(p?.state !== 'running') return { stop: true };
        const id = runId(p);
        if(runEnded.has(id)) return { wait: prisonSettling.get(id), stop: !prisonSettling.has(id) };   // versement relancé par pump
        try { if(!openRun(p)) return { stop: true }; } catch(e){ throw engineError(e, id); }
        return { id, target: dueTick(p) };
      });
      if(step.stop) return { upToDate: false };
      if(step.wait){ await step.wait.catch(() => {}); continue; }
      const { id, target } = step, tick = live.tickOf(id) ?? 0;
      if(tick >= target) return { upToDate: true };
      const end = Math.min(target, tick + Math.floor(left));
      if(end <= tick) return { upToDate: false };
      left -= end - tick;
      try { await advanceRun(id, end); }
      catch(e){ if(live.has(id) && !runEnded.has(id)) throw engineError(e, id); }   // fini ou fermé sous nos pieds (pump, une autre vue)
      if(runEnded.has(id)){ await prisonSettling.get(id)?.catch(() => {}); continue; }   // run fini : le suivant
      if(!live.has(id) || live.tickOf(id) < target) return { upToDate: false };        // budget épuisé (ou fermé)
    }
  }
  /* Paquet fini (joueur absent, prison à jour) : lastBatchAt = maintenant ; plafond atteint → waiting ; moteur fermé
     (le paquet suivant rejoue le run depuis son début), sauf si le joueur regarde entre-temps. */
  async function endBatch(accountId){
    await withLock('prison:' + accountId, async () => {
      batching.delete(accountId);
      const p = await loadPrison(accountId);
      if(p?.state !== 'running') return;
      const now = clock();
      p.lastBatchAt = now;
      if(now >= p.lastSeenAt + cfg.offlineMax) p.state = 'waiting';
      await store.putPrison(accountId, p);
      if(p.state === 'waiting') (await indexOfPrisons()).delete(accountId);   // plus relue jusqu'à sa visite (seePrison)
      if(!isPresent(p, now, cfg) && !watching.has(accountId)) live.close(runId(p));
    });
  }
  /* Prisons dans pump (spec « Rythme »), sur le budget left laissé par les sessions : d'abord celles que le joueur
     regarde (comme une session, la moins en retard d'abord), puis les paquets des absents (au plus un toutes les
     batchMs, joué au plus vite jusqu'au tick dû, plafonné à lastSeenAt + offlineMax ; un paquet commencé continue aux
     passages suivants jusqu'à être à jour ; au plus cfg.batchConcurrency paquets à la fois, les commencés d'abord, puis
     le plus ancien : sur OVH le budget est illimité, sans cela tous les absents dus se calculeraient en même temps).
     Un absent sans paquet dû : moteur fermé. → les calculs lancés. */
  async function pumpPrisons(left){
    const index = await indexOfPrisons(), now = clock();
    const present = [], absent = [];
    for(const accountId of [...index]){
      if(pumping.has('prison:' + accountId)) continue;
      const p = await loadPrison(accountId);
      if(p?.state !== 'running'){
        /* fermée ou en attente : sort de l'index, sous le verrou (un lancement ou une visite l'y remet après l'avoir écrite) */
        await withLock('prison:' + accountId, async () => { if((await loadPrison(accountId))?.state !== 'running') index.delete(accountId); });
        continue;
      }
      const id = runId(p);
      if(runEnded.has(id)){ if(!prisonSettling.has(id)) retryPayout(id); continue; }
      if(isPresent(p, now, cfg)) present.push(p);
      else if(batching.has(accountId) || batchDue(p, now, cfg)) absent.push(p);
      else if(live.has(id) && !watching.has(accountId)) live.close(id);
    }
    const lag = p => dueTick(p) - (live.tickOf(runId(p)) ?? 0);
    present.sort((a, b) => lag(a) - lag(b));
    const started = absent.filter(p => batching.has(p.account));
    const fresh = absent.filter(p => !batching.has(p.account)).sort((a, b) => a.lastBatchAt - b.lastBatchAt);
    const batches = [...started, ...fresh].slice(0, Math.max(0, cfg.batchConcurrency ?? 1));
    const jobs = [];
    for(const p of [...present, ...batches]){
      if(left < 1) break;
      const accountId = p.account, batch = !present.includes(p), key = 'prison:' + accountId;
      if(pumping.has(key)) continue;
      const share = Math.min(Math.max(0, lag(p)), Math.floor(left));
      if(share <= 0 && !batch) continue;
      left -= share;
      pumping.add(key);
      if(batch) batching.add(accountId);
      jobs.push((async () => {
        const { upToDate } = await playPrison(accountId, share);
        if(batch && upToDate) await endBatch(accountId);
      })().catch(e => runCrashed(accountId, e)                // moteur : compté, relancé au prochain passage (au plafond : arrêtée)
          ?? (live.has(runId(p)) && (console.error(`Prison ${runId(p)} :`, e.message), live.close(runId(p)))))
        .catch(e => console.error(`Prison de ${accountId} :`, e.message))
        .finally(() => pumping.delete(key)));
    }
    return jobs;
  }
  /* sessions qui empêchent de lancer une prison : mine, tour, instance (pas la mine instantanée) */
  const sessionOf = async accountId => (await store.sessionsOf(accountId))
    .find(s => ACTIVE.includes(s.status) && !hasLeft(s, accountId) && s.mode !== 'mi') ?? null;
  /* retard joué à une vue de la prison : au plus un paquet et le rejeu d'un run (au-delà, pump finit le rattrapage) */
  const catchUpBudget = p => prisonTickAt(cfg.batchMs, p.speed) + Math.ceil(cfg.runMax / DT);
  /* Visite du joueur (state, vue de la prison) : notée (touchPrison, lastSeenAt écrit au plus toutes les seenWriteMs ;
     une prison qui attendait repart d'où elle s'était arrêtée) ; play : le retard est joué avant de répondre (vue de
     la prison seulement, jamais state) ; puis la prison est envoyée avec le bilan de l'absence, une seule fois (remis à
     zéro dès qu'il est envoyé) et, si withView, la vue du run depuis le tick since.
     → { prison: publicPrison | null, view: vue | null } */
  const seePrison = (accountId, { since = null, withView = false, play = false } = {}) => watch(accountId, async () => {
    const visit = await withLock('prison:' + accountId, async () => {
      const p = await loadPrison(accountId);
      if(!p) return null;
      const now = clock(), changed = touchPrison(p, now, cfg);
      seen.set(accountId, p.lastSeenAt);
      if(changed || (p.state !== 'done' && !(now - (seenWritten.get(accountId) ?? -Infinity) < cfg.seenWriteMs))){
        await store.putPrison(accountId, p); seenWritten.set(accountId, now);
      }
      if(p.state === 'running') (await indexOfPrisons()).add(accountId);   // repartie après une attente : pump la reprend
      return p;
    });
    if(!visit) return { prison: null, view: null };
    if(play && visit.state === 'running'){
      try { await playPrison(accountId, catchUpBudget(visit)); }
      catch(e){ const crash = runCrashed(accountId, e); if(!crash) throw e; await crash; }   // moteur : la vue répond quand même
    }
    const { p, away } = await withLock('prison:' + accountId, async () => {
      const p = await loadPrison(accountId) ?? visit, away = p.away;
      if(hasAway(p)){ clearAway(p); await store.putPrison(accountId, p); }
      return { p, away };
    });
    const id = runId(p), on = p.state === 'running' && live.has(id);
    const info = on ? await live.info(id).catch(() => null) : null;
    const view = on && withView ? await live.view(id, since).catch(() => null) : null;
    return { prison: publicPrison(p, info, { away, cfg }), view };
  });
  /* la prison dans state() : une visite, sans rattrapage ; ne fait jamais échouer state() (au pire, telle qu'en base) */
  async function prisonOfState(accountId){
    try { return (await seePrison(accountId)).prison; }
    catch(e){
      console.error(`Prison de ${accountId} (state) :`, e.message);
      return publicPrison(await loadPrison(accountId).catch(() => null), null, { cfg });
    }
  }

  /* ---------- fin de session ---------- */

  /* Partage le coffre de la partie terminée et verse les parts. Sans effet si la session n'est pas « running ». */
  function settleWith(id, summary){
    if(settling.has(id)) return settling.get(id);
    const p = withLock('sess:' + id, async () => {
      let rec = await store.getGameSession(id);
      if(!rec || rec.status !== 'running') return;
      /* tour réussie : chaque joueur encore présent reçoit un trésor de la tour, qualité tirée par le serveur (RUNE), et
         sa part égale des stonebricks de la partie (pods, 26/10 : coffre + sacs, splitTowerLoot) */
      const side = towerSide(rec.mode);
      if(side){
        const heirs = (summary.shares || []).filter(s => summary.success && s.account && !s.left && !hasLeft(rec, s.account));
        const parts = splitTowerLoot(summary.loot, heirs.length, side, random);
        const luck = shrineOf(rec.stele)?.effect?.luck ?? null, extraBox = shrineOf(rec.heroic)?.effect?.extraBox ?? 0;   // stèle : trésor béni (30/10)
        for(const share of summary.shares || []){
          const i = heirs.indexOf(share);
          if(i < 0){ share.bag = {}; continue; }
          /* Shrine héroïque (31/10/2026) : chance d'une 2e boîte, tirée par joueur, qualité tirée à part */
          const boxes = {};
          for(let n = extraBox > 0 && random() < extraBox ? 2 : 1; n > 0; n--){ const item = treasureItem(side, rollChestQuality(random), luck); boxes[item] = (boxes[item] ?? 0) + 1; }
          share.bag = { ...boxes, ...parts[i] };
        }
        /* stèle (30/10/2026, Geoffrey), Shrine héroïque (31/10) : leur charge n'est consommée qu'à la victoire ; un échec la laisse au chef */
        if(summary.success && rec.steleOwner) await withLock('shrine:' + rec.steleOwner, async () => {
          const st = sanitizeShrines(await store.getShrines(rec.steleOwner));
          const spent = [spendStele(st, rec.stele, 'stele:' + rec.id), spendStele(st, rec.heroic, 'heroic:' + rec.id)];
          if(spent.some(Boolean)) await store.putShrines(rec.steleOwner, st);
        });
      }
      /* instance (27/10/2026, Geoffrey) : roi vaincu → chaque joueur encore présent reçoit un coffre de l'instance (Instance
         I : Coffre du Roi Gobelin), qualité tirée par le serveur comme un trésor de tour.
         Clé (30/10/2026, Geoffrey ; ancien : prise au lancement, rendue à tous en cas d'échec) : vérifiée au lancement mais
         PRISE SEULEMENT À LA VICTOIRE, chez chaque joueur encore présent, dans la même écriture que son coffre. Échec, ou
         joueur parti avant la fin : il garde sa clé. Plus de clé à la victoire (impossible en jeu normal) : pas de coffre. */
      const inst = isInstanceMode(rec.mode) ? instanceDef(rec.mode) : null;
      if(inst) for(const share of summary.shares || []){
        const here = share.account && !share.left && !hasLeft(rec, share.account);
        /* Instance II (30/10) : un Coffre du Golbute ; un mineur mort pendant le combat le reçoit aussi (il est resté) */
        share.bag = !(summary.success && here) ? {}
          : inst.chest === 'goblin' ? { [goblinChestItem(rollChestQuality(random), rec.level ?? 1)]: 1 }   // niveau 2 : Coffre du Roi Gobelin II (29/10)
          : inst.chest === 'golbute' ? { [golbuteChestItem(rollChestQuality(random))]: 1 } : {};
      }
      /* versement : seulement aux joueurs de la session encore présents, une seule fois par session */
      for(const share of summary.shares || []){
        if(!share.account || !inSession(rec, share.account) || share.left || hasLeft(rec, share.account)) continue;
        await withLock('inv:' + share.account, async () => {
          const inv = await loadInventory(share.account);
          /* instance gagnée : la clé part avec le versement du coffre (une seule fois, comme lui) */
          if(inst && summary.success && inst.key && !inv.credited.includes(rec.id) && !removeItem(inv, inst.key, 1)) share.bag = {};
          if(!creditSession(inv, rec.id, share.bag)) return;
          const who = rec.players.find(p => p.account === share.account)?.name;
          markFound(Object.keys(share.bag || {}), who);
          await store.putInventory(share.account, JSON.parse(serialize(inv)));
          /* trésor de tour très rare : annoncé sur Discord, une seule fois (comme le versement) */
          for(const item of Object.keys(share.bag || {})) shout(treasureMessage(who, item));
          /* résidus versés : ils remplissent les jauges du Jugement (une seule fois, comme le versement) */
          await withJudgment(j => ({ save: addResidues(j, share.bag, clock()) }));
          /* tour réussie : « déjà faite » pour l'ouverture où elle a été lancée (pas une ouverture suivante) */
          if(side && summary.success)
            await withJudgment(j => ({ save: j[side].opening === rec.opening && markDone(j, side, share.account, rec.level ?? 1) }));
        });
        /* XP : sa part du pot commun, une seule fois par session (idempotent, comme le coffre) ; pas dans le MI */
        if(rec.mode !== 'mi' && !side && !isInstanceMode(rec.mode)) await withLock('xp:' + share.account, async () => {
          const pr = await loadProgress(share.account);
          /* area max : mine classique, hors dev (l'historique de cette partie n'est pas encore écrit : rattrapage avant) */
          let areaUp = false;
          if(rec.mode === 'mine' && !rec.dev){ await catchUpAreaMax(share.account, pr); areaUp = raiseAreaMax(pr, summary.areasUnlocked); }
          /* XP de spécialisation : recalculée ici, pour l'arbre figé au lancement (rec.skills, revérifié) */
          const tree = sanitizeSkills(rec.skills?.[share.account]).tree;
          const credited = creditXp(pr, rec.id, share.xp ?? 0, { tree, xp: specXpOf(share.xp) });
          if(credited || areaUp) await store.putProgress(share.account, pr);
          if(credited) await shareXp(share.account, share.xp, rec.dev);
        });
      }
      rec = await store.getGameSession(id);
      rec.status = 'done'; rec.result = summary; rec.endedAt = clock();
      chat.drop(id);
      await store.putGameSession(rec);
      /* tableau de bord : une ligne par joueur présent (écrite une seule fois, même si la fin est rejouée) */
      await store.putSessionStats(statRows(rec, summary, a => hasLeft(rec, a)));
      await recordTower(rec);
      await recordInstance(rec);
    }).finally(() => settling.delete(id));
    settling.set(id, p);
    return p;
  }

  /* ---------- classements (onglet Social → Classements, 27/10/2026) ---------- */

  /* tour céleste réussie (session terminée, pas en mode dev) : les joueurs présents à la victoire (ceux qui reçoivent le
     trésor) gardent ce temps s'il bat leur record ; team = les pseudos de tous ces joueurs. Rejouée : ne change rien.
     Un record par niveau (29/10) : clé « compte » au niveau 1, « compte#2 » au niveau 2 (recordKey) ; un record d'un autre
     niveau sous cette clé (ancien record du niveau 2 rangé au niveau 1, voir backfillTowers) est remplacé. */
  async function recordTower(rec){
    const r = rec.result, side = towerSide(rec.mode);
    if(!side || rec.dev || !r?.success || !Number.isFinite(r.t)) return;
    const heirs = (r.shares || []).filter(s => s.account && !s.left && !hasLeft(rec, s.account)).map(s => s.account);
    const name = a => rec.players.find(p => p.account === a)?.name || '';
    const level = rec.level ?? 1;
    const next = sanitizeTowerRecord({ t: r.t, at: rec.endedAt ?? clock(), side, level, team: heirs.map(name), session: rec.id });
    if(!next) return;
    for(const a of heirs) await withLock('tower_record:' + a, async () => {
      const key = recordKey(a, level), old = sanitizeTowerRecord(await store.getTowerRecord(key));
      if(betterTower(old?.level === level ? old : null, next)) await store.putTowerRecords([[key, next]]);
    });
  }
  /* instance réussie (roi gobelin vaincu, 29/10/2026 ; pas en mode dev) : comme une tour. t = temps de jeu de l'entrée à
     la mort du roi ; fight = de son réveil (spawners cassés) à sa mort. Les joueurs présents à la victoire (ceux qui
     reçoivent un coffre) gardent ce temps s'il bat leur record. Rejouée : ne change rien. */
  async function recordInstance(rec){
    const r = rec.result;
    if(!isInstanceMode(rec.mode) || rec.dev || !r?.success || !Number.isFinite(r.t)) return;
    const heirs = (r.shares || []).filter(s => s.account && !s.left && !hasLeft(rec, s.account)).map(s => s.account);
    const name = a => rec.players.find(p => p.account === a)?.name || '';
    const fight = Number.isFinite(r.awake) ? r.t - r.awake : null;
    const next = sanitizeInstanceRecord({ t: r.t, fight, at: rec.endedAt ?? clock(), instance: rec.mode, team: heirs.map(name), session: rec.id });
    if(!next) return;
    /* un record par niveau (29/10) : clé « compte » au niveau 1, « compte#2 » au niveau 2 (recordKey) */
    for(const a of heirs) await withLock('instance_record:' + a, async () => {
      const key = recordKey(a, rec.level ?? 1);
      const prev = sanitizeInstanceRecord(await store.getInstanceRecord(key));
      if(betterInstance(prev, next)) await store.putInstanceRecords([[key, next]]);
    });
  }
  /* au premier classement après un démarrage : les victoires en tour encore gardées (sessions des 30 derniers jours,
     d'avant les records) deviennent des records. Avant (29/10) : les records de tour d'avant les niveaux (sans level,
     tous sous la clé du compte) reçoivent le niveau de leur session ; un record du niveau 2 reste sous la clé du niveau 1,
     marqué niveau 2 : il n'y est plus classé et la prochaine victoire au niveau 1 le remplace (recordTower). */
  let towerBackfill = null;
  const backfillTowers = () => towerBackfill ??= (async () => {
    const done = await store.sessionsWithStatus('done'), levelOf = new Map(done.map(s => [s.id, s.level ?? 1]));
    for(const { account } of await store.listTowerRecords()) await withLock('tower_record:' + account, async () => {
      const raw = await store.getTowerRecord(account);
      if(!raw || typeof raw !== 'object' || raw.level !== undefined) return;
      await store.putTowerRecords([[account, { ...raw, level: levelOf.get(raw.session) ?? 1 }]]);
    });
    for(const rec of done){
      if(isTowerMode(rec.mode)) await recordTower(rec);
      if(isInstanceMode(rec.mode)) await recordInstance(rec);   // victoires contre le roi gobelin d'avant le classement (29/10)
    }
  })();

  /* valeurs brutes de tous les comptes : { gs, xp, spec:{ arbre }, tower, instance } (listes [{ id, value, … }]), gardées cacheMs */
  let boardCache = null;
  async function leaderboardData(){
    if(boardCache && clock() - boardCache.at < LEADERBOARD.cacheMs) return boardCache.data;
    await backfillTowers();
    const gs = (await store.listStuff()).map(({ account, value }) => ({ id: account, value: gearScore(sanitizeStuff(value, createInventory()).worn) }));
    const progress = (await store.listProgress()).map(({ account, value }) => ({ id: account, p: sanitizeProgress(value) }));
    const xp = progress.map(({ id, p }) => ({ id, value: p.xp, level: levelOf(p.xp).level }));
    const spec = Object.fromEntries(SKILLS.trees.map(t => [t.id, progress.map(({ id, p }) => ({ id, value: p.spec[t.id] ?? 0, level: specLevels(p)[t.id].level }))]));
    const towerRows = (await store.listTowerRecords()).map(({ account, value }) => ({ ...splitRecordKey(account), r: sanitizeTowerRecord(value) }))
      .filter(x => x.r && x.account && x.r.level === x.level);
    const towerBoard = level => towerRows.filter(x => x.level === level).map(({ account, r }) => ({ id: account, value: r.t, at: r.at, side: r.side, team: r.team }));
    const instRows = (await store.listInstanceRecords()).map(({ account, value }) => ({ ...splitRecordKey(account), r: sanitizeInstanceRecord(value) }))
      .filter(x => x.r && x.account);
    const instanceBoard = level => instRows.filter(x => x.level === level).map(({ account, r }) => ({ id: account, value: r.t, at: r.at, team: r.team, fight: r.fight }));
    boardCache = { at: clock(), data: { gs, xp, spec, tower: towerBoard(1), tower2: towerBoard(2), instance: instanceBoard(1), instance2: instanceBoard(2) } };
    return boardCache.data;
  }

  /* quitter : le joueur ne recevra rien de cette session (GAME_DESIGN §6). Son mineur quitte la partie tout de suite.
     Renvoie { left, session, mode, ended } (ended : il était le dernier, la partie s'arrête pour de bon). */
  async function leaveSession(accountId){
    return withLock('acct:' + accountId, async () => {
      const rec0 = await activeOf(accountId);
      if(!rec0) fail('no_session', 404, 'Aucune session en cours.');
      return withLock('sess:' + rec0.id, async () => {
        const rec = await store.getGameSession(rec0.id);
        if(rec.status !== 'running' || isDue(rec)) fail('session_over', 409, 'La session est terminée : son résultat arrive.');
        const now = clock();
        let ended = false;
        if(rec.players.every(p => p.account === accountId || hasLeft(rec, p.account))){
          /* plus aucun joueur : personne ne reçoit rien, la partie s'arrête */
          live.close(rec.id);
          rec.leaves.push({ account: accountId, tick: live.tickOf(rec.id) ?? targetTick(rec), at: now });
          rec.status = 'done'; rec.endedAt = now; chat.drop(rec.id);
          ended = true;
          rec.result = { abandoned: true, shares: rec.players.map(p => ({ account: p.account, left: true, bag: {} })) };
        } else {
          if(!ensureLive(rec)) fail('session_over', 409, 'La session est terminée : son résultat arrive.');
          rec.leaves.push({ account: accountId, tick: await live.leave(rec.id, accountId), at: now });
        }
        await store.putGameSession(rec);
        return { left: true, session: rec.id, mode: rec.mode ?? 'mine', ended };
      });
    });
  }

  /* termine une session tout de suite (dev, ou session dont l'heure est passée) ; sans effet sinon */
  async function settle(id){
    const rec = await store.getGameSession(id);
    if(!rec || rec.status !== 'running' || (!rec.dev && clock() < rec.finishAt)) return;
    if(rec.dev){ if(ensureLive(rec)) await live.finish(id); }
    else await pump();                                 // jeu normal : la partie finit à son rythme (budget de calcul)
    await settling.get(id);
  }

  return {
    dev, speed, areaMaxOf,
    /* wiki : objets secrets, et ceux déjà trouvés (leurs effets s'affichent) */
    wiki: async () => { const found = new Set(await store.listDiscovered?.() ?? []); return { secret: WIKI.secret, discovered: WIKI.secret.filter(i => found.has(i)) }; },
    info: () => ({ dev, speed: dev ? null : speed, speeds: dev ? GAME.devSpeeds : [speed], maxPlayers: GAME.maxPlayers,
                   ...(dev ? { copies: Object.keys(devCopies()) } : {}) }),

    /* état du joueur : inventaire, préférences, session en cours, et résultat d'une session terminée pas encore vu */
    async state(me, waitedId = null){
      const list = await store.sessionsOf(me.id);
      const active = list.find(s => ACTIVE.includes(s.status) && !hasLeft(s, me.id)) ?? null;
      /* bilan à montrer : seulement celui de sa DERNIÈRE session finie, s'il ne l'a pas vu (30/10/2026, Geoffrey). Avant :
         le plus récent des non vus ; les bilans quittés sans bouton (avant le correctif du 30/10) revenaient alors un par
         un, un plus ancien à chaque rechargement, jusqu'à 30 jours en arrière (keepEnded) */
      const finished = list.filter(s => s.status === 'done' && !hasLeft(s, me.id));
      /* 31/10/2026 : dernière = finie en dernier (list est triée par début : une mine instantanée commencée pendant une
         tour cachait son bilan). waitedId : la session que cet écran vient de jouer, à lui montrer même déjà vue (un autre
         onglet ou appareil l'a marquée en l'affichant) ; un rechargement ne l'envoie pas, le bilan ne revient donc pas */
      const last = finished.reduce((a, s) => !a || (s.endedAt ?? 0) > (a.endedAt ?? 0) ? s : a, null);
      const ended = finished.find(s => s.id === waitedId) ?? (last && !last.seen.includes(me.id) ? last : null);
      const inv = await loadInventory(me.id);
      const crusher = await withCrusher(me.id, (_, c) => publicCrusher(c, clock()));
      return { inventory: publicInventory(inv), furnaces: publicFurnaces(await loadFurnaces(me.id)), crusher,
               stuff: (await loadStuff(me.id, inv)).worn,
               progress: publicProgress(await loadProgress(me.id)),
               energy: publicEnergy(await loadEnergy(me.id)),
               skills: publicSkills(await loadSkills(me.id), await pointsOf(me.id)),
               spells: publicSpells(await loadSpells(me.id), await spellCtx(me.id)),
               sets: publicSets(sanitizeSets(await store.getSets(me.id))),
               prefs: await loadPrefs(me.id),
               session: publicSession(active), ended: publicSession(ended),
               prison: await prisonOfState(me.id) };
    },

    /* fiche d'un joueur vue par un ami (onglet Social ; c'est le service social qui vérifie l'amitié) : niveau, stuff
       porté, skills. Lecture seule, rien sur l'inventaire ni la session. */
    /* mode dev : copie un vrai joueur depuis la base en ligne (lecture seule, server/game/dev-live-copies.js) */
    async devCopyPlayer(me, body = {}){
      if(!dev) fail('forbidden', 403, 'Réservé au mode développeur.');
      if(!devLiveCopies) fail('no_copy_db', 503, 'Accès à la base non réglé (DIM_DEV_COPY_URL, voir docs/debug.md).');
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if(!name || name.length > 32) fail('bad_request', 400, 'Tape le pseudo du joueur.');
      let r;
      try { r = await devLiveCopies.read(name); }
      catch(e){ console.error('Copie de joueur :', e.message); fail('copy_failed', 502, 'Base en ligne injoignable.'); }
      if(!r) fail('not_found', 404, 'Aucun joueur avec ce pseudo.');
      if(r.refused) fail('copy_refused', 409, `Copie de ${r.name} refusée par le jeu (stuff ou skills invalides).`);
      return { who: r.who, name: r.name, copies: Object.keys(devCopies()) };
    },

    async profile(accountId){
      const inv = await loadInventory(accountId);
      return { stuff: (await loadStuff(accountId, inv)).worn,
               progress: publicProgress(await loadProgress(accountId)),
               skills: skillRanks(await loadSkills(accountId)) };
    },

    async setPrefs(me, body){
      const p = sanitizePrefs(body);
      await store.putPrefs(me.id, p);
      return { prefs: p };
    },

    /* lance une session. members : joueurs d'un groupe [{account, name}], celui qui lance en premier (mineur Rouge) ;
       absent = seul. Refusé si un des joueurs a déjà une session en cours. */
    async start(me, body = {}, members = null){
      const players = await Promise.all((members?.length ? members : [{ account: me.id, name: displayName(me) }])
        .map(async p => ({ account: String(p.account), name: String(p.name ?? ''), ...await guildField(String(p.account)) })));
      if(players[0].account !== me.id) fail('bad_request', 400, 'Le joueur qui lance doit être le premier.');
      if(new Set(players.map(p => p.account)).size !== players.length || players.length > GAME.maxPlayers)
        fail('bad_request', 400, 'Équipe invalide.');
      /* type de mine choisi dans le lobby (Mine par défaut) ; un type annoncé mais pas prêt (MI) est refusé */
      const mode = body.mode ?? MINE_MODES[0].id;
      const modeDef = MINE_MODES.find(m => m.id === mode);
      if(!modeDef) fail('bad_request', 400, 'Type de mine inconnu.');
      if(!modeDef.ready) fail('mode_not_ready', 400, `${modeDef.label} : bientôt disponible.`);
      if(modeDef.scheduled) fail('mode_scheduled', 400, `${modeDef.label} : elle s'ouvre à heure fixe, inscris-toi dans le lobby.`);
      if(modeDef.giant) fail('mode_giant', 400, `${modeDef.label} : on y entre seul, depuis son panneau dans le lobby.`);
      if(modeDef.prison) fail('mode_prison', 400, `${modeDef.label} : elle se lance depuis son bouton dans le lobby.`);
      const side = modeDef.tower ?? null;
      /* instance (27/10) : une clé par joueur, vérifiée et consommée au lancement (sous le verrou des inventaires) */
      const inst = modeDef.instance ? instanceDef(mode) : null;
      if(modeDef.instance && !inst?.ready) fail('mode_not_ready', 400, `${modeDef.label} : bientôt disponible.`);
      /* énergie (29/10) : seule la mine classique en coûte, hors mode dev ; verrou par compte, bots exclus (seuls les vrais joueurs) */
      const energyLocks = mode === 'mine' && !dev ? players.map(p => 'energy:' + p.account) : [];
      /* verrous : compte, et ceux d'un versement de prison (inventaire, XP, énergie, prison) : le lancement peut arrêter la
         prison d'un joueur (29/10) ; ils couvrent aussi les clés d'instance et l'énergie */
      return withLock.many([...players.map(p => 'acct:' + p.account), ...players.flatMap(p => prisonLocks(p.account))], async () => {
        /* tour du Jugement : ouverte, et personne du groupe ne l'a déjà faite pendant cette ouverture ; en mode dev, toujours
           ouverte et sans limite (25/10, Geoffrey : pour la tester en boucle) */
        let opening = null, level = null, stele = null, heroic = null;
        /* niveau d'instance (29/10/2026, Geoffrey) : INSTANCE.levels, 1 par défaut, même clé ; ouvert à tous */
        if(inst){
          level = body.level ?? 1;
          if(!levelsOf(mode).includes(level)) fail('bad_request', 400, "Niveau d'instance inconnu.");
        }
        if(side){
          /* stèle (30/10/2026, SHRINES exorcisme / pacte) et Shrine héroïque (31/10) : ceux du chef, chargés et activés ; rien
             n'est pris ici, la charge part à la victoire (settleWith). Déjà engagé dans une partie en cours de ce chef (il l'a
             quittée) : il ne compte pas une seconde fois. En mode dev, imposés par body.stele et body.heroic (sans les payer).
             Le niveau vient du Shrine héroïque, jamais du navigateur (niveau 2 retiré du lobby le 31/10). */
          if(dev){
            stele = shrineOf(body.stele)?.tower === side ? body.stele : null;
            heroic = body.heroic === true ? heroicFor(sanitizeShrines({ active: { heroique: 1 } })) : null;
          } else {
            const sh = sanitizeShrines(await store.getShrines(me.id)), mine = (await store.sessionsOf(me.id)).filter(s => ACTIVE.includes(s.status) && s.steleOwner === me.id);
            const free = (id, key) => id && !mine.some(s => s[key] === id) ? id : null;
            stele = free(steleFor(sh, side), 'stele'); heroic = free(heroicFor(sh), 'heroic');
          }
          level = shrineOf(heroic)?.effect?.level ?? 1;
          /* une seule victoire par joueur et par ouverture (31/10/2026, Geoffrey ; ancien : une par niveau) */
          const t = await withJudgment(j => ({ value: { open: towerOpen(j, side, clock()), opening: j[side].opening,
                                                         done: players.filter(p => hasWon(j, side, p.account)) } }));
          if(!t.open && !dev) fail('tower_closed', 409, `${modeDef.label} est fermée : elle ouvre quand sa jauge du Jugement est pleine.`);
          if(t.done.length && !dev) fail('tower_done', 409, `${t.done.map(p => p.name || 'Un joueur').join(', ')} a déjà gagné cette tour pendant cette ouverture.`);
          opening = t.opening;
        }
        /* mine classique : pas de résidus si une tour du Jugement est ouverte au lancement (23/10, figé dans la session) */
        const residues = side || inst ? null : await withJudgment(j => ({ value: !anyTowerOpen(j, clock()) }));
        if(await activeOf(me.id)) fail('session_running', 409, 'Tu as déjà une session en cours.');
        for(const p of players.slice(1))
          if(await activeOf(p.account)) fail('member_in_session', 409, `${p.name || 'Un joueur'} est déjà dans une session.`);
        /* places : les sessions à l'heure seulement (une session dépassée se rattrape sur le budget restant) */
        if((await store.sessionsWithStatus('running')).filter(r => !overdue(r)).length >= (config.maxLive ?? Infinity))
          fail('server_busy', 503, 'Le serveur fait déjà tourner le maximum de sessions. Réessaie dans quelques minutes.', { retryAfter: 60 });
        const lim = startLimit.check(me.id);
        if(!lim.ok) fail('rate_limited', 429, 'Trop de sessions lancées. Réessaie un peu plus tard.', { retryAfter: lim.retryAfter });
        startLimit.hit(me.id);
        /* clés : chaque joueur doit avoir la sienne (vérifié avant de compter le lancement) */
        const invs = {};
        if(inst){
          for(const p of players) invs[p.account] = await loadInventory(p.account);
          const miss = dev ? [] : missingKeys(mode, players, a => invs[a]);   // mode dev : sans clé (compte invité, 31/10)
          if(miss.length) fail('no_key', 409, `Il faut une ${inst.key} par joueur : ${miss.map(p => p.name || 'un joueur').join(', ')} n'en ${miss.length > 1 ? 'ont' : 'a'} pas.`);
        }
        /* énergie : chaque joueur doit pouvoir payer (vérifié avant de compter le lancement ; rien n'est débité ici) */
        const energies = {};
        if(energyLocks.length){
          for(const p of players) energies[p.account] = await loadEnergy(p.account);
          const poor = players.filter(p => !canPay(energies[p.account]));
          if(poor.length) fail('no_energy', 409, `Pas assez d'énergie (${ENERGY.cost.min} au moins) : ${poor.map(p => p.name || 'Un joueur').join(', ')}. L'énergie se recharge en prison (Lobby, « Où miner », Prison).`);
        }
        const now = clock();
        const prefs = {}, looks = {}, gear = {}, skills = {}, spells = {}, statsAt = {};
        for(const p of players){
          /* figés pour toute la session : préférences, skills (glyphes compris), sorts, apparence et pièces portées */
          const f = await freezePlayer(p.account);
          prefs[p.account] = f.prefs; skills[p.account] = f.skills; spells[p.account] = f.spells;
          looks[p.account] = f.look; gear[p.account] = f.gear;
          /* tableau de bord de l'équipe : niveau, arbre et ilvl au lancement (mine classique, server/admin/dashboard.js) */
          if(mode === 'mine') statsAt[p.account] = launchSnapshot({ xp: (await loadProgress(p.account)).xp,
                                                                    tree: skills[p.account].tree, gear: gear[p.account] });
        }
        /* modulation d'une tour : chaque joueur sous le plafond de gear score, avec le stuff porté au lancement */
        const modulation = body.modulation === true;
        if(modulation){
          if(!TOWER.modulation.open && !dev) fail('bad_request', 400, "La modulation n'est pas encore ouverte.");
          if(!side) fail('bad_request', 400, 'La modulation ne concerne que les tours du Jugement.');
          const over = players.filter(p => gearScore(gear[p.account]) >= TOWER.modulation.gsMax);
          if(over.length) fail('gs_too_high', 409, `Modulation : il faut moins de ${TOWER.modulation.gsMax} GS chacun. `+
            over.map(p => `${p.name || 'Un joueur'} a ${gearScore(gear[p.account])} GS`).join(', ') + '.');
        }
        /* prison (29/10) : lancer une mine, une tour ou une instance termine la prison de chaque joueur, après tous les refus
           et avant la création de la session (coffre et énergie du run versés, pas le sac) : jamais deux parties pour un
           joueur. Ce qui a été versé est relu (inventaire, énergie, glyphes possédés). */
        for(const p of players){
          if(!(await stopPrisonOf(p.account)).stopped) continue;
          skills[p.account].owned = ownedGlyphs(await loadSkills(p.account), await loadInventory(p.account));
          if(inst) invs[p.account] = await loadInventory(p.account);
          if(energyLocks.length) energies[p.account] = await loadEnergy(p.account);
        }
        /* shrines du chef (28/10/2026, SHRINES) : mine classique hors mode dev ; chaque shrine actif perd une session ici,
           au lancement, et ses effets sont enregistrés dans la session (la partie se rejoue à l'identique) */
        const shrines = mode === 'mine' && !dev ? await withLock('shrine:' + me.id, async () => {
          const st = sanitizeShrines(await store.getShrines(me.id)), used = consumeShrines(st);
          if(used.length) await store.putShrines(me.id, st);
          return used;
        }) : [];
        /* mode dev : un preset par mineur (body.presets : les joueurs, puis les mineurs de test, 31/10/2026). Un mineur de
           test choisi compte, même si le nombre de mineurs de test demandé est plus petit */
        const places = dev ? sanitizeBotPresets(body.presets) : null, placeOfPlayers = places?.slice(0, players.length) ?? null;
        const botPresets = dev ? sanitizeBotPresets(places ? places.slice(players.length) : body.botPresets) : null;
        const botsWanted = Math.max(dev && isInt(body.bots) ? body.bots : 0, (botPresets?.findLastIndex(Boolean) ?? -1) + 1);
        const rec = {
          id: crypto.randomUUID(),
          mode,
          seed: dev && isInt(body.seed) && body.seed >= 0 && body.seed < 2**31 ? body.seed : randomSeed(),
          players,
          bots: dev ? Math.max(0, Math.min(GAME.maxPlayers - players.length, botsWanted)) : 0,
          prefs, looks, gear, skills, spells,
          overrides: dev ? sanitizeOverrides(body.overrides) : null,
          devSpecs: dev ? sanitizeDevSpecs(body.devSpecs) : null,   // spécialisations imposées (mode dev)
          botPresets,   // presets des mineurs de test (mode dev)
          ...(dev ? botCopiesOf(botPresets) : {}),   // copies de vrais joueurs (data/presets/)
          ...(placeOfPlayers?.some(Boolean) ? { playerPresets: placeOfPlayers, playerCopies: botCopiesOf(placeOfPlayers).botCopies ?? null } : {}),
          ...(dev ? selfPresetOf(body.selfPreset) : {}),   // preset du joueur qui lance (mode dev, 29/10)
          dev, speed: dev ? null : speed, startedAt: now,
          finishAt: dev ? null : now + (side ? towerDurationMs(speed) : inst ? instanceDurationMs(speed) : realDurationMs(speed)),
          ...(side ? { opening, level } : inst ? { level } : {}),
          ...(modulation ? { modulation: { gsMax: TOWER.modulation.gsMax } } : {}),
          ...(residues === false ? { residues: false } : {}),
          ...(shrines.length ? { shrines } : {}),
          ...(stele ? { stele } : {}), ...(heroic ? { heroic } : {}),
          ...((stele || heroic) && !dev ? { steleOwner: me.id } : {}),
          ...(mode === 'mine' && !dev ? { statsAt } : {}),
          leaves: [], focus: [], status: 'running', result: null, seen: [],
          clock: dev ? { tick: 0, at: now, speed: GAME.devSpeeds[0], paused: false } : null,
        };
        /* énergie : débit juste avant la création de la session, après tous les autres refus ; clé = id de session */
        if(energyLocks.length){
          rec.energy = {};
          for(const p of players){
            /* dès 6 d'énergie le lancement réussit toujours : le coût est plafonné à l'énergie restante (jamais négative) */
            const cost = Math.min(rollCost(random), Math.floor(energies[p.account].value));
            if(!spendEnergy(energies[p.account], rec.id, cost)) throw new Error('énergie : débit impossible après la vérification (bug)');
            rec.energy[p.account] = cost;
          }
          for(const p of players) await store.putEnergy(p.account, energies[p.account]);
        }
        /* instance : la clé est seulement vérifiée ici (plus haut) ; elle est prise à la victoire (30/10/2026) */
        await store.putGameSession(rec);
        ensureLive(rec);
        for(const fn of startHooks) Promise.resolve().then(() => fn(players.map(p => p.account))).catch(console.error);
        return { session: publicSession(rec) };
      });
    },

    /* lance une prison (solo). members : membres de son groupe au lobby (service des groupes), comme start ; plusieurs →
       refus. Une seule prison à la fois ; pas pendant une mine, une tour ou une instance (la mine instantanée et le Bloc
       géant, si). Le mineur est figé maintenant, comme pour une session ; le contenu est celui de son area max. */
    /* areas que le joueur peut choisir pour sa prison : 0 à son area max débloquée (mode dev : toutes) */
    /* profil de la prison que le joueur aurait s'il y entrait maintenant (lobby : ce que la carte contiendra) */
    /* compos (30/10) : actuelle (paliers de 10 mines), ancienne (mines 11 à 20), enregistrée ; les paliers sont gardés */
    prisonProfile: async me => withLock('prison:' + me.id, async () => publicCompos(await advanceCompos(me.id))),
    /* « Enregistrer » : which = 'current' | 'previous' devient la compo enregistrée (remplace l'ancienne enregistrée) */
    async prisonSaveCompo(me, body = {}){
      if(!['current', 'previous'].includes(body?.compo)) fail('bad_request', 400, 'Composition invalide.');
      return withLock('prison:' + me.id, async () => {
        const c = await advanceCompos(me.id), p = pickCompo(c, body.compo);
        if(!p) fail('no_compo', 409, 'Cette composition n\'existe pas encore.');
        c.saved = p; await store.putPrisonCompo(me.id, c);
        return publicCompos(c);
      });
    },
    /* body (mode dev seulement) : { speed } (GAME.devSpeeds) */
    async prisonStart(me, members = null, body = {}){
      if(Array.isArray(members) && members.length > 1) fail('not_solo', 409, 'La prison se joue seul : quitte ton groupe pour la lancer.');
      if(body?.area !== undefined && body.area !== null && !isInt(body.area)) fail('bad_request', 400, 'Area invalide.');
      if(body?.compo !== undefined && body.compo !== null && !['current', 'previous', 'saved'].includes(body.compo)) fail('bad_request', 400, 'Composition invalide.');
      await withLock.many(['acct:' + me.id, 'prison:' + me.id], async () => {
        const old = await loadPrison(me.id);
        if(old && old.state !== 'done') fail('prison_running', 409, 'Ta prison tourne déjà.');
        if(await sessionOf(me.id)) fail('session_running', 409, 'Tu as déjà une session en cours : termine-la d\'abord.');
        const lim = prisonLimit.check(me.id);
        if(!lim.ok) fail('rate_limited', 429, 'Trop de prisons lancées. Réessaie un peu plus tard.', { retryAfter: lim.retryAfter });
        prisonLimit.hit(me.id);
        /* contenu de la prison (29/10/2026, Geoffrey) : le profil des 10 dernières mines classiques du joueur (area moyenne,
           minerais, treasures, mobs ; src/meta/prison-profile.js), figé pour toute la prison ; pas de choix d'area */
        const compos = await advanceCompos(me.id);   // compos (30/10) : actuelle, ancienne (mines 11 à 20), enregistrée
        const profile = pickCompo(compos, body?.compo ?? 'current'), area = profile?.area;
        if(!profile) fail('no_compo', 409, 'Cette composition n\'existe pas encore.');
        const specs = { name: displayName(me), ...await guildField(me.id), ...await freezePlayer(me.id) };
        const runSpeed = dev && GAME.devSpeeds.includes(body?.speed) ? body.speed : speed;
        await loadEnergy(me.id);   // repos soldé jusqu'à l'entrée en prison (30/10/2026)
        const p = newPrisonRecord({ id: crypto.randomUUID(), account: me.id, seed: randomSeed(), specs, areaMax: area, profile, now: clock(), speed: runSpeed });
        await store.putPrison(me.id, p);
        (await indexOfPrisons()).add(me.id);
        openRun(p);
      });
      return { prison: (await seePrison(me.id)).prison };
    },
    /* « Sortir de prison » : le run en cours est arrêté au tick atteint ; son coffre (pas le sac) et son énergie sont
       versés, la prison est fermée. Rejoué, ou sans prison : rien. */
    async prisonStop(me){
      return withLock.many(['acct:' + me.id, ...prisonLocks(me.id)], async () => {
        const { prison } = await stopPrisonOf(me.id);
        return { prison: publicPrison(prison, null, { cfg }) };
      });
    },

    /* mine instantanée : ouvre une mine pour ces joueurs [{account, name}] à l'heure slot (ms). id = id de la mine,
       choisi par le service des inscriptions (le même pour la même ouverture) : une mine déjà ouverte ne l'est pas
       deux fois (redémarrage pendant l'ouverture). Un joueur déjà en session est écarté. Pas de limite de places :
       une mine instantanée coûte peu (~0,2 s de calcul pour 20 joueurs). Renvoie la session, ou null. */
    async openInstant(id, slot, list){
      const players = [];
      for(const p of list) if(!players.some(q => q.account === p.account)) players.push({ account: String(p.account), name: String(p.name ?? ''), ...await guildField(String(p.account)) });
      return withLock.many(players.map(p => 'acct:' + p.account), async () => {
        if(await store.getGameSession(id)) return null;
        const ok = [];
        for(const p of players) if(!await activeOf(p.account)) ok.push(p);   // une visite au Bloc géant n'empêche plus (27/10)
        if(!ok.length) return null;
        const looks = {}, gear = {}, skills = {};
        for(const p of ok){
          skills[p.account] = sessionSkills(await loadSkills(p.account));
          const st = await loadStuff(p.account, await loadInventory(p.account));
          looks[p.account] = lookOf(st);
          gear[p.account] = gearOf(st);      // pièces complètes : seulement pour l'aura (src/meta/aura.js)
        }
        const rec = {
          id, mode: 'mi', seed: randomSeed(), players: ok, bots: 0, prefs: {}, looks, gear, skills, overrides: null,
          dev: false, speed: GAME.speed, startedAt: slot, finishAt: slot + instantDurationMs(GAME.speed),
          leaves: [], focus: [], status: 'running', result: null, seen: [], clock: null,
        };
        await store.putGameSession(rec);
        ensureLive(rec);
        return publicSession(rec);
      });
    },
    /* fn(comptes) après chaque lancement d'une session normale (le service des inscriptions désinscrit ces joueurs) */
    onStart: fn => { startHooks.push(fn); },

    /* quitter (bouton « Quitter ») */
    async leave(me){ return { left: (await leaveSession(me.id)).left }; },

    /* focus (minerai, area) changé pendant la session : appliqué tout de suite dans la partie, enregistré avec son
       tick (GAME_DESIGN §3). Aucune ressource en jeu : on vérifie la forme et le nombre de changements. */
    async focus(me, body = {}){
      const f = body.focus;
      if(!f || typeof f !== 'object' || Array.isArray(f)) fail('bad_request', 400, 'Focus invalide.');
      return withLock('acct:' + me.id, async () => {
        const rec0 = await activeOf(me.id);
        if(!rec0) fail('no_session', 404, 'Aucune session en cours.');
        return withLock('sess:' + rec0.id, async () => {
          const rec = await store.getGameSession(rec0.id);
          if(rec.status !== 'running' || isDue(rec)) fail('session_over', 409, 'La session est terminée.');
          if(rec.mode === 'mi') fail('bad_request', 400, 'Pas de focus dans la mine instantanée.');
          if(isTowerMode(rec.mode)) fail('bad_request', 400, 'Pas de focus dans une tour.');
          if(isInstanceMode(rec.mode)) fail('bad_request', 400, 'Pas de focus dans une instance.');
          rec.focus ??= [];
          if(rec.focus.filter(e => e.account === me.id).length >= FOCUS.maxChanges)
            fail('too_many', 429, 'Trop de changements de focus dans cette session.');
          const focus = sanitizeFocus(f);
          if(!FOCUS.ores) for(const k of Object.keys(focus)) if(k !== 'area') delete focus[k];   // focus minerai retiré du jeu (30/10)
          if(!ensureLive(rec)) fail('session_over', 409, 'La session est terminée.');
          const ev = { account: me.id, tick: await live.focus(rec.id, me.id, focus), focus };
          rec.focus.push(ev);
          await store.putGameSession(rec);
          return { event: ev };
        });
      });
    },

    /* chat de la session : seuls ses joueurs encore là écrivent ; le nom affiché est celui de la session (serveur),
       jamais celui envoyé par le navigateur. En mémoire seulement (server/game/chat.js). */
    async chatPost(me, body = {}){
      const rec = await activeOf(me.id);
      if(!rec || rec.status !== 'running') fail('no_session', 404, 'Aucune session en cours.');
      const r = chat.post(rec.id, me.id, rec.players.find(p => p.account === me.id).name, body.text);
      if(r.error === 'bad_text') fail('bad_request', 400, `Message vide ou trop long (${CHAT.maxLen} caractères au plus).`);
      if(r.error === 'too_fast') fail('too_many', 429, 'Doucement : un message par seconde au plus.');
      /* mot interdit (30/10) : publié masqué, et un avertissement pour son auteur */
      const warning = r.hits.length && moderation
        ? await moderation.warn(me.id, { channel: 'session', text: r.original, masked: r.msg.text, hits: r.hits }) : null;
      return { message: r.msg, ...(warning ? { warning } : {}) };
    },
    /* messages de sa session après le numéro after (absent ou invalide : tous ceux gardés) */
    async chatGet(me, after){
      const rec = await activeOf(me.id);
      if(!rec) fail('no_session', 404, 'Aucune session en cours.');
      return { messages: chat.since(rec.id, Number.isSafeInteger(after) && after > 0 ? after : 0) };
    },

    /* la partie, pour l'afficher : depuis le tick since que le navigateur a déjà (absent : la carte entière).
       Répond tout de suite avec l'état actuel (c'est pump qui fait avancer la partie). Lecture seule.
       Partie terminée : view null (le résultat arrive). */
    async view(me, since){
      const rec = await activeOf(me.id);
      if(!rec) fail('no_session', 404, 'Aucune session en cours.');
      const s = Number.isSafeInteger(since) && since >= 0 ? since : null;
      const ok = rec.status === 'running' && ensureLive(rec);
      /* la partie peut se terminer (et le moteur la fermer) pendant que la vue attend son tour : « settling » */
      const view = ok ? await live.view(rec.id, s).catch(e => { if(live.has(rec.id)) throw e; return null; }) : null;
      return { view, status: view ? 'running' : 'settling', clock: rec.dev ? rec.clock : null, now: clock(), ...await teamEnergies(rec) };
    },

    /* la prison du joueur, pour l'afficher (GET /api/game/prison) : c'est une visite (présence, retour après une
       attente) ; le retard est joué avant l'envoi. view : le run en cours depuis le tick since (absent : carte entière). */
    async prisonView(me, since){
      const s = Number.isSafeInteger(since) && since >= 0 ? since : null;
      const r = await seePrison(me.id, { since: s, withView: true, play: true });
      return { ...r, now: clock() };
    },

    /* mode dev : vitesse de la prison (29/10/2026). Le run garde le tick atteint : son début est recalé pour que, à la
       nouvelle vitesse, le temps réel écoulé donne ce même tick (prisonDueMs / prisonTickAt). */
    async prisonClock(me, body = {}){
      if(!dev) fail('forbidden', 403, 'Réservé au mode développeur.');
      if(!GAME.devSpeeds.includes(body.speed)) fail('bad_request', 400, 'Vitesse invalide.');
      return withLock.many(prisonLocks(me.id), async () => {
        const p = await loadPrison(me.id);
        if(!p || p.state === 'done') fail('no_prison', 404, 'Aucune prison en cours.');
        const now = clock(), t = dueTick(p);   // le tick dû (le moteur, un peu en retard, le rattrape au prochain affichage)
        p.speed = body.speed;
        p.runStartedAt = Math.min(now, p.lastSeenAt + cfg.offlineMax) - p.pausedMs - t * DT * 1000 / p.speed;
        await store.putPrison(me.id, p);
        return { prison: publicPrison(p, null, { cfg }) };
      });
    },

    /* mode dev : vitesse et pause de la session (l'horloge est sur le serveur, la partie aussi) */
    async devClock(me, body = {}){
      if(!dev) fail('forbidden', 403, 'Réservé au mode développeur.');
      const rec0 = await activeOf(me.id);
      if(!rec0) fail('no_session', 404, 'Aucune session en cours.');
      return withLock('sess:' + rec0.id, async () => {
        const rec = await store.getGameSession(rec0.id);
        /* l'horloge repart d'où la partie en est vraiment (si elle n'arrive pas à suivre la vitesse demandée) */
        const c = { ...rec.clock, tick: Math.min(targetTick(rec), live.tickOf(rec.id) ?? Infinity), at: clock() };
        if(GAME.devSpeeds.includes(body.speed)) c.speed = body.speed;
        if(typeof body.paused === 'boolean') c.paused = body.paused;
        rec.clock = c;
        await store.putGameSession(rec);
        return { session: publicSession(rec) };
      });
    },

    /* « c'est fini » : en mode normal, refusé avant l'heure (la partie se termine d'elle-même au dernier tick) ;
       en mode dev, la partie est jouée jusqu'au bout tout de suite (fin libre) */
    async finish(me){
      const rec = await activeOf(me.id);
      if(!rec) fail('no_session', 404, 'Aucune session en cours.');
      if(rec.status === 'running' && !rec.dev && clock() < rec.finishAt)
        fail('too_early', 409, 'La session n\'est pas encore terminée.', { retryAfter: Math.ceil((rec.finishAt - clock()) / 1000) });
      await settle(rec.id);
      return { session: publicSession(await store.getGameSession(rec.id)) };
    },

    /* administration (server/admin/routes.js, jamais appelée par un joueur) : donne qty exemplaires d'un objet du jeu à
       un compte, sous le verrou de son inventaire (comme une action du joueur : mémoire et base changent ensemble, aucun
       redémarrage). Nom exact d'ITEMS, qty entier de 1 à ADMIN_MAX_QTY. */
    /* quality (facultative, 1 à 7) : la pièce de stuff arrive déjà identifiée dans cette qualité */
    async adminGive(accountId, item, qty, quality){
      if(typeof item !== 'string' || !Object.hasOwn(ITEMS, item)) fail('bad_item', 400, `« ${item} » n'est pas un objet du jeu (nom exact).`);
      if(!Number.isSafeInteger(qty) || qty < 1 || qty > ADMIN_MAX_QTY) fail('bad_request', 400, `Quantité : un entier de 1 à ${ADMIN_MAX_QTY}.`);
      if(quality !== undefined){
        if(!Number.isSafeInteger(quality) || !qualityDef(quality)) fail('bad_request', 400, 'Qualité : un entier de 1 à 7.');
        if(!canIdentify(item)) fail('bad_item', 400, `« ${item} » n'a pas de qualité (seulement les pièces de stuff, hors anneaux, boussoles et torches).`);
      }
      return withLock('inv:' + accountId, async () => {
        const inv = await loadInventory(accountId);
        if(ITEMS[item].cat === 'stuff' || ITEMS[item].stack === false) await loadStuff(accountId, inv);   // uid neufs
        const before = countOf(inv, item);
        const touched = addItem(inv, item, qty);
        if(quality !== undefined) for(const i of touched) inv.slots[i].q = quality;
        if(rolledSpec(item)) for(const i of touched) Object.assign(inv.slots[i], rollStats(item, random));   // Cape inclusive : jamais sans ses lignes
        await store.putInventory(accountId, JSON.parse(serialize(inv)));
        return { item, qty, ...(quality !== undefined && { quality }), before, after: countOf(inv, item) };
      });
    },

    /* Raffle (31/10/2026, server/social/raffle.js) : verse le lot une seule fois par raffle (id), même rejoué ; true si versé.
       Rune : ses lignes sont tirées ici, comme à l'ouverture d'un coffre ; énergie : plafonnée à ENERGY.max */
    raffleGive(accountId, id, lot){
      return withLock('inv:' + accountId, async () => {
        if(lot.energy){
          const e = await loadEnergy(accountId);
          if(!creditEnergy(e, id, lot.energy)) return false;
          await store.putEnergy(accountId, e);
          return true;
        }
        const inv = await loadInventory(accountId);
        if(lot.rune) await loadStuff(accountId, inv);    // uid neuf : jamais celui d'une pièce portée
        const slots = creditSession(inv, id, lot.rune ? { [lot.rune]: 1 } : { [lot.item]: lot.qty });
        if(!slots) return false;
        if(lot.rune) Object.assign(inv.slots[slots[0]], rollRune(lot.q, random));
        await store.putInventory(accountId, JSON.parse(serialize(inv)));
        return true;
      });
    },

    /* administration (29/10/2026, Geoffrey) : sort un joueur de sa session en cours, comme son bouton « Quitter » (il ne
       reçoit rien de cette session ; les autres continuent ; dernier joueur : la partie s'arrête, personne ne reçoit rien) */
    adminLeave: accountId => leaveSession(accountId),

    /* administration : retire qty exemplaires d'un objet à un compte (ex. un glyphe donné par erreur), sous les verrous
       de son inventaire et de ses skills (même ordre que glyph_pose). D'abord l'inventaire ; un glyphe posé sur son skill
       compte pour 1 et est retiré de la case s'il en manque. Tout ou rien : s'il en a moins que qty, rien ne change. */
    async adminTake(accountId, item, qty){
      if(typeof item !== 'string' || !Object.hasOwn(ITEMS, item)) fail('bad_item', 400, `« ${item} » n'est pas un objet du jeu (nom exact).`);
      if(!Number.isSafeInteger(qty) || qty < 1 || qty > ADMIN_MAX_QTY) fail('bad_request', 400, `Quantité : un entier de 1 à ${ADMIN_MAX_QTY}.`);
      return withLock('inv:' + accountId, () => withLock('skills:' + accountId, async () => {
        const inv = await loadInventory(accountId), st = await loadSkills(accountId);
        const node = nodeOfGlyph(item), posed = node && st.glyphs?.[node] === item ? 1 : 0;
        const inInv = countOf(inv, item), before = inInv + posed;
        if(before < qty) fail('not_owned', 409, `Il n'en a que ${before} (inventaire ${inInv}, posé ${posed}).`);
        const fromInv = Math.min(qty, inInv), fromSkill = qty - fromInv;
        if(fromInv) removeItem(inv, item, fromInv);
        if(fromSkill){ delete st.glyphs[node]; await store.putInventoryAndSkills(accountId, JSON.parse(serialize(inv)), st); }
        else await store.putInventory(accountId, JSON.parse(serialize(inv)));
        return { item, qty, fromInventory: fromInv, fromSkill, before, after: before - qty };
      }));
    },

    /* ouvrir un Treasure TX de son inventaire : le serveur tire le butin. opId (choisi par le navigateur) rend la
       demande rejouable sans effet : la même demande renvoie le même butin. */
    async open(me, body = {}){
      const { item, opId } = body;
      if(typeof item !== 'string' || !canOpen(item)) fail('bad_item', 400, 'Cet objet ne s\'ouvre pas.');
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      return withLock('inv:' + me.id, async () => {
        const inv = await loadInventory(me.id);
        await loadStuff(me.id, inv);                     // une rune reçoit un uid neuf : jamais celui d'une pièce portée
        /* all : « Ouvrir tout » (tous les exemplaires, au plus TREASURE.openAllMax) */
        const ctx = { spells: (await loadSpells(me.id)).learned };   // coffre du Roi Gobelin : un sort appris ne ressort pas
        const res = body.all === true ? openAll(inv, item, opId, random, ctx) : openTreasure(inv, item, opId, random, ctx);
        if(!res) fail('not_owned', 409, `Tu n'as pas de ${item} à ouvrir.`);
        if(!res.repeated){ await store.putInventory(me.id, JSON.parse(serialize(inv))); markFound(Object.keys(res.loot || {}), displayName(me)); }
        return { item, count: res.count ?? 1, loot: res.loot, inventory: publicInventory(inv) };
      });
    },

    /* four : poser dans une case, la vider, récupérer les lingots. Inventaire et fours changent ensemble, sous le verrou
       de l'inventaire ; opId rend la demande rejouable sans effet (double clic, requête renvoyée). */
    async furnace(me, body = {}){
      const { opId } = body;
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      const op = { action: body.action, furnace: body.furnace, slot: body.slot, item: body.item, qty: body.qty, mode: body.mode, out: body.out, count: body.count, opId };
      return withLock('inv:' + me.id, async () => {
        const inv = await loadInventory(me.id), st = await loadFurnaces(me.id);
        const r = furnaceOp(st, inv, op, clock());
        if(r.error) fail(r.error, ['not_enough', 'slot_busy', 'not_empty', 'no_recipe', 'already_unlocked', 'locked_before'].includes(r.error) ? 409 : 400, FURNACE_ERRORS[r.error] ?? 'Demande invalide.');
        if(!r.repeated) await store.putInventoryAndFurnaces(me.id, JSON.parse(serialize(inv)), st);
        return { inventory: publicInventory(inv), furnaces: publicFurnaces(st), left: r.left ?? 0 };   // left : cases restées (« Tout retirer », inventaire plein)
      });
    },

    /* concasseur : état à jour (le navigateur le redemande à la fin de chaque cycle) */
    async crusherState(me){
      return withCrusher(me.id, (inv, c) => ({ inventory: publicInventory(inv), crusher: publicCrusher(c, clock()) }));
    },
    /* concasseur : poser des blocs, vider une case, récupérer le butin. Inventaire et concasseur changent ensemble ;
       opId rend la demande rejouable sans effet. */
    async crusher(me, body = {}){
      const { opId } = body;
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      const op = { action: body.action, slot: body.slot, item: body.item, qty: body.qty, opId };
      return withCrusher(me.id, async (inv, c) => {
        const r = crusherOp(c, inv, op, clock());
        if(r.error) fail(r.error, ['not_enough', 'slot_busy'].includes(r.error) ? 409 : 400, CRUSHER_ERRORS[r.error] ?? 'Demande invalide.');
        if(!r.repeated) await store.putInventoryAndCrusher(me.id, JSON.parse(serialize(inv)), c);
        return { inventory: publicInventory(inv), crusher: publicCrusher(c, clock()) };
      });
    },

    /* craft : le serveur vérifie la recette et les ingrédients, retire et donne en une fois (opId : une seule fois) */
    async craft(me, body = {}){
      const { item, opId } = body;
      if(typeof item !== 'string') fail('bad_item', 400, 'Objet inconnu.');
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      return withLock('inv:' + me.id, async () => {
        const inv = await loadInventory(me.id);
        await loadStuff(me.id, inv);                     // garde les uid uniques (pièces portées comprises)
        const r = craft(inv, item, opId, random);       // Rune : qualité et lignes tirées par le serveur
        if(r.error) fail(r.error, r.error === 'not_enough' ? 409 : 400, CRAFT_ERRORS[r.error]);
        if(!r.repeated) await store.putInventory(me.id, JSON.parse(serialize(inv)));
        return { item, ...(r.pieces ? { piece: r.pieces[0] } : {}), inventory: publicInventory(inv) };
      });
    },

    /* skills : { action:'learn', node } ou { action:'reset' } (gratuit, refusé pendant une session : les skills de la
       session en cours sont figés au lancement). opId : une demande renvoyée n'agit qu'une fois. */
    async skills(me, body = {}){
      const { action, opId } = body;
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      const skillErr = e => fail(e, e === 'unknown' || e === 'bad_request' ? 400 : 409, SKILL_ERRORS[e] ?? 'Demande invalide.');
      /* glyphes : { action:'glyph_pose' | 'glyph_remove', node } ; l'objet quitte ou rejoint l'inventaire, refusé en session
         (les glyphes de la session en cours sont figés au lancement) ; inventaire et skills enregistrés ensemble */
      if(action === 'glyph_pose' || action === 'glyph_remove') return withLock('inv:' + me.id, () => withLock('skills:' + me.id, async () => {
        const inv = await loadInventory(me.id), points = await pointsOf(me.id), st = await loadSkills(me.id);
        if(st.ops.includes(opId)) return { skills: publicSkills(st, points), inventory: publicInventory(inv) };
        if(await activeOf(me.id)) fail('session_running', 409, 'Impossible pendant une session : termine-la d\'abord.');
        const r = glyphOp(st, inv, { action: action === 'glyph_pose' ? 'pose' : 'remove', node: body.node, opId });
        if(r.error) skillErr(r.error);
        if(!r.repeated) await store.putInventoryAndSkills(me.id, JSON.parse(serialize(inv)), st);
        return { skills: publicSkills(st, points), inventory: publicInventory(inv) };
      }));
      return withLock('skills:' + me.id, async () => {
        if(action === 'reset' && await activeOf(me.id)) fail('session_running', 409, 'Reset impossible pendant une session : termine-la d\'abord.');
        const points = await pointsOf(me.id), st = await loadSkills(me.id);
        const r = skillOp(st, { action, node: body.node, opId }, points);
        if(r.error) fail(r.error, r.error === 'unknown' || r.error === 'bad_request' ? 400 : 409, SKILL_ERRORS[r.error] ?? 'Demande invalide.');
        if(!r.repeated) await store.putSkills(me.id, st);
        return { skills: publicSkills(st, points) };
      });
    },

    /* sorts : { action:'equip', spell, slot } | { action:'unequip', slot } | { action:'learn', item } (apprendre un
       parchemin : il quitte l'inventaire, le sort reste acquis). Possible pendant une session : les sorts de la session
       en cours sont figés au lancement. opId : une demande renvoyée n'agit qu'une fois. */
    async spells(me, body = {}){
      const { action, opId } = body;
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      const err = e => fail(e, e === 'unknown' || e === 'bad_request' ? 400 : 409, SPELL_ERRORS[e] ?? 'Demande invalide.');
      if(action === 'learn') return withLock('inv:' + me.id, () => withLock('spells:' + me.id, async () => {
        const inv = await loadInventory(me.id), st = await loadSpells(me.id);
        const r = learnScroll(st, inv, body.item, opId);
        if(r.error) err(r.error);
        if(!r.repeated) await store.putInventoryAndSpells(me.id, JSON.parse(serialize(inv)), st);
        return { spells: publicSpells(st, await spellCtx(me.id)), inventory: publicInventory(inv) };
      }));
      return withLock('spells:' + me.id, async () => {
        const st = await loadSpells(me.id), ctx = await spellCtx(me.id);
        const r = spellOp(st, { action, spell: body.spell, slot: body.slot, opId }, ctx);
        if(r.error) err(r.error);
        if(!r.repeated) await store.putSpells(me.id, st);
        return { spells: publicSpells(st, ctx) };
      });
    },

    /* sets : { action:'create' } | { action:'save', id } | { action:'rename', id, name } | { action:'delete', id } |
       { action:'equip', id }. Créer et enregistrer : refusés pendant une session. Équiper est permis pendant une session
       (28/10/2026, Geoffrey ; avant : refusé) : la session en cours garde le stuff, les skills et les sorts figés à son
       lancement (rec.gear, rec.skills, rec.spells), le set ne compte qu'à partir de la prochaine. Équiper touche l'inventaire, le stuff, les skills et les sorts : tout est écrit en une fois. opId : une demande
       renvoyée n'agit qu'une fois. */
    async sets(me, body = {}){
      const { action, opId } = body;
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      if(!['create', 'save', 'rename', 'delete', 'equip'].includes(action)) fail('bad_request', 400, 'Demande invalide.');
      const err = e => fail(e, e === 'bad_request' ? 400 : e === 'unknown' ? 404 : 409, SET_ERRORS[e] ?? 'Demande invalide.');
      return withLock.many(['inv:' + me.id, 'skills:' + me.id, 'spells:' + me.id, 'sets:' + me.id], async () => {
        const sets = sanitizeSets(await store.getSets(me.id));
        if(sets.ops.includes(opId)) return await setsReply(me.id, sets);
        const inv = await loadInventory(me.id), stuff = await loadStuff(me.id, inv);
        const skills = await loadSkills(me.id), spells = await loadSpells(me.id);
        if(action === 'equip'){
          const ctx = await spellCtx(me.id);
          const r = applySet(sets, { id: body.id, opId }, { inv, stuff, skills, spells, points: await pointsOf(me.id), spec: ctx.spec });
          if(r.error) err(r.error);
          await store.putLoadout(me.id, { inventory: JSON.parse(serialize(inv)), stuff, skills, spells, sets });
          return { ...await setsReply(me.id, sets), missing: r.missing };
        }
        const r = setOp(sets, { action, id: body.id, name: body.name, opId }, snapshot(stuff, skills, spells));
        if(r.error) err(r.error);
        await store.putSets(me.id, sets);
        return await setsReply(me.id, sets);
      });
    },

    /* table de recherche : { action:'research', tier } ou { action:'recycle', item }. Le serveur tire le hasard
       (imprévisible) ; opId : une demande renvoyée rend le même résultat sans rien refaire. */
    async research(me, body = {}){
      const { action, opId } = body;
      if(action !== 'research' && action !== 'recycle') fail('bad_request', 400, 'Demande invalide.');
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      return withLock('inv:' + me.id, async () => {
        const inv = await loadInventory(me.id);
        const r = action === 'research' ? research(inv, body.tier, opId, random) : recycle(inv, body.item, opId, random);
        if(r.error) fail(r.error, ['not_enough', 'not_owned', 'nothing_left', 'tier_locked'].includes(r.error) ? 409 : 400, RESEARCH_ERRORS[r.error]);
        if(!r.repeated){
          await store.putInventory(me.id, JSON.parse(serialize(inv)));
          if(action === 'research') markFound([r.item], displayName(me));   // tier 4 : un plan secret sorti de la recherche le révèle aussi (28/10)
        }
        return { action, item: r.item, parts: r.parts, inventory: publicInventory(inv) };
      });
    },

    /* utiliser un blueprint : le serveur le retire de l'inventaire et débloque sa recette, en une seule écriture
       (opId : une demande renvoyée ne consomme pas un second blueprint) */
    async learn(me, body = {}){
      const { item, opId } = body;
      if(typeof item !== 'string') fail('bad_item', 400, 'Objet inconnu.');
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      return withLock('inv:' + me.id, async () => {
        const inv = await loadInventory(me.id);
        const r = learn(inv, item, opId);
        if(r.error) fail(r.error, r.error === 'no_use' ? 400 : 409, LEARN_ERRORS[r.error]);
        if(!r.repeated) await store.putInventory(me.id, JSON.parse(serialize(inv)));
        return { item, recipe: r.recipe, inventory: publicInventory(inv) };
      });
    },

    /* ranger l'inventaire : { action:'sort' } trie tout, { action:'move', from, to, item, uid? } déplace un objet (échange
       avec celui qui est en to). Rien n'est créé ni retiré ; un déplacement renvoyé ne ré-échange pas (src/meta/inventory.js). */
    async inventory(me, body = {}){
      const { action } = body;
      if(action !== 'sort' && action !== 'move') fail('bad_request', 400, ARRANGE_ERRORS.bad_request);
      return withLock('inv:' + me.id, async () => {
        const inv = await loadInventory(me.id);
        if(action === 'sort') sortInventory(inv);
        else {
          const r = moveSlot(inv, { from: body.from, to: body.to, item: body.item, uid: body.uid });
          if(r.error) fail(r.error, r.error === 'not_owned' ? 409 : 400, ARRANGE_ERRORS[r.error]);
        }
        await store.putInventory(me.id, JSON.parse(serialize(inv)));
        return { inventory: publicInventory(inv) };
      });
    },

    /* recycler une pièce de stuff fabriquée { uid } : détruite, elle rend RECYCLE.share de sa recette (src/meta/craft.js).
       Refusé si elle est dans un set (relu sous son verrou) ; une pièce portée n'est pas dans l'inventaire. Une demande
       renvoyée ne trouve plus la pièce : rien n'est rendu deux fois. */
    async recycle(me, body = {}){
      if(!isInt(body.uid)) fail('bad_request', 400, RECYCLE_ERRORS.bad_request);
      return withLock.many(['inv:' + me.id, 'sets:' + me.id], async () => {
        const inv = await loadInventory(me.id);
        await loadStuff(me.id, inv);                     // garde les uid uniques (pièces portées comprises)
        const sets = sanitizeSets(await store.getSets(me.id));
        const r = recycleStuff(inv, body.uid, uid => inSomeSet(sets, uid), random);   // rune : Poudre de rêve tirée
        if(r.error) fail(r.error, r.error === 'bad_request' || r.error === 'not_recyclable' ? 400 : 409, RECYCLE_ERRORS[r.error]);
        await store.putInventory(me.id, JSON.parse(serialize(inv)));
        return { item: r.item, refund: r.refund, inventory: publicInventory(inv) };
      });
    },

    /* stuff : équiper une pièce de l'inventaire dans une case, ou la retirer. Inventaire et stuff changent ensemble. */
    /* amélioration : { action:'identify', uid, sacrifice } ou { action:'upgrade', uid }, opId. Le serveur tire le hasard ;
       une demande renvoyée retrouve son résultat (rien n'est tiré ni consommé deux fois). Les pièces portées comptent
       aussi (28/10/2026) : inventaire et stuff sont enregistrés ensemble (un sacrifice porté vide sa case). */
    async upgrade(me, body = {}){
      const { action, opId } = body;
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, UPGRADE_ERRORS.bad_request);
      if(!isInt(body.uid) || (action === 'identify' && !isInt(body.sacrifice)) || (action === 'enchant' && !isInt(body.rune)))
        fail('bad_request', 400, UPGRADE_ERRORS.bad_request);
      return withLock('inv:' + me.id, async () => {
        const inv = await loadInventory(me.id);
        const st = await loadStuff(me.id, inv), worn = st.worn;   // garde les uid uniques (pièces portées comprises)
        const r = action === 'identify' ? identify(inv, { uid: body.uid, sacrifice: body.sacrifice, opId }, random, worn)
                : action === 'upgrade' ? upgrade(inv, { uid: body.uid, opId }, random, worn)
                : action === 'enchant' ? enchant(inv, { uid: body.uid, rune: body.rune, opId }, worn)
                : action === 'unenchant' ? unenchant(inv, { uid: body.uid, opId }, worn) : { error: 'bad_request' };
        const ringAsked = isRing((inv.slots.find(s => s?.uid === body.uid) ?? Object.values(worn).find(p => p?.uid === body.uid))?.item);
        if(r.error) fail(r.error, r.error === 'not_enough' || r.error === 'not_owned' ? 409 : 400, (r.error === 'not_enough' && ringAsked ? 'Il te faut un doublon de cet anneau dans l\'inventaire.' : null) ?? UPGRADE_ERRORS[r.error] ?? UPGRADE_ERRORS.bad_request);
        if(!r.repeated) await store.putInventoryAndStuff(me.id, JSON.parse(serialize(inv)), st);
        /* identification très rare : annoncée sur Discord (pas une demande renvoyée) */
        if(action === 'identify' && !r.repeated) shout(identifyMessage(displayName(me), r.piece));
        return { piece: r.piece, fragment: r.fragment, success: r.success ?? true, inventory: publicInventory(inv), stuff: worn };
      });
    },

    async stuff(me, body = {}){
      const { opId } = body;
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      const op = { action: body.action, slot: body.slot, uid: body.uid, opId };
      return withLock('inv:' + me.id, async () => {
        const inv = await loadInventory(me.id), st = await loadStuff(me.id, inv);
        const r = stuffOp(inv, st, op);
        if(r.error) fail(r.error, r.error === 'not_owned' ? 409 : 400, STUFF_ERRORS[r.error] ?? 'Demande invalide.');
        if(!r.repeated) await store.putInventoryAndStuff(me.id, JSON.parse(serialize(inv)), st);
        return { inventory: publicInventory(inv), stuff: st.worn };
      });
    },

    /* historique : ses sessions terminées (gardées config.keepEnded), les plus récentes d'abord, avec la seed et SA part */
    /* onglet Jugement : les deux jauges, les tours ouvertes et ce que ce joueur a déjà fait */
    async judgment(me){
      return withJudgment(j => ({ value: publicJudgment(j, clock(), me.id) }));
    },
    /* classements : valeurs de tous les comptes (le service social classe et met les pseudos) */
    leaderboardData,
    /* shrines (28/10/2026) : rattachés au compte du chef (leaderId). Le service des groupes vérifie que celui qui donne
       est dans le groupe de ce chef (ou que c'est lui-même, seul). */
    async shrinesOf(leaderId){ return publicShrines(sanitizeShrines(await store.getShrines(leaderId))); },
    /* don : body = { shrine, item, qty, opId } ; code : code du lobby actuel du chef (gardé tant qu'il a un shrine) */
    async shrineGive(me, leaderId, body = {}, code = null){
      const { opId } = body;
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      return withLock.many(['inv:' + me.id, 'shrine:' + leaderId], async () => {
        const inv = await loadInventory(me.id), st = sanitizeShrines(await store.getShrines(leaderId));
        const r = giveShrine(st, inv, { shrine: body.shrine, item: body.item, qty: body.qty, opId });
        if(r.error) fail(r.error, ['active', 'full', 'not_owned'].includes(r.error) ? 409 : 400, SHRINE_ERRORS[r.error]);
        if(!r.repeated){
          if(code && hasShrines(st)) st.code = code;
          await store.putShrinesAndInventory(leaderId, st, me.id, JSON.parse(serialize(inv)));
        }
        return { shrines: publicShrines(st), inventory: publicInventory(inv), given: r.given, activated: r.activated };
      });
    },
    /* le chef active ou désactive une stèle chargée (30/10/2026) : body = { shrine, on } */
    async steleSet(leaderId, body = {}){
      return withLock('shrine:' + leaderId, async () => {
        const st = sanitizeShrines(await store.getShrines(leaderId)), r = setStele(st, { shrine: body.shrine, on: body.on });
        if(r.error) fail(r.error, r.error === 'not_charged' ? 409 : 400, SHRINE_ERRORS[r.error]);
        await store.putShrines(leaderId, st);
        return { shrines: publicShrines(st) };
      });
    },
    /* code d'un nouveau lobby de ce chef : le sien, gardé, tant qu'il a un shrine (actif ou en cours de paiement) ;
       sinon propose. Le service des groupes vérifie qu'il est libre. */
    async partyCodeFor(accountId, propose){
      return withLock('shrine:' + accountId, async () => {
        const st = sanitizeShrines(await store.getShrines(accountId));
        if(!hasShrines(st)) return propose;
        if(st.code) return st.code;
        st.code = propose; await store.putShrines(accountId, st);
        return propose;
      });
    },
    /* tour d'un camp : ouverte ? et les comptes qui l'ont déjà faite pendant cette ouverture (bouton « Who ? » du lobby) */
    async towerDone(side){
      if(!JUDGMENT_SIDES.includes(side)) fail('bad_request', 400, 'Camp inconnu.');
      return withJudgment(j => ({ value: { open: dev || towerOpen(j, side, clock()),   // mode dev : toujours ouverte (comme au lancement)
                                           done: new Set(j.done[side].opening === j[side].opening ? j.done[side].accounts.filter(a => !a.includes(':')) : []) } }));   // niveau 1 (« compte:n » = niveau n)
    },

    /* administration : ouvrir un k hole dans la session en cours d'un joueur (route /api/admin/khole,
       scripts/force-khole.js). Mine classique seulement. map : 0 = carte tirée, 1 à KHOLE.maps.length = imposée.
       Appliqué tout de suite dans la partie et enregistré avec son tick, comme un choix de joueur : la partie se rejoue
       à l'identique après un redémarrage. */
    async adminKhole(accountId, map = 0){
      if(!Number.isSafeInteger(map) || map < 0 || map > KHOLE.maps.length) fail('bad_request', 400, `Carte : un entier de 0 à ${KHOLE.maps.length}.`);
      const rec0 = await activeOf(accountId);
      if(!rec0) fail('no_session', 404, 'Ce joueur n\'a pas de session en cours.');
      return withLock('sess:' + rec0.id, async () => {
        const rec = await store.getGameSession(rec0.id);
        if(rec.status !== 'running' || isDue(rec)) fail('session_over', 409, 'La session est terminée.');
        if(rec.mode === 'mi' || isTowerMode(rec.mode) || isInstanceMode(rec.mode)) fail('bad_request', 400, 'Seulement dans une mine classique (pas la mine instantanée, une tour ni une instance).');
        if(!ensureLive(rec)) fail('session_over', 409, 'La session est terminée.');
        const r = await live.khole(rec.id, map);
        if(!r.ok) fail('khole_refused', 409, 'Impossible maintenant : déjà dans un k hole (ou un k hole s\'ouvre), ou fin de session trop proche.');
        (rec.kholes ??= []).push({ tick: r.tick, map, at: clock() });
        await store.putGameSession(rec);
        return { session: rec.id, tick: r.tick, map: map ? KHOLE.maps[map - 1].label : 'au hasard', players: rec.players.map(p => p.name) };
      });
    },

    /* administration : régler la jauge d'un camp (route /api/admin/judgment), mémoire et base ensemble */
    async adminJudgment(side, count){
      return withJudgment(j => {
        const before = JUDGMENT_SIDES.includes(side) ? j[side].count : null;
        if(!setJudgmentCount(j, side, count, clock()))
          fail('bad_request', 400, `side : ${JUDGMENT_SIDES.join(' ou ')} · count : un entier de 0 à ${JUDGMENT.cap}.`);
        return { save: true, value: { side, before, after: j[side].count, cap: JUDGMENT.cap, open: towerOpen(j, side, clock()) } };
      });
    },

    /* administration : toutes les lignes du tableau de bord (route /api/admin/stats, scripts/dashboard.js) */
    adminStats: () => store.allSessionStats(),
    /* tableau de bord de la prison (30/10/2026) : une ligne par compte qui a une prison (server/admin/prison-dashboard.js) */
    async adminPrisonStats(){
      const rows = [];
      for(const { account, value } of await store.listPrisons()){
        const p = sanitizePrison(value);
        rows.push(prisonRow({ account, name: p?.specs?.name, prison: p, sessions: await store.sessionsOf(account) }));   // pseudo figé à l'entrée en prison
      }
      return rows;
    },

    async history(me){
      const list = (await store.sessionsOf(me.id)).filter(s => s.status === 'done' && s.result).slice(0, 50);
      return { sessions: list.map(s => {
        const r = s.result, mine = (r.shares || []).find(x => x.account === me.id) ?? null;
        return { id: s.id, mode: s.mode ?? 'mine', seed: s.seed, dev: !!s.dev, startedAt: s.startedAt, endedAt: s.endedAt ?? null,
                 players: s.players.map(p => p.name || 'Joueur'), areas: r.areasUnlocked ?? null, depth: r.maxDepth ?? null,
                 left: !!mine?.left || hasLeft(s, me.id), bag: mine?.bag ?? {}, xp: mine?.xp ?? 0,
                 ...(r.prison ? { prison: { runs: r.prison.runs | 0, energy: +r.prison.energy || 0, area: r.prison.area ?? null, t: +r.prison.t || 0 } } : {}) };
      }) };
    },

    /* le joueur a vu le résultat : on ne le lui remontre plus */
    async ack(me, id){
      if(typeof id !== 'string') fail('bad_request', 400, 'Session manquante.');
      return withLock('acct:' + me.id, async () => {
        const rec = await store.getGameSession(id);
        if(!rec || !inSession(rec, me.id) || rec.status !== 'done') return;
        if(!rec.seen.includes(me.id)){ rec.seen.push(me.id); await store.putGameSession(rec); }
      });
    },

    /* démarrage du serveur : les sessions en cours repartent (reconstruites, puis rattrapent le temps écoulé) ;
       ménage des vieilles sessions */
    async recover(){
      for(const rec of await store.sessionsWithStatus('settling')){ rec.status = 'running'; await store.putGameSession(rec); }
      for(const rec of await store.sessionsWithStatus('running'))
        if(rec.dev && !rec.clock){ rec.clock = { tick: 0, at: clock(), speed: GAME.devSpeeds[0], paused: true }; await store.putGameSession(rec); }
      for(const rec of await store.sessionsWithStatus('done'))
        if(rec.endedAt && clock() - rec.endedAt > config.keepEnded) await store.deleteGameSession(rec.id);
      await pump();
    },
    pump,
    settle,         // pour les tests
    close: () => live.closeAll(),
    /* ID de la session en cours du joueur (lancée par lui ou par le chef de son groupe), sinon null */
    activeSessionId: async accountId => (await activeOf(accountId))?.id ?? null,
    /* son énergie vue par les autres (onglet Social, 31/10) : lecture seule, sans verrou ni écriture, pour ne jamais
       écraser un débit ou un crédit en cours ; repos compté comme dans son bandeau */
    energyOf: async accountId => publicEnergy((await restedEnergy(accountId)).e),

    /* sa session en cours vue par ses amis (onglet Social) : type de mine, temps restant (ms, null en mode dev), ou null ;
       30/10 : size = joueurs encore dans la session (partis exclus) sur max, pour repérer les solos et duos */
    activeSessionInfo: async accountId => {
      const rec = await activeOf(accountId);
      return rec ? { mode: rec.mode ?? 'mine', leftMs: rec.finishAt ? Math.max(0, rec.finishAt - clock()) : null,
                     size: rec.players.filter(p => !hasLeft(rec, p.account)).length, max: GAME.maxPlayers } : await inGiant(accountId);
    },
    /* comptes qui jouent une session en ce moment (pas partis), navigateur ouvert ou non : la liste Online du Social */
    playersInSession: async () => {
      const ids = new Set();
      for(const status of ACTIVE) for(const rec of await store.sessionsWithStatus(status))
        for(const p of rec.players) if(!hasLeft(rec, p.account)) ids.add(p.account);
      if(giant) for(const a of await giant.players()) ids.add(a);
      return [...ids];
    },

    /* ---------- Bloc géant (server/giant/service.js) ---------- */
    useGiant(hooks){ giant = hooks; },
    /* entrer au Bloc géant : sous le verrou du compte ; fn(fiche) reçoit le stuff, les skills et les sorts figés pour la
       visite et enregistre l'entrée. Possible pendant une session, et une session peut se lancer pendant une visite
       (27/10/2026, Geoffrey ; avant : l'un ou l'autre) : la visite et la session tournent chacune de leur côté. */
    async giantEnter(accountId, fn){
      return withLock('acct:' + accountId, async () => {
        const inv = await loadInventory(accountId), st = await loadStuff(accountId, inv);
        const sk = await loadSkills(accountId);
        return fn({ gear: gearOf(st), look: lookOf(st), skills: sessionSkills(sk),
                    spells: equippedSpells(await loadSpells(accountId), await spellCtx(accountId)) });
      });
    },
    /* donner une récompense du Bloc géant : sous le verrou de l'inventaire ; fn(inv) ajoute les objets et renvoie
       { player, … } (état du joueur à écrire AVEC l'inventaire) ou null (rien à donner, rien n'est écrit) */
    async giantGrant(accountId, fn){
      return withLock('inv:' + accountId, async () => {
        const inv = await loadInventory(accountId);
        await loadStuff(accountId, inv);                 // uid neufs : jamais celui d'une pièce portée
        const r = await fn(inv);
        if(r?.player) await store.putInventoryAndGiantPlayer(accountId, JSON.parse(serialize(inv)), r.player);
        return { ...r, inventory: publicInventory(inv) };
      });
    },
    /* arbre de skills choisi (mineur, logisticien, barbare) ou null : la spécialisation affichée dans le lobby */
    skillTreeOf: async accountId => (await loadSkills(accountId)).tree ?? null,
    /* niveau de spécialisation dans cet arbre (null sans arbre) : « Logisticien (SP lvl : 3) » dans le lobby */
    specLevelOf: async (accountId, tree) => tree ? specLevels(await loadProgress(accountId))[tree]?.level ?? null : null,
    /* apparence (noms des pièces portées, { case: objet }) : le skin de chaque membre dans le lobby */
    lookFor: async accountId => lookOf(await loadStuff(accountId, await loadInventory(accountId))),
    gsFor: async accountId => gearScore(gearOf(await loadStuff(accountId, await loadInventory(accountId)))),
    /* prison en cours (ou en attente) de ce joueur : le lobby du groupe prévient qu'un lancement la terminera (29/10) */
    prisonActiveOf: async accountId => ['running', 'waiting'].includes((await loadPrison(accountId))?.state),
    /* niveau du mineur (fiche d'un joueur dans le Carreau, 29/10) */
    levelFor: async accountId => levelOf((await loadProgress(accountId)).xp).level,
    aurasFor: async accountId => aurasOf(gearOf(await loadStuff(accountId, await loadInventory(accountId)))),
    /* heure de fin de sa dernière session terminée (0 si aucune) : le groupe compte son délai d'absence à partir d'elle */
    lastEndedAt: async accountId => Math.max(0, ...(await store.sessionsOf(accountId))
      .filter(s => s.status === 'done' && !hasLeft(s, accountId)).map(s => s.endedAt || 0)),
  };
}
