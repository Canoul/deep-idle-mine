/* Groupes (lobby à plusieurs) : se réunir avant de lancer une session commune.

   - Un groupe a un chef, jusqu'à GAME.maxPlayers membres et un code (ex. K7Q4P2) : le code ou le lien
     #rejoindre=K7Q4P2 permettent d'entrer ; on peut aussi inviter un ami par son ID de compte (il accepte ou refuse
     depuis son lobby).
   - Seul le chef lance : le serveur crée alors la session de jeu pour tous les membres (server/game/service.js).
     Le groupe RESTE après le lancement (décision du créateur, 21/10/2026) : à la fin de la session, chacun revient
     dans le même groupe et le chef peut relancer sans réinviter. Qui ne veut pas enchaîner quitte le groupe.
     Si le chef part, le membre suivant devient chef ; un groupe vide disparaît. Le chef peut aussi donner sa place.
   - « Prêt » (21/10/2026) : chaque membre (sauf le chef : lancer = prêt) se déclare prêt ; le chef ne lance que si tous
     les autres le sont. Au lancement, et quand quelqu'un rejoint, tout le monde repasse « pas prêt » : à la fin d'une
     session, le chef ne peut pas relancer tant que les autres n'ont pas redit qu'ils sont prêts.
   - Un membre qui n'a plus donné signe de vie (onglet fermé) depuis PARTY_SERVER.memberTimeout est retiré, sauf s'il
     est dans une session (pendant la partie, son navigateur ne parle plus au groupe) : le délai repart de la fin.
   Les groupes vivent en mémoire et sont recopiés dans le stockage (store, s'il est donné) à chaque vrai changement :
   un redémarrage du serveur (mise à jour automatique toutes les 2 min) les retrouve (load). Les signes de vie ne sont
   pas enregistrés (ils changent sans arrêt) : au redémarrage, tout le monde repart avec un délai neuf.
   Recherche de groupe (LFG, mine classique, 22/10/2026) : un solo ou le chef d'un groupe de 2 entre dans une file ; dès
   qu'elle permet un lobby complet, il se forme d'un coup (règle : src/shared/lfg.js). Le chef de ce lobby peut avoir
   demandé « lancer dès que plein » : la session Mine démarre alors aussitôt. La file vit en mémoire seulement (perdue
   au redémarrage : le navigateur s'en aperçoit grâce à `boot` et relance sa recherche).
   Testable seul : on lui passe le service de jeu, la recherche de compte et une horloge. */
import crypto from 'node:crypto';
import { GAME, PARTY, MINE_MODES } from '../../src/config.js';
import { CODE_ALPHABET, displayName, parseAccountId, formatAccountId } from '../../src/shared/account.js';
import { parsePartyCode } from '../../src/shared/party.js';
import { matchLfg } from '../../src/shared/lfg.js';
import { createLimiter } from '../accounts/ratelimit.js';
import { PARTY_SERVER } from '../config.js';

export class PartyError extends Error {
  constructor(code, status, message, extra = {}){ super(message); this.code = code; this.status = status; Object.assign(this, extra); }
}
const fail = (code, status, message, extra) => { throw new PartyError(code, status, message, extra); };

/* game : service des sessions ; getAccount(id) : compte ou null (pour inviter par ID) */
export function createPartyService({ game, getAccount, store = null, clock = Date.now, config = PARTY_SERVER,
                                     newCode = () => Array.from({ length: PARTY.codeLength }, () => CODE_ALPHABET[crypto.randomInt(32)]).join('') }){
  const parties = new Map();                 // code → groupe
  /* « Prêt tout le temps » (23/10/2026) : réglage du JOUEUR, pas du groupe. Seule la case le change ; il le garde en
     changeant de groupe (nouveau groupe, invitation, LFG). Retrouvé au redémarrage depuis les groupes enregistrés. */
  const alwaysOn = new Set();
  const newMember = (account, name) => ({ account, name, seenAt: clock(), ready: alwaysOn.has(account), always: alwaysOn.has(account) });
  const limit = {
    invite: createLimiter(config.invitesPerHour, clock),
    join:   createLimiter(config.joinFailures, clock),
  };

  /* ---------- lecture ---------- */

  const partyOf = accountId => { for(const p of parties.values()) if(p.members.some(m => m.account === accountId)) return p; return null; };
  const memberOf = (p, accountId) => p.members.find(m => m.account === accountId);
  const invitesFor = accountId => [...parties.values()].filter(p => p.invites.has(accountId));

  /* ce que les membres voient de leur groupe (les ID de compte sont publics) */
  function publicParty(p, meId, playing = new Set(), trees = new Map(), looks = new Map(), specLv = new Map(), auras = new Map()){
    const now = clock();
    return { code: p.code, leader: p.leader, max: GAME.maxPlayers, launching: !!p.launching,
             members: p.members.map(m => ({ account: m.account, displayId: formatAccountId(m.account), name: m.name,
                                            leader: m.account === p.leader, me: m.account === meId, ready: !!m.ready || !!m.always,
                                            always: !!m.always,
                                            playing: playing.has(m.account), tree: trees.get(m.account) ?? null,
                                            specLevel: specLv.get(m.account) ?? null,
                                            look: looks.get(m.account) ?? {},
                                            auras: auras.get(m.account) ?? {},          // aura des pièces visibles (src/meta/aura.js)
                                            away: !playing.has(m.account) && now - m.seenAt > config.awayAfter })),
             invited: [...p.invites.values()].map(i => ({ account: i.account, displayId: formatAccountId(i.account), name: i.name })) };
  }

  /* ---------- ménage ---------- */

  /* « Prêt tout le temps » (m.always) : le membre reste prêt, rien ne le remet à « pas prêt » */
  const unready = p => { for(const m of p.members) m.ready = !!m.always; };
  /* membres (hors chef) qui ne sont pas prêts */
  const notReady = p => p.members.filter(m => m.account !== p.leader && !m.ready && !m.always);

  function removeMember(p, accountId){
    p.members = p.members.filter(m => m.account !== accountId);
    if(!p.members.length){ parties.delete(p.code); return; }
    if(p.leader === accountId) p.leader = p.members[0].account;          // le suivant devient chef
  }
  /* membres partis sans prévenir, invitations périmées, groupes vides. Pendant une session, le navigateur ne parle plus
     au groupe : chaque membre lancé a une grâce jusqu'à la fin prévue de la session (graceUntil), et un membre encore
     en session (pause du mode dev…) compte comme vu maintenant. Le délai repart donc de la fin de la session. */
  async function sweep(){
    const now = clock();
    for(const p of [...parties.values()]){
      if(p.launching) continue;
      for(const m of [...p.members]){
        /* membre prêt (ou « prêt tout le temps ») : gardé même onglet fermé (26/10, Geoffrey). Il est affiché « absent »
           mais le chef peut toujours le lancer avec le groupe. Le chef, lui, n'est jamais gardé ainsi (sinon personne
           ne pourrait plus lancer). Pour l'enlever : le chef le retire. */
        if(m.account !== p.leader && (m.ready || m.always)) continue;
        if(now - Math.max(m.seenAt, m.graceUntil ?? 0) <= config.memberTimeout) continue;   // grâce : fin prévue de la session
        /* … ou fin RÉELLE de sa dernière session (en retard sur l'heure prévue, ou fin libre en dev) */
        if(now - (await game.lastEndedAt?.(m.account) ?? 0) <= config.memberTimeout) continue;
        if(await game.activeSessionId(m.account)) m.seenAt = now;
        else if(parties.get(p.code) === p && !p.launching) removeMember(p, m.account);
      }
      for(const [id, inv] of p.invites) if(now - inv.at > config.inviteTtl) p.invites.delete(id);
    }
  }

  /* session lancée : personne n'est retiré du groupe avant sa fin prévue */
  function grace(p, r){
    const end = r?.session?.finishAt;
    if(Number.isFinite(end)) for(const m of p.members) m.graceUntil = end;
  }

  /* signe de vie de celui qui appelle (avant le ménage : on ne se retire pas soi-même) */
  function touch(me){ const p = partyOf(me.id); if(p) memberOf(p, me.id).seenAt = clock(); }

  function create(me){
    let code;
    do code = newCode(); while(parties.has(code));
    const p = { code, leader: me.id, members: [newMember(me.id, displayName(me))],
                invites: new Map(), createdAt: clock(), launching: false };
    parties.set(code, p);
    return p;
  }

  async function notInSession(me){
    if(await game.activeSessionId(me.id)) fail('session_running', 409, 'Tu es déjà dans une session.');
  }
  const noChange = p => { if(p.launching) fail('launching', 409, 'La session est en train d\'être lancée.'); };

  /* ---------- recherche de groupe (LFG) ---------- */

  const queue = new Map();      // compte qui cherche (solo ou chef d'un groupe de 2) → { account, me, name, members, size, at, seenAt, auto }
  const found = new Map();      // compte → { at, names, error } : « groupe trouvé », montré config.lfgNotice ms
  const boot = crypto.randomUUID();   // change à chaque démarrage du serveur : la file a été perdue

  const teamOf = id => { const p = partyOf(id); return p ? p.members.map(m => m.account) : [id]; };
  /* une entrée vaut tant que l'équipe n'a pas bougé depuis son entrée dans la file (quelqu'un entre ou part : annulée) */
  function lfgValid(e){
    const p = partyOf(e.account);
    if(p && (p.launching || (p.members.length > 1 && p.leader !== e.account))) return false;
    return teamOf(e.account).join() === e.members.join();
  }
  /* sortent de la file : sans nouvelles depuis lfgTimeout (onglet fermé), équipe changée, quelqu'un en session */
  async function pruneLfg(){
    const now = clock();
    for(const e of [...queue.values()]){
      let out = now - e.seenAt > config.lfgTimeout || !lfgValid(e);
      for(const id of e.members) out ||= !!await game.activeSessionId(id);
      if(out) queue.delete(e.account);
    }
    for(const [id, f] of found) if(now - f.at > config.lfgNotice) found.delete(id);
  }
  /* forme un lobby d'un coup : les invités quittent leur groupe d'un joueur et entrent dans celui de l'hôte (créé s'il
     n'en a pas) */
  function formLobby({ host, guests }){
    const p = partyOf(host.account) ?? create(host.me);
    unready(p);                                        // des nouveaux venus : tout le monde redit qu'il est prêt
    for(const g of guests){
      const old = partyOf(g.account);
      if(old) removeMember(old, g.account);
      p.members.push(newMember(g.account, g.name));
      p.invites.delete(g.account);
    }
    for(const e of [host, ...guests]) queue.delete(e.account);
    const names = p.members.map(m => m.name);
    for(const m of p.members) found.set(m.account, { at: clock(), names, error: null });
    return p;
  }
  /* « lancer dès que plein » (choix du chef seulement) : un échec laisse le lobby formé, le chef lancera à la main */
  async function autoLaunch(host, p){
    p.launching = true;
    try {
      const members = [memberOf(p, host.account), ...p.members.filter(m => m.account !== host.account)];
      grace(p, await game.start(host.me, { mode: MINE_MODES[0].id }, members.map(m => ({ account: m.account, name: m.name }))));
    } catch(e){
      for(const m of p.members) if(found.has(m.account)) found.get(m.account).error = e.message;
    } finally { p.launching = false; }
  }
  let matching = false;
  async function runLfg(){
    if(matching) return;                     // un seul appariement à la fois (on attend le service de jeu au milieu)
    matching = true;
    try {
      await pruneLfg();
      let m;
      while((m = matchLfg([...queue.values()].filter(lfgValid), GAME.maxPlayers))){
        const p = formLobby(m);
        if(m.host.auto) await autoLaunch(m.host, p);
      }
    } finally { matching = false; }
  }
  /* ce que voit le joueur : la recherche de son équipe (la sienne, ou celle de son chef), et « groupe trouvé » */
  function lfgView(me){
    const p = partyOf(me.id);
    const e = queue.get(p && p.members.length > 1 ? p.leader : me.id);
    const f = found.get(me.id);
    return { boot,
             players: [...queue.values()].filter(lfgValid).reduce((n, q) => n + q.size, 0),   // joueurs en recherche, montrés à tous (23/10)
             search: e && lfgValid(e) ? { mine: e.account === me.id, waited: clock() - e.at, auto: e.auto } : null,
             found: f ? { at: f.at, names: f.names, error: f.error } : null };
  }

  /* ---------- stockage ---------- */

  /* ce qu'on garde d'un groupe (pas les signes de vie, ni « en cours de lancement ») */
  const saved = p => ({ code: p.code, leader: p.leader, createdAt: p.createdAt,
                        members: p.members.map(m => ({ account: m.account, name: m.name, graceUntil: m.graceUntil ?? null, ready: !!m.ready, always: !!m.always })),
                        invites: [...p.invites.values()] });
  const written = new Map();                 // code → JSON déjà enregistré
  /* enregistre les groupes qui ont vraiment changé, efface ceux qui ont disparu */
  async function save(){
    if(!store) return;
    for(const p of parties.values()){
      const json = JSON.stringify(saved(p));
      if(written.get(p.code) !== json){ written.set(p.code, json); await store.putParty(p.code, JSON.parse(json)); }
    }
    for(const code of [...written.keys()]) if(!parties.has(code)){ written.delete(code); await store.deleteParty(code); }
  }
  /* démarrage du serveur : on retrouve les groupes enregistrés (chacun repart avec un délai d'absence neuf) */
  async function load(){
    if(!store) return;
    for(const s of await store.getParties()){
      if(!s?.code || !Array.isArray(s.members) || !s.members.length) continue;
      const p = { code: s.code, leader: s.leader, createdAt: s.createdAt ?? clock(), launching: false,
                  members: s.members.map(m => ({ account: m.account, name: m.name, seenAt: clock(), graceUntil: m.graceUntil ?? undefined, ready: m.ready === true, always: m.always === true })),
                  invites: new Map((s.invites || []).map(i => [i.account, i])) };
      for(const m of p.members) if(m.always) alwaysOn.add(m.account);
      if(!p.members.some(m => m.account === p.leader)) p.leader = p.members[0].account;
      parties.set(p.code, p);
      written.set(p.code, JSON.stringify(saved(p)));
    }
  }
  /* chaque action enregistre ensuite ce qui a changé (même si elle échoue à mi-chemin) */
  const saving = fn => async (...args) => { try { return await fn(...args); } finally { await save(); } };

  /* ---------- actions ---------- */
  const actions = {
    /* état vu par le joueur (appelé régulièrement par son lobby : sert aussi de signe de vie) */
    async state(me){
      touch(me);
      await sweep();
      if(queue.has(me.id)) queue.get(me.id).seenAt = clock();
      await runLfg();
      const p = partyOf(me.id);
      /* membres encore dans une session (la précédente, pas finie pour eux) : affichés « en session » */
      const playing = new Set();
      if(p) for(const m of p.members) if(m.account !== me.id && await game.activeSessionId(m.account)) playing.add(m.account);
      /* spécialisation de chacun (arbre de skills choisi) */
      const trees = new Map();
      if(p) for(const m of p.members) trees.set(m.account, await game.skillTreeOf?.(m.account) ?? null);
      /* et son niveau de spécialisation dans cet arbre */
      const specLv = new Map();
      if(p) for(const m of p.members) specLv.set(m.account, await game.specLevelOf?.(m.account, trees.get(m.account)) ?? null);
      /* skin de chacun (équipement porté) */
      const looks = new Map();
      if(p) for(const m of p.members) looks.set(m.account, await game.lookFor?.(m.account) ?? {});
      /* et l'aura de ses pièces visibles (src/meta/aura.js) */
      const auras = new Map();
      if(p) for(const m of p.members) auras.set(m.account, await game.aurasFor?.(m.account) ?? {});
      return {
        party: p ? publicParty(p, me.id, playing, trees, looks, specLv, auras) : null,
        /* invitations reçues : qui invite, qui est déjà là */
        invites: invitesFor(me.id).map(q => ({ code: q.code, from: q.invites.get(me.id).from,
                                               members: q.members.map(m => m.name), full: q.members.length >= GAME.maxPlayers })),
        session: await game.activeSessionId(me.id),       // le chef a lancé : le navigateur passe à la session
        lfg: lfgView(me),
      };
    },

    /* entrer dans la recherche de groupe (seul, ou chef d'un groupe de 2) ; déjà dedans : on garde sa place et on met à
       jour « lancer dès que plein » (auto) */
    async lfg(me, body = {}){
      touch(me); await sweep();
      await notInSession(me);
      const p = partyOf(me.id);
      if(p){
        noChange(p);
        if(p.members.length >= GAME.maxPlayers) fail('party_full', 409, 'Ton groupe est déjà complet.');
        if(p.members.length > 1 && p.leader !== me.id) fail('not_leader', 403, 'C\'est le chef du groupe qui lance la recherche.');
      }
      const members = teamOf(me.id), old = queue.get(me.id), now = clock();
      queue.set(me.id, { account: me.id, me: { id: me.id, name: me.name ?? null, guest: !!me.guest }, name: displayName(me),
                         members, size: members.length, auto: body.auto === true, seenAt: now,
                         at: old && old.members.join() === members.join() ? old.at : now });
      found.delete(me.id);
      await runLfg();
      const q = partyOf(me.id);
      return { party: q ? publicParty(q, me.id) : null, lfg: lfgView(me), session: await game.activeSessionId(me.id) };
    },

    /* quitter la recherche */
    async lfgCancel(me){
      queue.delete(me.id);
      return { lfg: lfgView(me) };
    },

    /* créer son groupe (pour avoir un code à partager). Déjà dans un groupe : on le garde. */
    async create(me){
      touch(me); await sweep();
      await notInSession(me);
      return { party: publicParty(partyOf(me.id) ?? create(me), me.id) };
    },

    /* entrer avec un code (ou en acceptant une invitation : même code). On quitte son groupe précédent. */
    async join(me, input){
      touch(me); await sweep();
      const code = parsePartyCode(input);
      const lim = limit.join.check(me.id);
      if(!lim.ok) fail('rate_limited', 429, 'Trop de codes faux. Réessaie dans quelques minutes.', { retryAfter: lim.retryAfter });
      const p = code && parties.get(code);
      if(!p){ limit.join.hit(me.id); fail('party_not_found', 404, 'Aucun groupe avec ce code (il a peut-être été dissous).'); }
      await notInSession(me);
      if(memberOf(p, me.id)) return { party: publicParty(p, me.id) };
      noChange(p);
      if(p.members.length >= GAME.maxPlayers) fail('party_full', 409, 'Ce groupe est complet.');
      const old = partyOf(me.id);
      if(old){ noChange(old); removeMember(old, me.id); }
      unready(p);                                      // un nouveau venu : tout le monde redit qu'il est prêt
      p.members.push(newMember(me.id, displayName(me)));
      p.invites.delete(me.id);
      return { party: publicParty(p, me.id) };
    },

    /* inviter un ami par son ID de compte (tout membre peut inviter ; sans groupe, on en crée un) */
    async invite(me, input){
      touch(me); await sweep();
      const id = parseAccountId(input);
      if(!id) fail('invalid_id', 400, 'ID de compte invalide (ex. 7K3Q-9XHP).');
      if(id === me.id) fail('invalid_id', 400, 'C\'est ton propre ID.');
      const lim = limit.invite.check(me.id);
      if(!lim.ok) fail('rate_limited', 429, 'Trop d\'invitations envoyées. Réessaie plus tard.', { retryAfter: lim.retryAfter });
      await notInSession(me);
      const friend = await getAccount(id);
      if(!friend) fail('account_not_found', 404, 'Aucun joueur avec cet ID.');
      if(await game.activeSessionId(id)) fail('friend_in_session', 409, `${displayName(friend)} est en session : invite-le à la fin.`);
      const p = partyOf(me.id) ?? create(me);
      noChange(p);
      if(memberOf(p, id)) fail('already_member', 409, `${displayName(friend)} est déjà dans ton groupe.`);
      if(p.members.length >= GAME.maxPlayers) fail('party_full', 409, 'Ton groupe est complet.');
      if(!p.invites.has(id) && p.invites.size >= config.maxPendingInvites)
        fail('too_many_invites', 409, 'Trop d\'invitations en attente pour ce groupe.');
      limit.invite.hit(me.id);
      p.invites.set(id, { account: id, name: displayName(friend), from: displayName(me), at: clock() });
      return { party: publicParty(p, me.id) };
    },

    /* rejoindre le lobby d'un ami (onglet Social ; le service des amis a vérifié l'amitié). L'ami n'a pas encore de
       groupe : on lui en crée un, dont il est le chef, et on y entre. Refusé s'il est en session. */
    async joinFriend(me, friend){
      touch(me); await sweep();
      if(friend.id === me.id) fail('invalid_id', 400, 'C\'est toi.');
      await notInSession(me);
      if(await game.activeSessionId(friend.id)) fail('friend_in_session', 409, `${displayName(friend)} est en session.`);
      const p = partyOf(friend.id) ?? create(friend);
      if(memberOf(p, me.id)) return { party: publicParty(p, me.id) };
      noChange(p);
      if(p.members.length >= GAME.maxPlayers) fail('party_full', 409, 'Ce groupe est complet.');
      const old = partyOf(me.id);
      if(old){ noChange(old); removeMember(old, me.id); }
      p.members.push(newMember(me.id, displayName(me)));
      p.invites.delete(me.id);
      return { party: publicParty(p, me.id) };
    },

    /* refuser une invitation */
    async decline(me, input){
      const p = parties.get(parsePartyCode(input));
      p?.invites.delete(me.id);
      return { ok: true };
    },

    /* quitter son groupe (on se retrouve seul) */
    async leave(me){
      const p = partyOf(me.id);
      if(p){ noChange(p); removeMember(p, me.id); }
      return { party: null };
    },

    /* le chef retire un membre (ou annule une invitation envoyée) */
    async kick(me, input){
      const p = partyOf(me.id);
      if(!p) fail('no_party', 404, 'Tu n\'es dans aucun groupe.');
      if(p.leader !== me.id) fail('not_leader', 403, 'Seul le chef du groupe peut retirer un joueur.');
      noChange(p);
      const id = parseAccountId(input);
      if(!id || id === me.id) fail('invalid_id', 400, 'Joueur invalide.');
      if(memberOf(p, id)) removeMember(p, id);
      p.invites.delete(id);
      return { party: publicParty(p, me.id) };
    },

    /* se déclarer prêt (ou plus prêt). value doit être exactement true ou false. */
    async ready(me, value){
      touch(me);
      if(typeof value !== 'boolean') fail('bad_request', 400, 'Valeur invalide.');
      const p = partyOf(me.id);
      if(!p) fail('no_party', 404, "Tu n'es dans aucun groupe.");
      noChange(p);
      await notInSession(me);
      const m = memberOf(p, me.id);
      m.ready = value || !!m.always;                   // « prêt tout le temps » : seule la case le retire (23/10)
      return { party: publicParty(p, me.id) };
    },

    /* « Prêt tout le temps » : le membre reste prêt d'une session à l'autre (et quand quelqu'un arrive), le chef peut
       enchaîner sans attendre son clic. Possible pendant une session (on le coche pour la suivante). value : true / false. */
    async alwaysReady(me, value){
      touch(me);
      if(typeof value !== 'boolean') fail('bad_request', 400, 'Valeur invalide.');
      const p = partyOf(me.id);
      if(!p) fail('no_party', 404, "Tu n'es dans aucun groupe.");
      noChange(p);
      const m = memberOf(p, me.id);
      m.always = value;
      m.ready = value;
      if(value) alwaysOn.add(me.id); else alwaysOn.delete(me.id);
      return { party: publicParty(p, me.id) };
    },

    /* le chef donne sa place de chef à un autre membre */
    async promote(me, input){
      touch(me);
      const p = partyOf(me.id);
      if(!p) fail('no_party', 404, "Tu n'es dans aucun groupe.");
      if(p.leader !== me.id) fail('not_leader', 403, 'Seul le chef du groupe peut nommer un autre chef.');
      noChange(p);
      const id = parseAccountId(input);
      if(!id || id === me.id || !memberOf(p, id)) fail('invalid_id', 400, 'Joueur invalide.');
      p.leader = id;
      memberOf(p, id).ready = false;                   // le chef n'a pas d'état « prêt »
      memberOf(p, me.id).ready = !!memberOf(p, me.id).always;   // l'ancien chef devient membre : à lui de dire qu'il est prêt (sauf « prêt tout le temps »)
      return { party: publicParty(p, me.id) };
    },

    /* « Lancer la session » : seul = session solo ; en groupe, seul le chef lance, pour tous les membres.
       Le groupe reste (on enchaîne les sessions sans se réinviter). Un membre encore dans la session précédente :
       lancement refusé par le service de jeu (member_in_session), le groupe ne bouge pas. */
    async launch(me, body = {}){
      touch(me); await sweep();
      const p = partyOf(me.id);
      if(!p || p.members.length === 1){
        if(p) noChange(p);
        const r = await game.start(me, body);
        if(p) grace(p, r);
        return r;
      }
      if(p.leader !== me.id) fail('not_leader', 403, 'C\'est le chef du groupe qui lance la session.');
      noChange(p);
      const waiting = notReady(p);
      if(waiting.length) fail('not_ready', 409, `Pas encore prêt : ${waiting.map(m => m.name).join(', ')}.`);
      p.launching = true;                              // plus d'entrée ni de sortie pendant la création
      try {
        const members = [memberOf(p, me.id), ...p.members.filter(m => m.account !== me.id)];
        const r = await game.start(me, body, members.map(m => ({ account: m.account, name: m.name })));
        grace(p, r);
        unready(p);                                    // la session finie, chacun redira qu'il est prêt
        return r;
      } finally { p.launching = false; }
    },

  };
  for(const k of Object.keys(actions)) actions[k] = saving(actions[k]);
  return {
    ...actions,
    load,
    /* pour l'onglet Social : groupe d'un joueur (taille, places) et invitations qu'il a reçues, sans ménage ni signe de vie */
    groupOf: accountId => { const p = partyOf(accountId); return p ? { code: p.code, size: p.members.length, max: GAME.maxPlayers } : null; },
    invitesOf: accountId => invitesFor(accountId).map(q => ({ code: q.code, from: q.invites.get(accountId).from,
                                                              members: q.members.map(m => m.name), full: q.members.length >= GAME.maxPlayers })),
    /* pour les tests et le journal */
    count: () => parties.size,
    lfgCount: () => queue.size,
    _sweep: saving(sweep),
  };
}
