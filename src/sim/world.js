/* Le monde : grille de blocs, génération déterministe des areas, gravité, déblocage. */
import { W, AREA_H, AREA_Y0, CFG, BLOCKS, BARRIER, IDS, AREAS, GEN, TREASURE, TREASURE_BLOCK, WINCH, JUDGMENT, GLYPHS } from '../config.js';
import { mulberry32, hash, shuffle } from '../core/rng.js';
import { log } from './log.js';
import { planDungeon, carve, registerDungeon } from './dungeon.js';
import { planTraps, carveTrap, registerTrap } from './trap.js';

export const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];

/* catégories de blocs (voir BLOCK_TYPES dans config) ; 0 = case vide, sans catégorie */
export const typeOf = t => t ? BLOCKS[t].type : null;
export const isOre  = t => typeOf(t)==='ore';
export const isResidue = t => !!t && BLOCKS[t].family==='residu';
/* ce que l'IA peut viser une fois découvert : minerais, treasures et résidus (Jugement) */
export const isTarget = t => isOre(t) || typeOf(t)==='treasure' || isResidue(t);
/* objet rapporté par un treasure de l'area k (Treasure T1, T2…) ; le dernier tier couvre les areas au-delà */
export const treasureItem = k => (TREASURE.tiers.find(t => k <= t.maxArea) || TREASURE.tiers.at(-1)).item;

export const areaDef  = k => AREAS[Math.min(k, AREAS.length-1)];
export const areaComp = k => areaDef(k).comp;
export const areaOf   = y => y < AREA_Y0 ? -1 : Math.floor((y-AREA_Y0)/AREA_H);
export const areaTop  = k => AREA_Y0 + k*AREA_H;   // première couche de l'area k

export const maxRow = G => G.tiles.length-1;
/* sous la dernière area débloquée, tout est barrière (l'IA l'ignore comme case non franchissable) */
export const tileAt = (G,x,y) => y>maxRow(G) ? BARRIER : G.tiles[y][x];
export const isAir  = (G,x,y) => y>=0 && y<G.tiles.length && x>=0 && x<W && G.tiles[y][x]===0;
/* treuil : G.winch = { x, bottom } une fois posé (colonne x, lignes 1 à bottom), sinon null */
export const isWinch = (G,x,y) => !!G.winch && x===G.winch.x && y>=1 && y<=G.winch.bottom;
/* gravité : sol sous la case (x,y) ? Non s'il y a du vide dessous sans échelle (ni sur la case, ni juste dessous) ;
   le puits du treuil tient comme une échelle (le seau) */
export const supported = (G,x,y) =>
  !(y+1<=maxRow(G) && isAir(G,x,y+1) && !G.ladder[y+1][x] && !isWinch(G,x,y+1) && !(y>0 && (G.ladder[y][x] || isWinch(G,x,y))));
/* case où l'on finit en tombant depuis (x,y) ; n = nombre de cases de chute */
export function landing(G,x,y){ let n=0; while(!supported(G,x,y)){ y++; n++; } return {y,n}; }
/* chute qui finit sur une échelle (l'appui d'arrivée est une échelle) : elle se fait à la vitesse de l'échelle, pas à
   celle d'une chute (22/10, Geoffrey : l'IA sortait du treuil ou d'une échelle pour se laisser tomber à côté, plus vite) */
export const ontoLadder = (G,x,ly) => !!G.ladder[ly+1]?.[x];
/* chute depuis (x,y) : landing + known = le mineur connaît ce trou (toutes les cases traversées et le sol d'arrivée
   sont découvertes). Une chute dans du vide pas encore découvert est une chute imprévue. */
export function fallInfo(G,x,y){
  const l=landing(G,x,y);
  let known=true;
  for(let yy=y+1; yy<=Math.min(l.y+1, maxRow(G)); yy++) if(!G.seen[yy][x]){ known=false; break; }
  return {...l, known};
}
/* ligne finie : plus rien à creuser (les blocs incassables, ex. murs de donjon, ne comptent pas) */
export const rowDone = (G,y) => { const row=G.tiles[y]; if(!row) return false; for(let x=0;x<W;x++) if(row[x]!==0 && !BLOCKS[row[x]]?.unbreakable) return false; return true; };

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
  /* donjon (DUNGEON) et pièges (TRAP) : tirages à part, posés par-dessus ; les comptes de l'area suivent les blocs
     remplacés (un mur de donjon n'y entre pas) */
  const put = (x, ry, id) => { const i=ry*W+x, old=grid[i]; if(old===id) return;
    const key=oreKey(old); if(key && counts[key]) counts[key]--;
    if(id===0) counts.air=(counts.air||0)+1; else if(oreKey(id) in counts) counts[oreKey(id)]++;
    grid[i]=id; };
  const dp = planDungeon(G.seed, k), traps = planTraps(G.seed, k, dp);
  if(dp) carve(dp, put);
  for(const p of traps) carveTrap(p, (x, ry) => grid[ry*W+x], put, IDS[big]);
  if(dp || traps.length) oreTotal = Object.keys(counts).filter(n=>isOre(IDS[n])).reduce((s,n)=>s+counts[n],0);
  const treasure = placeTreasure(G, k, grid, counts, r);
  if(!G.noResidues) placeResidues(G.seed, k, grid, counts);   // pas de résidus si une tour était ouverte au lancement (23/10)
  for(let ry=0; ry<AREA_H; ry++){
    G.tiles.push(grid.slice(ry*W,(ry+1)*W));
    G.ladder.push(new Uint8Array(W));
    G.seen.push(new Uint8Array(W));
  }
  if(dp) registerDungeon(G, k, dp, areaTop(k)+dp.ry0);
  for(const p of traps) registerTrap(G, k, p, areaTop(k)+p.ry0);
  // les mimics ne sont plus placés ici : ils naissent pendant la partie (un minerai de la roche devient un mimic, src/sim/mobs.js)
  /* ores : pour chaque minerai de l'area, le nombre initial et ce qu'il en reste dans la roche (focus minerai) */
  const ores = {};
  for(const n in counts) if(isOre(IDS[n])) ores[n] = { total:counts[n], left:counts[n] };
  G.areas[k] = {k, comp, counts, oreTotal, oreMined:0, ores, chestChance:areaDef(k).chestChance||0, treasure};
}

/* clé de composition d'un bloc (IDS) : 3 → 'coal' */
export const oreKey = t => Object.keys(IDS).find(n => IDS[n]===t);

/* un bloc de minerai t vient de quitter la roche de l'area k (miné, ou mimic vaincu) */
export function oreRemoved(G,k,t){
  const o = G.areas[k]?.ores[oreKey(t)];
  if(o && o.left>0) o.left--;
}

/* Treasure : un tirage par area (chestChance) ; s'il sort, le treasure remplace un bloc de terrain au hasard.
   Son butin (Treasure TX) dépend du tier de l'area : même seed → même coffre, même butin. */
function placeTreasure(G, k, grid, counts, r){
  if(!(r() < (areaDef(k).chestChance||0))) return null;
  const spots=[]; for(let i=0;i<grid.length;i++) if(typeOf(grid[i])==='terrain') spots.push(i);
  if(!spots.length) return null;
  const c=spots[Math.floor(r()*spots.length)], name=Object.keys(IDS).find(n=>IDS[n]===grid[c]);
  counts[name]--; counts.treasure=1; grid[c]=TREASURE_BLOCK;
  const t={k, x:c%W, y:areaTop(k)+((c/W)|0), item:treasureItem(k), opened:false};
  G.treasures.set(t.y*W+t.x, t);
  return t;
}

/* Résidus angélique et démoniaque (JUDGMENT) : à partir de l'area fromArea, pct % des cases de l'area au total (les
   deux ensemble), à la place de pierre normale (jamais un minerai, un treasure, un mur de donjon ni une case vide). Tirage à part (seed +
   salt + area) et posé en dernier : le reste de l'area ne change pas. Comptes exacts (comme les minerais). */
export function placeResidues(seed, k, grid, counts){
  if(k < JUDGMENT.fromArea) return;
  const r = mulberry32(hash(seed ^ JUDGMENT.salt, k+1)), n = Math.round(grid.length*JUDGMENT.pct/100);
  /* 23/10 (Geoffrey) : pct = les deux résidus ensemble (avant : pct de chaque, soit le double), pris dans la pierre
     normale seulement (avant : n'importe quel terrain). Moitié chacun ; s'il en reste un (nombre impair), son camp est
     tiré au sort (même seed, même camp). */
  const sides = Object.values(JUDGMENT.sides), half = Math.floor(n/2);
  const want = sides.map(() => half);
  if(n - 2*half) want[r() < 0.5 ? 0 : 1]++;
  const spots = [];
  for(let i=0;i<grid.length;i++) if(grid[i]===IDS.stone) spots.push(i);
  shuffle(spots, r);
  let si = 0;
  sides.forEach((d, i) => {
    const key = oreKey(d.block);
    for(let j=0; j<want[i] && si<spots.length; j++){
      const c = spots[si++];
      counts.stone--; counts[key] = (counts[key]||0) + 1; grid[c] = d.block;
    }
  });
}

export const unlockNeed = a => Math.ceil(CFG.unlockRatio*a.oreTotal);

/* Débloque l'area suivante si le seuil de minerais de la dernière area est atteint. Renvoie true si débloquée. */
export function tryUnlock(G){
  const k = G.unlockedAreas-1, a = G.areas[k];
  if(a.oreMined < unlockNeed(a)) return false;
  genArea(G, G.unlockedAreas); G.unlockedAreas++;
  for(const m of G.miners){ m.exploring=false; m.skipRows.clear(); }
  log(G, `🔓 Area ${k+1} débloquée !`);
  /* treuil (skill Logisticien) : un logisticien qui a le skill (le premier) va le prolonger jusqu'au haut de la nouvelle
     area ; de préférence le porteur du sac (Mule), sinon le premier qui a Mule, sinon le premier qui a le Treuil */
  /* Glyphe Treuil : son porteur passe avant tout le monde et pose un ascenseur, un déblocage sur GLYPHS.liftEvery
     (1er, 3e, 5e… : k = 0, 2, 4…) ; aux autres déblocages, personne ne part creuser */
  const lift=G.miners.find(m=>m.skill?.winch && m.skill?.glyph_winch);
  if(lift){
    if(k % GLYPHS.liftEvery !== 0) return true;
    lift.winchJob={ bottom:Math.max(lift.winchJob?.bottom ?? 0, areaTop(k+1)), lift:true };
    log(G, `🛗 ${lift.name} part installer l'ascenseur jusqu'à l'area ${k+1}`);
    return true;
  }
  const lg=G.miners.find(m=>m.skill?.winch && G.mule?.carrier===m.id) ?? G.miners.find(m=>m.skill?.winch && m.skill?.mule) ?? G.miners.find(m=>m.skill?.winch);
  if(lg){ lg.winchJob={ bottom:Math.max(lg.winchJob?.bottom ?? 0, areaTop(k+1)) }; log(G, `🪣 ${lg.name} part installer le treuil jusqu'à l'area ${k+1}`); }
  return true;
}
