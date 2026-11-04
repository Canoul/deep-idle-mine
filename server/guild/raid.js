/* Lobby de raid d'une guilde (04/11/2026, Geoffrey ; spec docs/superpowers/specs/2026-11-04-raid-cerbere-design.md) :
   onglet Raid de la guilde. En mémoire seulement, comme les groupes (un redémarrage le vide : chacun le rejoint à nouveau).
   Un lobby par guilde : { leader, members:[{ account, name, ready }], launching }.
   - seuls les membres de la guilde le rejoignent, RAID.maxPlayers au plus ; un joueur déjà en session (n'importe quel mode)
     ne peut ni le rejoindre ni lancer ;
   - chef de raid : le premier arrivé ; quand il part, le suivant (ordre d'arrivée) ; lobby vide : supprimé ;
   - une arrivée remet les autres « pas prêt » (comme un groupe) ; le chef compte toujours comme prêt ;
   - le chef lance quand tous les autres sont prêts : game.startRaid (server/game/service.js) crée la session pour tous ;
     réussi, le lobby est vidé (ils sont en raid) ;
   - un membre qui n'est plus dans la guilde sort du lobby à la prochaine lecture.
   Le lancement se fait HORS de la file du lobby et de celle de la guilde : il prend les verrous des comptes (inventaire,
   XP…), qu'un versement de session tient en attendant la guilde (addXp) ; launching bloque entrées et sorties pendant ce temps.
   guildOf(compte) → la guilde ({ id, members:[{ id }] }) ou null ; nameOf(compte) → pseudo affiché. */
import { RAID } from '../../src/config.js';
import { SocialError } from '../social/service.js';

const fail = (code, status, message) => { throw new SocialError(code, status, message); };

export function createRaidLobby({ game = null, guildOf, nameOf }){
  const lobbies = new Map();       // id de guilde → lobby
  let chain = Promise.resolve();
  const serial = fn => { const run = chain.catch(() => {}).then(fn); chain = run.catch(() => {}); return run; };
  const inSession = async id => !!(await game?.activeSessionId(id));

  /* la guilde du joueur (refus sans guilde) et son lobby, débarrassé de ceux qui ont quitté la guilde */
  async function context(me){
    const g = await guildOf(me.id);
    if(!g) fail('no_guild', 404, 'Tu n\'es pas dans une guilde.');
    const L = lobbies.get(g.id) ?? null;
    if(L) prune(g, L);
    return { g, L: lobbies.get(g.id) ?? null };
  }
  function prune(g, L){
    if(L.launching) return;
    L.members = L.members.filter(m => g.members.some(x => x.id === m.account));
    fix(g.id, L);
  }
  /* chef parti : le suivant ; plus personne : le lobby disparaît */
  function fix(guildId, L){
    if(!L.members.length){ lobbies.delete(guildId); return; }
    if(!L.members.some(m => m.account === L.leader)) L.leader = L.members[0].account;
    for(const m of L.members) if(m.account === L.leader) m.ready = true;
  }
  const notLaunching = L => { if(L?.launching) fail('raid_launching', 409, 'Le raid est en cours de lancement.'); };
  const waitingOf = L => L.members.filter(m => m.account !== L.leader && !m.ready);

  /* ce que voit un membre de la guilde (champ raid de GET /api/guild) */
  async function view(me){
    const g = await guildOf(me.id);
    if(!g) return null;
    const L = lobbies.get(g.id) ?? null;
    if(L) prune(g, L);
    const lobby = lobbies.get(g.id) ?? null;
    const members = lobby ? await Promise.all(lobby.members.map(async m => ({ account: m.account, name: m.name, ready: !!m.ready,
      leader: m.account === lobby.leader, me: m.account === me.id, playing: await inSession(m.account) }))) : [];
    const mine = members.some(m => m.me);
    const running = await game?.raidOfGuild?.(g.id).catch(() => null) ?? null;
    return { max: RAID.maxPlayers, members, leader: lobby?.leader ?? null, size: members.length, mine,
             isLeader: !!lobby && lobby.leader === me.id, launching: !!lobby?.launching,
             waiting: lobby ? waitingOf(lobby).map(m => m.name) : [],
             canLaunch: !!lobby && lobby.leader === me.id && !lobby.launching && !waitingOf(lobby).length,
             running: running ? { id: running.id, startedAt: running.startedAt, finishAt: running.finishAt,
                                  players: running.players.map(p => p.name), mine: running.players.some(p => p.account === me.id) } : null };
  }

  return {
    view,
    join: me => serial(async () => {
      const { g, L } = await context(me);
      if(L?.members.some(m => m.account === me.id)) return;            // déjà dedans (double clic)
      notLaunching(L);
      if(L && L.members.length >= RAID.maxPlayers) fail('raid_full', 409, `Le raid est complet (${RAID.maxPlayers} joueurs).`);
      if(await inSession(me.id)) fail('session_running', 409, 'Tu es déjà dans une session : termine-la d\'abord.');
      const lobby = L ?? { leader: me.id, members: [], launching: false };
      for(const m of lobby.members) if(m.account !== lobby.leader) m.ready = false;   // une arrivée : les autres repassent « pas prêt »
      lobby.members.push({ account: me.id, name: await nameOf(me.id), ready: false });
      lobbies.set(g.id, lobby);
      fix(g.id, lobby);
    }),
    leave: me => serial(async () => {
      const { g, L } = await context(me);
      if(!L?.members.some(m => m.account === me.id)) return;
      notLaunching(L);
      L.members = L.members.filter(m => m.account !== me.id);
      fix(g.id, L);
    }),
    /* le chef de raid sort un joueur du lobby */
    kick: (me, id) => serial(async () => {
      const { g, L } = await context(me);
      if(!L?.members.some(m => m.account === me.id)) fail('not_in_raid', 404, 'Tu n\'es pas dans le lobby du raid.');
      if(L.leader !== me.id) fail('not_leader', 403, 'Seul le chef du raid peut faire ça.');
      if(id === me.id || !L.members.some(m => m.account === id)) return;
      notLaunching(L);
      L.members = L.members.filter(m => m.account !== id);
      fix(g.id, L);
    }),
    ready: (me, on) => serial(async () => {
      if(typeof on !== 'boolean') fail('bad_request', 400, 'Demande invalide.');
      const { L } = await context(me);
      const m = L?.members.find(x => x.account === me.id);
      if(!m) fail('not_in_raid', 404, 'Tu n\'es pas dans le lobby du raid.');
      notLaunching(L);
      m.ready = L.leader === me.id ? true : on;
    }),
    /* le chef lance pour tout le lobby (lui en premier) ; body (mode dev) : { seed } */
    async launch(me, body = {}){
      const held = await serial(async () => {
        const { g, L } = await context(me);
        if(!L?.members.some(m => m.account === me.id)) fail('not_in_raid', 404, 'Tu n\'es pas dans le lobby du raid.');
        if(L.leader !== me.id) fail('not_leader', 403, 'C\'est le chef du raid qui lance.');
        notLaunching(L);
        if(!game) fail('unavailable', 503, 'Le raid n\'est pas disponible.');
        const waiting = waitingOf(L);
        if(waiting.length) fail('not_ready', 409, `Pas encore prêt : ${waiting.map(m => m.name).join(', ')}.`);
        for(const m of L.members) if(await inSession(m.account)) fail('member_in_session', 409, `${m.name || 'Un joueur'} est déjà dans une session.`);
        L.launching = true;
        const lead = L.members.find(m => m.account === me.id);
        return { g, L, members: [lead, ...L.members.filter(m => m !== lead)].map(m => ({ account: m.account, name: m.name })) };
      });
      const { g, L, members } = held;
      try {
        const r = await game.startRaid(me, members, { guild: g.id, ...(Number.isSafeInteger(body?.seed) ? { seed: body.seed } : {}) });
        await serial(async () => { if(lobbies.get(g.id) === L) lobbies.delete(g.id); });   // ils sont en raid
        return r;
      } catch(e){
        await serial(async () => { L.launching = false; });
        throw e;
      }
    },
    /* compte supprimé : il sort de tous les lobbies */
    eraseAccount: id => serial(async () => {
      for(const [gid, L] of lobbies) if(!L.launching && L.members.some(m => m.account === id)){ L.members = L.members.filter(m => m.account !== id); fix(gid, L); }
    }),
  };
}
