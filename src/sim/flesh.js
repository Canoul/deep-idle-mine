/* Mur de chair (MOBS.chair, 28/10/2026, Geoffrey) : un mob de 1 × h cases, une colonne ((o.x, o.y) = sa case du bas,
   o.h = h). Une masse de chair qui RECOUVRE la roche sans la casser : il naît dans la roche, à côté du mineur visé, et ne
   se déplace qu'à l'horizontale (ni gravité, ni montée), une colonne à la fois, vers le mineur le plus proche.
   Ses cases forment un MUR (G.flesh, refait à chaque tick) : world.isAir les compte comme pleines (on n'y entre pas, on y
   tient debout, la lumière ne passe pas), et aucun bloc qu'il recouvre ne peut être miné (fleshAt). Il faut le tuer.
   Passif : stacks de ralentissement de la vitesse d'attaque (fleshAura). Logique pure, sans DOM ; le tacle est celui de
   tous les mobs (src/sim/mobs.js). */
import { W, DT, MOBS } from '../config.js';
import { maxRow, isWinch } from './world.js';
import { updateLight } from './light.js';
import { dungeonAt } from './dungeon.js';
import { veiled } from './trap.js';
import { nearCell } from './knock.js';

const C = MOBS.chair;
export const isFlesh = o => o.type === 'chair';
/* ses cases quand sa case du bas est (x, y) */
export const fleshCellsAt = (x, y, h = C.h) => Array.from({ length: h }, (_, i) => [x, y - i]);

/* une case recouverte par un mur de chair vivant ? */
export const fleshAt = (G, x, y) => !!G.flesh?.size && G.flesh.has(y * W + x);

/* refait G.flesh à partir des murs vivants ; met la lumière à jour si le mur a bougé (il la bloque) */
export function syncFlesh(G){
  const next = new Set();
  for(const o of G.mobs) if(isFlesh(o) && o.hp > 0) for(const [x, y] of fleshCellsAt(o.x, o.y, o.h)) next.add(y * W + x);
  const prev = G.flesh;
  const same = prev ? prev.size === next.size && [...next].every(k => prev.has(k)) : !next.size;
  if(same) return;
  G.flesh = next;
  updateLight(G);
}

/* un mineur occupe-t-il cette case (ou est-il en train d'y entrer) ? */
const minerIn = (G, x, y) => G.miners.some(m => m.y > 0 && ((m.x === x && m.y === y)
  || (m.action?.type === 'move' && m.action.data.x === x && m.action.data.y === y)));
/* case où le mur peut s'étendre : dans la mine, ni donjon, ni piège caché, ni puits du treuil, sans mineur */
const canCover = (G, x, y) => x >= 0 && x < W && y >= 1 && y <= maxRow(G)
  && !dungeonAt(G, x, y) && !veiled(G, x, y) && !isWinch(G, x, y) && !minerIn(G, x, y);

/* naissance : sa case du bas {x, y}, à spawnDist cases à gauche ou à droite du mineur m, la ligne du mineur vers le milieu
   du mur (décalée si le mur sortirait de la mine), ou null. Tirage au hasard « live » (G.rng) parmi les places possibles. */
export function fleshSpot(G, m){
  const { min, max } = C.spawnDist, h = C.h, out = [];
  const y = Math.min(maxRow(G), Math.max(h, m.y + Math.floor((h - 1) / 2)));   // bas du mur : 2 lignes sous le mineur (h = 6)
  for(let d = min; d <= max; d++) for(const x of [m.x + d, m.x - d])
    if(fleshCellsAt(x, y, h).every(([cx, cy]) => canCover(G, cx, cy))) out.push({ x, y });
  return out.length ? out[Math.floor(G.rng() * out.length)] : null;
}

/* un pas vers le mineur m (à l'horizontale seulement) ; il ne va jamais sur la colonne du mineur s'il le touche (sinon
   il l'écraserait) : s'il est juste au-dessus / au-dessous de lui, il s'arrête. Il attend sa cadence (o.cd, step s).
   Renvoie true s'il a bougé. */
export function fleshStep(G, o, m, step){
  const dx = Math.sign(m.x - o.x);
  if(!dx || o.cd > 1e-9) return false;
  const nx = o.x + dx;
  if(!fleshCellsAt(nx, o.y, o.h).every(([cx, cy]) => canCover(G, cx, cy))) return false;
  o.x = nx; o.kx = 0; o.ky = 0; o.cd = step;
  return true;
}

/* Passif : toutes les C.every s (un compteur par mineur, plusieurs murs ne se cumulent pas), un mineur sous terre à
   C.radius cases au plus de la case la plus proche d'un mur prend un stack (C.maxStacks au plus) ; ils durent C.last s
   après le dernier reçu et tombent tous dès qu'il sort du rayon. resists(G, m) : la Ténacité ignore-t-elle ce stack ? */
export function fleshAura(G, resists){
  const walls = G.mobs.filter(o => isFlesh(o) && o.hp > 0);
  for(const m of G.miners){
    const near = m.y > 0 && walls.some(o => { const c = nearCell(o, m); return Math.hypot(c.x - m.x, c.y - m.y) <= C.radius + 1e-9; });
    if(!near || (m.fleshStacks && G.t > m.fleshUntil + 1e-9)){ m.fleshStacks = 0; m.fleshTick = 0; }
    if(!near) continue;
    m.fleshTick = (m.fleshTick || 0) + DT;
    if(m.fleshTick < C.every - 1e-9) continue;
    m.fleshTick -= C.every;
    if(resists(G, m)) continue;
    m.fleshStacks = Math.min(C.maxStacks, (m.fleshStacks || 0) + 1);
    m.fleshUntil = G.t + C.last;
    m.stats.fleshed = (m.stats.fleshed || 0) + 1; G.stats.fleshed = (G.stats.fleshed || 0) + 1;
  }
}

/* multiplicateur de vitesse d'attaque d'un mineur (1 sans stack, 0,1 à 9 stacks) */
export const fleshSlow = m => 1 - (m.fleshStacks || 0) * C.slow / 100;
