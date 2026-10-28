/* Golem (MOBS.golem, 26/10/2026, Geoffrey) : un mob de 2 × 2 cases. (o.x, o.y) = sa case du bas à gauche ; il occupe
   les colonnes x et x+1, les lignes y−1 et y. Il casse les blocs qui le gênent (perdus pour tout le monde) : à sa
   naissance d'un coup, puis un bloc toutes les MOBS.golem.dig s pour rejoindre sa proie. Il descend en creusant sous
   lui, avance à l'horizontale, monte en escalier vers sa proie puis tout droit (cheminée) une fois dessous ; il ne prend
   pas les échelles. Il s'agrippe à la roche (standing) : il ne tombe que dans le vide (grande salle, puits). Ébranlement : voir quake. Logique pure, sans DOM ; le tacle, les coups et la poursuite sont ceux de tous
   les mobs (src/sim/mobs.js). */
import { W, DT, CFG, MOBS, BLOCKS, BRIDGE } from '../config.js';
import { maxRow, isAir, isOre, areaOf, oreRemoved } from './world.js';
import { updateLight } from './light.js';
import { dungeonAt } from './dungeon.js';
import { veiled } from './trap.js';
import { nearCell } from './knock.js';
import { log } from './log.js';

const C = MOBS.golem;
/* ses 4 cases quand sa case du bas à gauche est (x, y) */
export const cellsAt = (x, y) => [[x, y], [x + 1, y], [x, y - 1], [x + 1, y - 1]];
const inBox = (G, x, y) => x >= 0 && x + 1 < W && y - 1 >= 1 && y <= maxRow(G);
/* case vide où il peut se tenir (pas l'intérieur caché d'un piège, pas un donjon) */
const open = (G, x, y) => isAir(G, x, y) && !veiled(G, x, y) && !dungeonAt(G, x, y);

/* bloc qu'il peut casser : pas incassable, pas un treasure, pas une passerelle, pas un mimic, ni dans un donjon ou un
   piège encore caché */
export function breakable(G, x, y){
  if(x < 0 || x >= W || y < 1 || y > maxRow(G)) return false;
  const t = G.tiles[y][x];
  if(!t || BLOCKS[t].unbreakable || BLOCKS[t].type === 'treasure' || t === BRIDGE) return false;
  if(veiled(G, x, y) || dungeonAt(G, x, y)) return false;
  if(G.flesh?.has(y * W + x)) return false;   // recouvert par un mur de chair (src/sim/flesh.js)
  return !G.mobs.some(o => o.type === 'mimic' && o.hp > 0 && o.x === x && o.y === y);
}

/* un bloc cassé par le golem : il disparaît sans rien rapporter (un minerai quitte la roche de son area) */
function smash(G, x, y){
  const t = G.tiles[y][x];
  G.tiles[y][x] = 0;
  if(isOre(t)) oreRemoved(G, areaOf(y), t);
  G.stats.golemBlocks = (G.stats.golemBlocks || 0) + 1;
  updateLight(G);
}

/* il tient : un bloc sous une de ses deux colonnes, ou contre un de ses flancs (il s'agrippe à la roche ; le bord de la
   mine compte). Une échelle ne le porte pas. Sans ça, un corps de 2 de large qui creuse un escalier ne peut jamais
   faire demi-tour (la marche qui le porterait est toujours déjà creusée) : il glissait sur son escalier, remontait… */
const solid = (G, x, y) => !isAir(G, x, y);
export const standing = (G, x, y) => y >= maxRow(G) || solid(G, x, y + 1) || solid(G, x + 1, y + 1)
  || solid(G, x - 1, y) || solid(G, x - 1, y - 1) || solid(G, x + 2, y) || solid(G, x + 2, y - 1);
/* il ne pourra pas entrer ici (bord, bloc qu'il ne casse pas, case cachée ou de donjon) */
const blocked = (G, x, y) => !inBox(G, x, y) || cellsAt(x, y).some(([cx, cy]) => isAir(G, cx, cy) ? !open(G, cx, cy) : !breakable(G, cx, cy));

/* naissance : peut-il naître avec (x, y) pour case du bas à gauche ? (les blocs qui gênent seront cassés) */
export const fitsAt = (G, x, y) => !blocked(G, x, y) && standing(G, x, y);
/* le pose : casse d'un coup les blocs qui gênent */
export function clearAt(G, x, y){ for(const [cx, cy] of cellsAt(x, y)) if(!isAir(G, cx, cy)) smash(G, cx, cy); }

/* cases où le recul pourrait le pousser (il n'en subit pas : MOBS.golem.knockRes) */
export const golemCanEnter = G => (x, y) => inBox(G, x, y) && cellsAt(x, y).every(([cx, cy]) => open(G, cx, cy));

/* chute : sans sol sous lui, il tombe à la vitesse d'un mineur ; renvoie true pendant la chute */
export function golemFalls(G, o){
  if(standing(G, o.x, o.y)){ o.fall = 0; return false; }
  o.fall = (o.fall || 0) + DT * CFG.fallSpeed;
  while(o.fall >= 1 && !standing(G, o.x, o.y)){ o.y++; o.fall -= 1; }
  if(standing(G, o.x, o.y)) o.fall = 0;
  o.kx = 0; o.ky = 0;
  return true;
}

/* un pas vers le mineur m. Plus haut que lui : une marche en escalier vers lui, ou tout droit s'il est juste dessous ;
   sans appui (grande salle), il avance dans une direction gardée (o.stair) jusqu'à la roche, et ne fait demi-tour que
   contre un bord ou un bloc qu'il ne casse pas. À côté : à l'horizontale ; plus bas, une fois au-dessus : il creuse
   sous lui et descend. Chaque bloc sur le chemin est cassé, un toutes les MOBS.golem.dig s (o.dig) ; le pas lui-même
   attend sa cadence (o.cd, step s). Renvoie false s'il ne peut rien faire (bloqué). */
export function golemStep(G, o, m, step){
  const dx = m.x < o.x ? -1 : m.x > o.x + 1 ? 1 : 0, up = m.y < o.y - 1, down = m.y > o.y;
  let moves;
  if(up){
    o.stair ||= dx || (o.x + 2 < W ? 1 : -1);
    if(blocked(G, o.x + o.stair, o.y - 1) && blocked(G, o.x + o.stair, o.y)) o.stair = -o.stair;
    moves = dx ? [[dx, -1], [0, -1], [o.stair, -1], [o.stair, 0]] : [[0, -1], [o.stair, -1], [o.stair, 0]];
  } else {
    o.stair = 0;
    moves = dx ? [[dx, 0]] : down ? [[0, 1]] : [];
  }
  for(const [sx, sy] of moves){
    const nx = o.x + sx, ny = o.y + sy;
    if(blocked(G, nx, ny)) continue;
    if(up && !standing(G, nx, ny)) continue;        // en montant : jamais là où il retomberait
    const need = cellsAt(nx, ny).filter(([cx, cy]) => !isAir(G, cx, cy));
    if(need.length){
      if(o.dig > 1e-9) return true;
      smash(G, need[0][0], need[0][1]); o.dig = C.dig;
      return true;
    }
    if(o.cd > 1e-9) return true;
    o.x = nx; o.y = ny; o.kx = 0; o.ky = 0; o.cd = step;
    return true;
  }
  return false;
}

/* ébranlement : à chaque tranche de stunStep des PV max perdue (stuns fois au plus), les mineurs sous terre à
   stunRadius cases au plus de sa case la plus proche sont étourdis stunTime s (m.quakeUntil, lu par l'IA). resists(G, m) :
   la Ténacité du mineur l'ignore-t-elle ? */
export function quake(G, o, resists){
  const due = Math.min(C.stuns, Math.floor((1 - o.hp / o.maxhp) / C.stunStep + 1e-9));
  while((o.quakes || 0) < due){
    o.quakes = (o.quakes || 0) + 1;
    const hit = [];
    for(const m of G.miners){
      if(m.y <= 0) continue;
      const c = nearCell(o, m);
      if(Math.hypot(c.x - m.x, c.y - m.y) > C.stunRadius + 1e-9 || resists(G, m)) continue;
      m.quakeUntil = G.t + C.stunTime; hit.push(m.name);
      m.stats.quaked = (m.stats.quaked || 0) + 1; G.stats.quaked = (G.stats.quaked || 0) + 1;
    }
    log(G, `🗿 Le golem ébranle la mine${hit.length ? ` : ${hit.join(', ')} étourdi${hit.length > 1 ? 's' : ''} ${C.stunTime} s` : ''}`);
  }
}
