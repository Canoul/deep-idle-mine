/* Le Carreau (29/10/2026) : plan de la ville du spawn et règles de la place d'un joueur, partagés par le navigateur
   (dessin, marche) et le serveur (qui revérifie ce que le navigateur envoie). Config : TOWN (src/config.js).
   Plan : les bâtiments de TOWN.buildings posés de gauche à droite, séparés de TOWN.gap cases, TOWN.margin cases avant
   le premier et après le dernier. Coordonnées en cases ; x d'un joueur = milieu de son corps. */
import { TOWN } from '../config.js';

/* bâtiments avec leur place : { …b, x (bord gauche), door (milieu de la porte) } ; width : largeur de la ville */
export function townLayout(cfg = TOWN){
  let x = cfg.margin;
  const buildings = cfg.buildings.map(b => { const o = { ...b, x, door: x + b.w / 2 }; x += b.w + cfg.gap; return o; });
  return { buildings, width: x - cfg.gap + cfg.margin };
}
const LAYOUT = townLayout();
export const TOWN_WIDTH = LAYOUT.width;
export const townBuildings = () => LAYOUT.buildings;
export const buildingOf = tab => LAYOUT.buildings.find(b => b.tab === tab) ?? null;

/* petit hachage stable d'un texte (ID de compte) → [0, 1[ */
export function hash01(s){
  let h = 2166136261;
  for(const c of String(s)){ h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 2 ** 32;
}

/* place d'un joueur devant le bâtiment de son onglet (spot) : la porte, décalée de ± TOWN.spread selon son ID pour que
   les joueurs d'un même bâtiment ne se superposent pas. Onglet inconnu : la Place du Carreau (Lobby). */
export function restX(spot, id, cfg = TOWN){
  const b = buildingOf(spot) ?? buildingOf('lobby');
  return b.door + (hash01(id) * 2 - 1) * cfg.spread;
}

export const clampX = x => Math.min(TOWN_WIDTH - 1, Math.max(1, x));

/* ce que le navigateur envoie : { spot: onglet ouvert, x: sa place s'il se promène (sinon absent ou null) }.
   Renvoie { spot, x } (x arrondi au 1/100 de case, ramené dans la ville, ou null), ou null si invalide. */
export function cleanTownPing(raw){
  if(!raw || typeof raw !== 'object') return null;
  const { spot, x } = raw;
  if(typeof spot !== 'string' || !buildingOf(spot)) return null;
  if(x === undefined || x === null) return { spot, x: null };
  if(typeof x !== 'number' || !Number.isFinite(x)) return null;
  return { spot, x: Math.round(clampX(x) * 100) / 100 };
}

/* bâtiment dont la porte est à moins de reach cases de x (le plus proche), ou null */
export function buildingNear(x, reach = TOWN.reach){
  let best = null, d = Infinity;
  for(const b of LAYOUT.buildings){ const k = Math.abs(b.door - x); if(k <= reach && k < d){ best = b; d = k; } }
  return best;
}

/* un pas de marche de x vers target pendant dt secondes : vitesse TOWN.walk, augmentée pour qu'un long trajet tienne
   en TOWN.rush secondes (dist : distance au départ du trajet). Renvoie la nouvelle place. */
export function stepToward(x, target, dt, dist = Math.abs(target - x), cfg = TOWN){
  const v = Math.max(cfg.walk, dist / cfg.rush), d = target - x;
  return Math.abs(d) <= v * dt ? target : x + Math.sign(d) * v * dt;
}
