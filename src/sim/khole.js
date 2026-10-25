/* K hole (KHOLE en config ; décisions du créateur, 25/10/2026) : un portail enfoui dans une area. Dès qu'un mineur le
   découvre, il s'ouvre ; KHOLE.warn s plus tard, tout le groupe est aspiré dans une autre dimension pendant
   KHOLE.duration s (pris sur l'heure de session), puis chacun revient à sa place dans la mine, avec ce qu'il porte.

   Principe : c'est la même partie, on échange la carte. Tout ce qui appartient à la mine (WORLD : blocs, échelles,
   découverte, areas, mobs, torches, treuil, Mule, donjons, pièges…) est mis de côté, et la dimension prend sa place ;
   pour chaque mineur, sa position et son travail en cours (SPOT) aussi. La simulation continue avec le même code (IA,
   chemins, rendu, envoi au navigateur) : une seule carte tourne à la fois, la mine est figée. Au retour, on remet tout.
   Ce qui n'est pas mis de côté continue : l'heure, le coffre de la session, l'inventaire porté, l'oxygène, les stats,
   les recharges de sorts.

   La dimension dépend uniquement de seed + numéro du k hole (déterministe, comme une area) : une surface et son coffre
   (le coffre de la session), une couche de terre, puis une area de KHOLE.comp. Pas de mobs, rien à débloquer. */
import { W, AREA_H, TOP_DIRT_ROWS, IDS, CHEST_BASE, CHEST_X, SPAWN_X, KHOLE, KHOLE_BLOCK } from '../config.js';
import { mulberry32, hash } from '../core/rng.js';
import { fillComp, typeOf, isResidue, isOre, oreKey, areaTop } from './world.js';
import { createMiner } from './mineur.js';
import { updateLight } from './light.js';
import { log } from './log.js';

/* ce qui appartient à la carte : mis de côté pendant le k hole */
const WORLD = ['tiles', 'ladder', 'seen', 'areas', 'unlockedAreas', 'winch', 'treasures', 'dungeons', 'traps', 'veil', 'mobs',
  'torches', 'light', 'mimicCells', 'mule', 'ducks', 'duckBase', 'spawnTimer', 'spawnTurn', 'combat'];
/* ce qui, chez un mineur, dépend de sa place dans la mine (position, cibles, chantiers, action en cours) */
const SPOT = ['x', 'y', 'kx', 'ky', 'face', 'dir', 'action', 'mode', 'status', 'reason', 'target', 'foe', 'foeHit', 'exploring',
  'exploreArea', 'skipRows', 'ignored', 'digCol', 'galleryRow', 'returnStart', 'lastReturnDur', 'returnFromY', 'yieldSince',
  'scaredIn', 'scaredUntil', 'muleJob', 'muleFetch', 'helping', 'helpFoe', 'helpSkip', 'goingDown', 'choke', 'winchJob',
  'winchDepth', 'pickPlan', 'pickPlanEmpty', 'pickPlanAt', 'pickFail', 'tripCap', 'secPerRow', 'lazyTry', 'lastArea', 'pings',
  'fall', 'atkReady'];

/* ---------- génération ---------- */

const inBox = (b, x, ry) => x >= b.x0-1 && x <= b.x0+b.w && ry >= b.ry0-1 && ry <= b.ry0+b.h;   // boîte et son pourtour

/* tirage de l'area k (à part de la seed : le reste de l'area ne change pas) ; s'il sort, le k hole remplace un bloc de
   terrain (pas un résidu), hors des boîtes avoid ({x0, ry0, w, h} : donjon, pièges). Renvoie { x, ry } ou null. */
export function placeKhole(seed, k, grid, counts, avoid = []){
  if(k < KHOLE.fromArea) return null;
  const r = mulberry32(hash(seed ^ KHOLE.salt, k+1));
  if(!(r() < KHOLE.chance)) return null;
  const spots = [];
  for(let i=0; i<grid.length; i++){
    const x = i%W, ry = (i/W)|0;
    if(typeOf(grid[i])==='terrain' && !isResidue(grid[i]) && !avoid.some(b => inBox(b, x, ry))) spots.push(i);
  }
  if(!spots.length) return null;
  const c = spots[Math.floor(r()*spots.length)], key = oreKey(grid[c]);
  counts[key]--; grid[c] = KHOLE_BLOCK;
  return { x: c%W, ry: (c/W)|0 };
}

/* G.kholes : [{ k, x, y, opensAt (découvert : heure d'aspiration) , used }] */
export function registerKhole(G, k, p){
  (G.kholes ??= []).push({ k, x: p.x, y: areaTop(k)+p.ry, opensAt: null, used: false });
}

/* la carte de la dimension n (n-ième k hole de la session) */
export function dimension(seed, n){
  const tiles = [new Uint8Array(W)], ladder = [new Uint8Array(W)], seen = [new Uint8Array(W).fill(1)];
  for(let y=1; y<=TOP_DIRT_ROWS; y++){ tiles.push(new Uint8Array(W).fill(IDS.dirt)); ladder.push(new Uint8Array(W)); seen.push(new Uint8Array(W).fill(1)); }
  tiles[1][CHEST_X] = CHEST_BASE;
  const { grid, counts, oreTotal } = fillComp(mulberry32(hash(seed ^ KHOLE.salt ^ 0x2d1e, n+1)), KHOLE.comp);
  for(let ry=0; ry<AREA_H; ry++){ tiles.push(grid.slice(ry*W, (ry+1)*W)); ladder.push(new Uint8Array(W)); seen.push(new Uint8Array(W)); }
  const ores = {};
  for(const key in counts) if(isOre(IDS[key])) ores[key] = { total: counts[key], left: counts[key] };
  return { tiles, ladder, seen, areas: [{ k: 0, comp: KHOLE.comp, counts, oreTotal, oreMined: 0, ores, chestChance: 0, treasure: null }],
    unlockedAreas: 1, winch: null, treasures: new Map(), dungeons: [], traps: [], veil: new Set(), mobs: [], torches: [], light: new Map(),
    mimicCells: new Set(), mule: null, ducks: 0, duckBase: 1, spawnTimer: Infinity, spawnTurn: 0, combat: false };
}

/* ---------- aller et retour ---------- */

const take = (o, keys) => Object.fromEntries(keys.map(k => [k, o[k]]));

/* aspire le groupe dans la dimension du k hole h */
export function enterKhole(G, h){
  h.used = true;
  const n = G.kholes.indexOf(h);
  G.khole = { n, x: h.x, y: h.y, until: G.t + KHOLE.duration, world: take(G, WORLD),
              spots: new Map(G.miners.map(m => [m.id, take(m, SPOT)])) };
  Object.assign(G, dimension(G.seed, n));
  G.miners.forEach((m, i) => {
    const fresh = take(createMiner(m.id), SPOT);
    for(const k of SPOT) m[k] = fresh[k];
    m.x = Math.min(W-1, SPAWN_X + i - Math.floor(G.miners.length/2)); m.y = 0; m.status = 'Aspiré par le k hole';
  });
  G.realm = (G.realm || 0) + 1;            // la carte a changé : l'envoi suivant au navigateur est la carte entière
  log(G, `🌀 Le groupe est aspiré par le k hole ! (${KHOLE.duration} s dans une autre dimension)`);
}

/* ramène le groupe dans la mine, chacun à sa place ; le portail a disparu (case vide) */
export function exitKhole(G){
  const K = G.khole; if(!K) return;
  Object.assign(G, K.world);
  for(const m of G.miners){ const s = K.spots.get(m.id); if(s) Object.assign(m, s); }
  G.tiles[K.y][K.x] = 0;
  G.khole = null;
  updateLight(G);
  G.realm++;
  log(G, '🌀 Retour dans la mine : le k hole s\'est refermé');
}

/* exécute fn sur la mine (pas la dimension) : ex. le sac de la Mule d'un joueur qui part pendant le k hole */
export function inMine(G, fn){
  const K = G.khole; if(!K) return fn();
  const dim = take(G, WORLD);
  Object.assign(G, K.world);
  try { return fn(); } finally { K.world = take(G, WORLD); Object.assign(G, dim); }
}

/* à chaque tick : découverte d'un k hole (il s'ouvre), aspiration au bout de KHOLE.warn s, retour au bout de duration */
export function updateKhole(G){
  if(G.khole){ if(G.t >= G.khole.until - 1e-9) exitKhole(G); return; }
  for(const h of G.kholes || []){
    if(h.used) continue;
    if(h.opensAt == null){
      if(!G.seen[h.y]?.[h.x]) continue;
      h.opensAt = G.t + KHOLE.warn;
      log(G, '🌀 Un k hole s\'ouvre…');
    }
    if(G.t >= h.opensAt - 1e-9){ enterKhole(G, h); return; }
  }
}
