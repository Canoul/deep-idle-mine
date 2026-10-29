/* Classements (onglet Social → Classements, 27/10/2026, Geoffrey) : logique pure, partagée par le serveur et le navigateur.
   Classements : gs (gear score des pièces portées), xp (XP du mineur), spec:<arbre> (XP de spécialisation de cet arbre,
   un classement par arbre), tower (meilleur temps de victoire dans une tour céleste, Ange et Démon confondus, en secondes
   de jeu), instance (29/10/2026, Geoffrey : meilleur temps pour vaincre le roi gobelin de l'Instance I, en secondes de
   jeu depuis l'entrée dans l'instance). Plus grand = mieux, sauf la tour et l'instance (plus court = mieux). Un joueur à
   0 n'est pas classé.
   Ex aequo : même rang ; à égalité, le plus ancien d'abord (at), puis l'ID de compte. */
import { SKILLS, JUDGMENT, LEADERBOARD, INSTANCE } from '../config.js';

export const BOARDS = ['gs', 'xp', ...SKILLS.trees.map(t => 'spec:' + t.id), 'tower', 'instance', 'instance2'];   // instance2 : niveau 2 (29/10)
/* classements où le plus court gagne (temps) */
const FASTEST = new Set(['tower', 'instance', 'instance2']);
export const isBoard = b => typeof b === 'string' && BOARDS.includes(b);
/* arbre d'un classement de spécialisation (« spec:barbare » → 'barbare'), sinon null */
export const specTree = b => isBoard(b) && b.startsWith('spec:') ? b.slice(5) : null;

/* entries [{ id, value, at?, … }] → { board, total, rows (top size, avec rank et me), me (ma ligne si hors du top, sinon null) } */
export function rankBoard(board, entries, meId, size = LEADERBOARD.size){
  const sign = FASTEST.has(board) ? 1 : -1;
  const list = entries.filter(e => Number.isFinite(e.value) && e.value > 0)
    .sort((a, b) => sign * (a.value - b.value) || (a.at ?? 0) - (b.at ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let rank = 0;
  const ranked = list.map((e, i) => { if(i === 0 || e.value !== list[i - 1].value) rank = i + 1; return { ...e, rank, me: e.id === meId }; });
  const rows = ranked.slice(0, size);
  const mine = rows.some(e => e.me) ? null : ranked.find(e => e.me) ?? null;
  return { board, total: ranked.length, rows, me: mine };
}

/* Record de tour d'un joueur (ns tower_record) : { t (s de jeu, au dixième), at (ms), side, team:[pseudos], session }.
   Relu et revérifié ; null s'il est invalide. */
export function sanitizeTowerRecord(r){
  if(!r || typeof r !== 'object') return null;
  if(!Number.isFinite(r.t) || r.t <= 0 || !Number.isFinite(r.at) || !Object.hasOwn(JUDGMENT.sides, r.side)) return null;
  const team = Array.isArray(r.team) ? r.team.filter(n => typeof n === 'string').map(n => n.slice(0, 32)).slice(0, LEADERBOARD.teamMax) : [];
  return { t: Math.round(r.t * 10) / 10, at: r.at, side: r.side, team, session: typeof r.session === 'string' ? r.session : '' };
}
/* le nouveau record remplace-t-il l'ancien ? Strictement plus rapide (à égalité, le premier garde sa place) */
export const betterTower = (prev, next) => !!next && (!prev || next.t < prev.t);

/* Record d'instance d'un joueur (ns instance_record, 29/10/2026) : { t (s de jeu de l'entrée à la mort du roi, au
   dixième), fight (s de combat contre le roi, de son réveil à sa mort, ou null), at (ms), instance (id de INSTANCE.list),
   team:[pseudos], session }. Relu et revérifié ; null s'il est invalide. */
export function sanitizeInstanceRecord(r){
  if(!r || typeof r !== 'object') return null;
  if(!Number.isFinite(r.t) || r.t <= 0 || !Number.isFinite(r.at) || !INSTANCE.list.some(i => i.id === r.instance && i.ready)) return null;
  const team = Array.isArray(r.team) ? r.team.filter(n => typeof n === 'string').map(n => n.slice(0, 32)).slice(0, LEADERBOARD.teamMax) : [];
  const t = Math.round(r.t * 10) / 10;
  const fight = Number.isFinite(r.fight) && r.fight > 0 && r.fight <= r.t ? Math.round(r.fight * 10) / 10 : null;
  return { t, fight, at: r.at, instance: r.instance, team, session: typeof r.session === 'string' ? r.session : '' };
}
export const betterInstance = betterTower;
/* clé d'un record d'instance (29/10/2026) : le compte au niveau 1 (records d'avant les niveaux), « compte#2 » au niveau 2 */
export const instanceRecordKey = (account, level = 1) => level > 1 ? `${account}#${level}` : account;
export function splitInstanceKey(key){
  const [account, lv] = String(key).split('#');
  const level = lv === undefined ? 1 : /^[0-9]+$/.test(lv) ? +lv : NaN;
  return Number.isInteger(level) && level >= 1 ? { account, level } : { account: null, level: null };
}

/* 432,5 s → « 7:12.5 » */
export function towerTime(t){
  if(!Number.isFinite(t) || t < 0) return '–';
  const d = Math.round(t * 10), m = Math.floor(d / 600), s = (d % 600) / 10;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
