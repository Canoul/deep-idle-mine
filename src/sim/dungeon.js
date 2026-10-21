/* Donjon (DUNGEON en config) : un carré de briques incassables, une entrée, un boss (minotaure) dedans.
   Logique pure de la simulation : génération, qui peut entrer, déclencheur (découverte), effroi.
   G.dungeons : [{ id, k, x0, y0, hx, hy, side, boss, found, barbIn, cleared }] en coordonnées de la mine :
   (x0, y0) = coin haut-gauche du carré, (hx, hy) = l'entrée (une case vide dans le mur), boss = id du mob. */
import { W, AREA_H, CHEST_X, DUNGEON, DUNGEON_WALL, WINCH } from '../config.js';
import { mulberry32, hash } from '../core/rng.js';
import { log } from './log.js';

const S = DUNGEON.size;

/* ---------- géométrie ---------- */
export const interior = (d,x,y) => x>d.x0 && x<d.x0+S-1 && y>d.y0 && y<d.y0+S-1;
export const isHole   = (d,x,y) => x===d.hx && y===d.hy;
/* case du donjon où l'on peut se tenir : l'intérieur ou l'entrée */
export const inRoom   = (d,x,y) => interior(d,x,y) || isHole(d,x,y);
export const isIn     = (d,m) => inRoom(d,m.x,m.y);
/* case du carré (murs compris) */
export const inSquare = (d,x,y) => x>=d.x0 && x<d.x0+S && y>=d.y0 && y<d.y0+S;
/* donjon dont (x,y) est l'intérieur ou l'entrée, ou null */
export const dungeonAt = (G,x,y) => G.dungeons?.length ? G.dungeons.find(d => inRoom(d,x,y)) ?? null : null;
/* case devant l'entrée, dehors */
export const front = d => ({ x: d.side==='L' ? d.hx-1 : d.hx+1, y: d.hy });

/* colonnes de départ x0 possibles : à margin cases des bords, sans toucher la colonne du treuil ± winchGap */
export function startColumns(){
  const out=[], lo=WINCH.x-DUNGEON.winchGap, hi=WINCH.x+DUNGEON.winchGap;
  for(let x0=DUNGEON.margin; x0+S-1<=W-1-DUNGEON.margin; x0++) if(x0+S-1<lo || x0>hi) out.push(x0);
  return out;
}

/* tirage du donjon de l'area k (hasard à part, tiré de la seed) : { x0, ry0, side, hry } en lignes de l'area, ou null */
export function planDungeon(seed, k){
  if(!DUNGEON.areas.includes(k)) return null;
  const r = mulberry32(hash(seed, k+1) ^ DUNGEON.salt);
  if(!(r() < DUNGEON.chance)) return null;
  const xs = startColumns();
  const x0 = xs[Math.floor(r()*xs.length)];
  const ry0 = DUNGEON.margin + Math.floor(r()*(AREA_H - 2*DUNGEON.margin - S + 1));
  const side = r()<0.5 ? 'L' : 'R';
  const hry = ry0 + S - 2 - Math.floor(r()*DUNGEON.holeRows);   // une des holeRows lignes du bas de l'intérieur
  return { x0, ry0, side, hry };
}

/* pose le carré : set(x, ry, id) écrit une case (ry = ligne locale) ; renvoie les cases écrites */
export function carve(p, set){
  const hx = p.side==='L' ? p.x0 : p.x0+S-1;
  for(let ry=p.ry0; ry<p.ry0+S; ry++) for(let x=p.x0; x<p.x0+S; x++){
    const wall = x===p.x0 || x===p.x0+S-1 || ry===p.ry0 || ry===p.ry0+S-1;
    set(x, ry, wall && !(x===hx && ry===p.hry) ? DUNGEON_WALL : 0);
  }
  return hx;
}

/* enregistre le donjon et son boss (coordonnées de la mine : y0 = première ligne du carré) */
export function registerDungeon(G, k, p, y0){
  const hx = p.side==='L' ? p.x0 : p.x0+S-1, B = DUNGEON.boss;
  const boss = { id:G.mobId++, type:B.type, x:p.x0+Math.floor(S/2), y:y0+S-2, hp:B.hp, maxhp:B.hp, cd:1 };
  const d = { id:G.dungeons.length, k, x0:p.x0, y0, hx, hy:y0+(p.hry-p.ry0), side:p.side, boss:boss.id,
              found:false, barbIn:false, cleared:false };
  boss.dungeon = d.id;
  G.mobs.push(boss); G.dungeons.push(d);
  return d;
}

/* pour les tests : pose un donjon directement dans la mine (x0, y0 en coordonnées de la mine) */
export function addDungeon(G, { x0, y0, side='L', hy=y0+S-2 }){
  const p = { x0, ry0:0, side, hry:hy-y0 };
  carve(p, (x, ry, id) => { G.tiles[y0+ry][x]=id; });
  return registerDungeon(G, -1, p, y0);
}

/* ---------- qui peut entrer ---------- */
export const bossOf = (G,d) => G.mobs.find(o => o.id===d.boss && o.hp>0) ?? null;
export const isBarbarian = m => m.skillTree==='barbare';
export const hasBarbarian = G => G.miners.some(isBarbarian);
/* un donjon « actif » : découvert, boss vivant. Avant sa découverte, personne ne sait qu'il est là. */
export const active = (G,d) => d.found && !d.cleared && !!bossOf(G,d);
/* ce mineur peut-il entrer ? barbare : toujours ; les autres : après le barbare, sauf « Fuir » ; sans barbare : non */
export function mayEnter(G,m,d){
  if(!active(G,d)) return true;
  if(!hasBarbarian(G)) return false;
  if(isBarbarian(m)) return true;
  return d.barbIn && m.prefs.fightMobs!=='flee';
}
/* la case (x,y) est-elle interdite à ce mineur ? (pas s'il est déjà dedans : il doit pouvoir en sortir) */
export function noEntry(G,m,x,y){
  const d = dungeonAt(G,x,y);
  return !!d && !isIn(d,m) && !mayEnter(G,m,d);
}
/* masque des cases interdites à ce mineur (null s'il n'y en a aucune) : pour les recherches d'itinéraire */
export function forbidMask(G,m){
  let mask=null;
  for(const d of G.dungeons || []){
    if(isIn(d,m) || mayEnter(G,m,d)) continue;
    mask ??= new Uint8Array(G.tiles.length*W);
    for(let y=d.y0; y<d.y0+S; y++) for(let x=d.x0; x<d.x0+S; x++) if(inRoom(d,x,y)) mask[y*W+x]=1;
  }
  return mask;
}

/* ---------- à chaque tick : découverte, barbare entré, effroi, boss vaincu ---------- */
export function updateDungeons(G){
  for(const d of G.dungeons || []){
    if(d.cleared) continue;
    const boss = bossOf(G,d);
    if(!boss){ d.cleared=true; if(d.found) log(G, `🏆 Le ${DUNGEON.boss.name.toLowerCase()} est vaincu : le donjon est libre`); continue; }
    if(!d.found && seen(G,d)){
      d.found=true;
      log(G, hasBarbarian(G) ? '🏰 Un donjon est découvert ! Tout le monde se rassemble devant l\'entrée, le barbare entrera le premier'
                             : '🏰 Un donjon est découvert ! Sans barbare, personne n\'y entre');
    }
    if(!d.barbIn && G.miners.some(m => isBarbarian(m) && interior(d,m.x,m.y))){
      d.barbIn=true;
      const b=G.miners.find(m => isBarbarian(m) && interior(d,m.x,m.y));
      log(G, `⚔ ${b.name} entre dans le donjon`);
    }
    for(const m of G.miners){
      const inside = interior(d,m.x,m.y);
      /* sans barbare : se retrouver dans le donjon effraie (une fois par entrée) */
      if(inside && !hasBarbarian(G) && m.scaredIn!==d.id){
        m.scaredIn=d.id; m.scaredUntil=G.t+DUNGEON.scaredTime;
        log(G, `😱 ${m.name} se retrouve dans le donjon : effrayé ${DUNGEON.scaredTime} s`);
      }
      if(!isIn(d,m) && m.scaredIn===d.id) m.scaredIn=null;
      /* effrayé et attaqué par le boss : il s'enfuit d'un coup à la surface (il garde ce qu'il porte) */
      if(m.scaredUntil>G.t && boss.grab===m.id) flee(G,m,boss);
    }
  }
}
const seen = (G,d) => { for(let y=d.y0; y<d.y0+S; y++) for(let x=d.x0; x<d.x0+S; x++) if(G.seen[y]?.[x]) return true; return false; };

function flee(G,m,boss){
  boss.grab=null;
  m.x=CHEST_X; m.y=0; m.action=null; m.fall=null; m.foe=null; m.target=null; m.exploring=false;
  m.mode='surface'; m.scaredUntil=0; m.scaredIn=null;
  m.stats.fled=(m.stats.fled||0)+1;
  log(G, `💨 ${m.name}, effrayé, s'enfuit à la surface !`);
}
