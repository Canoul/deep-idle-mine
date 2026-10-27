/* Bloc géant : règles partagées par le jeu et le serveur (logique pure, GIANT dans src/config.js).
   - la session du jour : de minuit à minuit, heure de Paris (dayOf, dayEnd) ;
   - entrer : une fois toutes les GIANT.cooldownMs depuis sa dernière entrée (nextEntry) ;
   - récompense : paliers du score collectif, qui s'additionnent (tiersReached, rewardFor) ;
   - classement du jour (ranking). */
import { GIANT, DT, GAME, ITEMS } from '../config.js';

const HOUR = 3600e3;
const fmt = new Map();
const formatter = (tz, opts) => { const k = tz + JSON.stringify(opts); if(!fmt.has(k)) fmt.set(k, new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts })); return fmt.get(k); };

/* jour (« 2026-10-26 ») de l'instant t dans le fuseau tz */
export function dayOf(t, tz = GIANT.timeZone){
  const p = Object.fromEntries(formatter(tz, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
/* fin de la session du jour de t : le premier instant du jour suivant (minuit dans tz ; les décalages de Paris sont des
   heures entières, on cherche donc heure par heure) */
export function dayEnd(t, tz = GIANT.timeZone){
  const d = dayOf(t, tz);
  let s = Math.floor(t / HOUR) * HOUR + HOUR;
  for(let i = 0; i < 30; i++, s += HOUR) if(dayOf(s, tz) !== d) return s;
  throw new Error('fin du jour introuvable');
}
/* début du jour de t */
export function dayStart(t, tz = GIANT.timeZone){
  const d = dayOf(t, tz);
  let s = Math.floor(t / HOUR) * HOUR;
  for(let i = 0; i < 30; i++, s -= HOUR) if(dayOf(s - 1, tz) !== d) return s;
  throw new Error('début du jour introuvable');
}

/* prochaine entrée possible pour un joueur dont la dernière entrée est lastEntry (ms, ou null) */
export const nextEntry = (lastEntry, cfg = GIANT) => Number.isFinite(lastEntry) ? lastEntry + cfg.cooldownMs : 0;
export const canEnter = (lastEntry, now, cfg = GIANT) => now >= nextEntry(lastEntry, cfg);

/* durée réelle d'une visite (ms) et son nombre de ticks (temps de jeu GIANT.visit, à la vitesse du jeu) */
export const VISIT_TICKS = Math.round(GIANT.visit / DT);
export const visitDurationMs = (speed = GAME.speed) => GIANT.visit / speed * 1000;

/* paliers atteints par un score collectif */
export const tiersReached = (total, cfg = GIANT) => cfg.tiers.filter(t => Number.isFinite(total) && total >= t.min);
/* récompense d'un joueur venu au moins une fois : les objets de tous les paliers atteints, additionnés */
export function rewardFor(total, cfg = GIANT){
  const items = {};
  for(const t of tiersReached(total, cfg)) for(const [k, n] of Object.entries(t.items)) items[k] = (items[k] || 0) + n;
  return items;
}
/* pépites d'argent d'un joueur : 1 par tranche de GIANT.nugget.per de ses points du jour, arrondi vers le bas (27/10) */
export const nuggetsFor = (points, cfg = GIANT) => cfg.nugget && Number.isFinite(points) && points > 0 ? Math.floor(points / cfg.nugget.per) : 0;
/* récompense d'un joueur qui y a droit : les paliers du score collectif + ses pépites d'argent */
export function playerRewardFor(total, points, cfg = GIANT){
  const items = rewardFor(total, cfg), n = nuggetsFor(points, cfg);
  if(n > 0) items[cfg.nugget.item] = (items[cfg.nugget.item] || 0) + n;
  return items;
}
/* visites qu'il faut avoir faites ce jour-là (« AAAA-MM-JJ ») pour recevoir sa récompense : GIANT.minVisits depuis
   GIANT.minVisitsFrom (27/10/2026), 1 avant (les journées déjà finies gardent leur règle) */
export const minVisitsFor = (day, cfg = GIANT) => typeof day === 'string' && cfg.minVisitsFrom && day >= cfg.minVisitsFrom ? (cfg.minVisits ?? 1) : 1;
/* le joueur a-t-il droit à la récompense du jour ? score = { points, visits } du jour */
export const earnsReward = (score, day, cfg = GIANT) => Number.isSafeInteger(score?.visits) && score.visits >= minVisitsFor(day, cfg);
/* les objets des paliers doivent exister (vérifié au chargement des tests) */
export const tierItemsKnown = (cfg = GIANT) => cfg.tiers.every(t => Object.keys(t.items).every(k => Object.hasOwn(ITEMS, k)))
  && (!cfg.nugget || Object.hasOwn(ITEMS, cfg.nugget.item));

/* points affichés : un entier (arrondi vers le bas, on ne montre jamais plus que ce qui est gagné) */
export const shownPoints = p => Math.floor(Number.isFinite(p) ? p : 0);

/* classement du jour : scores = { compte: { points, visits, name } } → [{ account, name, points, rank }], du plus haut au
   plus bas (à égalité : le plus de visites puis le nom) ; top lignes, et la ligne de `me` si elle n'y est pas */
export function ranking(scores, me = null, top = GIANT.top){
  const all = Object.entries(scores || {}).map(([account, s]) => ({ account, name: s.name || account, points: shownPoints(s.points), visits: s.visits || 0 }))
    .sort((a, b) => b.points - a.points || b.visits - a.visits || a.name.localeCompare(b.name, 'fr'))
    .map((r, i) => ({ ...r, rank: i + 1 }));
  const list = all.slice(0, top);
  const mine = me ? all.find(r => r.account === me) ?? null : null;
  return { list, me: mine && mine.rank > top ? mine : null, players: all.length };
}
