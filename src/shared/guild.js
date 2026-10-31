/* Guilde (31/10/2026, Geoffrey) : règles partagées par le jeu et le serveur (qui fait foi). Logique pure.
   Fiche : { guilds:{ id:{ id, name, createdAt, rawXp, members:[{ id, rank, joinedAt, rawXp }], invites:[{ id, by, at }],
   requests:[{ id, at }] } } }. rawXp : XP brute des membres, GUILD.xpPct % ne s'applique que sur le total (src/meta/level.js). */
import { GUILD } from '../config.js';
import { nameKey, parseAccountId } from './account.js';

export const RANK = { chief:'chief', officer:'officer', member:'member' };
export const RANK_LABEL = { chief:'Chef de guilde', officer:'Officier', member:'Membre' };
const RANK_ORDER = [RANK.chief, RANK.officer, RANK.member];

/* droits, sur des grades : a agit, t subit. Le chef et les officiers recrutent ; personne n'agit sur le chef. */
const isChief = a => a === RANK.chief, isOfficer = a => a === RANK.officer, isMember = a => a === RANK.member;
export const canRecruit = a => isChief(a) || isOfficer(a);
export const canKick = (a, t) => (isChief(a) && (isOfficer(t) || isMember(t))) || (isOfficer(a) && isMember(t));
export const canPromote = (a, t) => canRecruit(a) && isMember(t);
export const canDemote = (a, t) => isChief(a) && isOfficer(t);
export const canTransfer = (a, t) => isChief(a) && (isOfficer(t) || isMember(t));

/* nom affiché : espaces autour retirés, espaces multiples réduits */
export const cleanGuildName = s => String(s ?? '').normalize('NFC').trim().replace(/ +/g, ' ');
/* clé d'unicité : sans majuscules ni accents, comme un pseudo */
export const guildNameKey = s => nameKey(cleanGuildName(s));
/* null si le nom est valable, sinon le message à afficher */
export function guildNameError(s){
  if(typeof s !== 'string') return 'Tape le nom de ta guilde.';
  const n = cleanGuildName(s);
  if(n.length < GUILD.nameMin) return `Le nom doit faire au moins ${GUILD.nameMin} caractères.`;
  if(n.length > GUILD.nameMax) return `Le nom doit faire au plus ${GUILD.nameMax} caractères.`;
  if(/\p{C}/u.test(n)) return 'Ce nom contient un caractère interdit.';
  return null;
}

/* remplaçant du chef : le plus ancien officier, sinon le plus ancien membre */
export function nextChief(members){
  const pick = list => list.reduce((best, m) => !best || m.joinedAt < best.joinedAt ? m : best, null);
  return pick(members.filter(m => m.rank === RANK.officer)) ?? pick(members);
}

/* activité affichée, depuis le statut d'un joueur (server/social/service.js) : un lobby compte comme connecté */
export const activityOf = status => status === 'session' ? 'session' : status === 'offline' ? 'offline' : 'online';
const ACTIVITY_ORDER = ['online', 'session', 'offline'];
/* lignes { rank, activity, name } : grade, puis activité, puis pseudo */
export const sortMembers = rows => [...rows].sort((a, b) =>
  RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank) || ACTIVITY_ORDER.indexOf(a.activity) - ACTIVITY_ORDER.indexOf(b.activity) || a.name.localeCompare(b.name, 'fr'));

const isId = v => typeof v === 'string' && parseAccountId(v) === v;
const whole = v => Number.isSafeInteger(v) && v >= 0 ? v : 0;
const when = v => Number.isFinite(v) ? v : 0;
const uniqueIds = list => { const seen = new Set(); return list.filter(x => !seen.has(x.id) && seen.add(x.id)); };

/* relue et revérifiée à chaque chargement : un joueur dans une seule guilde, un seul chef, pas de guilde vide */
export function sanitizeGuilds(raw){
  const guilds = {}, taken = new Set();
  const src = raw?.guilds && typeof raw.guilds === 'object' ? raw.guilds : {};
  for(const [id, g] of Object.entries(src)){
    if(!g || typeof g !== 'object' || typeof g.name !== 'string' || !g.name) continue;
    const members = uniqueIds(Array.isArray(g.members) ? g.members.filter(m => m && isId(m.id) && !taken.has(m.id)) : [])
      .map(m => ({ id:m.id, rank:RANK_ORDER.includes(m.rank) ? m.rank : RANK.member, joinedAt:when(m.joinedAt), rawXp:whole(m.rawXp) }));
    if(!members.length) continue;
    const chief = members.find(m => m.rank === RANK.chief);
    for(const m of members) if(m.rank === RANK.chief && m !== chief) m.rank = RANK.officer;
    if(!chief) nextChief(members).rank = RANK.chief;
    members.forEach(m => taken.add(m.id));
    const list = v => uniqueIds(Array.isArray(v) ? v.filter(x => x && isId(x.id)) : []);
    guilds[id] = { id, name:g.name, createdAt:when(g.createdAt), rawXp:whole(g.rawXp), members,
                   invites:list(g.invites).map(x => ({ id:x.id, by:isId(x.by) ? x.by : null, at:when(x.at) })).slice(-GUILD.maxInvites),
                   requests:list(g.requests).map(x => ({ id:x.id, at:when(x.at) })).slice(-GUILD.maxRequests) };
  }
  return { guilds };
}
