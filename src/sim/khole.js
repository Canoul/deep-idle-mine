/* K hole (KHOLE en config ; décisions du créateur, 25/10/2026) : un portail enfoui dans une area. Dès qu'un mineur le
   découvre, il s'ouvre ; KHOLE.warn s plus tard, tout le groupe est aspiré dans une autre dimension, une carte tirée
   parmi KHOLE.maps, pendant la durée de cette carte (prise sur l'heure de session), puis il est téléporté à la surface
   de la mine, avec ce qu'il porte. Certaines cartes finissent plus tôt (end : minotaures vaincus, treasures ouverts).

   Principe : c'est la même partie, on échange la carte. Tout ce qui appartient à la mine (WORLD : blocs, échelles,
   découverte, areas, mobs, torches, treuil, Mule, donjons, pièges…) est mis de côté et la dimension prend sa place. La
   simulation continue avec le même code (IA, chemins, rendu, envoi au navigateur) : une seule carte tourne à la fois, la
   mine est figée. Au retour, on remet la mine. Ce qui n'est pas mis de côté continue : l'heure, le coffre de la session,
   l'inventaire porté, les stats, les recharges de sorts. Chez chaque mineur, sa position et son travail en cours (SPOT)
   repartent de zéro à l'aller comme au retour.

   La dimension dépend uniquement de seed + numéro du k hole + son area (déterministe ; les vagues de mobs utilisent le
   hasard « live » G.rng, comme les apparitions normales) : « au fond d'une mine », à la profondeur de l'area k du k hole
   (areaOf donne k : PV des mobs, table des pièges et des vagues, tier des treasures), w × h cases dans le coin gauche de
   la grille, entourées de barrière. Dans la dimension (G.khole), l'oxygène ne baisse pas, les pods n'ont pas de limite
   et l'IA ne remonte jamais (src/sim/session.js, src/sim/ai.js), rien ne se débloque (tryUnlock), pas d'apparition de
   mobs normale, pas de focus d'area, la profondeur ne compte pas. */
import { W, IDS, BARRIER, SPAWN_X, SESSION_LEN, KHOLE, KHOLE_BLOCK, DUNGEON, TREASURE, TREASURE_BLOCK, MOBS, mobHp } from '../config.js';
import { mulberry32, hash } from '../core/rng.js';
import { fillComp, typeOf, isResidue, isOre, oreKey, areaTop, areaOf, treasureItem } from './world.js';
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
  'fall', 'atkReady', 'braumIn'];

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

/* carte du n-ième k hole : imposée en mode dev (KHOLE.map, 1 à maps.length), sinon tirée selon weight */
export function pickMap(seed, n){
  const forced = Math.round(KHOLE.map);
  if(forced >= 1 && forced <= KHOLE.maps.length) return KHOLE.maps[forced-1];
  const total = KHOLE.maps.reduce((s, m) => s + m.weight, 0);
  let x = mulberry32(hash(seed ^ KHOLE.salt ^ 0x4a7, n+1))() * total;
  for(const m of KHOLE.maps){ x -= m.weight; if(x < 0) return m; }
  return KHOLE.maps.at(-1);
}

/* ---------- la dimension ---------- */

const emptyArea = k => ({ k, comp: {}, counts: {}, oreTotal: 0, oreMined: 0, ores: {}, chestChance: 0, treasure: null });

/* pose une boîte w × h dans la zone de minage (colonnes x0min à map.w - 1), à une case au moins des autres boîtes :
   toutes les places sont essayées dans un ordre tiré au hasard ; null si aucune ne convient */
function placeBox(r, map, w, h, taken){
  const spots = [];
  for(let x0=map.spawnCols; x0<=map.w-w; x0++) for(let ry0=0; ry0<=map.h-h; ry0++) spots.push({ x0, ry0, w, h });
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
function layout(r, map){
  let best = null;
  for(let a=0; a<KHOLE.attempts; a++){
    const taken = [], dungeons = [], traps = [];
    for(let i=0; i<(map.dungeons || 0); i++){ const b = placeBox(r, map, DUNGEON.size, DUNGEON.size, taken); if(b) dungeons.push(b); }
    for(let i=0; i<(map.traps || 0); i++){ const b = placeBox(r, map, TRAP_BOX.w, TRAP_BOX.h, taken); if(b) traps.push(b); }
    if(!best || dungeons.length + traps.length > best.dungeons.length + best.traps.length) best = { taken, dungeons, traps };
    if(dungeons.length === (map.dungeons || 0) && traps.length === (map.traps || 0)) break;
  }
  return best;
}

/* carte « filons » : spawnCols colonnes vides à gauche (vues), puis comp, donjons, pièges et treasures */
function buildVeins(G, r, map, k, top){
  const S0 = map.spawnCols, zw = map.w - S0, { grid, counts, oreTotal } = fillComp(r, map.comp, zw, map.h);
  const at = (x, ry) => ry*zw + x - S0;
  const get = (x, ry) => grid[at(x, ry)];
  const put = (x, ry, id) => { const i = at(x, ry), key = oreKey(grid[i]); if(grid[i] === id) return;
    if(key && counts[key]) counts[key]--; grid[i] = id; };
  const filler = IDS[Object.keys(map.comp).filter(n => typeOf(IDS[n])==='terrain').sort((a, b) => map.comp[b]-map.comp[a])[0]];
  const L = layout(r, map), taken = L.taken;
  const dungeons = L.dungeons.map(b => ({ x0: b.x0, ry0: b.ry0, side: r() < 0.5 ? 'L' : 'R',
    hry: b.ry0 + DUNGEON.size - 2 - Math.floor(r()*DUNGEON.holeRows) }));
  const traps = L.traps.map(b => ({ x0: b.x0, ry0: b.ry0, mobs: trapMobs(k, r) }));
  for(const p of dungeons) carve(p, put);
  for(const p of traps) carveTrap(p, get, put, filler);
  /* treasures : treasurePct % des cases de la zone, à la place de terrain hors donjon et pièges (tier de l'area k) */
  const spots = [];
  for(let i=0; i<grid.length; i++) if(typeOf(grid[i])==='terrain' && !taken.some(b => inBox(b, S0 + i%zw, (i/zw)|0, 0))) spots.push(i);
  const chests = [];
  for(let j=0, want=Math.min(spots.length, Math.round(zw*map.h*map.treasurePct/100)); j<want; j++){
    const s = j + Math.floor(r()*(spots.length-j)); [spots[j], spots[s]] = [spots[s], spots[j]];
    put(S0 + spots[j]%zw, (spots[j]/zw)|0, TREASURE_BLOCK); chests.push(spots[j]);
  }
  for(let ry=0; ry<map.h; ry++){
    const y = top + ry;
    for(let x=0; x<S0; x++){ G.tiles[y][x] = 0; G.seen[y][x] = 1; }
    for(let x=S0; x<map.w; x++) G.tiles[y][x] = get(x, ry);
  }
  for(const p of dungeons) registerDungeon(G, k, p, top + p.ry0);
  for(const p of traps) registerTrap(G, k, p, top + p.ry0);
  for(const i of chests){ const x = S0 + i%zw, y = top + ((i/zw)|0); G.treasures.set(y*W + x, { k, x, y, item: treasureItem(k), opened: false }); }
  const ores = {};
  for(const key in counts) if(isOre(IDS[key])) ores[key] = { total: counts[key], left: counts[key] };
  G.areas[k] = { k, comp: map.comp, counts, oreTotal, oreMined: 0, ores, chestChance: 0, treasure: null };
}

/* un mob posé au sol de la dimension (PV de l'area k), qui chasse le groupe */
function addMob(G, type, x, y, k, extra = {}){
  const hp = type === DUNGEON.boss.type ? DUNGEON.boss.hp : mobHp(type, k);
  const o = { id: G.mobId++, type, x, y, hp, maxhp: hp, cd: 1, hunt: G.miners[0]?.id ?? null, ...extra };
  if(type === 'occultiste') o.cast = MOBS.occult.cooldown;
  G.mobs.push(o);
  return o;
}

/* salle vide (arene, tresor, vagues) : toute vue ; minotaures aux deux bouts, treasures sur la droite */
function buildRoom(G, r, map, k, top){
  const floor = top + map.h - 1;
  for(let ry=0; ry<map.h; ry++) for(let x=0; x<map.w; x++){ G.tiles[top+ry][x] = 0; G.seen[top+ry][x] = 1; }
  if(map.minotaurs){
    const xs = map.minotaurs === 1 ? [map.w-1] : Array.from({ length: map.minotaurs }, (_, i) => Math.round(i*(map.w-1)/(map.minotaurs-1)));
    for(const x of xs) addMob(G, DUNGEON.boss.type, x, floor, k, { name: DUNGEON.boss.name });
  }
  for(let i=0; i<(map.treasures || 0); i++){
    const x = map.w-1-i, item = TREASURE.tiers[Math.floor(r()*TREASURE.tiers.length)].item;   // tier tiré au hasard
    G.tiles[floor][x] = TREASURE_BLOCK;
    G.treasures.set(floor*W + x, { k, x, y: floor, item, opened: false });
  }
}

/* remplace la carte de G par la dimension n (n-ième k hole, carte map), à la profondeur de l'area k ; renvoie la case
   d'arrivée de chaque mineur (par son rang) */
export function buildDimension(G, n, k, map = pickMap(G.seed, n)){
  const r = mulberry32(hash(G.seed ^ KHOLE.salt ^ 0x2d1e, n+1));
  const top = areaTop(k), rows = top + map.h, floor = rows - 1;
  const row = fill => new Uint8Array(W).fill(fill);
  Object.assign(G, {
    tiles: Array.from({ length: rows }, () => row(BARRIER)), ladder: Array.from({ length: rows }, () => row(0)),
    seen: Array.from({ length: rows }, () => row(0)), areas: Array.from({ length: k+1 }, (_, i) => emptyArea(i)),
    unlockedAreas: k+1, winch: null, treasures: new Map(), dungeons: [], traps: [], veil: new Set(), mobs: [], torches: [],
    light: new Map(), mimicCells: new Set(), mule: null, ducks: 0, duckBase: k+1, spawnTimer: Infinity, spawnTurn: 0, combat: false,
  });
  if(map.comp) buildVeins(G, r, map, k, top); else buildRoom(G, r, map, k, top);
  /* arrivée, regroupés : en bas à gauche (un par colonne d'arrivée s'il y en a), ou au milieu */
  return i => ({ x: map.spawn === 'middle' ? Math.floor(map.w/2) : Math.min(i, Math.max(0, (map.spawnCols || 1) - 1)), y: floor });
}

/* vagues : la suivante dès que la précédente est vaincue (map.wave mobs, table de l'area sans mimic, colonne au hasard) */
function updateWaves(G){
  const K = G.khole, map = K.map;
  if(G.mobs.some(o => o.hp > 0)) return;
  const floor = G.tiles.length - 1;
  for(const type of trapMobs(K.k, G.rng, map.wave)) addMob(G, type, Math.floor(G.rng()*map.w), floor, K.k);
  K.waves = (K.waves || 0) + 1;
  log(G, `🌀 Vague ${K.waves} : ${map.wave} mobs`);
}

/* fin anticipée de la carte : minotaures vaincus, ou treasures ouverts */
function finished(G){
  const end = G.khole.map.end;
  if(end === 'bosses') return !G.mobs.some(o => o.type === DUNGEON.boss.type && o.hp > 0);
  if(end === 'treasures') return [...G.treasures.values()].every(t => t.opened);
  return false;
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
  const n = G.kholes.indexOf(h), map = KHOLE.maps[h.map - 1] ?? pickMap(G.seed, n);   // h.map : carte imposée (admin)
  /* retour au bout de la durée de la carte, ou quand il ne reste que endMargin s de session (le temps de déposer) */
  const until = Math.min(G.t + map.duration, SESSION_LEN - KHOLE.endMargin);
  G.khole = { n, k: h.k, x: h.x, y: h.y, map, until, world: take(G, WORLD) };
  const spawn = buildDimension(G, n, h.k, map);
  G.miners.forEach((m, i) => { const p = spawn(i); placeMiner(m, p.x, p.y, 'Aspiré par le k hole'); });
  for(const o of G.mobs) if(o.hunt != null) o.hunt = G.miners[0]?.id ?? null;
  G.realm = (G.realm || 0) + 1;            // la carte a changé : l'envoi suivant au navigateur est la carte entière
  log(G, `🌀 Le groupe est aspiré par le k hole : ${map.label} ! (${Math.round(map.duration/60)} min)`);
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

/* k hole imposé (administration, scripts/force-khole.js) : il s'ouvre sous les pieds du premier mineur du groupe,
   comme s'il venait de le découvrir (même message, aspiration KHOLE.warn s plus tard) ; map : 1 à maps.length pour
   imposer la carte, 0 = tirée comme d'habitude. Refusé (false) si la partie est finie, déjà dans un k hole (ou un k hole
   va s'ouvrir), vide, ou trop près de la fin (KHOLE.endMargin). Rejoué au même tick, il donne la même partie. */
export function forceKhole(G, map = 0){
  const m = G.miners[0];
  if(G.over || G.khole || !m || G.t >= SESSION_LEN - KHOLE.endMargin - KHOLE.warn) return false;
  if((G.kholes || []).some(h => !h.used && h.opensAt != null)) return false;
  (G.kholes ??= []).push({ k: Math.max(0, areaOf(m.y)), x: m.x, y: m.y, opensAt: G.t + KHOLE.warn, used: false,
    map: Number.isSafeInteger(map) && map >= 1 && map <= KHOLE.maps.length ? map : 0 });
  log(G, '🌀 Un k hole s\'ouvre…');
  return true;
}

/* exécute fn sur la mine (pas la dimension) : ex. le sac de la Mule d'un joueur qui part pendant le k hole */
export function inMine(G, fn){
  const K = G.khole; if(!K) return fn();
  const dim = take(G, WORLD);
  Object.assign(G, K.world);
  try { return fn(); } finally { K.world = take(G, WORLD); Object.assign(G, dim); }
}

/* à chaque tick : découverte d'un k hole (il s'ouvre), aspiration au bout de KHOLE.warn s ; dans la dimension, vagues,
   retour au bout de la durée ou dès que la carte est finie */
export function updateKhole(G){
  if(G.khole){
    if(G.t >= G.khole.until - 1e-9 || finished(G)) return exitKhole(G);
    if(G.khole.map.wave) updateWaves(G);
    return;
  }
  if(G.t >= SESSION_LEN - KHOLE.endMargin - 1e-9) return;   // fin de session proche : il ne s'ouvre plus
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
