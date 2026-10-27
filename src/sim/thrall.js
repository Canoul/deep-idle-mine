/* Gobelins asservis (Couronne du Roi Gobelin, 27/10/2026, Geoffrey ; GOBLIN_KING.thrall en config).
   Un gobelin qui naît à STATS.goblinThrall cases ou moins (cercle) d'un mineur qui porte la couronne ne rejoint pas les
   mobs (src/sim/mobs.js spawnMobs) : il devient un « asservi », rangé à part dans G.thralls. Il ne se bat pas, ne vole
   rien, personne ne le frappe. Pendant GOBLIN_KING.thrall.life secondes, il mine les minerais autour de lui
   (reach cases au plus, Manhattan), à la vitesse d'un mineur de base (STATS : minage, marche, montée), avec la même
   priorité que son maître (le porteur : son focus minerai, src/sim/focus.js targetVal). Pour rejoindre un minerai, il
   creuse droit vers lui, comme un mineur. Tout bloc qu'il casse va directement dans le coffre commun (G.chest) et dans
   la part « gobelins » du coffre (G.goblinChest, affichée à part) ; un minerai compte pour le déblocage de l'area.
   Pas de fortune, pas de shiny, pas d'XP (choix de Claude : « mineur de base »). Il s'agrippe à la roche comme le
   golem (il ne tombe que dans le vide). Au bout de son temps, il disparaît. Logique pure, sans hasard. */
import { W, DT, CFG, BLOCKS, STATS, GOBLIN_KING } from '../config.js';
import { maxRow, isAir, isOre, areaOf, tryUnlock, oreRemoved } from './world.js';
import { updateLight } from './light.js';
import { breakable } from './golem.js';
import { targetVal } from './focus.js';
import { log } from './log.js';

const C = GOBLIN_KING.thrall;
const byId = (G, id) => G.miners.find(m => m.id === id) ?? null;
const solid = (G, x, y) => x < 0 || x >= W || !isAir(G, x, y);
/* il tient : sol dessous, roche contre un flanc (il s'agrippe), ou une échelle */
const grips = (G, x, y) => y >= maxRow(G) || solid(G, x, y + 1) || solid(G, x - 1, y) || solid(G, x + 1, y) || !!G.ladder[y]?.[x];
const STEP_T = 1 / STATS.speed, CLIMB_T = 1 / STATS.climbSpeed, FALL_T = 1 / CFG.fallSpeed;
const mineTime = t => BLOCKS[t].hard / STATS.mineSpeed;

/* porteur de la couronne le plus proche de (x, y) dans son rayon, ou null (le gobelin qui naît là reste hostile) */
export function thrallOwner(G, x, y){
  let best = null, bd = Infinity;
  for(const m of G.miners){
    const r = m.carac?.goblinThrall || 0;
    if(r <= 0 || m.y <= 0) continue;
    const d = Math.hypot(m.x - x, m.y - y);
    if(d <= r + 1e-9 && d < bd){ bd = d; best = m; }
  }
  return best;
}

/* un gobelin qui vient de naître en (x, y) devient l'asservi de ce mineur */
export function enslave(G, id, x, y, owner){
  (G.thralls ??= []).push({ id, x, y, owner: owner.id, until: G.t + C.life, target: null, dig: null, cd: 0, skip: [] });
  G.stats.thralls = (G.stats.thralls || 0) + 1;
  log(G, `👑 Un gobelin s'incline devant ${owner.name} : il mine pour le groupe pendant ${C.life} s`);
}

/* minerai que ce mineur vise ou mine déjà (l'asservi lui laisse) */
const minerTakes = (G, x, y) => G.miners.some(m => (m.target && m.target.x === x && m.target.y === y)
  || (m.action?.type === 'mine' && m.action.data.x === x && m.action.data.y === y));
const taken = (G, o, x, y) => minerTakes(G, x, y) || G.thralls.some(t => t !== o && ((t.target && t.target.x === x && t.target.y === y) || (t.dig && t.dig.x === x && t.dig.y === y)));

/* le minerai le plus intéressant autour de lui : valeur pour son maître / (distance + temps de minage + 1) */
function pickTarget(G, o, owner){
  let best = null, bs = -Infinity;
  for(let y = Math.max(1, o.y - C.reach); y <= Math.min(maxRow(G), o.y + C.reach); y++)
    for(let x = Math.max(0, o.x - C.reach); x <= Math.min(W - 1, o.x + C.reach); x++){
      const d = Math.abs(x - o.x) + Math.abs(y - o.y), t = G.tiles[y][x];
      if(d > C.reach || !isOre(t) || !breakable(G, x, y) || taken(G, o, x, y) || o.skip.includes(y * W + x)) continue;
      const v = owner ? targetVal(owner, t) : BLOCKS[t].val;
      if(v === null) continue;                          // focus « seulement » : les autres minerais sont ignorés
      const s = v / (d + mineTime(t) + 1);
      if(s > bs){ bs = s; best = { x, y }; }
    }
  return best;
}

/* un bloc cassé par un asservi : il va au coffre commun (et à la part des gobelins) ; un minerai compte pour l'area */
function breakFor(G, x, y){
  const t = G.tiles[y][x];
  if(!t) return;
  G.tiles[y][x] = 0;
  if(G.seen[y]) G.seen[y][x] = true;
  updateLight(G);
  G.stats.thrallBlocks = (G.stats.thrallBlocks || 0) + 1;
  if(!BLOCKS[t].noDrop){
    const name = BLOCKS[t].name;
    G.chest[name] = (G.chest[name] || 0) + 1;
    G.goblinChest[name] = (G.goblinChest[name] || 0) + 1;
  }
  if(isOre(t)){ const k = areaOf(y); G.areas[k].oreMined++; oreRemoved(G, k, t); tryUnlock(G); }
}

/* un pas vers la cible : l'axe le plus long d'abord ; s'il est barré par un bloc incassable, l'autre axe */
function stepToward(G, o, tg){
  const dx = Math.sign(tg.x - o.x), dy = Math.sign(tg.y - o.y);
  const axes = Math.abs(tg.x - o.x) >= Math.abs(tg.y - o.y) ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
  for(const [sx, sy] of axes){
    if(!sx && !sy) continue;
    const nx = o.x + sx, ny = o.y + sy;
    if(nx < 0 || nx >= W || ny < 1 || ny > maxRow(G)) continue;
    if(!isAir(G, nx, ny)){
      if(!breakable(G, nx, ny)) continue;
      o.dig = { x: nx, y: ny, left: mineTime(G.tiles[ny][nx]) };   // il creuse son chemin
      return true;
    }
    if(sy < 0 && !grips(G, nx, ny)) continue;               // monter dans le vide : impossible
    o.x = nx; o.y = ny; o.cd = sy < 0 ? CLIMB_T : STEP_T;
    return true;
  }
  return false;
}

function updateThrall(G, o){
  if(!grips(G, o.x, o.y)){                                   // chute, case par case
    o.dig = null; o.cd -= DT;
    if(o.cd <= 1e-9){ o.y++; o.cd = FALL_T; }
    return;
  }
  if(o.dig){                                                 // il mine un bloc
    if(isAir(G, o.dig.x, o.dig.y)){ o.dig = null; return; }  // un mineur l'a cassé avant lui
    o.dig.left -= DT;
    if(o.dig.left > 1e-9) return;
    breakFor(G, o.dig.x, o.dig.y);
    if(o.target && o.target.x === o.dig.x && o.target.y === o.dig.y) o.target = null;
    o.dig = null;
    return;
  }
  if(o.cd > 1e-9){ o.cd -= DT; return; }                     // en plein pas
  const tg = o.target;
  if(!tg || !isOre(G.tiles[tg.y]?.[tg.x]) || minerTakes(G, tg.x, tg.y)) o.target = pickTarget(G, o, byId(G, o.owner));
  if(!o.target) return;                                      // rien à miner autour : il attend
  const d = Math.abs(o.target.x - o.x) + Math.abs(o.target.y - o.y);
  if(d <= 1){ o.dig = { x: o.target.x, y: o.target.y, left: mineTime(G.tiles[o.target.y][o.target.x]) }; return; }
  if(stepToward(G, o, o.target)) return;
  /* bloqué (incassable des deux côtés) : il abandonne ce minerai */
  o.skip.push(o.target.y * W + o.target.x); o.target = null;
}

/* à chaque tick : les asservis travaillent, ceux dont le temps est écoulé disparaissent */
export function updateThralls(G){
  if(!G.thralls?.length) return;
  for(const o of G.thralls) if(o.until > G.t + 1e-9) updateThrall(G, o);
  const gone = G.thralls.filter(o => o.until <= G.t + 1e-9);
  if(!gone.length) return;
  G.thralls = G.thralls.filter(o => o.until > G.t + 1e-9);
  for(const _ of gone) log(G, '👺 Un gobelin asservi a fini son travail et disparaît');
}
