/* Classements (onglet Social → Classements, 27/10/2026, Geoffrey) : logique pure, partagée par le serveur et le navigateur.
   Classements : gs (gear score des pièces portées), xp (XP du mineur), spec:<arbre> (XP de spécialisation de cet arbre,
   un classement par arbre), tower (meilleur temps de victoire dans une tour céleste, Ange et Démon confondus, en secondes
   de jeu). Plus grand = mieux, sauf la tour (plus court = mieux). Un joueur à 0 n'est pas classé.
   Ex aequo : même rang ; à égalité, le plus ancien d'abord (at), puis l'ID de compte. */
import { SKILLS, JUDGMENT, LEADERBOARD } from '../config.js';

export const BOARDS = ['gs', 'xp', ...SKILLS.trees.map(t => 'spec:' + t.id), 'tower'];
export const isBoard = b => typeof b === 'string' && BOARDS.includes(b);
/* arbre d'un classement de spécialisation (« spec:barbare » → 'barbare'), sinon null */
export const specTree = b => isBoard(b) && b.startsWith('spec:') ? b.slice(5) : null;

/* entries [{ id, value, at?, … }] → { board, total, rows (top size, avec rank et me), me (ma ligne si hors du top, sinon null) } */
export function rankBoard(board, entries, meId, size = LEADERBOARD.size){
  const sign = board === 'tower' ? 1 : -1;
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

/* 432,5 s → « 7:12.5 » */
export function towerTime(t){
  if(!Number.isFinite(t) || t < 0) return '–';
  const d = Math.round(t * 10), m = Math.floor(d / 600), s = (d % 600) / 10;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
