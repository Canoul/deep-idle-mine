/* Amis (onglet Social) : demandes d'ami, liste d'amis avec ce qu'ils font, rejoindre / inviter un ami.

   - Ajouter un ami par son pseudo (ou son ID de compte : un invité n'a pas de pseudo) envoie une DEMANDE ; l'autre
     l'accepte ou la refuse (pop-up + onglet Social). Deux joueurs qui se demandent l'un l'autre deviennent amis tout
     de suite. Un ami se retire des deux côtés.
   - Présence : chaque appel à state() est un signe de vie (le navigateur l'appelle toutes les quelques secondes, dans
     tous les onglets du jeu, même caché ou en session). En ligne = signe de vie depuis moins de SOCIAL_SERVER.onlineFor.
     La présence vit en mémoire (après un redémarrage, tout le monde réapparaît en quelques secondes).
   - Statut d'un ami : « session » (une session de jeu en cours pour lui), sinon « offline », sinon « lobby » (dans un
     groupe : n/3), sinon « online ».
   - Inviter : passe par le service des groupes (invitation par ID, refusée si l'ami est en session). Rejoindre : entre
     dans le groupe de l'ami (créé s'il n'en a pas), seulement s'il est en ligne et pas en session.

   Stockage par compte (ns « social ») : { friends:[id], incoming:[{ from, at }], outgoing:[{ to, at }] }. Une
   demande touche deux comptes : ils sont écrits ensemble, et toutes les écritures passent l'une après l'autre (pas
   de demande à moitié faite avec deux requêtes simultanées). Testable seul : comptes, groupes, jeu et horloge passés
   en paramètres. */
import { displayName, formatAccountId, parseAccountId, nameKey } from '../../src/shared/account.js';
import { createLimiter } from '../accounts/ratelimit.js';
import { SOCIAL_SERVER } from '../config.js';

export class SocialError extends Error {
  constructor(code, status, message, extra = {}){ super(message); this.code = code; this.status = status; Object.assign(this, extra); }
}
const fail = (code, status, message, extra) => { throw new SocialError(code, status, message, extra); };

const empty = () => ({ friends: [], incoming: [], outgoing: [] });
/* relu et revérifié à chaque fois : listes d'ID valides, sans doublon, bornées */
const isId = v => typeof v === 'string' && parseAccountId(v) === v;
export function sanitizeSocial(raw, cfg = SOCIAL_SERVER){
  const s = empty();
  if(!raw || typeof raw !== 'object') return s;
  const uniq = (list, key) => { const seen = new Set(); return list.filter(x => { const k = key(x); if(seen.has(k)) return false; seen.add(k); return true; }); };
  s.friends = uniq(Array.isArray(raw.friends) ? raw.friends.filter(isId) : [], x => x).slice(0, cfg.maxFriends);
  s.incoming = uniq(Array.isArray(raw.incoming) ? raw.incoming.filter(r => r && isId(r.from) && Number.isFinite(r.at) && !s.friends.includes(r.from)) : [], r => r.from)
    .map(r => ({ from: r.from, at: r.at })).slice(-cfg.maxIncoming);
  s.outgoing = uniq(Array.isArray(raw.outgoing) ? raw.outgoing.filter(r => r && isId(r.to) && Number.isFinite(r.at) && !s.friends.includes(r.to)) : [], r => r.to)
    .map(r => ({ to: r.to, at: r.at })).slice(-cfg.maxOutgoing);
  return s;
}

/* accounts : { getAccount(id), findAccountByName(clé) } ; party : service des groupes ; game : service de jeu */
export function createSocialService({ store, accounts, party, game, clock = Date.now, config = SOCIAL_SERVER }){
  const seen = new Map();                    // compte → dernier signe de vie (ms)
  const limit = createLimiter(config.requestsPerHour, clock);
  let chain = Promise.resolve();
  /* une écriture à la fois (une demande change deux comptes) */
  const serial = fn => { const run = chain.catch(() => {}).then(fn); chain = run.catch(() => {}); return run; };

  const load = async id => sanitizeSocial(await store.getSocial(id), config);
  const save = entries => store.putSocial(entries);           // [[id, social]…] écrits ensemble
  const online = id => clock() - (seen.get(id) ?? -Infinity) <= config.onlineFor;
  const nameOf = async id => displayName(await accounts.getAccount(id)) || formatAccountId(id);

  /* l'ami visé : par pseudo d'abord, sinon par ID (« 7K3Q-9XHP ») */
  async function findTarget(input){
    const text = typeof input === 'string' ? input.trim() : '';
    if(!text || text.length > 32) fail('bad_name', 400, 'Tape le pseudo de ton ami.');
    const byName = await accounts.findAccountByName(nameKey(text));
    if(byName) return byName;
    const id = parseAccountId(text);
    const byId = id && await accounts.getAccount(id);
    if(byId) return byId;
    fail('not_found', 404, 'Aucun joueur avec ce pseudo.');
  }

  /* ce que fait un ami */
  async function statusOf(id){
    if(await game.activeSessionId(id)) return { status: 'session' };
    if(!online(id)) return { status: 'offline' };
    const g = party.groupOf(id);
    return g ? { status: 'lobby', size: g.size, max: g.max } : { status: 'online' };
  }

  async function view(me){
    const s = await load(me.id);
    const meBusy = !!await game.activeSessionId(me.id);
    const myGroup = party.groupOf(me.id);
    const friends = [];
    for(const id of s.friends){
      const st = await statusOf(id);
      const g = party.groupOf(id);
      const together = !!(g && myGroup && g.code === myGroup.code);
      friends.push({ id, displayId: formatAccountId(id), name: await nameOf(id), ...st, together,
                     canInvite: !meBusy && st.status !== 'offline' && st.status !== 'session' && !together,
                     canJoin: !meBusy && (st.status === 'online' || st.status === 'lobby') && !together && !(g && g.size >= g.max) });
    }
    const order = { lobby: 0, online: 1, session: 2, offline: 3 };
    friends.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name, 'fr'));
    return {
      friends,
      incoming: await Promise.all(s.incoming.map(async r => ({ id: r.from, displayId: formatAccountId(r.from), name: await nameOf(r.from), at: r.at }))),
      outgoing: await Promise.all(s.outgoing.map(async r => ({ id: r.to, displayId: formatAccountId(r.to), name: await nameOf(r.to), at: r.at }))),
      /* invitations de groupe reçues (pop-up « xxx vous a invité dans son lobby ») */
      partyInvites: party.invitesOf(me.id),
    };
  }

  const friendOf = async (me, input) => {
    const id = parseAccountId(typeof input === 'string' ? input : '');
    if(!id || !(await load(me.id)).friends.includes(id)) fail('not_friend', 404, 'Ce joueur n\'est pas dans tes amis.');
    return accounts.getAccount(id);
  };

  const api = {
    /* liste d'amis + demandes + invitations */
    state: me => view(me),

    /* demander quelqu'un en ami (par pseudo ou ID) ; s'il m'avait déjà demandé : amis tout de suite */
    request: (me, input) => serial(async () => {
      const target = await findTarget(input);
      if(target.id === me.id) fail('self', 400, 'Tu ne peux pas t\'ajouter toi-même.');
      const a = await load(me.id), b = await load(target.id);
      const name = displayName(target);
      if(a.friends.includes(target.id)) fail('already_friend', 409, `${name} est déjà dans tes amis.`);
      if(a.incoming.some(r => r.from === target.id)) return accept(me, a, b, target.id);
      if(a.outgoing.some(r => r.to === target.id)) fail('already_sent', 409, `Demande déjà envoyée à ${name}.`);
      if(a.friends.length >= config.maxFriends) fail('too_many', 409, 'Tu as atteint le nombre maximum d\'amis.');
      if(b.friends.length >= config.maxFriends) fail('too_many', 409, `${name} a atteint le nombre maximum d'amis.`);
      if(a.outgoing.length >= config.maxOutgoing) fail('too_many', 409, 'Trop de demandes en attente : attends qu\'on te réponde.');
      const lim = limit.check(me.id);
      if(!lim.ok) fail('rate_limited', 429, 'Trop de demandes envoyées. Réessaie plus tard.', { retryAfter: lim.retryAfter });
      limit.hit(me.id);
      const at = clock();
      a.outgoing.push({ to: target.id, at });
      b.incoming.push({ from: me.id, at });
      if(b.incoming.length > config.maxIncoming) b.incoming.splice(0, b.incoming.length - config.maxIncoming);
      await save([[me.id, a], [target.id, b]]);
      return { sent: name, ...await view(me) };
    }),

    /* répondre à une demande reçue */
    answer: (me, input, yes) => serial(async () => {
      const id = parseAccountId(typeof input === 'string' ? input : '');
      const a = await load(me.id);
      if(!id || !a.incoming.some(r => r.from === id)) return view(me);           // déjà traitée (double clic) : rien à faire
      const b = await load(id);
      if(yes) return accept(me, a, b, id);
      a.incoming = a.incoming.filter(r => r.from !== id);
      b.outgoing = b.outgoing.filter(r => r.to !== me.id);
      await save([[me.id, a], [id, b]]);
      return view(me);
    }),

    /* annuler une demande envoyée, ou retirer un ami (des deux côtés) */
    remove: (me, input) => serial(async () => {
      const id = parseAccountId(typeof input === 'string' ? input : '');
      if(!id) fail('bad_request', 400, 'Joueur invalide.');
      const a = await load(me.id), b = await load(id);
      a.friends = a.friends.filter(x => x !== id); b.friends = b.friends.filter(x => x !== me.id);
      a.outgoing = a.outgoing.filter(r => r.to !== id); b.incoming = b.incoming.filter(r => r.from !== me.id);
      await save([[me.id, a], [id, b]]);
      return view(me);
    }),

    /* inviter un ami dans mon groupe / rejoindre le sien */
    async invite(me, input){
      const f = await friendOf(me, input);
      if(!online(f.id)) fail('friend_offline', 409, `${displayName(f)} est hors ligne.`);
      await party.invite(me, f.id);
      return view(me);
    },
    async join(me, input){
      const f = await friendOf(me, input);
      if(!online(f.id)) fail('friend_offline', 409, `${displayName(f)} est hors ligne.`);
      const r = await party.joinFriend(me, f);
      return { party: r.party, ...await view(me) };
    },

    /* voir le stuff d'un ami (niveau, pièces portées, skills), même hors ligne ; seulement un ami */
    async profile(me, input){
      const f = await friendOf(me, input);
      if(!f) fail('not_found', 404, 'Ce joueur n\'existe plus.');
      return { id: f.id, displayId: formatAccountId(f.id), name: displayName(f) || formatAccountId(f.id), ...await game.profile(f.id) };
    },

  };
  /* toute demande d'un joueur est un signe de vie (state() en premier : le navigateur l'appelle sans arrêt) */
  for(const k of Object.keys(api)){ const fn = api[k]; api[k] = (me, ...rest) => { seen.set(me.id, clock()); return fn(me, ...rest); }; }
  return api;

  /* devenir amis : on retire les demandes dans les deux sens */
  async function accept(me, a, b, id){
    if(a.friends.length >= config.maxFriends || b.friends.length >= config.maxFriends) fail('too_many', 409, 'Nombre maximum d\'amis atteint.');
    a.incoming = a.incoming.filter(r => r.from !== id); a.outgoing = a.outgoing.filter(r => r.to !== id);
    b.incoming = b.incoming.filter(r => r.from !== me.id); b.outgoing = b.outgoing.filter(r => r.to !== me.id);
    if(!a.friends.includes(id)) a.friends.push(id);
    if(!b.friends.includes(me.id)) b.friends.push(me.id);
    await save([[me.id, a], [id, b]]);
    return { friend: await nameOf(id), ...await view(me) };
  }
}
