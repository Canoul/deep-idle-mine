/* Amis (onglet Social) : demandes d'ami, liste d'amis avec ce qu'ils font, rejoindre / inviter un ami.

   - Ajouter un ami par son pseudo (ou son ID de compte : un invité n'a pas de pseudo) envoie une DEMANDE ; l'autre
     l'accepte ou la refuse (pop-up + onglet Social). Deux joueurs qui se demandent l'un l'autre deviennent amis tout
     de suite. Un ami se retire des deux côtés.
   - Présence : chaque appel à state() est un signe de vie (le navigateur l'appelle toutes les quelques secondes, dans
     tous les onglets du jeu, même caché ou en session). En ligne = signe de vie depuis moins de SOCIAL_SERVER.onlineFor.
     La présence vit en mémoire (après un redémarrage, tout le monde réapparaît en quelques secondes).
   - Statut d'un ami : « session » (une session de jeu en cours pour lui), sinon « offline », sinon « lobby » (dans un
     groupe : n/3), sinon « online ».
   - Joueurs en ligne (onglet Social → Online, 26/10) : tous les comptes en ligne ou en session (même navigateur
     fermé), pas seulement les amis ; ceux qui
     ne sont pas en session d'abord (en ligne ou dans un lobby), puis ceux en session, par pseudo. Liste bornée à
     SOCIAL_SERVER.onlineListMax, le compteur donne le vrai total.
   - Classements (sous-onglet Classements, 27/10/2026) : GS, XP, XP de spécialisation (un par arbre), meilleur temps de
     tour céleste ; tous les comptes, le top LEADERBOARD.size et sa propre place (src/meta/leaderboard.js). Les valeurs
     viennent du service de jeu (game.leaderboardData) ; ici on classe et on met les pseudos.
   - Chat global (carte du Lobby, 28/10/2026) : un seul salon pour tous les comptes (invités compris), nom donné par le
     serveur, CHAT.globalGapMs entre deux messages d'un joueur ; les CHAT.keep derniers sont enregistrés (ns chat_global)
     et repris au premier appel après un redémarrage.
   - Inviter : passe par le service des groupes (invitation par ID, refusée si l'ami est en session). Rejoindre : entre
     dans le groupe de l'ami (créé s'il n'en a pas), seulement s'il est en ligne et pas en session.

   Stockage par compte (ns « social ») : { friends:[id], incoming:[{ from, at }], outgoing:[{ to, at }] }. Une
   demande touche deux comptes : ils sont écrits ensemble, et toutes les écritures passent l'une après l'autre (pas
   de demande à moitié faite avec deux requêtes simultanées). Testable seul : comptes, groupes, jeu et horloge passés
   en paramètres. */
import { displayName, formatAccountId, parseAccountId, nameKey } from '../../src/shared/account.js';
import { canBeInvited } from '../../src/shared/party.js';
import { createLimiter } from '../accounts/ratelimit.js';
import { SOCIAL_SERVER } from '../config.js';
import { isBoard, specTree, rankBoard } from '../../src/meta/leaderboard.js';
import { LEADERBOARD, CHAT } from '../../src/config.js';
import { LOBBY_TAG } from '../../src/shared/chat.js';
import crypto from 'node:crypto';
import { createChat } from '../game/chat.js';
import { createRaffle } from './raffle.js';
import { isRaffleJoin } from '../../src/shared/raffle.js';
import { RAFFLE } from '../../src/config.js';
import { chatChannel, sanitizeChatPrefs } from '../../src/shared/chat.js';

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
export function createSocialService({ store, accounts, party, game, clock = Date.now, config = SOCIAL_SERVER, moderation = null,
                                      random = () => crypto.randomBytes(6).readUIntBE(0, 6) / 2**48 }){
  const seen = new Map();                    // compte → dernier signe de vie (ms)
  const lastSeen = new Map();                // compte → dernier signe de vie, gardé whoRecentFor (« Who ? » : hors ligne récents)
  const energies = new Map();                // compte → { at, energy } : dernière énergie lue (energyField)
  const limit = createLimiter(config.requestsPerHour, clock);
  let chain = Promise.resolve();
  /* une écriture à la fois (une demande change deux comptes) */
  const serial = fn => { const run = chain.catch(() => {}).then(fn); chain = run.catch(() => {}); return run; };

  const load = async id => sanitizeSocial(await store.getSocial(id), config);
  const save = entries => store.putSocial(entries);           // [[id, social]…] écrits ensemble
  const online = id => clock() - (seen.get(id) ?? -Infinity) <= config.onlineFor;
  /* chat global : jamais oublié faute de message (ttl infini), relu en base une seule fois */
  const GLOBAL = 'global';
  const chat = createChat({ clock, gapMs: CHAT.globalGapMs, ttlMs: Infinity, keep: CHAT.globalKeep });
  /* canaux (31/10) : un message avec des lecteurs (to : MP, groupe) ne part qu'à eux et à son auteur ; to n'est jamais envoyé */
  const canRead = (m, id) => !m.to || m.account === id || m.to.includes(id);
  /* le code du groupe d'un lien reste au serveur : survol et clic passent par le numéro du message, on ne peut pas essayer des codes */
  const chatView = ({ to: _to, lobby, ...m }) => lobby ? { ...m, lobby: { mode: lobby.mode, level: lobby.level, size: lobby.size, max: lobby.max } } : m;
  /* lecteurs d'un message : {} (public), ou { to, toName? } ; le serveur décide, le navigateur donne seulement un pseudo */
  async function audience(me, channel, to){
    if(channel === 'group'){
      const members = await party?.membersOf?.(me.id) ?? [];
      if(members.length < 2) fail('bad_request', 400, "Tu n'es pas dans un groupe.");
      return { to: members, ...(await party.isLeader?.(me.id) ? { leader: true } : {}) };   // chef du groupe à l'envoi (31/10) : décidé ici, jamais par le navigateur
    }
    if(channel !== 'mp') return {};
    const target = typeof to === 'string' ? await accounts.findAccountByName(nameKey(to)) : null;
    if(!target) fail('not_found', 404, 'Ce joueur n\'existe pas.');
    if(target.id === me.id) fail('bad_request', 400, 'Tu ne peux pas t\'écrire à toi-même.');
    return { to: [target.id], toName: displayName(target) };
  }
  async function lobbyOfMessage(me, id){
    await chatReady();
    const m = Number.isSafeInteger(id) ? chat.since(GLOBAL, id - 1).find(x => x.id === id && canRead(x, me.id)) : null;
    if(!m?.lobby) fail('not_found', 404, 'Ce lien n\'est plus valable.');
    return m.lobby;
  }
  let chatLoad = null;
  const chatReady = () => chatLoad ??= Promise.resolve().then(() => store.getGlobalChat?.())
    .then(raw => chat.restore(GLOBAL, raw)).catch(console.error);
  const nameOf = async id => displayName(await accounts.getAccount(id)) || formatAccountId(id);
  const saveChat = () => serial(() => store.putGlobalChat(chat.room(GLOBAL)));
  const raffle = createRaffle({ store, clock, random, give: (id, key, lot) => game.raffleGive(id, key, lot),
    announce: async (text, winner) => { await chatReady(); chat.system(GLOBAL, RAFFLE.name, text, CHAT.channels[0].id, winner ? { winner } : {}); await saveChat(); } });

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
    const ses = await game.activeSessionInfo(id);
    if(ses) return { status: 'session', mode: ses.mode, leftMs: ses.leftMs, ...(ses.size ? { size: ses.size, max: ses.max } : {}) };
    if(await game.prisonActiveOf?.(id)) return { status: 'session', mode: 'prison', online: online(id) };   // prison (30/10/2026) : comptée comme une session ; online : jeu ouvert (pastille verte, 31/10)
    if(!online(id)) return { status: 'offline' };
    const g = party.groupOf(id);
    return g ? { status: 'lobby', size: g.size, max: g.max } : { status: 'online' };
  }

  /* son énergie (31/10/2026) : relue au plus tous les energyFor, la lecture parcourt ses sessions et chaque navigateur
     redemande ses amis toutes les quelques secondes ; { energy } ou rien si le service de jeu ne la donne pas */
  async function energyField(id){
    let c = energies.get(id);
    if(!c || clock() - c.at >= config.energyFor){
      c = { at: clock(), energy: await game.energyOf?.(id) };
      energies.set(id, c);
    }
    return c.energy ? { energy: c.energy } : {};
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
      friends.push({ id, displayId: formatAccountId(id), name: await nameOf(id), ...st, ...await energyField(id), together,
                     canInvite: !meBusy && canBeInvited(st) && !together,
                     canJoin: !meBusy && (st.status === 'online' || st.status === 'lobby') && !together && !(g && (g.size >= g.max || g.locked)) });
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

    /* joueurs en ligne (tous, amis ou non) : { count, players:[{ id, displayId, name, status…, energy, me, friend }] } */
    async online(me){
      const now = clock();
      for(const [id, t] of seen) if(now - t > config.onlineFor) seen.delete(id);     // oubliés : la Map ne grossit pas
      const mine = new Set((await load(me.id)).friends);
      /* en ligne = jeu ouvert (signe de vie) OU en session (elle tourne sur le serveur même navigateur fermé, comme chez les amis) */
      const ids = new Set([...seen.keys(), ...await game.playersInSession()]);
      const players = [];
      for(const id of ids)
        players.push({ id, displayId: formatAccountId(id), name: await nameOf(id), ...await statusOf(id), me: id === me.id, friend: mine.has(id) });
      const busy = p => p.status === 'session' ? 1 : 0;                                 // pas en session au-dessus
      players.sort((a, b) => busy(a) - busy(b) || a.name.localeCompare(b.name, 'fr'));
      const shown = players.slice(0, config.onlineListMax);
      for(const p of shown) Object.assign(p, await energyField(p.id));
      return { count: players.length, players: shown };
    },

    /* « Who ? » (lobby, tour ouverte) : joueurs qui n'ont pas encore fait la tour de ce camp pendant cette ouverture, pour
       trouver des alliés : en ligne d'abord, puis hors ligne venus depuis whoRecentFor (26/10/2026 ; lastSeenAt : dernier
       passage, le plus récent d'abord). Moi exclu. Tour fermée : liste vide. */
    async towerWho(me, side){
      const t = await game.towerDone(side);
      if(!t.open) return { side, open: false, count: 0, players: [] };
      const all = await api.online(me);
      const players = all.players.filter(p => !p.me && !t.done.has(p.id));
      const now = clock(), since = now - config.whoRecentFor, shown = new Set(all.players.map(p => p.id));
      for(const [id, at] of lastSeen) if(at < since) lastSeen.delete(id);
      const when = { ...await accounts.recentlySeen?.(since) };
      for(const [id, at] of lastSeen) if(!(when[id] >= at)) when[id] = at;
      const mine = new Set((await load(me.id)).friends);
      const away = [];
      for(const [id, at] of Object.entries(when)){
        if(id === me.id || shown.has(id) || t.done.has(id) || !await accounts.getAccount(id)) continue;
        away.push({ id, displayId: formatAccountId(id), name: await nameOf(id), status: 'offline', lastSeenAt: at, friend: mine.has(id) });
      }
      away.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
      const list = [...players, ...away].slice(0, config.onlineListMax);
      return { side, open: true, count: list.length, online: players.length, players: list };
    },

    /* un classement (board : BOARDS de src/meta/leaderboard.js) : { board, total, rows:[{ rank, name, value, me, … }], me } */
    async leaderboard(me, board){
      if(!isBoard(board)) fail('bad_request', 400, 'Classement inconnu.');
      const data = await game.leaderboardData(), tree = specTree(board);
      const hidden = new Set((await Promise.all(LEADERBOARD.hidden.map(n => accounts.findAccountByName(nameKey(n))))).filter(Boolean).map(a => a.id));
      const r = rankBoard(board, (tree ? data.spec[tree] : data[board]).filter(e => !hidden.has(e.id)), me.id);
      const row = async ({ id, rank, value, me: mine, level, side, team, fight }) =>
        ({ rank, name: await nameOf(id), value, me: mine, ...(level ? { level } : {}), ...(side ? { side, team } : {}),
           ...(board === 'instance' || board === 'instance2' ? { team: team ?? [], fight: fight ?? null } : {}) });   // roi gobelin (niveaux 1 et 2) : équipe, temps de combat (29/10)
      return { board, total: r.total, rows: await Promise.all(r.rows.map(row)), me: r.me && await row(r.me) };
    },

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

    /* chat global : tout compte connecté écrit ; le nom affiché vient du compte (serveur), jamais du navigateur */
    async chatPost(me, body = {}){
      await chatReady();
      const channel = chatChannel(body.channel).id;
      /* !join (31/10) : jamais publié ; la réponse revient à ce joueur seul, dans le canal où il l'a tapé */
      if(isRaffleJoin(body.text)){
        const message = chat.notice(GLOBAL, RAFFLE.name, await raffle.join(me), channel);
        await saveChat();
        return { message };
      }
      const reach = await audience(me, channel, body.to);
      const lobby = typeof body.text === 'string' && body.text.includes(LOBBY_TAG) ? { lobby: await party.chatLink(me, body.lobby) } : {};
      const r = chat.post(GLOBAL, me.id, displayName(me) || formatAccountId(me.id), body.text, { channel, ...reach, ...lobby });
      if(r.error === 'bad_text') fail('bad_request', 400, `Message vide ou trop long (${CHAT.maxLen} caractères au plus).`);
      if(r.error === 'too_fast') fail('too_many', 429, `Doucement : un message toutes les ${CHAT.globalGapMs / 1000} secondes au plus.`);
      await serial(() => store.putGlobalChat(chat.room(GLOBAL)));   // état le plus récent, écritures l'une après l'autre
      /* mot interdit (30/10) : publié masqué, et un avertissement pour son auteur */
      const warning = r.hits.length && moderation
        ? await moderation.warn(me.id, { channel: 'global', text: r.original, masked: r.msg.text, hits: r.hits }) : null;
      return { message: chatView(r.msg), ...(warning ? { warning } : {}) };
    },
    /* messages après le numéro after (absent ou invalide : tous ceux gardés), seulement ceux que ce joueur peut lire */
    async chatGet(me, after){
      await chatReady();
      return { messages: chat.since(GLOBAL, Number.isSafeInteger(after) && after > 0 ? after : 0).filter(m => canRead(m, me.id)).slice(-CHAT.keep).map(chatView) };
    },
    /* lien de lobby d'un message (31/10/2026) : son aperçu, tel qu'il est maintenant ; { open:false } si le groupe n'existe plus */
    async chatLobby(me, id){
      const link = await lobbyOfMessage(me, id), peek = await party.peek(link.code);
      return { mode: link.mode, level: link.level, open: !!peek, ...(peek ?? { size: 0, max: link.max, members: [] }) };
    },
    /* cliquer sur le lien : rejoindre ce groupe (mêmes règles qu'avec son code) */
    async chatLobbyJoin(me, id){
      const link = await lobbyOfMessage(me, id);
      if(!await party.peek(link.code)) fail('party_not_found', 404, 'Ce groupe n\'existe plus.');
      return party.join(me, link.code);
    },
    /* réglages du chat de ce joueur (onglets, canaux masqués) */
    async chatPrefs(me){ return sanitizeChatPrefs(await store.getChatPrefs?.(me.id)); },
    async chatPrefsSave(me, body = {}){ const p = sanitizeChatPrefs(body); await store.putChatPrefs(me.id, p); return p; },

  };
  /* toute demande d'un joueur est un signe de vie (state() en premier : le navigateur l'appelle sans arrêt) */
  for(const k of Object.keys(api)){ const fn = api[k]; api[k] = (me, ...rest) => { seen.set(me.id, clock()); lastSeen.set(me.id, clock()); return fn(me, ...rest); }; }
  /* messages du chat global de moins de ms (bulles du Carreau, server/town/service.js) : pas un signe de vie */
  api.statusOf = statusOf;   // présence d'un membre de guilde (server/guild/service.js) : pas un signe de vie
  api.raffleForce = () => raffle.force();   // administration (server/admin/routes.js)
  api.raffleTick = () => raffle.tick();   // boucle du serveur (server/main.js) : pas un signe de vie
  api.recentChat = async ms => { await chatReady(); const now = clock(); return chat.since(GLOBAL, 0).filter(m => !m.to && now - m.at <= ms); };   // jamais un MP ni un message de groupe
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
