/* Guilde (31/10/2026, Geoffrey) : une seule fiche pour toutes les guildes (ns guilds), gardée en mémoire et enregistrée à chaque
   changement. Une action à la fois (comme le raffle) : deux acceptations simultanées ne dépassent jamais GUILD.maxMembers,
   et un joueur n'entre jamais dans deux guildes. Chaque action relit le grade du joueur dans la fiche : le navigateur ne
   donne que l'action et sa cible. Une action déjà faite (double clic, deux officiers) renvoie l'état, sans erreur.
   accounts : { getAccount(id), findAccountByName(clé) } ; statusOf(id) : présence d'un joueur (server/social/service.js). */
import crypto from 'node:crypto';
import { GUILD } from '../../src/config.js';
import { RANK, canRecruit, canKick, canPromote, canDemote, canTransfer, nextChief, sortMembers, activityOf,
         cleanGuildName, guildNameKey, guildNameError, sanitizeGuilds } from '../../src/shared/guild.js';
import { guildXpOf, guildLevelOf } from '../../src/meta/level.js';
import { displayName, formatAccountId, nameKey, parseAccountId } from '../../src/shared/account.js';
import { nameBanned } from '../moderation/filter.js';
import { SocialError } from '../social/service.js';

const fail = (code, status, message) => { throw new SocialError(code, status, message); };
const isId = v => typeof v === 'string' && parseAccountId(v) === v;
const needId = v => { if(!isId(v)) fail('bad_request', 400, 'Joueur inconnu.'); };
const needGuildId = v => { if(typeof v !== 'string' || !v || v.length > 64) fail('bad_request', 400, 'Guilde inconnue.'); };
const needName = me => { if(me.guest || !me.name) fail('guest', 403, 'Choisis un pseudo pour rejoindre une guilde.'); };

export function createGuildService({ store, accounts, statusOf, clock = Date.now, makeId = () => crypto.randomUUID() }){
  let state = null, byAccount = new Map(), chain = Promise.resolve();
  const serial = fn => { const run = chain.catch(() => {}).then(fn); chain = run.catch(() => {}); return run; };
  async function load(){
    if(state) return;
    const raw = await store.getGuilds();
    if(state) return;      // deux premières lectures en même temps
    state = sanitizeGuilds(raw);
    byAccount = new Map(Object.values(state.guilds).flatMap(g => g.members.map(m => [m.id, g.id])));
  }
  const save = () => store.putGuilds(state);
  const all = () => Object.values(state.guilds);
  const guildOf = id => state.guilds[byAccount.get(id)] ?? null;
  const nameOf = async id => displayName(await accounts.getAccount(id)) || formatAccountId(id);
  const chiefOf = g => g.members.find(m => m.rank === RANK.chief);
  const summary = async g => ({ id:g.id, name:g.name, ...guildLevelOf(g.rawXp), xp:guildXpOf(g.rawXp), members:g.members.length, max:GUILD.maxMembers, chief:await nameOf(chiefOf(g).id) });

  async function mineView(me, g){
    const rank = g.members.find(m => m.id === me.id).rank;
    const rows = await Promise.all(g.members.map(async m => ({ id:m.id, name:await nameOf(m.id), rank:m.rank, xp:guildXpOf(m.rawXp),
      activity:activityOf((await statusOf(m.id))?.status),
      actions:m.id === me.id ? { kick:false, promote:false, demote:false, transfer:false }
        : { kick:canKick(rank, m.rank), promote:canPromote(rank, m.rank), demote:canDemote(rank, m.rank), transfer:canTransfer(rank, m.rank) } })));
    const requests = canRecruit(rank) ? await Promise.all(g.requests.map(async r => ({ id:r.id, name:await nameOf(r.id) }))) : [];
    return { id:g.id, name:g.name, ...guildLevelOf(g.rawXp), xp:guildXpOf(g.rawXp), rank, max:GUILD.maxMembers, members:sortMembers(rows), requests };
  }
  const invitesFor = id => all().filter(g => g.invites.some(i => i.id === id));
  async function view(me){
    await load();
    const g = guildOf(me.id);
    return { mine:g ? await mineView(me, g) : null,
             invites:await Promise.all(invitesFor(me.id).map(summary)),
             requests:all().filter(x => x.requests.some(r => r.id === me.id)).map(x => x.id) };
  }

  /* écriture : file unique, puis l'état vu par ce joueur */
  const act = fn => async (me, ...args) => {
    await serial(async () => { await load(); if(await fn(me, ...args) !== false) await save(); });
    return view(me);
  };
  /* entrer dans une guilde, ou en créer une : ses autres invitations et demandes tombent */
  const dropPending = id => { for(const x of all()){ x.invites = x.invites.filter(i => i.id !== id); x.requests = x.requests.filter(r => r.id !== id); } };
  function enter(g, id){
    dropPending(id);
    g.members.push({ id, rank:RANK.member, joinedAt:clock(), rawXp:0 });
    byAccount.set(id, g.id);
  }
  function exit(g, id){
    const wasChief = chiefOf(g).id === id;
    g.members = g.members.filter(m => m.id !== id);
    byAccount.delete(id);
    if(!g.members.length) delete state.guilds[g.id];
    else if(wasChief) nextChief(g.members).rank = RANK.chief;
  }
  const notFull = g => { if(g.members.length >= GUILD.maxMembers) fail('guild_full', 409, 'Cette guilde est pleine.'); };
  const outside = me => { if(guildOf(me.id)) fail('in_guild', 409, 'Quitte ta guilde d\'abord.'); };
  /* la guilde de l'acteur et son grade */
  function actor(me){
    const g = guildOf(me.id);
    if(!g) fail('no_guild', 404, 'Tu n\'es pas dans une guilde.');
    return { g, rank:g.members.find(m => m.id === me.id).rank };
  }
  const recruiter = me => { const a = actor(me); if(!canRecruit(a.rank)) fail('forbidden', 403, 'Seuls le chef et les officiers peuvent faire ça.'); return a; };
  const forbidden = () => fail('forbidden', 403, 'Ton grade ne permet pas de faire ça.');
  /* la cible d'une action dans la guilde de l'acteur ; null si elle est déjà partie (double clic) */
  function target(g, id){
    const m = g.members.find(x => x.id === id);
    if(!m && byAccount.has(id)) fail('not_member', 404, 'Ce joueur n\'est pas dans ta guilde.');
    return m ?? null;
  }

  return {
    view,
    async list(me, query){
      await load();
      const q = typeof query === 'string' ? guildNameKey(query.slice(0, GUILD.nameMax * 2)) : '';
      const found = all().filter(g => guildNameKey(g.name).includes(q)).sort((a, b) => b.rawXp - a.rawXp || a.name.localeCompare(b.name, 'fr'));
      return { guilds:await Promise.all(found.map(summary)) };
    },
    /* niveau puis XP : le niveau suit l'XP, un seul tri suffit */
    async board(me){
      await load();
      const sorted = all().sort((a, b) => b.rawXp - a.rawXp || a.createdAt - b.createdAt);
      return { guilds:await Promise.all(sorted.map(async (g, i) => ({ rank:i + 1, ...await summary(g) }))) };
    },
    /* invitations reçues par un joueur (pop-up, server/social/service.js) */
    async invitesOf(id){ await load(); return invitesFor(id).map(g => ({ guildId:g.id, name:g.name })); },

    create: act((me, input) => {
      needName(me);
      const e = guildNameError(input);
      if(e) fail('bad_name', 400, e);
      const name = cleanGuildName(input);
      if(nameBanned(name)) fail('bad_name', 400, 'Ce nom n\'est pas autorisé.');
      outside(me);
      const key = guildNameKey(name);
      if(all().some(g => guildNameKey(g.name) === key)) fail('name_taken', 409, 'Ce nom est déjà pris.');
      dropPending(me.id);
      const id = makeId();
      state.guilds[id] = { id, name, createdAt:clock(), rawXp:0, members:[{ id:me.id, rank:RANK.chief, joinedAt:clock(), rawXp:0 }], invites:[], requests:[] };
      byAccount.set(me.id, id);
    }),
    invite: act(async (me, input) => {
      const text = typeof input === 'string' ? input.trim() : '';
      if(!text || text.length > 32) fail('bad_name', 400, 'Tape le pseudo du joueur.');
      const { g } = recruiter(me);
      const who = await accounts.findAccountByName(nameKey(text));
      if(!who || who.guest) fail('not_found', 404, 'Aucun joueur avec ce pseudo.');
      if(g.members.some(m => m.id === who.id)) fail('already_member', 409, `${who.name} est déjà dans ta guilde.`);
      if(g.invites.some(i => i.id === who.id)) return false;
      if(g.invites.length >= GUILD.maxInvites) fail('too_many', 409, 'Trop d\'invitations en attente.');
      g.invites.push({ id:who.id, by:me.id, at:clock() });
    }),
    acceptInvite: act((me, id) => {
      needName(me); needGuildId(id);
      const g = state.guilds[id];
      if(g?.members.some(m => m.id === me.id)) return false;
      if(!g?.invites.some(i => i.id === me.id)) fail('no_invite', 404, 'Cette invitation n\'existe plus.');
      outside(me); notFull(g);
      enter(g, me.id);
    }),
    refuseInvite: act((me, id) => {
      needGuildId(id);
      const g = state.guilds[id];
      if(!g?.invites.some(i => i.id === me.id)) return false;
      g.invites = g.invites.filter(i => i.id !== me.id);
    }),
    request: act((me, id) => {
      needName(me); needGuildId(id);
      const g = state.guilds[id];
      if(!g) fail('not_found', 404, 'Cette guilde n\'existe plus.');
      outside(me);
      if(g.requests.some(r => r.id === me.id)) return false;
      notFull(g);
      if(all().filter(x => x.requests.some(r => r.id === me.id)).length >= GUILD.maxPendingPerPlayer) fail('too_many', 409, 'Trop de demandes en attente.');
      if(g.requests.length >= GUILD.maxRequests) fail('too_many', 409, 'Cette guilde a trop de demandes en attente.');
      g.requests.push({ id:me.id, at:clock() });
    }),
    cancelRequest: act((me, id) => {
      needGuildId(id);
      const g = state.guilds[id];
      if(!g?.requests.some(r => r.id === me.id)) return false;
      g.requests = g.requests.filter(r => r.id !== me.id);
    }),
    acceptRequest: act((me, id) => {
      needId(id);
      const { g } = recruiter(me);
      if(!g.requests.some(r => r.id === id)) return false;
      if(guildOf(id)) fail('in_guild', 409, 'Ce joueur est déjà dans une guilde.');
      notFull(g);
      enter(g, id);
    }),
    refuseRequest: act((me, id) => {
      needId(id);
      const { g } = recruiter(me);
      if(!g.requests.some(r => r.id === id)) return false;
      g.requests = g.requests.filter(r => r.id !== id);
    }),
    promote: act((me, id) => {
      needId(id);
      const { g, rank } = actor(me), t = target(g, id);
      if(!t) return false;
      if(t.rank === RANK.officer && canRecruit(rank)) return false;
      if(!canPromote(rank, t.rank)) forbidden();
      t.rank = RANK.officer;
    }),
    demote: act((me, id) => {
      needId(id);
      const { g, rank } = actor(me), t = target(g, id);
      if(!t) return false;
      if(t.rank === RANK.member && rank === RANK.chief) return false;
      if(!canDemote(rank, t.rank)) forbidden();
      t.rank = RANK.member;
    }),
    kick: act((me, id) => {
      needId(id);
      const { g, rank } = actor(me), t = target(g, id);
      if(!t) return false;
      if(!canKick(rank, t.rank)) forbidden();
      exit(g, id);
    }),
    /* le chef donne sa place et devient officier */
    transfer: act((me, id) => {
      needId(id);
      const { g, rank } = actor(me), t = target(g, id);
      if(!t) return false;
      if(!canTransfer(rank, t.rank)) forbidden();
      g.members.find(m => m.id === me.id).rank = RANK.officer;
      t.rank = RANK.chief;
    }),
    leave: act(me => {
      const g = guildOf(me.id);
      if(!g) return false;
      exit(g, me.id);
    }),

    /* XP d'un membre, versée une seule fois par le service de jeu (creditXp) ; sans guilde, rien */
    addXp: (id, xp) => serial(async () => {
      await load();
      const g = guildOf(id);
      if(!g || !Number.isSafeInteger(xp) || xp <= 0 || !Number.isSafeInteger(g.rawXp + xp)) return;
      g.rawXp += xp;
      g.members.find(m => m.id === id).rawXp += xp;
      await save();
    }),
  };
}
