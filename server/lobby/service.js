/* Lobby partagé de l'onglet Mine (GAME_DESIGN §6, « Lancer une session ») : jusqu'à 3 joueurs préparent une
   session ensemble. Logique sans HTTP, testable avec une horloge simulée.

   - Inviter : par pseudo ou par ID de compte. Une invitation reste valable jusqu'au lancement du lobby (ou jusqu'à
     ce qu'on la refuse, ou que le lobby se vide). L'invité la voit dans l'onglet Social.
   - Rejoindre : l'invité quitte son lobby éventuel et entre dans celui de l'hôte ; tous voient le même lobby.
   - L'hôte seul lance la session, avec exactement les membres présents (le serveur de jeu la crée).
   - L'hôte part (ou n'est plus vu depuis LOBBY_SERVER.idle) : le plus ancien membre devient hôte.
   Les lobbies vivent en mémoire : un redémarrage du serveur les vide (comptes et sessions de jeu restent). */
import crypto from 'node:crypto';
import { GAME } from '../../src/config.js';
import { nameKey, parseAccountId, formatAccountId, displayName } from '../../src/shared/account.js';
import { createLimiter } from '../accounts/ratelimit.js';
import { LOBBY_SERVER } from '../config.js';

export class LobbyError extends Error {
  constructor(code, status, message, extra = {}){ super(message); this.code = code; this.status = status; Object.assign(this, extra); }
}
const fail = (code, status, message, extra) => { throw new LobbyError(code, status, message, extra); };
const inviteId = v => typeof v === 'string' && /^[\w-]{8,64}$/.test(v);

/* accounts : stockage des comptes (getAccount, findAccountByName) ; game : service des sessions de jeu */
export function createLobbyService({ accounts, game, clock = Date.now, config = LOBBY_SERVER, maxPlayers = GAME.maxPlayers }){
  const lobbies = new Map();    // id → { id, host, members:[{ id, name, joinedAt, seenAt }], invites:[…] }
  const memberOf = new Map();   // ID de compte → id du lobby
  const inviteLimit = createLimiter({ max: config.invitesPerHour, window: 3600e3 }, clock);

  /* une opération à la fois : deux requêtes simultanées (double clic, deux joueurs) ne s'entremêlent jamais */
  let queue = Promise.resolve();
  const serial = fn => { const run = queue.catch(() => {}).then(fn); queue = run.catch(() => {}); return run; };

  const lobbyOf = id => lobbies.get(memberOf.get(id)) ?? null;

  function removeMember(l, id){
    l.members = l.members.filter(m => m.id !== id);
    memberOf.delete(id);
    if(!l.members.length){ lobbies.delete(l.id); return; }            // lobby vide : ses invitations disparaissent
    if(l.host === id) l.host = l.members[0].id;                        // le plus ancien devient hôte
  }
  function dissolve(l){
    for(const m of l.members) memberOf.delete(m.id);
    lobbies.delete(l.id);
  }
  /* membres plus vus depuis longtemps (page fermée) : ils quittent le lobby */
  function prune(){
    const old = clock() - config.idle;
    for(const l of [...lobbies.values()]) for(const m of [...l.members]) if(m.seenAt < old) removeMember(l, m.id);
  }
  const member = acc => ({ id: acc.id, name: acc.name ?? null, joinedAt: clock(), seenAt: clock() });
  const nameOf = m => displayName(m);

  /* joueur visé par un pseudo ou un ID de compte (saisie tolérante : 7k3q 9xhp) */
  async function lookup(input){
    const s = String(input).trim();
    if(!s || s.length > 40) return null;
    const id = parseAccountId(s);
    const byId = id ? await accounts.getAccount(id) : null;
    return byId ?? await accounts.findAccountByName(nameKey(s));
  }

  /* ce que voit un joueur : son lobby (s'il en a un) et les invitations qu'il a reçues */
  function view(me){
    const l = lobbyOf(me.id);
    const lobby = l && {
      id: l.id, maxPlayers,
      members: l.members.map(m => ({ id: m.id, displayId: formatAccountId(m.id), name: nameOf(m), host: m.id === l.host, me: m.id === me.id })),
      pending: l.invites.map(i => ({ id: i.id, name: i.toName })),
      isHost: l.host === me.id,
    };
    const invites = [];
    for(const x of lobbies.values()) for(const i of x.invites) if(i.to === me.id && x.id !== l?.id)
      invites.push({ id: i.id, from: i.fromName, host: nameOf(x.members.find(m => m.id === x.host)), players: x.members.length, at: i.at });
    return { lobby, invites };
  }

  return {
    /* relu par le navigateur toutes les LOBBY.pollMs : le joueur est vu (il reste dans son lobby) */
    poll(me){
      return serial(async () => {
        prune();
        const m = lobbyOf(me.id)?.members.find(x => x.id === me.id);
        if(m) m.seenAt = clock();
        return { ...view(me), inSession: await game.hasActive(me.id) };
      });
    },

    invite(me, body = {}){
      return serial(async () => {
        prune();
        if(typeof body.to !== 'string') fail('bad_request', 400, 'Pseudo ou ID manquant.');
        const target = await lookup(body.to);
        if(!target) fail('not_found', 404, 'Aucun joueur avec ce pseudo ou cet ID.');
        if(target.id === me.id) fail('self', 400, 'Tu ne peux pas t\'inviter toi-même.');
        let l = lobbyOf(me.id);
        if(l?.members.some(m => m.id === target.id)) fail('already_member', 409, `${displayName(target)} est déjà dans ton lobby.`);
        if(l && l.members.length >= maxPlayers) fail('full', 409, 'Le lobby est complet.');
        if(l?.invites.some(i => i.to === target.id)) return view(me);              // déjà invité : rien de plus
        if(l && l.invites.length >= config.maxPending) fail('too_many', 429, 'Trop d\'invitations en attente.');
        const lim = inviteLimit.check(me.id);
        if(!lim.ok) fail('rate_limited', 429, 'Trop d\'invitations envoyées. Réessaie plus tard.', { retryAfter: lim.retryAfter });
        inviteLimit.hit(me.id);
        if(!l){                                                                      // premier invité : le lobby naît
          l = { id: crypto.randomUUID(), host: me.id, members: [member(me)], invites: [] };
          lobbies.set(l.id, l); memberOf.set(me.id, l.id);
        }
        l.invites.push({ id: crypto.randomUUID(), to: target.id, toName: displayName(target),
                         from: me.id, fromName: displayName(me), at: clock() });
        return view(me);
      });
    },

    accept(me, body = {}){
      return serial(async () => {
        prune();
        if(!inviteId(body.invite)) fail('bad_request', 400, 'Invitation invalide.');
        const l = [...lobbies.values()].find(x => x.invites.some(i => i.id === body.invite && i.to === me.id));
        if(!l) fail('no_invite', 404, 'Cette invitation n\'existe plus.');
        if(await game.hasActive(me.id)) fail('session_running', 409, 'Tu es déjà dans une session : termine-la avant de rejoindre un lobby.');
        if(l.members.length >= maxPlayers) fail('full', 409, 'Ce lobby est complet.');
        const cur = lobbyOf(me.id);
        if(cur) removeMember(cur, me.id);                                            // on quitte son lobby actuel
        l.invites = l.invites.filter(i => i.to !== me.id);
        l.members.push(member(me)); memberOf.set(me.id, l.id);
        return view(me);
      });
    },

    decline(me, body = {}){
      return serial(async () => {
        if(!inviteId(body.invite)) fail('bad_request', 400, 'Invitation invalide.');
        for(const l of lobbies.values()) l.invites = l.invites.filter(i => !(i.id === body.invite && i.to === me.id));
        return view(me);
      });
    },

    leave(me){
      return serial(async () => {
        const l = lobbyOf(me.id);
        if(l) removeMember(l, me.id);
        return view(me);
      });
    },

    /* Lancer : seul, la session habituelle ; en lobby, l'hôte seul, avec tous les membres. Le lobby disparaît
       ensuite (ses invitations aussi) ; chaque membre retrouve la session en relisant son état. */
    launch(me, body = {}){
      return serial(async () => {
        prune();
        const l = lobbyOf(me.id);
        if(l && l.members.length > 1 && l.host !== me.id) fail('not_host', 403, 'Seul l\'hôte peut lancer la session.');
        const group = l && l.members.length > 1 ? l.members.map(m => ({ id: m.id, name: m.name })) : null;
        const out = await game.start(me, body, group);
        if(l) dissolve(l);
        return out;
      });
    },

    /* pour les tests */
    _lobbies: lobbies,
  };
}
