/* Piège (TRAP en config) : une salle vide cachée dans la roche, pleine de mobs.
   Logique pure de la simulation : tirage, pose, intérieur caché, déclenchement.
   G.traps : [{ id, k, x0, y0, mobs:[{type, hp}], sprung, by }] en coordonnées de la mine : (x0, y0) = coin
   haut-gauche de la paroi. La salle fait TRAP.w × TRAP.h cases, la paroi une case d'épaisseur tout autour.
   G.veil : cases de l'intérieur des pièges pas encore déclenchés (y*W+x) ; la découverte du mineur les ignore. */
import { W, AREA_H, IDS, TRAP, MOBS, DUNGEON, WINCH, mobHp } from '../config.js';
import { mulberry32, hash } from '../core/rng.js';
import { log } from './log.js';
import { hasBarbarian } from './dungeon.js';

const OW = TRAP.w+2, OH = TRAP.h+2;   // paroi comprise

/* ---------- géométrie ---------- */
export const inTrapRoom = (t,x,y) => x>t.x0 && x<t.x0+OW-1 && y>t.y0 && y<t.y0+OH-1;
export const isTrapWall = (t,x,y) => x>=t.x0 && x<t.x0+OW && y>=t.y0 && y<t.y0+OH && !inTrapRoom(t,x,y);
/* case cachée : l'intérieur d'un piège pas encore déclenché */
export const veiled = (G,x,y) => !!G.veil?.size && G.veil.has(y*W+x);

/* types des mobs d'un piège dans l'area k : table d'apparition de l'area, sans mimic ni MOBS.noTrap (poids renormalisés) */
export function trapTable(k){
  const row = MOBS.spawnTable[Math.max(0, Math.min(MOBS.spawnTable.length-1, k))], out = {};
  for(const t in row) if(t!=='mimic' && !MOBS.noTrap.includes(t) && row[t]>0 && MOBS.minArea[t]<=k) out[t]=row[t];
  return out;
}
function pick(table, r){
  const types=Object.keys(table), sum=types.reduce((s,t)=>s+table[t],0);
  let x=r()*sum;
  for(const t of types){ x-=table[t]; if(x<0) return t; }
  return types[types.length-1];
}

/* mobs d'un piège de l'area k (même tirage que dans la mine) ; sert aussi à la dimension du k hole */
export const trapMobs = (k, r, n = TRAP.mobs) => { const table = trapTable(k); return Array.from({ length:n }, () => pick(table, r)); };
/* taille d'un piège, paroi comprise */
export const TRAP_BOX = { w:OW, h:OH };

/* deux rectangles (paroi comprise) se touchent-ils, à gap cases près ? */
const near = (a,b,gap) => a.x0 < b.x0+b.w+gap && b.x0 < a.x0+a.w+gap && a.ry0 < b.ry0+b.h+gap && b.ry0 < a.ry0+a.h+gap;

/* tirage des pièges de l'area k (hasard à part, tiré de la seed) : [{ x0, ry0, mobs:[type…] }] en lignes de l'area.
   dungeon : le donjon de l'area (planDungeon) ou null, pour ne pas le toucher. */
export function planTraps(seed, k, dungeon=null){
  if(k < TRAP.fromArea) return [];
  const r = mulberry32(hash(seed, k+1) ^ TRAP.salt), table = trapTable(k), out = [];
  const taken = dungeon ? [{ x0:dungeon.x0, ry0:dungeon.ry0, w:DUNGEON.size, h:DUNGEON.size }] : [];
  const lo = WINCH.x-TRAP.winchGap, hi = WINCH.x+TRAP.winchGap;
  for(let i=0; i<TRAP.tries; i++){
    if(!(r() < TRAP.chance)) continue;
    const mobs = Array.from({ length:TRAP.mobs }, () => pick(table, r));
    for(let a=0; a<TRAP.attempts; a++){
      const p = { x0: TRAP.margin + Math.floor(r()*(W - 2*TRAP.margin - OW + 1)),
                  ry0: TRAP.margin + Math.floor(r()*(AREA_H - 2*TRAP.margin - OH + 1)), w:OW, h:OH };
      if(!(p.x0+OW-1 < lo || p.x0 > hi) || taken.some(q => near(p,q,1))) continue;
      taken.push(p); out.push({ x0:p.x0, ry0:p.ry0, mobs });
      break;
    }
  }
  return out;
}

/* pose un piège : set(x, ry, id) écrit une case (ry = ligne locale), get(x, ry) la lit. L'intérieur est vidé ; une case
   vide de la paroi (poche d'air de l'area) est bouchée par le bloc de terrain filler, sinon on verrait dedans. */
export function carveTrap(p, get, set, filler){
  for(let ry=p.ry0; ry<p.ry0+OH; ry++) for(let x=p.x0; x<p.x0+OW; x++){
    const room = x>p.x0 && x<p.x0+OW-1 && ry>p.ry0 && ry<p.ry0+OH-1;
    if(room) set(x, ry, 0);
    else if(get(x, ry)===0) set(x, ry, filler);
  }
}

/* enregistre le piège (y0 = première ligne de la paroi, en coordonnées de la mine) et cache son intérieur */
export function registerTrap(G, k, p, y0){
  const t = { id:G.traps.length, k, x0:p.x0, y0, sprung:false, by:null,
              mobs: p.mobs.map(type => ({ type, hp: Math.round(mobHp(type, k)*TRAP.hpMul) })) };
  G.traps.push(t);
  G.veil ??= new Set();
  for(let y=y0+1; y<y0+OH-1; y++) for(let x=p.x0+1; x<p.x0+OW-1; x++) G.veil.add(y*W+x);
  return t;
}

/* pour les tests : pose un piège directement dans la mine (x0, y0 en coordonnées de la mine ; area k pour les PV) */
export function addTrap(G, { x0, y0, k=1, mobs=Array(TRAP.mobs).fill('bestiole') }){
  const p = { x0, ry0:0, mobs };
  carveTrap(p, (x, ry) => G.tiles[y0+ry][x], (x, ry, id) => { G.tiles[y0+ry][x]=id; }, IDS.stone);
  return registerTrap(G, k, p, y0);
}

/* ---------- à chaque tick : un bloc de paroi a disparu → le piège se déclenche ---------- */
export function updateTraps(G){
  for(const t of G.traps || []){
    if(t.sprung) continue;
    const hole = breach(G,t);
    if(hole) spring(G,t,hole);
  }
}
function breach(G,t){
  for(let y=t.y0; y<t.y0+OH; y++) for(let x=t.x0; x<t.x0+OW; x++)
    if(isTrapWall(t,x,y) && G.tiles[y]?.[x]===0) return { x, y };
  return null;
}

/* déclenchement : tout le piège se dévoile, ses mobs sortent (sur le sol de la salle) et chassent le mineur le plus
   proche du trou ; un barbare de la partie viendra (src/sim/ai.js, trapGoal) */
export function spring(G, t, hole){
  t.sprung = true;
  for(let y=t.y0; y<t.y0+OH; y++) for(let x=t.x0; x<t.x0+OW; x++){ G.seen[y][x]=1; G.veil.delete(y*W+x); }
  let by=null, bd=Infinity;
  for(const m of G.miners){ if(m.y<=0) continue; const d=Math.abs(m.x-hole.x)+Math.abs(m.y-hole.y); if(d<bd){ bd=d; by=m; } }
  t.by = by?.id ?? null;
  t.mobs.forEach((s, i) => {
    const o = { id:G.mobId++, type:s.type, x:t.x0+1+(i%TRAP.w), y:t.y0+TRAP.h-Math.floor(i/TRAP.w), hp:s.hp, maxhp:s.hp, cd:1,
                trap:t.id, hunt:t.by, speed:TRAP.speedMul };
    if(o.type==='occultiste') o.cast=MOBS.occult.cooldown;
    G.mobs.push(o);
  });
  G.stats.traps=(G.stats.traps||0)+1;
  if(by) by.stats.trapped=(by.stats.trapped||0)+1;
  log(G, `🪤 ${by ? by.name+' tombe sur un piège' : 'Un piège s\'ouvre'} : ${t.mobs.length} mobs en sortent !`
         + (hasBarbarian(G) ? ' Le barbare vient à la rescousse' : ''));
}
