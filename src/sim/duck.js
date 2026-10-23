/* Gallianix (DUCK, GAME_DESIGN §5) : canard de la surface. Un canard naît à chaque area débloquée pendant la session,
   près du coffre ; il se promène à la surface (ligne 0) à DUCK.range cases au plus du coffre, sans jamais tomber dans
   la mine : un trou (pas de sol sous la case) se saute s'il fait au plus DUCK.jump cases de large, sinon demi-tour.
   Si les mineurs creusent sous lui, il s'envole jusqu'au sol le plus proche (il ne reste jamais en l'air).
   Il ne tacle pas et ne chasse personne. Son hasard est à part (G.duckRng) : il ne décale pas le reste de la partie. */
import { W, DT, CHEST_X, DUCK } from '../config.js';
import { mulberry32 } from '../core/rng.js';
import { log } from './log.js';

const rngOf = G => (G.duckRng ??= mulberry32(G.seed ^ DUCK.salt));
/* sol sous la case (x, 0) de la surface : la couche 1 est pleine, ou une échelle y monte */
const ground = (G, x) => x >= 0 && x < W && (G.tiles[1]?.[x] > 0 || !!G.ladder[1]?.[x]);
const inRange = x => Math.abs(x - CHEST_X) <= DUCK.range;
/* nom du n-ième canard de la session (0 = le premier) : la liste dans l'ordre, puis on recommence */
export const duckName = n => DUCK.names[((n % DUCK.names.length) + DUCK.names.length) % DUCK.names.length];

/* un canard par area débloquée depuis le lancement (G.duckBase = areas ouvertes au lancement) */
export function spawnDucks(G){
  G.duckBase ??= G.unlockedAreas;
  G.ducks ??= 0;
  while(G.ducks < G.unlockedAreas - G.duckBase){
    const r = rngOf(G), spots = [];
    for(let x = CHEST_X - DUCK.range; x <= CHEST_X + DUCK.range; x++) if(x !== CHEST_X && ground(G, x)) spots.push(x);
    const x = spots.length ? spots[Math.floor(r() * spots.length)] : CHEST_X;
    const name = duckName(G.ducks++);
    G.mobs.push({ id:G.mobId++, type:DUCK.type, name, x, y:0, hp:DUCK.hp, maxhp:DUCK.hp, cd:DUCK.step, dir: r() < 0.5 ? -1 : 1 });
    log(G, `🦆 Un Gallianix apparaît près du coffre : ${name}`);
  }
}

/* un pas : il continue dans sa direction (parfois il s'arrête ou se retourne) ; saute un trou s'il peut */
export function updateDuck(G, o){
  o.grab = null; o.chase = null; o.hop = false;
  o.cd = (o.cd ?? 0) - DT;
  if(o.cd > 0) return;
  const r = rngOf(G);
  o.cd = DUCK.step;
  /* plus de sol sous lui (les mineurs ont creusé la couche du dessous) : il s'envole vers la case avec du sol la plus
     proche, dans sa zone de préférence (sinon il resterait en l'air au-dessus d'un trou trop large) */
  if(!ground(G, o.x)){ const to = nearestGround(G, o.x); if(to != null){ o.hop = true; o.dir = Math.sign(to - o.x) || o.dir; o.x = to; } return; }
  if(r() < DUCK.pause) return;
  if(r() < 0.25) o.dir = -o.dir;
  for(const dir of [o.dir, -o.dir]){
    const to = landing(G, o.x, dir);
    if(to == null) continue;
    o.hop = Math.abs(to - o.x) > 1; o.x = to; o.dir = dir;
    return;
  }
}
/* case avec du sol la plus proche de x (dans la zone du coffre d'abord, sinon n'importe où à la surface) ; null si aucune */
function nearestGround(G, x){
  let best = null;
  for(const inZone of [true, false]){
    for(let nx = 0; nx < W; nx++) if(ground(G, nx) && (!inZone || inRange(nx)) && (best == null || Math.abs(nx - x) < Math.abs(best - x))) best = nx;
    if(best != null) return best;
  }
  return null;
}
/* case où il arrive en allant vers dir : la voisine si elle a du sol, sinon la première case avec du sol après un trou
   d'au plus DUCK.jump cases ; null s'il ne peut pas (bord, trou trop large, trop loin du coffre) */
function landing(G, x, dir){
  for(let k = 1; k <= DUCK.jump + 1; k++){
    const nx = x + dir * k;
    if(nx < 0 || nx >= W || !inRange(nx)) return null;
    if(ground(G, nx)) return nx;
  }
  return null;
}
