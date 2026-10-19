/* Le monde : grille de blocs, génération déterministe des areas, gravité, déblocage. */
import { W, AREA_H, AREA_Y0, CFG, BLOCKS, BARRIER, IDS, AREAS, MOBS, GEN } from '../config.js';
import { mulberry32, hash, shuffle } from '../core/rng.js';
import { log } from './log.js';

export const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];

/* catégories de blocs (voir BLOCK_TYPES dans config) ; 0 = case vide, sans catégorie */
export const typeOf = t => t ? BLOCKS[t].type : null;
export const isOre  = t => typeOf(t)==='ore';

export const areaDef  = k => AREAS[Math.min(k, AREAS.length-1)];
export const areaComp = k => areaDef(k).comp;
export const areaOf   = y => y < AREA_Y0 ? -1 : Math.floor((y-AREA_Y0)/AREA_H);
export const areaTop  = k => AREA_Y0 + k*AREA_H;   // première couche de l'area k

export const maxRow = G => G.tiles.length-1;
/* sous la dernière area débloquée, tout est barrière (l'IA l'ignore comme case non franchissable) */
export const tileAt = (G,x,y) => y>maxRow(G) ? BARRIER : G.tiles[y][x];
export const isAir  = (G,x,y) => y>=0 && y<G.tiles.length && x>=0 && x<W && G.tiles[y][x]===0;
/* gravité : sol sous la case (x,y) ? Non s'il y a du vide dessous sans échelle (ni sur la case, ni juste dessous) */
export const supported = (G,x,y) =>
  !(y+1<=maxRow(G) && isAir(G,x,y+1) && !G.ladder[y+1][x] && !(y>0 && G.ladder[y][x]));
/* case où l'on finit en tombant depuis (x,y) ; n = nombre de cases de chute */
export function landing(G,x,y){ let n=0; while(!supported(G,x,y)){ y++; n++; } return {y,n}; }
export const rowDone = (G,y) => { for(let x=0;x<W;x++) if(!isAir(G,x,y)) return false; return true; };

/* filons / poches : `count` cases de `id` en groupes d'un seul tenant de 1 à `maxSize` cases, sur des cases libres */
const FREE = 255;   // case pas encore attribuée pendant la génération (0 = air est une vraie valeur)
function placeClusters(grid, r, id, count, maxSize, out){
  const N = grid.length; let rem = count;
  while(rem>0){
    let c; do{ c=Math.floor(r()*N); }while(grid[c]!==FREE);
    const size = Math.min(rem, 1+Math.floor(r()*maxSize));
    const cells=[c]; grid[c]=id; let g=0;
    while(cells.length<size && g++<30){
      const b=cells[Math.floor(r()*cells.length)], bx=b%W, by=(b/W)|0, d=DIRS[Math.floor(r()*4)];
      const nx=bx+d[0], ny=by+d[1];
      if(nx<0||nx>=W||ny<0||ny>=AREA_H) continue;
      const ni=ny*W+nx; if(grid[ni]!==FREE) continue;
      grid[ni]=id; cells.push(ni);
    }
    if(out) cells.forEach(ci=>out.push(ci));
    rem -= cells.length;
  }
}

/* Génère l'area k uniquement depuis seed + k (déterministe). Comptes exacts :
   minerais en filons, vide en poches, puis le reste (terrain) mélangé. */
export function genArea(G,k){
  const r = mulberry32(hash(G.seed, k+1));
  const comp = areaComp(k), N = W*AREA_H;
  const counts = {}; let sum = 0;
  for(const n in comp){ counts[n]=Math.round(comp[n]*N/100); sum+=counts[n]; }
  // l'arrondi est absorbé par le terrain le plus présent
  const big = Object.keys(counts).filter(n=>typeOf(IDS[n])==='terrain').sort((a,b)=>counts[b]-counts[a])[0];
  counts[big] += N - sum;
  const grid = new Uint8Array(N).fill(FREE);
  let oreTotal = 0; const oreCells = [];
  for(const n in counts){
    const id = IDS[n]; if(!isOre(id)) continue;
    oreTotal += counts[n];
    placeClusters(grid, r, id, counts[n], GEN.veinMax, oreCells);
  }
  if(counts.air) placeClusters(grid, r, IDS.air, counts.air, GEN.airPocketMax);
  const filler=[];
  for(const n in counts) if(typeOf(IDS[n])==='terrain') for(let i=0;i<counts[n];i++) filler.push(IDS[n]);
  shuffle(filler, r); let fi=0;
  for(let i=0;i<N;i++) if(grid[i]===FREE) grid[i]=filler[fi++];
  for(let ry=0; ry<AREA_H; ry++){
    G.tiles.push(grid.slice(ry*W,(ry+1)*W));
    G.ladder.push(new Uint8Array(W));
    G.seen.push(new Uint8Array(W));
  }
  // mimics : de faux minerais (même tirage que la génération, donc déterministes)
  shuffle(oreCells, r);
  const nMim = Math.min(MOBS.mimicCount(k), oreCells.length);
  for(let i=0;i<nMim;i++){
    const c=oreCells[i], x=c%W, ry=(c/W)|0, y=areaTop(k)+ry, hp=MOBS.mimicHp(k);
    G.mobs.push({id:G.mobId++, type:'mimic', x, y, hp, maxhp:hp, revealed:false, ore:grid[c]});
  }
  G.areas[k] = {k, comp, counts, oreTotal, oreMined:0};
}

export const unlockNeed = a => Math.ceil(CFG.unlockRatio*a.oreTotal);

/* Débloque l'area suivante si le seuil de minerais de la dernière area est atteint. Renvoie true si débloquée. */
export function tryUnlock(G){
  const k = G.unlockedAreas-1, a = G.areas[k];
  if(a.oreMined < unlockNeed(a)) return false;
  genArea(G, G.unlockedAreas); G.unlockedAreas++;
  for(const m of G.miners){ m.exploring=false; m.skipRows.clear(); }
  log(G, `🔓 Area ${k+1} débloquée !`);
  return true;
}
