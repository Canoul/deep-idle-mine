/* Le monde : grille de blocs, génération déterministe des areas, gravité, déblocage. */
import { W, AREA_H, AREA_Y0, CFG, BLOCKS, BARRIER, IDS, AREAS, GEN, TREASURE, TREASURE_BLOCK, WINCH, JUDGMENT, GLYPHS, DUNGEON, TRAP, PRISON, CHEST_X } from '../config.js';
import { pickShare } from '../meta/prison-profile.js';
import { mulberry32, hash, shuffle } from '../core/rng.js';
import { log } from './log.js';
import { planDungeon, carve, registerDungeon } from './dungeon.js';
import { planTraps, carveTrap, registerTrap } from './trap.js';
import { placeKhole, registerKhole } from './khole.js';
import { oreBonusComp } from '../meta/shrines.js';

export const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];

/* catégories de blocs (voir BLOCK_TYPES dans config) ; 0 = case vide, sans catégorie */
export const typeOf = t => t ? BLOCKS[t].type : null;
export const isOre  = t => typeOf(t)==='ore';
export const isResidue = t => !!t && BLOCKS[t].family==='residu';
/* ce que l'IA peut viser une fois découvert : minerais, treasures et résidus (Jugement) */
export const isTarget = t => isOre(t) || typeOf(t)==='treasure' || isResidue(t);
/* objet rapporté par un treasure de l'area k (Treasure T1, T2…) ; le dernier tier couvre les areas au-delà */
export const treasureItem = k => (TREASURE.tiers.find(t => k <= t.maxArea) || TREASURE.tiers.at(-1)).item;
/* chance d'un treasure dans l'area k (contenu ck) : moitié moins en prison (PRISON.treasureMul) */
const chestChanceOf = (G, ck) => (areaDef(ck).chestChance || 0) * (G.prison ? PRISON.treasureMul : 1);

export const areaDef  = k => AREAS[Math.min(k, AREAS.length-1)];
export const areaComp = k => areaDef(k).comp;
export const areaOf   = y => y < AREA_Y0 ? -1 : Math.floor((y-AREA_Y0)/AREA_H);
export const areaTop  = k => AREA_Y0 + k*AREA_H;   // première couche de l'area k

/* Prison (PRISON, src/sim/prison.js) : l'area k a le CONTENU (composition, mobs, treasures, donjon, pièges, résidus) de
   l'area max du joueur, G.prison.areaMax ; dans la mine, le contenu de l'area k est celui de l'area k. L'index d'area
   (G.areas[k], déblocage, navigation de l'IA) reste areaOf. */
export const contentOf = (G, k) => G.prison && k >= 0 ? G.prison.areaMax : k;   // k < 0 : couches au-dessus des areas
export const contentAt = (G, y) => contentOf(G, areaOf(y));
/* colonnes de la prison : { x0, w } (PRISON.width colonnes centrées sur le coffre), ou null hors prison */
export const prisonBox = G => G.prison ? { x0: CHEST_X - Math.floor(PRISON.width/2), w: PRISON.width } : null;
/* composition de la prison : chaque minerai × oreMul, la différence prise sur TOUS les blocs de terrain de la composition
   (pierre, terre et pierre dure), chacun dans sa proportion (décision du 29/10) ; somme inchangée (100). Plafonnée au
   terrain disponible. Pure. */
export function prisonComp(comp, oreMul){
  if(oreMul === 1) return { ...comp };
  const kind = n => BLOCKS[IDS[n]]?.type ?? null;
  const ores = Object.keys(comp).filter(n => kind(n) === 'ore'), land = Object.keys(comp).filter(n => kind(n) === 'terrain');
  const S = ores.reduce((s, n) => s + comp[n], 0), T = land.reduce((s, n) => s + comp[n], 0);
  if(!(S > 0) || !(T > 0)) return { ...comp };
  const p = Math.max(-S, Math.min(T, S * (oreMul - 1))), out = { ...comp };
  for(const n of ores) out[n] = comp[n] + comp[n] / S * p;
  for(const n of land) out[n] = comp[n] - comp[n] / T * p;
  return out;
}

/* composition de la prison avec le profil du joueur (29/10/2026) : la part totale de minerais reste celle de prisonComp,
   répartie selon ses minerais des 10 dernières mines (profile.ores) ; sans profil de minerais : inchangée. Pure. */
export function profileComp(comp, ores){
  if(!ores) return comp;
  const kind = n => BLOCKS[IDS[n]]?.type ?? null, out = {};
  let S = 0;
  for(const [n, v] of Object.entries(comp)){ if(kind(n) === 'ore') S += v; else out[n] = v; }
  if(!(S > 0)) return comp;
  for(const [n, part] of Object.entries(ores)) out[n] = (out[n] || 0) + S * part;
  return out;
}

export const maxRow = G => G.tiles.length-1;
/* sous la dernière area débloquée, tout est barrière (l'IA l'ignore comme case non franchissable) */
export const tileAt = (G,x,y) => y>maxRow(G) ? BARRIER : G.tiles[y][x];
/* une case recouverte par un mur de chair (G.flesh, src/sim/flesh.js) n'est pas vide : on n'y entre pas, on y tient */
export const isAir  = (G,x,y) => y>=0 && y<G.tiles.length && x>=0 && x<W && G.tiles[y][x]===0 && !(G.flesh && G.flesh.size && G.flesh.has(y*W+x));
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
function placeClusters(grid, r, id, count, maxSize, out, w=W, h=AREA_H){
  const N = grid.length; let rem = count;
  while(rem>0){
    let c; do{ c=Math.floor(r()*N); }while(grid[c]!==FREE);
    const size = Math.min(rem, 1+Math.floor(r()*maxSize));
    const cells=[c]; grid[c]=id; let g=0;
    while(cells.length<size && g++<30){
      const b=cells[Math.floor(r()*cells.length)], bx=b%w, by=(b/w)|0, d=DIRS[Math.floor(r()*4)];
      const nx=bx+d[0], ny=by+d[1];
      if(nx<0||nx>=w||ny<0||ny>=h) continue;
      const ni=ny*w+nx; if(grid[ni]!==FREE) continue;
      grid[ni]=id; cells.push(ni);
    }
    if(out) cells.forEach(ci=>out.push(ci));
    rem -= cells.length;
  }
}

/* Remplit une grille w × h (par défaut une area : W × AREA_H) selon une composition en % (comptes exacts) : minerais en
   filons, vide en poches, puis le reste (terrain) mélangé. Renvoie { grid, counts, big (terrain le plus présent),
   oreTotal }. Sert aux areas et à la dimension du k hole (src/sim/khole.js). */
export function fillComp(r, comp, w=W, h=AREA_H){
  const N = w*h;
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
    placeClusters(grid, r, id, counts[n], GEN.veinMax, oreCells, w, h);
  }
  if(counts.air) placeClusters(grid, r, IDS.air, counts.air, GEN.airPocketMax, null, w, h);
  const filler=[];
  for(const n in counts) if(typeOf(IDS[n])==='terrain') for(let i=0;i<counts[n];i++) filler.push(IDS[n]);
  shuffle(filler, r); let fi=0;
  for(let i=0;i<N;i++) if(grid[i]===FREE) grid[i]=filler[fi++];
  return { grid, counts, big, oreTotal };
}

/* Génère l'area k uniquement depuis seed + k (déterministe), comptes exacts (fillComp), puis donjon, pièges, treasure,
   résidus et k hole par-dessus. */
export function genArea(G,k){
  const r = mulberry32(hash(G.seed, k+1));
  /* prison : contenu de l'area max (contentOf), part de minerais × PRISON.oreMul ; remplie sur box.w colonnes, les
     autres colonnes sont des barreaux (hors des comptes de l'area) */
  const ck = contentOf(G, k), box = prisonBox(G);
  const base = G.prison ? profileComp(prisonComp(areaComp(ck), PRISON.oreMul), G.prison.profile?.ores) : areaComp(ck);
  /* Shrine d'abondance (28/10/2026) : G.oreBonus points de terrain changés en minerais, dans chaque area de la session */
  const comp = G.oreBonus > 0 ? oreBonusComp(base, G.oreBonus) : base;
  const filled = fillComp(r, comp, box ? box.w : W), { counts, big } = filled;
  let { grid, oreTotal } = filled;
  if(box){
    const g = new Uint8Array(W*AREA_H).fill(PRISON.bars);
    for(let ry=0; ry<AREA_H; ry++) g.set(grid.subarray(ry*box.w, (ry+1)*box.w), ry*W + box.x0);
    grid = g;
  }
  /* donjon (DUNGEON) et pièges (TRAP) : tirages à part, posés par-dessus ; les comptes de l'area suivent les blocs
     remplacés (un mur de donjon n'y entre pas) */
  const put = (x, ry, id) => { const i=ry*W+x, old=grid[i]; if(old===id) return;
    const key=oreKey(old); if(key && counts[key]) counts[key]--;
    if(id===0) counts.air=(counts.air||0)+1; else if(oreKey(id) in counts) counts[oreKey(id)]++;
    grid[i]=id; };
  /* prison : donjon et pièges entre les barreaux ; le donjon plus près du treuil (PRISON.dungeonWinchGap), chance × rareMul */
  const dp = planDungeon(G.seed, ck, box && { ...box, winchGap:PRISON.dungeonWinchGap, chanceMul:PRISON.rareMul }),
        traps = planTraps(G.seed, ck, dp, box && { ...box, chanceMul:PRISON.trapMul });   // prison : 2 fois moins de pièges
  if(dp) carve(dp, put);
  for(const p of traps) carveTrap(p, (x, ry) => grid[ry*W+x], put, IDS[big]);
  if(dp || traps.length) oreTotal = Object.keys(counts).filter(n=>isOre(IDS[n])).reduce((s,n)=>s+counts[n],0);
  const treasure = placeTreasure(G, k, grid, counts, r);
  if(!G.noResidues) placeResidues(G.seed, ck, grid, counts, box ? box.w*AREA_H : grid.length);   // pas de résidus si une tour était ouverte au lancement (23/10)
  /* k hole (KHOLE) : tirage à part, posé en dernier, hors du donjon et des pièges */
  const kh = placeKhole(G.seed, k, grid, counts, [...(dp ? [{ x0:dp.x0, ry0:dp.ry0, w:DUNGEON.size, h:DUNGEON.size }] : []),
    ...traps.map(p => ({ x0:p.x0, ry0:p.ry0, w:TRAP.w+2, h:TRAP.h+2 }))], G.prison ? PRISON.kholeMul : 1);   // prison : 2 fois moins (29/10)
  for(let ry=0; ry<AREA_H; ry++){
    G.tiles.push(grid.slice(ry*W,(ry+1)*W));
    G.ladder.push(new Uint8Array(W));
    G.seen.push(new Uint8Array(W));
  }
  if(dp) registerDungeon(G, k, dp, areaTop(k)+dp.ry0);
  for(const p of traps) registerTrap(G, ck, p, areaTop(k)+p.ry0);   // PV des mobs : ceux du contenu
  if(kh) registerKhole(G, k, kh);
  // les mimics ne sont plus placés ici : ils naissent pendant la partie (un minerai de la roche devient un mimic, src/sim/mobs.js)
  /* ores : pour chaque minerai de l'area, le nombre initial et ce qu'il en reste dans la roche (focus minerai) */
  const ores = {};
  for(const n in counts) if(isOre(IDS[n])) ores[n] = { total:counts[n], left:counts[n] };
  G.areas[k] = {k, comp, counts, oreTotal, oreMined:0, ores, chestChance:chestChanceOf(G, ck), treasure};
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
  const ck = contentOf(G, k);
  if(!(r() < chestChanceOf(G, ck))) return null;
  const spots=[]; for(let i=0;i<grid.length;i++) if(typeOf(grid[i])==='terrain') spots.push(i);
  if(!spots.length) return null;
  const c=spots[Math.floor(r()*spots.length)], name=Object.keys(IDS).find(n=>IDS[n]===grid[c]);
  counts[name]--; counts.treasure=1; grid[c]=TREASURE_BLOCK;
  /* prison (29/10) : tier tiré selon les Treasure TX des 10 dernières mines du joueur (profile.treasures) */
  const tiers = G.prison?.profile?.treasures, item = tiers ? pickShare(tiers, r()) : treasureItem(ck);
  const t={k, x:c%W, y:areaTop(k)+((c/W)|0), item, opened:false};
  G.treasures.set(t.y*W+t.x, t);
  return t;
}

/* Résidus angélique et démoniaque (JUDGMENT) : à partir de l'area fromArea, pct % des cases de l'area au total (les
   deux ensemble), à la place de pierre normale (jamais un minerai, un treasure, un mur de donjon ni une case vide). Tirage à part (seed +
   salt + area) et posé en dernier : le reste de l'area ne change pas. Comptes exacts (comme les minerais). */
export function placeResidues(seed, k, grid, counts, cells = grid.length){
  if(k < JUDGMENT.fromArea) return;
  /* cells : cases de l'area (prison : celles entre les barreaux) */
  const r = mulberry32(hash(seed ^ JUDGMENT.salt, k+1)), n = Math.round(cells*JUDGMENT.pct/100);
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
  if(G.khole || G.prison) return false;   // k hole : ce n'est pas la mine ; prison : une seule area, rien à débloquer
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
