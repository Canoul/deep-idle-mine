/* Sessions de jeu côté serveur : c'est le serveur qui fait foi (anti-triche).

   - Le serveur crée la session (seed, joueurs, préférences, heure de départ) ; le navigateur ne fait que l'afficher.
   - Le navigateur ne peut que dire « je lance », « je quitte », « c'est fini » et lire l'état. Il n'écrit jamais
     dans un inventaire.
   - Fin de session : le serveur rejoue lui-même la partie depuis son enregistrement (replay, dans un thread à part),
     partage le coffre entre les joueurs présents et verse les parts. Chaque versement est idempotent
     (creditSession) : un rejeu relancé après un arrêt brutal ne duplique rien.
   - Mode normal : vitesse fixe (GAME.speed), la fin est refusée avant l'heure. Mode dev : vitesses libres,
     réglages dev, fin quand le navigateur le dit.
   - À plusieurs : le chef d'un groupe (server/party/) lance la session pour tous les membres. Chaque navigateur
     construit la même partie ; un départ est annoncé GAME.leaveNotice secondes à l'avance pour que tous retirent
     le mineur au même tick que le serveur.
   Testable seul : on lui passe un stockage, une horloge et une fonction de rejeu. */
import crypto from 'node:crypto';
import { GAME, PREFS, FOCUS, FURNACE } from '../../src/config.js';
import { sanitizePrefs, sanitizeOverrides, tickAt, realDurationMs, TOTAL_TICKS } from '../../src/shared/game.js';
import { sanitizeFocus } from '../../src/sim/focus.js';
import { displayName } from '../../src/shared/account.js';
import { createInventory, deserialize, serialize, creditSession } from '../../src/meta/inventory.js';
import { canOpen, openTreasure } from '../../src/meta/loot.js';
import { sanitizeFurnaces, furnaceOp, advance } from '../../src/meta/furnace.js';
import { craft } from '../../src/meta/craft.js';
import { sanitizeStuff, stuffOp } from '../../src/meta/stuff.js';
import { createLimiter } from '../accounts/ratelimit.js';
import { GAME_SERVER } from '../config.js';

export class GameError extends Error {
  constructor(code, status, message, extra = {}){ super(message); this.code = code; this.status = status; Object.assign(this, extra); }
}
const fail = (code, status, message, extra) => { throw new GameError(code, status, message, extra); };

const ACTIVE = ['running', 'settling'];
const CRAFT_ERRORS = { unknown: 'Recette inconnue.', locked: 'Recette pas encore débloquée.',
                       not_enough: 'Il te manque des ingrédients.' };
const STUFF_ERRORS = { bad_slot: 'Case inconnue.', not_owned: 'Cette pièce n\'est pas dans ton inventaire.',
                       wrong_slot: 'Cette pièce ne va pas dans cette case.' };
const FURNACE_ERRORS = {
  bad_furnace: 'Ce four n\'existe pas.', bad_slot: 'Case inconnue.', bad_qty: 'Quantité invalide.',
  bad_item: 'Cet objet ne va pas dans cette case.', not_enough: 'Tu n\'en as pas assez.',
  slot_busy: 'La case contient déjà autre chose : vide-la d\'abord.', inventory_full: 'L\'inventaire ne peut pas recevoir ça.',
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

export function createGameService({ store, replay, clock = Date.now, dev = GAME_SERVER.dev, speed = GAME.speed,
                                    config = GAME_SERVER, randomSeed = () => crypto.randomInt(2**31),
                                    random = () => crypto.randomInt(2**48) / 2**48 }){
  const withLock = createLocks();
  const settling = new Set();
  const startLimit = createLimiter({ max: config.startsPerHour, window: 3600e3 }, clock);

  /* ---------- lecture ---------- */

  async function loadInventory(accountId){
    const raw = await store.getInventory(accountId);
    return raw ? deserialize(JSON.stringify(raw)) : createInventory();   // relu et revérifié à chaque fois
  }
  const loadFurnaces = async accountId => sanitizeFurnaces(await store.getFurnaces(accountId));   // revérifié à chaque fois
  /* ce que le navigateur voit des fours : avancés jusqu'à maintenant, heure du serveur (pour la barre de progression) */
  const publicFurnaces = st => ({ list: st.list.map(f => advance(f, clock())), max: FURNACE.max, now: clock() });
  /* stuff : relu avec l'inventaire (une pièce présente des deux côtés est retirée du stuff ; les uid restent uniques) */
  const loadStuff = async (accountId, inv) => sanitizeStuff(await store.getStuff(accountId), inv);
  const loadPrefs = async accountId => sanitizePrefs(await store.getPrefs(accountId));

  /* ce que le navigateur voit d'une session */
  function publicSession(rec){
    if(!rec) return null;
    return { id: rec.id, seed: rec.seed, players: rec.players, bots: rec.bots, prefs: rec.prefs, overrides: rec.overrides,
             dev: rec.dev, speed: rec.speed, startedAt: rec.startedAt, finishAt: rec.finishAt, now: clock(),
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

  /* ---------- fin de session ---------- */

  /* Rejoue la session, partage le coffre, verse les parts. Sans effet si elle n'est pas « running ».
   Renvoie une promesse (les routes ne l'attendent pas : le rejeu prend jusqu'à une minute). */
  function settle(id){
    if(settling.has(id)) return Promise.resolve();
    settling.add(id);
    return (async () => {
      let rec = await store.getGameSession(id);
      if(!rec || rec.status !== 'running') return;
      rec.status = 'settling';
      await store.putGameSession(rec);

      let summary;
      try { summary = await replay(rec); }
      catch(e){
        console.error(`Rejeu de la session ${id} impossible :`, e.message);
        rec = await store.getGameSession(id);
        rec.status = 'running'; rec.failures = (rec.failures || 0) + 1;
        await store.putGameSession(rec);
        return;
      }

      /* versement : seulement aux joueurs de la session encore présents, une seule fois par session */
      for(const share of summary.shares || []){
        if(!share.account || share.left || !inSession(rec, share.account) || hasLeft(rec, share.account)) continue;
        await withLock('inv:' + share.account, async () => {
          const inv = await loadInventory(share.account);
          if(creditSession(inv, rec.id, share.bag)) await store.putInventory(share.account, JSON.parse(serialize(inv)));
        });
      }
      rec = await store.getGameSession(id);
      rec.status = 'done'; rec.result = summary; rec.endedAt = clock();
      await store.putGameSession(rec);
    })().finally(() => settling.delete(id));
  }

  /* toutes les sessions arrivées à leur fin (joueurs absents compris) */
  async function settleDue(){
    for(const rec of await store.sessionsWithStatus('running')) if(isDue(rec)) await settle(rec.id);
  }

  return {
    dev, speed,
    info: () => ({ dev, speed: dev ? null : speed, speeds: dev ? GAME.devSpeeds : [speed], maxPlayers: GAME.maxPlayers }),

    /* état du joueur : inventaire, préférences, session en cours, et résultat d'une session terminée pas encore vu */
    async state(me){
      const list = await store.sessionsOf(me.id);
      const active = list.find(s => ACTIVE.includes(s.status) && !hasLeft(s, me.id)) ?? null;
      if(active && isDue(active)) settle(active.id).catch(console.error);
      const ended = list.find(s => s.status === 'done' && !s.seen.includes(me.id) && !hasLeft(s, me.id)) ?? null;
      const inv = await loadInventory(me.id);
      return { inventory: { slots: inv.slots }, furnaces: publicFurnaces(await loadFurnaces(me.id)),
               stuff: (await loadStuff(me.id, inv)).worn,
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
      return withLock.many(players.map(p => 'acct:' + p.account), async () => {
        if(await activeOf(me.id)) fail('session_running', 409, 'Tu as déjà une session en cours.');
        for(const p of players.slice(1))
          if(await activeOf(p.account)) fail('member_in_session', 409, `${p.name || 'Un joueur'} est déjà dans une session.`);
        const lim = startLimit.check(me.id);
        if(!lim.ok) fail('rate_limited', 429, 'Trop de sessions lancées. Réessaie un peu plus tard.', { retryAfter: lim.retryAfter });
        startLimit.hit(me.id);
        const now = clock();
        const prefs = {};
        for(const p of players) prefs[p.account] = await loadPrefs(p.account);
        const rec = {
          id: crypto.randomUUID(),
          seed: dev && isInt(body.seed) && body.seed >= 0 && body.seed < 2**31 ? body.seed : randomSeed(),
          players,
          bots: dev && isInt(body.bots) ? Math.max(0, Math.min(GAME.maxPlayers - players.length, body.bots)) : 0,
          prefs,
          overrides: dev ? sanitizeOverrides(body.overrides) : null,
          dev, speed: dev ? null : speed, startedAt: now, finishAt: dev ? null : now + realDurationMs(speed),
          leaves: [], focus: [], status: 'running', result: null, seen: [],
        };
        await store.putGameSession(rec);
        return { session: publicSession(rec) };
      });
    },

    /* quitter : le joueur ne recevra rien de cette session (GAME_DESIGN §6) */
    async leave(me, body = {}){
      return withLock('acct:' + me.id, async () => {
        const rec = await activeOf(me.id);
        if(!rec) fail('no_session', 404, 'Aucune session en cours.');
        if(rec.status !== 'running' || isDue(rec)) fail('session_over', 409, 'La session est terminée : son résultat arrive.');
        const now = clock();
        /* jeu normal : départ dans GAME.leaveNotice s (les autres navigateurs l'apprennent avant d'y arriver), et au
           plus tard au dernier tick (un départ doit toujours avoir lieu avant la fin) */
        const tick = dev ? (isInt(body.tick) ? Math.max(0, Math.min(TOTAL_TICKS - 1, body.tick)) : 0)
                         : Math.min(TOTAL_TICKS - 1, tickAt(now - rec.startedAt + GAME.leaveNotice * 1000, rec.speed));
        rec.leaves.push({ account: me.id, tick, at: now });
        if(rec.players.every(p => hasLeft(rec, p.account))){
          /* plus aucun joueur : personne ne reçoit rien, pas besoin de rejouer */
          rec.status = 'done'; rec.endedAt = now;
          rec.result = { abandoned: true, shares: rec.players.map(p => ({ account: p.account, left: true, bag: {} })) };
        }
        await store.putGameSession(rec);
        return { left: true };
      });
    },

    /* focus minerai changé pendant la session : enregistré avec son tick, rejoué tel quel (GAME_DESIGN §3).
       Jeu normal : le tick vient de l'horloge du serveur (+ FOCUS.delayTicks) ; dev : celui du navigateur.
       Les ticks restent croissants (rejeu dans l'ordre). Aucune ressource en jeu : on vérifie la forme et le nombre. */
    async focus(me, body = {}){
      return withLock('acct:' + me.id, async () => {
        const rec = await activeOf(me.id);
        if(!rec) fail('no_session', 404, 'Aucune session en cours.');
        if(rec.status !== 'running' || isDue(rec)) fail('session_over', 409, 'La session est terminée.');
        const f = body.focus;
        if(!f || typeof f !== 'object' || Array.isArray(f)) fail('bad_request', 400, 'Focus invalide.');
        rec.focus ??= [];
        if(rec.focus.filter(e => e.account === me.id).length >= FOCUS.maxChanges)
          fail('too_many', 429, 'Trop de changements de focus dans cette session.');
        const now = clock();
        let tick = dev ? (isInt(body.tick) ? body.tick : 0) : tickAt(now - rec.startedAt, rec.speed) + FOCUS.delayTicks;
        tick = Math.max(tick, rec.focus.at(-1)?.tick ?? 0, 0);
        if(tick > TOTAL_TICKS) fail('session_over', 409, 'La session est terminée.');
        const ev = { account: me.id, tick, focus: sanitizeFocus(f) };
        rec.focus.push(ev);
        await store.putGameSession(rec);
        return { event: ev };
      });
    },

    /* le navigateur signale la fin : en mode normal, refusé avant l'heure */
    async finish(me){
      const rec = await activeOf(me.id);
      if(!rec) fail('no_session', 404, 'Aucune session en cours.');
      if(rec.status === 'running' && !rec.dev && clock() < rec.finishAt)
        fail('too_early', 409, 'La session n\'est pas encore terminée.', { retryAfter: Math.ceil((rec.finishAt - clock()) / 1000) });
      settle(rec.id).catch(console.error);
      return { session: publicSession({ ...rec, status: 'settling' }) };
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
        return { item, loot: res.loot, inventory: { slots: inv.slots } };
      });
    },

    /* four : poser dans une case, la vider, récupérer les lingots. Inventaire et fours changent ensemble, sous le verrou
       de l'inventaire ; opId rend la demande rejouable sans effet (double clic, requête renvoyée). */
    async furnace(me, body = {}){
      const { opId } = body;
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      const op = { action: body.action, furnace: body.furnace, slot: body.slot, item: body.item, qty: body.qty, opId };
      return withLock('inv:' + me.id, async () => {
        const inv = await loadInventory(me.id), st = await loadFurnaces(me.id);
        const r = furnaceOp(st, inv, op, clock());
        if(r.error) fail(r.error, r.error === 'not_enough' || r.error === 'slot_busy' ? 409 : 400, FURNACE_ERRORS[r.error] ?? 'Demande invalide.');
        if(!r.repeated) await store.putInventoryAndFurnaces(me.id, JSON.parse(serialize(inv)), st);
        return { inventory: { slots: inv.slots }, furnaces: publicFurnaces(st) };
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
        return { item, inventory: { slots: inv.slots } };
      });
    },

    /* stuff : équiper une pièce de l'inventaire dans une case, ou la retirer. Inventaire et stuff changent ensemble. */
    async stuff(me, body = {}){
      const { opId } = body;
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      const op = { action: body.action, slot: body.slot, uid: body.uid, opId };
      return withLock('inv:' + me.id, async () => {
        const inv = await loadInventory(me.id), st = await loadStuff(me.id, inv);
        const r = stuffOp(inv, st, op);
        if(r.error) fail(r.error, r.error === 'not_owned' ? 409 : 400, STUFF_ERRORS[r.error] ?? 'Demande invalide.');
        if(!r.repeated) await store.putInventoryAndStuff(me.id, JSON.parse(serialize(inv)), st);
        return { inventory: { slots: inv.slots }, stuff: st.worn };
      });
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

    /* démarrage du serveur : un rejeu interrompu (arrêt brutal) est relancé ; ménage des vieilles sessions */
    async recover(){
      for(const rec of await store.sessionsWithStatus('settling')){ rec.status = 'running'; await store.putGameSession(rec); }
      for(const rec of await store.sessionsWithStatus('done'))
        if(rec.endedAt && clock() - rec.endedAt > config.keepEnded) await store.deleteGameSession(rec.id);
      await settleDue();
    },
    settleDue,
    settle,         // pour les tests
    /* ID de la session en cours du joueur (lancée par lui ou par le chef de son groupe), sinon null */
    activeSessionId: async accountId => (await activeOf(accountId))?.id ?? null,
  };
}
