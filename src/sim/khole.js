/* K hole (KHOLE en config ; décisions du créateur, 25/10/2026) : un portail enfoui dans une area. Dès qu'un mineur le
   découvre, il s'ouvre ; KHOLE.warn s plus tard, tout le groupe est aspiré dans une autre dimension pendant
   KHOLE.duration s (pris sur l'heure de session), puis il est téléporté à la surface de la mine, avec ce qu'il porte.

   Principe : c'est la même partie, on échange la carte. Tout ce qui appartient à la mine (WORLD : blocs, échelles,
   découverte, areas, mobs, torches, treuil, Mule, donjons, pièges…) est mis de côté et la dimension prend sa place. La
   simulation continue avec le même code (IA, chemins, rendu, envoi au navigateur) : une seule carte tourne à la fois, la
   mine est figée. Au retour, on remet la mine. Ce qui n'est pas mis de côté continue : l'heure, le coffre de la session,
   l'inventaire porté, les stats, les recharges de sorts. Chez chaque mineur, sa position et son travail en cours (SPOT)
   repartent de zéro à l'aller comme au retour.

   La dimension dépend uniquement de seed + numéro du k hole + son area (déterministe) : « au fond d'une mine », à la
   profondeur de l'area k du k hole (areaOf donne k : PV des mobs, table des pièges, tier des treasures), KHOLE.w × KHOLE.h
   cases dans le coin gauche de la grille, entourées de barrière. Dans la dimension (G.khole), l'oxygène ne baisse pas,
   les pods n'ont pas de limite et l'IA ne remonte jamais (src/sim/session.js, src/sim/ai.js), rien ne se débloque
   (tryUnlock), pas d'apparition de mobs, pas de focus d'area, la profondeur ne compte pas. */
import { W, IDS, BARRIER, SPAWN_X, KHOLE, KHOLE_BLOCK, DUNGEON, TREASURE_BLOCK } from '../config.js';
import { mulberry32, hash } from '../core/rng.js';
import { fillComp, typeOf, isResidue, isOre, oreKey, areaTop, treasureItem } from './world.js';
import { carve, registerDungeon } from './dungeon.js';
import { carveTrap, registerTrap, trapMobs, TRAP_BOX } from './trap.js';
import { createMiner } from './mineur.js';
import { updateLight } from './light.js';
import { log } from './log.js';

/* ce qui appartient à la carte : mis de côté pendant le k hole */
const WORLD = ['tiles', 'ladder', 'seen', 'areas', 'unlockedAreas', 'winch', 'treasures', 'dungeons', 'traps', 'veil', 'mobs',
  'torches', 'light', 'mimicCells', 'mule', 'ducks', 'duckBase', 'spawnTimer', 'spawnTurn', 'combat'];
/* ce qui, chez un mineur, dépend de sa place sur la carte (position, cibles, chantiers, action en cours) */
const SPOT = ['x', 'y', 'kx', 'ky', 'face', 'dir', 'action', 'mode', 'status', 'reason', 'target', 'foe', 'foeHit', 'exploring',
  'exploreArea', 'skipRows', 'ignored', 'digCol', 'galleryRow', 'returnStart', 'lastReturnDur', 'returnFromY', 'yieldSince',
  'scaredIn', 'scaredUntil', 'muleJob', 'muleFetch', 'helping', 'helpFoe', 'helpSkip', 'goingDown', 'choke', 'winchJob',
  'winchDepth', 'pickPlan', 'pickPlanEmpty', 'pickPlanAt', 'pickFail', 'tripCap', 'secPerRow', 'lazyTry', 'lastArea', 'pings',
  'fall', 'atkReady'];

/* ---------- le portail, dans la mine ---------- */

/* (x, ry) dans la boîte b ou à moins de gap cases d'elle */
const inBox = (b, x, ry, gap = 1) => x >= b.x0-gap && x < b.x0+b.w+gap && ry >= b.ry0-gap && ry < b.ry0+b.h+gap;

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

/* G.kholes : [{ k, x, y, opensAt (découvert : heure d'aspiration), used }] */
export function registerKhole(G, k, p){
  (G.kholes ??= []).push({ k, x: p.x, y: areaTop(k)+p.ry, opensAt: null, used: false });
}

/* ---------- la dimension ---------- */

const emptyArea = k => ({ k, comp: {}, counts: {}, oreTotal: 0, oreMined: 0, ores: {}, chestChance: 0, treasure: null });
/* terrain le plus présent de la composition : il bouche les trous d'une paroi de piège */
const filler = () => IDS[Object.keys(KHOLE.comp).filter(n => typeOf(IDS[n])==='terrain').sort((a, b) => KHOLE.comp[b]-KHOLE.comp[a])[0]];

/* pose une boîte w × h dans la zone de minage (colonnes spawnCols à KHOLE.w - 1), à une case au moins des autres
   boîtes : toutes les places sont essayées dans un ordre tiré au hasard ; null si aucune ne convient */
function placeBox(r, w, h, taken){
  const spots = [];
  for(let x0=KHOLE.spawnCols; x0<=KHOLE.w-w; x0++) for(let ry0=0; ry0<=KHOLE.h-h; ry0++) spots.push({ x0, ry0, w, h });
  for(let j=0; j<spots.length; j++){
    const s = j + Math.floor(r()*(spots.length-j)); [spots[j], spots[s]] = [spots[s], spots[j]];
    const b = spots[j];
    if(taken.some(q => b.x0 < q.x0+q.w+1 && q.x0 < b.x0+b.w+1 && b.ry0 < q.ry0+q.h+1 && q.ry0 < b.ry0+b.h+1)) continue;
    taken.push(b); return b;
  }
  return null;
}
/* place les donjons puis les pièges ; si tout ne tient pas, recommence (KHOLE.attempts fois au plus) et garde la
   disposition qui en place le plus */
function layout(r){
  let best = null;
  for(let a=0; a<KHOLE.attempts; a++){
    const taken = [], dungeons = [], traps = [];
    for(let i=0; i<KHOLE.dungeons; i++){ const b = placeBox(r, DUNGEON.size, DUNGEON.size, taken); if(b) dungeons.push(b); }
    for(let i=0; i<KHOLE.traps; i++){ const b = placeBox(r, TRAP_BOX.w, TRAP_BOX.h, taken); if(b) traps.push(b); }
    if(!best || dungeons.length + traps.length > best.dungeons.length + best.traps.length) best = { taken, dungeons, traps };
    if(dungeons.length === KHOLE.dungeons && traps.length === KHOLE.traps) break;
  }
  return best;
}

/* remplace la carte de G par la dimension n (n-ième k hole), à la profondeur de l'area k ; renvoie la ligne d'arrivée */
export function buildDimension(G, n, k){
  const r = mulberry32(hash(G.seed ^ KHOLE.salt ^ 0x2d1e, n+1));
  const top = areaTop(k), rows = top + KHOLE.h, S0 = KHOLE.spawnCols;
  const row = fill => new Uint8Array(W).fill(fill);
  Object.assign(G, {
    tiles: Array.from({ length: rows }, () => row(BARRIER)), ladder: Array.from({ length: rows }, () => row(0)),
    seen: Array.from({ length: rows }, () => row(0)), areas: Array.from({ length: k+1 }, (_, i) => emptyArea(i)),
    unlockedAreas: k+1, winch: null, treasures: new Map(), dungeons: [], traps: [], veil: new Set(), mobs: [], torches: [],
    light: new Map(), mimicCells: new Set(), mule: null, ducks: 0, duckBase: k+1, spawnTimer: Infinity, spawnTurn: 0, combat: false,
  });
  /* zone de minage (à droite de l'arrivée) : comp, comptes exacts ; x de la grille, ry ligne locale */
  const zw = KHOLE.w - S0, { grid, counts, oreTotal } = fillComp(r, KHOLE.comp, zw, KHOLE.h);
  const at = (x, ry) => ry*zw + x - S0;
  const get = (x, ry) => grid[at(x, ry)];
  const put = (x, ry, id) => { const i = at(x, ry), key = oreKey(grid[i]); if(grid[i] === id) return;
    if(key && counts[key]) counts[key]--; grid[i] = id; };
  /* donjon(s), puis pièges (toujours posés, mobs et PV de l'area k), sans se toucher */
  const L = layout(r), taken = L.taken;
  const dungeons = L.dungeons.map(b => ({ x0: b.x0, ry0: b.ry0, side: r() < 0.5 ? 'L' : 'R',
    hry: b.ry0 + DUNGEON.size - 2 - Math.floor(r()*DUNGEON.holeRows) }));
  const traps = L.traps.map(b => ({ x0: b.x0, ry0: b.ry0, mobs: trapMobs(k, r) }));
  for(const p of dungeons) carve(p, put);
  for(const p of traps) carveTrap(p, get, put, filler());
  /* treasures : treasurePct % des cases de la zone, à la place de terrain hors donjon et pièges (tier de l'area k) */
  const spots = [];
  for(let i=0; i<grid.length; i++) if(typeOf(grid[i])==='terrain' && !taken.some(b => inBox(b, S0 + i%zw, (i/zw)|0, 0))) spots.push(i);
  const chests = [];
  for(let j=0, want=Math.min(spots.length, Math.round(zw*KHOLE.h*KHOLE.treasurePct/100)); j<want; j++){
    const s = j + Math.floor(r()*(spots.length-j)); [spots[j], spots[s]] = [spots[s], spots[j]];
    put(S0 + spots[j]%zw, (spots[j]/zw)|0, TREASURE_BLOCK); chests.push(spots[j]);
  }
  /* la grille dans la carte : arrivée (S0 colonnes vides, vues) puis la zone */
  for(let ry=0; ry<KHOLE.h; ry++){
    const y = top + ry;
    for(let x=0; x<S0; x++){ G.tiles[y][x] = 0; G.seen[y][x] = 1; }
    for(let x=S0; x<KHOLE.w; x++) G.tiles[y][x] = get(x, ry);
  }
  for(const p of dungeons) registerDungeon(G, k, p, top + p.ry0);
  for(const p of traps) registerTrap(G, k, p, top + p.ry0);
  for(const i of chests){ const x = S0 + i%zw, y = top + ((i/zw)|0);
    G.treasures.set(y*W + x, { k, x, y, item: treasureItem(k), opened: false }); }
  const ores = {};
  for(const key in counts) if(isOre(IDS[key])) ores[key] = { total: counts[key], left: counts[key] };
  G.areas[k] = { k, comp: KHOLE.comp, counts, oreTotal, oreMined: 0, ores, chestChance: 0, treasure: null };
  return top + KHOLE.h - 1;                          // arrivée : en bas à gauche, « au fond de la mine »
}

/* ---------- aller et retour ---------- */

const take = (o, keys) => Object.fromEntries(keys.map(k => [k, o[k]]));
/* remet à zéro la place et le travail d'un mineur (valeurs de création) et le pose en (x, y) */
function placeMiner(m, x, y, status){
  const fresh = take(createMiner(m.id), SPOT);
  for(const k of SPOT) m[k] = fresh[k];
  m.x = x; m.y = y; m.status = status;
}

/* aspire le groupe dans la dimension du k hole h */
export function enterKhole(G, h){
  h.used = true;
  const n = G.kholes.indexOf(h);
  G.khole = { n, k: h.k, x: h.x, y: h.y, until: G.t + KHOLE.duration, world: take(G, WORLD) };
  const y = buildDimension(G, n, h.k);
  G.miners.forEach((m, i) => placeMiner(m, Math.min(i, KHOLE.spawnCols-1), y, 'Aspiré par le k hole'));
  G.realm = (G.realm || 0) + 1;            // la carte a changé : l'envoi suivant au navigateur est la carte entière
  log(G, `🌀 Le groupe est aspiré par le k hole ! (${Math.round(KHOLE.duration/60)} min dans une autre dimension)`);
}

/* ramène le groupe dans la mine, à la surface (autour du point de départ) ; le portail a disparu (case vide) ; les mobs
   de la mine qui tenaient un mineur le lâchent */
export function exitKhole(G){
  const K = G.khole; if(!K) return;
  Object.assign(G, K.world);
  G.miners.forEach((m, i) => placeMiner(m, Math.max(0, Math.min(W-1, SPAWN_X + i - Math.floor(G.miners.length/2))), 0, 'Revenu du k hole'));
  for(const o of G.mobs){ o.grab = null; o.chase = null; }
  G.tiles[K.y][K.x] = 0;
  G.khole = null;
  updateLight(G);
  G.realm++;
  log(G, '🌀 Retour à la surface de la mine : le k hole s\'est refermé');
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
