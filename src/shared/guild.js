/* Guilde (31/10/2026, Geoffrey) : règles partagées par le jeu et le serveur (qui fait foi). Logique pure.
   Fiche : { guilds:{ id:{ id, name, createdAt, rawXp, members:[{ id, rank, joinedAt, rawXp }], invites:[{ id, by, at }],
   requests:[{ id, at }], buildings, log, ops } } } (log : nombre de lignes du journal, rangé à part, ns guild_log ; ops : dernières demandes de don). rawXp : XP brute des membres, GUILD.xpPct % ne s'applique que sur le total (src/meta/level.js). */
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

/* bâtiments (01/11/2026) : g.buildings = { id: { level, given:{ matériau: quantité } } }, un niveau en cours de construction */
export const buildingDef = id => GUILD.buildings.find(b => b.id === id) ?? null;
export const buildingLevel = (g, id) => g?.buildings?.[id]?.level ?? 0;
/* coût du prochain niveau, null au niveau maximum */
export const nextLevel = (g, b) => b.levels[buildingLevel(g, b.id)] ?? null;
/* ce qu'il manque de ce matériau pour le prochain niveau (pending : parts déjà réservées par des dons en cours) */
export const missing = (g, b, item, pending = 0) => {
  const need = nextLevel(g, b)?.cost[item] ?? 0;
  return Math.max(0, need - (g?.buildings?.[b.id]?.given?.[item] ?? 0) - pending);
};
export const buildingReady = (g, b) => !!nextLevel(g, b) && Object.keys(nextLevel(g, b).cost).every(i => missing(g, b, i) === 0);
export const canBuild = canRecruit;
/* bonus de tous les niveaux construits : { mult:{ stat: % }, add:{ stat: points } }, null s'il n'y en a aucun */
export function guildBonus(g){
  const out = { mult:{}, add:{} };
  for(const b of GUILD.buildings) for(const lv of b.levels.slice(0, buildingLevel(g, b.id))) for(const kind of ['mult', 'add'])
    for(const [k, v] of Object.entries(lv[kind] ?? {})) out[kind][k] = (out[kind][k] ?? 0) + v;
  return Object.keys(out.mult).length || Object.keys(out.add).length ? out : null;
}
function cleanBuildings(raw){
  const out = {};
  for(const b of GUILD.buildings){
    const r = raw?.[b.id], level = Math.min(whole(r?.level), b.levels.length), given = {};
    for(const item of Object.keys(b.levels[level]?.cost ?? {})) if(whole(r?.given?.[item])) given[item] = Math.min(whole(r.given[item]), b.levels[level].cost[item]);
    if(level || Object.keys(given).length) out[b.id] = { level, given };
  }
  return out;
}

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
                   requests:list(g.requests).map(x => ({ id:x.id, at:when(x.at) })).slice(-GUILD.maxRequests),
                   buildings:cleanBuildings(g.buildings), log:whole(g.log),
                   ops:Array.isArray(g.ops) ? g.ops.filter(o => typeof o === 'string').slice(-GUILD.opMemory) : [] };
  }
  return { guilds };
}
