/* Sessions de jeu côté serveur : c'est le serveur qui fait foi (anti-triche).

   - Le serveur crée la session (seed, joueurs, préférences, heure de départ) et la FAIT TOURNER lui-même, en direct
     (server/game/live.js) : c'est la seule copie de la partie. Les navigateurs ne font que l'afficher.
   - Le navigateur ne peut que dire « je lance », « je quitte », « focus », et lire l'état. Il n'écrit jamais dans un
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
   Testable seul : on lui passe un stockage, une horloge et la façon de faire tourner les parties (liveRunner). */
import crypto from 'node:crypto';
import { GAME, PREFS, FOCUS, FURNACE, MINE_MODES } from '../../src/config.js';
import { DT } from '../../src/config.js';
import { sanitizePrefs, sanitizeOverrides, tickAt, realDurationMs, TOTAL_TICKS } from '../../src/shared/game.js';
import { sanitizeFocus } from '../../src/sim/focus.js';
import { displayName } from '../../src/shared/account.js';
import { createInventory, deserialize, serialize, creditSession } from '../../src/meta/inventory.js';
import { sanitizeProgress, creditXp, levelOf } from '../../src/meta/level.js';
import { sanitizeSkills, skillOp, skillRanks, spentPoints } from '../../src/meta/skills.js';
import { canOpen, openTreasure } from '../../src/meta/loot.js';
import { sanitizeFurnaces, furnaceOp, advance } from '../../src/meta/furnace.js';
import { sanitizeCrusher, crusherOp, advance as advanceCrusher, publicCrusher } from '../../src/meta/crusher.js';
import { craft, learn } from '../../src/meta/craft.js';
import { research, recycle } from '../../src/meta/research.js';
import { sanitizeStuff, stuffOp, lookOf, gearOf } from '../../src/meta/stuff.js';
import { identify, upgrade } from '../../src/meta/upgrade.js';
import { createLimiter } from '../accounts/ratelimit.js';
import { GAME_SERVER } from '../config.js';
import { createLiveRunner } from './live.js';
import { instantDurationMs } from '../../src/shared/instant.js';

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
                       no_points: 'Plus de points de skill : gagne un niveau.', bad_request: 'Demande invalide.' };
const RESEARCH_ERRORS = { bad_tier: 'Tier de recherche inconnu.', tier_locked: 'Apprends d\'abord toutes les recettes du tier précédent.', nothing_left: 'Tu as appris tous les blueprints de ce tier.',
                          not_enough: 'Il te faut plus de Blueprint parts.', bad_item: 'Seul un blueprint se recycle.',
                          not_owned: 'Tu n\'as pas ce blueprint.', bad_request: 'Demande invalide.' };
/* ce que le navigateur voit de l'inventaire : les slots, et les recettes débloquées par blueprint */
const publicInventory = inv => ({ slots: inv.slots, unlocked: inv.unlocked });
const STUFF_ERRORS = { bad_slot: 'Case inconnue.', not_owned: 'Cette pièce n\'est pas dans ton inventaire.',
                       wrong_slot: 'Cette pièce ne va pas dans cette case.' };
const UPGRADE_ERRORS = { not_owned: 'Cette pièce n\'est pas dans ton inventaire (retire-la d\'abord si elle est équipée).',
                         same_piece: 'Il faut un deuxième exemplaire à sacrifier.', already_identified: 'Cette pièce est déjà identifiée.',
                         not_same_item: 'Le sacrifice doit être le même objet.', maxed: 'Cette pièce est déjà au niveau maximum.',
                         not_enough: 'Il te manque des matériaux.', bad_request: 'Demande invalide.' };
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

export function createGameService({ store, liveRunner = createLiveRunner, clock = Date.now, dev = GAME_SERVER.dev, speed = GAME.speed,
                                    config = GAME_SERVER, randomSeed = () => crypto.randomInt(2**31),
                                    /* hasard du butin, imprévisible, dans [0, 1[ : 48 bits aléatoires (randomInt refuse 2**48) */
                                    random = () => crypto.randomBytes(6).readUIntBE(0, 6) / 2**48 }){
  const withLock = createLocks();
  const settling = new Map();      // id → promesse du versement en cours
  /* les parties en direct ; à la fin de l'une d'elles, son coffre est partagé et versé */
  const live = liveRunner({ onEnd: (id, summary) => { settleWith(id, summary).catch(console.error); } });
  const startLimit = createLimiter({ max: config.startsPerHour, window: 3600e3 }, clock);
  const startHooks = [];           // appelés après le lancement d'une session normale (comptes des joueurs)

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
  /* progression (XP totale) : relue et revérifiée à chaque fois ; le navigateur voit niveau, avancement et points */
  const loadProgress = async accountId => sanitizeProgress(await store.getProgress(accountId));
  const publicProgress = p => ({ xp: p.xp, ...levelOf(p.xp) });
  /* skills : revérifiés avec les points du niveau (jamais plus de rangs que de points) */
  const pointsOf = async accountId => levelOf((await loadProgress(accountId)).xp).talentPoints;
  const loadSkills = async accountId => sanitizeSkills(await store.getSkills(accountId), await pointsOf(accountId));
  const publicSkills = (st, points) => ({ ...skillRanks(st), points, spent: spentPoints(st) });

  /* ce que le navigateur voit d'une session */
  function publicSession(rec){
    if(!rec) return null;
    return { id: rec.id, mode: rec.mode ?? 'mine', seed: rec.seed, players: rec.players, bots: rec.bots, prefs: rec.prefs, looks: rec.looks ?? {}, overrides: rec.overrides,
             dev: rec.dev, speed: rec.speed, startedAt: rec.startedAt, finishAt: rec.finishAt, now: clock(),
             tick: live.tickOf(rec.id), clock: rec.dev ? rec.clock : null,
             leaves: rec.leaves.map(({ account, tick }) => ({ account, tick })),
             focus: (rec.focus || []).map(({ account, tick, focus }) => ({ account, tick, focus })), status: rec.status,
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
    await Promise.all(jobs);
    await Promise.all(settling.values());
  }

  /* ---------- fin de session ---------- */

  /* Partage le coffre de la partie terminée et verse les parts. Sans effet si la session n'est pas « running ». */
  function settleWith(id, summary){
    if(settling.has(id)) return settling.get(id);
    const p = withLock('sess:' + id, async () => {
      let rec = await store.getGameSession(id);
      if(!rec || rec.status !== 'running') return;
      /* versement : seulement aux joueurs de la session encore présents, une seule fois par session */
      for(const share of summary.shares || []){
        if(!share.account || share.left || !inSession(rec, share.account) || hasLeft(rec, share.account)) continue;
        await withLock('inv:' + share.account, async () => {
          const inv = await loadInventory(share.account);
          if(creditSession(inv, rec.id, share.bag)) await store.putInventory(share.account, JSON.parse(serialize(inv)));
        });
        /* XP : sa part du pot commun, une seule fois par session (idempotent, comme le coffre) ; pas dans le MI */
        if(rec.mode !== 'mi') await withLock('xp:' + share.account, async () => {
          const pr = await loadProgress(share.account);
          if(creditXp(pr, rec.id, share.xp ?? 0)) await store.putProgress(share.account, pr);
        });
      }
      rec = await store.getGameSession(id);
      rec.status = 'done'; rec.result = summary; rec.endedAt = clock();
      await store.putGameSession(rec);
    }).finally(() => settling.delete(id));
    settling.set(id, p);
    return p;
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
    dev, speed,
    info: () => ({ dev, speed: dev ? null : speed, speeds: dev ? GAME.devSpeeds : [speed], maxPlayers: GAME.maxPlayers }),

    /* état du joueur : inventaire, préférences, session en cours, et résultat d'une session terminée pas encore vu */
    async state(me){
      const list = await store.sessionsOf(me.id);
      const active = list.find(s => ACTIVE.includes(s.status) && !hasLeft(s, me.id)) ?? null;
      const ended = list.find(s => s.status === 'done' && !s.seen.includes(me.id) && !hasLeft(s, me.id)) ?? null;
      const inv = await loadInventory(me.id);
      const crusher = await withCrusher(me.id, (_, c) => publicCrusher(c, clock()));
      return { inventory: publicInventory(inv), furnaces: publicFurnaces(await loadFurnaces(me.id)), crusher,
               stuff: (await loadStuff(me.id, inv)).worn,
               progress: publicProgress(await loadProgress(me.id)),
               skills: publicSkills(await loadSkills(me.id), await pointsOf(me.id)),
               prefs: await loadPrefs(me.id),
               session: publicSession(active), ended: publicSession(ended) };
    },

    async setPrefs(me, body){
      const p = sanitizePrefs(body);
      await store.putPrefs(me.id, p);
      return { prefs: p };
    },

    /* lance une session. members : joueurs d'un groupe [{account, name}], celui qui lance en premier (mineur Rouge) ;
       absent = seul. Refusé si un des joueurs a déjà une session en cours. */
    async start(me, body = {}, members = null){
      const players = (members?.length ? members : [{ account: me.id, name: displayName(me) }])
        .map(p => ({ account: String(p.account), name: String(p.name ?? '') }));
      if(players[0].account !== me.id) fail('bad_request', 400, 'Le joueur qui lance doit être le premier.');
      if(new Set(players.map(p => p.account)).size !== players.length || players.length > GAME.maxPlayers)
        fail('bad_request', 400, 'Équipe invalide.');
      /* type de mine choisi dans le lobby (Mine par défaut) ; un type annoncé mais pas prêt (MI) est refusé */
      const mode = body.mode ?? MINE_MODES[0].id;
      const modeDef = MINE_MODES.find(m => m.id === mode);
      if(!modeDef) fail('bad_request', 400, 'Type de mine inconnu.');
      if(!modeDef.ready) fail('mode_not_ready', 400, `${modeDef.label} : bientôt disponible.`);
      if(modeDef.scheduled) fail('mode_scheduled', 400, `${modeDef.label} : elle s'ouvre à heure fixe, inscris-toi dans le lobby.`);
      return withLock.many(players.map(p => 'acct:' + p.account), async () => {
        if(await activeOf(me.id)) fail('session_running', 409, 'Tu as déjà une session en cours.');
        for(const p of players.slice(1))
          if(await activeOf(p.account)) fail('member_in_session', 409, `${p.name || 'Un joueur'} est déjà dans une session.`);
        /* places : les sessions à l'heure seulement (une session dépassée se rattrape sur le budget restant) */
        if((await store.sessionsWithStatus('running')).filter(r => !overdue(r)).length >= (config.maxLive ?? Infinity))
          fail('server_busy', 503, 'Le serveur fait déjà tourner le maximum de sessions. Réessaie dans quelques minutes.', { retryAfter: 60 });
        const lim = startLimit.check(me.id);
        if(!lim.ok) fail('rate_limited', 429, 'Trop de sessions lancées. Réessaie un peu plus tard.', { retryAfter: lim.retryAfter });
        startLimit.hit(me.id);
        const now = clock();
        const prefs = {}, looks = {}, gear = {}, skills = {};
        for(const p of players){
          prefs[p.account] = await loadPrefs(p.account);
          skills[p.account] = skillRanks(await loadSkills(p.account));   // figés pour toute la session
          /* apparence pendant la session : l'équipement porté au lancement (src/skins.js) ; ses caractéristiques :
             les mêmes pièces, avec leur qualité et leur niveau (gear) */
          const st = await loadStuff(p.account, await loadInventory(p.account));
          looks[p.account] = lookOf(st);
          gear[p.account] = gearOf(st);
        }
        const rec = {
          id: crypto.randomUUID(),
          mode,
          seed: dev && isInt(body.seed) && body.seed >= 0 && body.seed < 2**31 ? body.seed : randomSeed(),
          players,
          bots: dev && isInt(body.bots) ? Math.max(0, Math.min(GAME.maxPlayers - players.length, body.bots)) : 0,
          prefs, looks, gear, skills,
          overrides: dev ? sanitizeOverrides(body.overrides) : null,
          dev, speed: dev ? null : speed, startedAt: now, finishAt: dev ? null : now + realDurationMs(speed),
          leaves: [], focus: [], status: 'running', result: null, seen: [],
          clock: dev ? { tick: 0, at: now, speed: GAME.devSpeeds[0], paused: false } : null,
        };
        await store.putGameSession(rec);
        ensureLive(rec);
        for(const fn of startHooks) Promise.resolve().then(() => fn(players.map(p => p.account))).catch(console.error);
        return { session: publicSession(rec) };
      });
    },

    /* mine instantanée : ouvre une mine pour ces joueurs [{account, name}] à l'heure slot (ms). id = id de la mine,
       choisi par le service des inscriptions (le même pour la même ouverture) : une mine déjà ouverte ne l'est pas
       deux fois (redémarrage pendant l'ouverture). Un joueur déjà en session est écarté. Pas de limite de places :
       une mine instantanée coûte peu (~0,2 s de calcul pour 20 joueurs). Renvoie la session, ou null. */
    async openInstant(id, slot, list){
      const players = [];
      for(const p of list) if(!players.some(q => q.account === p.account)) players.push({ account: String(p.account), name: String(p.name ?? '') });
      return withLock.many(players.map(p => 'acct:' + p.account), async () => {
        if(await store.getGameSession(id)) return null;
        const ok = [];
        for(const p of players) if(!await activeOf(p.account)) ok.push(p);
        if(!ok.length) return null;
        const looks = {}, skills = {};
        for(const p of ok){
          skills[p.account] = skillRanks(await loadSkills(p.account));
          looks[p.account] = lookOf(await loadStuff(p.account, await loadInventory(p.account)));
        }
        const rec = {
          id, mode: 'mi', seed: randomSeed(), players: ok, bots: 0, prefs: {}, looks, skills, overrides: null,
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

    /* quitter : le joueur ne recevra rien de cette session (GAME_DESIGN §6). Son mineur quitte la partie tout de suite. */
    async leave(me){
      return withLock('acct:' + me.id, async () => {
        const rec0 = await activeOf(me.id);
        if(!rec0) fail('no_session', 404, 'Aucune session en cours.');
        return withLock('sess:' + rec0.id, async () => {
          const rec = await store.getGameSession(rec0.id);
          if(rec.status !== 'running' || isDue(rec)) fail('session_over', 409, 'La session est terminée : son résultat arrive.');
          const now = clock();
          if(rec.players.every(p => p.account === me.id || hasLeft(rec, p.account))){
            /* plus aucun joueur : personne ne reçoit rien, la partie s'arrête */
            live.close(rec.id);
            rec.leaves.push({ account: me.id, tick: live.tickOf(rec.id) ?? targetTick(rec), at: now });
            rec.status = 'done'; rec.endedAt = now;
            rec.result = { abandoned: true, shares: rec.players.map(p => ({ account: p.account, left: true, bag: {} })) };
          } else {
            if(!ensureLive(rec)) fail('session_over', 409, 'La session est terminée : son résultat arrive.');
            rec.leaves.push({ account: me.id, tick: await live.leave(rec.id, me.id), at: now });
          }
          await store.putGameSession(rec);
          return { left: true };
        });
      });
    },

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
          rec.focus ??= [];
          if(rec.focus.filter(e => e.account === me.id).length >= FOCUS.maxChanges)
            fail('too_many', 429, 'Trop de changements de focus dans cette session.');
          const focus = sanitizeFocus(f);
          if(!ensureLive(rec)) fail('session_over', 409, 'La session est terminée.');
          const ev = { account: me.id, tick: await live.focus(rec.id, me.id, focus), focus };
          rec.focus.push(ev);
          await store.putGameSession(rec);
          return { event: ev };
        });
      });
    },

    /* la partie, pour l'afficher : depuis le tick since que le navigateur a déjà (absent : la carte entière).
       Répond tout de suite avec l'état actuel (c'est pump qui fait avancer la partie). Lecture seule.
       Partie terminée : view null (le résultat arrive). */
    async view(me, since){
      const rec = await activeOf(me.id);
      if(!rec) fail('no_session', 404, 'Aucune session en cours.');
      const s = Number.isSafeInteger(since) && since >= 0 ? since : null;
      const ok = rec.status === 'running' && ensureLive(rec);
      return { view: ok ? await live.view(rec.id, s) : null, status: ok ? 'running' : 'settling',
               clock: rec.dev ? rec.clock : null, now: clock() };
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

    /* ouvrir un Treasure TX de son inventaire : le serveur tire le butin. opId (choisi par le navigateur) rend la
       demande rejouable sans effet : la même demande renvoie le même butin. */
    async open(me, body = {}){
      const { item, opId } = body;
      if(typeof item !== 'string' || !canOpen(item)) fail('bad_item', 400, 'Cet objet ne s\'ouvre pas.');
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      return withLock('inv:' + me.id, async () => {
        const inv = await loadInventory(me.id);
        const res = openTreasure(inv, item, opId, random);
        if(!res) fail('not_owned', 409, `Tu n'as pas de ${item} à ouvrir.`);
        if(!res.repeated) await store.putInventory(me.id, JSON.parse(serialize(inv)));
        return { item, loot: res.loot, inventory: publicInventory(inv) };
      });
    },

    /* four : poser dans une case, la vider, récupérer les lingots. Inventaire et fours changent ensemble, sous le verrou
       de l'inventaire ; opId rend la demande rejouable sans effet (double clic, requête renvoyée). */
    async furnace(me, body = {}){
      const { opId } = body;
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      const op = { action: body.action, furnace: body.furnace, slot: body.slot, item: body.item, qty: body.qty, mode: body.mode, opId };
      return withLock('inv:' + me.id, async () => {
        const inv = await loadInventory(me.id), st = await loadFurnaces(me.id);
        const r = furnaceOp(st, inv, op, clock());
        if(r.error) fail(r.error, ['not_enough', 'slot_busy', 'not_empty', 'no_recipe', 'already_unlocked', 'locked_before'].includes(r.error) ? 409 : 400, FURNACE_ERRORS[r.error] ?? 'Demande invalide.');
        if(!r.repeated) await store.putInventoryAndFurnaces(me.id, JSON.parse(serialize(inv)), st);
        return { inventory: publicInventory(inv), furnaces: publicFurnaces(st) };
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
        const r = craft(inv, item, opId);
        if(r.error) fail(r.error, r.error === 'not_enough' ? 409 : 400, CRAFT_ERRORS[r.error]);
        if(!r.repeated) await store.putInventory(me.id, JSON.parse(serialize(inv)));
        return { item, inventory: publicInventory(inv) };
      });
    },

    /* skills : { action:'learn', node } ou { action:'reset' } (gratuit, refusé pendant une session : les skills de la
       session en cours sont figés au lancement). opId : une demande renvoyée n'agit qu'une fois. */
    async skills(me, body = {}){
      const { action, opId } = body;
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      return withLock('skills:' + me.id, async () => {
        if(action === 'reset' && await activeOf(me.id)) fail('session_running', 409, 'Reset impossible pendant une session : termine-la d\'abord.');
        const points = await pointsOf(me.id), st = await loadSkills(me.id);
        const r = skillOp(st, { action, node: body.node, opId }, points);
        if(r.error) fail(r.error, r.error === 'unknown' || r.error === 'bad_request' ? 400 : 409, SKILL_ERRORS[r.error] ?? 'Demande invalide.');
        if(!r.repeated) await store.putSkills(me.id, st);
        return { skills: publicSkills(st, points) };
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
        if(!r.repeated) await store.putInventory(me.id, JSON.parse(serialize(inv)));
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

    /* stuff : équiper une pièce de l'inventaire dans une case, ou la retirer. Inventaire et stuff changent ensemble. */
    /* amélioration : { action:'identify', uid, sacrifice } ou { action:'upgrade', uid }, opId. Le serveur tire le hasard ;
       une demande renvoyée retrouve son résultat (rien n'est tiré ni consommé deux fois). */
    async upgrade(me, body = {}){
      const { action, opId } = body;
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, UPGRADE_ERRORS.bad_request);
      if(!isInt(body.uid) || (action === 'identify' && !isInt(body.sacrifice))) fail('bad_request', 400, UPGRADE_ERRORS.bad_request);
      return withLock('inv:' + me.id, async () => {
        const inv = await loadInventory(me.id);
        await loadStuff(me.id, inv);                     // garde les uid uniques (pièces portées comprises)
        const r = action === 'identify' ? identify(inv, { uid: body.uid, sacrifice: body.sacrifice, opId }, random)
                : action === 'upgrade' ? upgrade(inv, { uid: body.uid, opId }, random) : { error: 'bad_request' };
        if(r.error) fail(r.error, r.error === 'not_enough' || r.error === 'not_owned' ? 409 : 400, UPGRADE_ERRORS[r.error] ?? UPGRADE_ERRORS.bad_request);
        if(!r.repeated) await store.putInventory(me.id, JSON.parse(serialize(inv)));
        return { piece: r.piece, success: r.success ?? true, inventory: publicInventory(inv) };
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
    async history(me){
      const list = (await store.sessionsOf(me.id)).filter(s => s.status === 'done' && s.result).slice(0, 50);
      return { sessions: list.map(s => {
        const r = s.result, mine = (r.shares || []).find(x => x.account === me.id) ?? null;
        return { id: s.id, mode: s.mode ?? 'mine', seed: s.seed, dev: !!s.dev, startedAt: s.startedAt, endedAt: s.endedAt ?? null,
                 players: s.players.map(p => p.name || 'Joueur'), areas: r.areasUnlocked ?? null, depth: r.maxDepth ?? null,
                 left: !!mine?.left || hasLeft(s, me.id), bag: mine?.bag ?? {}, xp: mine?.xp ?? 0 };
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
    /* arbre de skills choisi (mineur, logisticien, barbare) ou null : la spécialisation affichée dans le lobby */
    skillTreeOf: async accountId => (await loadSkills(accountId)).tree ?? null,
    /* heure de fin de sa dernière session terminée (0 si aucune) : le groupe compte son délai d'absence à partir d'elle */
    lastEndedAt: async accountId => Math.max(0, ...(await store.sessionsOf(accountId))
      .filter(s => s.status === 'done' && !hasLeft(s, accountId)).map(s => s.endedAt || 0)),
  };
}
