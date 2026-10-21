/* Effets des actions du mineur sur le monde, et choix de l'action pour un pas dans une direction. */
import { W, STATS, CFG, BLOCKS, BRIDGE, MOBS, TREASURE, ITEMS, XP, SKILLS, SHINY, DUNGEON } from '../config.js';
import { areaOf, isOre, typeOf, treasureItem, isAir, tileAt, supported, tryUnlock, oreRemoved, oreKey, fallInfo, isWinch } from './world.js';
import { updateLight } from './light.js';
import { startAction, collect, mineT, moveT, climbT, buildT, winchT } from './mineur.js';
import { provoke, revealMimic } from './mobs.js';
import { log } from './log.js';
import { noEntry } from './dungeon.js';

/* XP de la session : pot commun (partagé à parts égales en fin de session) ; m.stats.xp = ce que ce mineur y a apporté */
function gainXp(G,m,n){ if(!n) return; G.stats.xp=(G.stats.xp||0)+n; m.stats.xp=(m.stats.xp||0)+n; }

/* skills Mineur après un minerai : +1 d'oxygène (ore_oxygen), bonus de marche pendant SKILLS.rushTime (ore_rush,
   remis à zéro à chaque minerai : ne se cumule pas) */
function oreSkills(G,m){
  if(m.skill.ore_oxygen) m.ox=Math.min(m.carac.oxygenMax, m.ox+m.skill.ore_oxygen);   // +1 d'oxygène par minerai
  if(m.skill.ore_rush) m.rushUntil=G.t+SKILLS.rushTime;
}
/* skill Barbare loot : butin d'un mob +loot (×), la part décimale tirée au hasard (G.rng : hasard « live ») */
function lootOf(G,m,n){
  const b=m.skill.loot; if(!b) return n;
  const v=n*(1+b), base=Math.floor(v);
  return base + (G.rng() < v-base ? 1 : 0);
}

function oreMinedIn(G,y,t){ const k=areaOf(y); G.areas[k].oreMined++; oreRemoved(G,k,t); tryUnlock(G); }

/* shiny : un minerai qui a une recette de four tombe parfois déjà cuit (SHINY) ; renvoie le shiny ou null */
export function shinyOf(G,t){
  const s=Object.hasOwn(SHINY.items, BLOCKS[t].name) ? SHINY.items[BLOCKS[t].name] : null;
  return s && G.shinyRng() < SHINY.chance ? s.item : null;
}

/* fortune : combien d'exemplaires EN PLUS d'un minerai miné (m.carac.fortune, en %) ; 0 le plus souvent
   (aussi utilisée par la mine instantanée, src/sim/instant/) */
export function fortuneExtra(G,m){
  const f=m.carac.fortune||0; if(f<=0) return 0;
  const sure=Math.floor(f/100);
  return sure + (G.fortuneRng()*100 < f-sure*100 ? 1 : 0);
}

export function mineBlock(G,m,x,y){
  const mim=G.mobs.find(o=>o.type==='mimic'&&o.hp>0&&o.x===x&&o.y===y);
  if(mim){ revealMimic(G,mim,'⚠ Un mimic se cachait dans la roche !'); return; }   // un mimic se combat, il ne se mine pas
  const t=G.tiles[y][x]; if(!t) return;
  G.tiles[y][x]=0; G.stats.mined++; m.stats.mined++; updateLight(G);
  const shiny=shinyOf(G,t);
  let got=null;
  if(shiny){
    got=shiny; collect(m, shiny, ITEMS[shiny].w, 1); G.stats.shiny++; m.stats.shiny=(m.stats.shiny||0)+1;
    log(G, `✨ ${m.name} trouve un ${shiny} !`);
  } else if(!BLOCKS[t].noDrop){ got=BLOCKS[t].name; collect(m, got, BLOCKS[t].w, 1); }
  if(got && isOre(t)){   // fortune : le minerai obtenu est dupliqué
    const extra=fortuneExtra(G,m);
    if(extra){ collect(m, got, ITEMS[got].w, extra); m.stats.fortune=(m.stats.fortune||0)+extra; }
  }
  if(isOre(t)){ m.stats.ore++; oreMinedIn(G,y,t); gainXp(G,m,XP.ore[oreKey(t)]); oreSkills(G,m); }
  if(typeOf(t)==='treasure') openTreasure(G,m,x,y);
}

/* treasure : un objet Treasure TX (tier selon l'area du treasure) va dans l'inventaire du mineur.
   Aucun minerai : rien ne compte pour le déblocage de l'area. */
function openTreasure(G,m,x,y){
  const tr=G.treasures.get(y*W+x), item=tr ? tr.item : treasureItem(areaOf(y));
  if(tr) tr.opened=true;
  collect(m, item, TREASURE.itemWeight, TREASURE.itemCount);
  G.stats.treasures++; m.stats.treasures++;
  log(G, `💰 ${m.name} ouvre un treasure : +${TREASURE.itemCount} ${item}`);
}

export function killMob(G,m,o){
  o.hp=0; G.stats.kills++; m.stats.kills++; gainXp(G,m,XP.mob[o.type]);
  if(o.type==='mimic'){
    G.tiles[o.y][o.x]=0; G.mimicCells.delete(o.y*W+o.x); updateLight(G); const b=BLOCKS[o.ore], n=lootOf(G,m,MOBS.mimicLoot);
    collect(m, b.name, b.w, n); oreMinedIn(G,o.y,o.ore);
    log(G, `🗡 ${m.name} : mimic vaincu (+${n} ${b.name})`);
  } else if(o.type==='gobelin'){
    const n=lootOf(G,m,MOBS.goblinLoot(G.rng)), c=lootOf(G,m,MOBS.goblinChitin);
    collect(m,MOBS.goblinItem,ITEMS[MOBS.goblinItem].w,n); collect(m,MOBS.bugItem,ITEMS[MOBS.bugItem].w,c);
    log(G, `🗡 ${m.name} : gobelin vaincu (+${n} peau de gobelin, +${c} chitine)`);
  } else if(o.dungeon!=null){
    /* boss de donjon : 1 à 3 Cristaux de pleine lune (Pillage compris) ; chaque joueur en recevra la quantité entière */
    const L=DUNGEON.loot, n=lootOf(G,m,L.min+Math.floor(G.rng()*(L.max-L.min+1)));
    collect(m,L.item,ITEMS[L.item].w ?? 1,n);
    log(G, `🗡 ${m.name} : ${DUNGEON.boss.name.toLowerCase()} vaincu ! (+${n} ${L.item})`);
  } else if(o.type==='occultiste'){
    const it=MOBS.occult.item, n=lootOf(G,m,MOBS.occult.loot(G.rng));
    collect(m,it,ITEMS[it].w ?? 1,n);
    log(G, `🗡 ${m.name} : occultiste vaincu (+${n} ${it.toLowerCase()})`);
  } else {
    const n=lootOf(G,m,MOBS.bugLoot(G.rng)); collect(m,MOBS.bugItem,1,n);
    log(G, `🗡 ${m.name} : bestiole vaincue (+${n} chitine)`);
  }
  G.mobs = G.mobs.filter(x=>x.hp>0);
}

export function finishAction(G,m,a){
  switch(a.type){
    case 'move':
      m.face = Math.sign(a.data.x-m.x)||m.face;
      m.x=a.data.x; m.y=a.data.y;
      if(m.y>G.stats.maxDepth) G.stats.maxDepth=m.y;
      if(m.y>m.stats.maxDepth) m.stats.maxDepth=m.y;
      { const ai=areaOf(m.y); if(ai>=0 && ai!==m.lastArea) m.lastArea=ai; }   // pas de ligne au journal (trop fréquent)
      break;
    case 'mine': mineBlock(G,m,a.data.x,a.data.y); break;
    case 'ladder':
      if(!isWinch(G,m.x,m.y)) G.ladder[m.y][m.x]=1;       // jamais d'échelle dans le puits du treuil
      // skill tall_ladder : une échelle de 2 de haut si la case du dessus est vide (pas dans le puits du treuil)
      if(m.skill.tall_ladder && m.y-1>=1 && G.tiles[m.y-1][m.x]===0 && !isWinch(G,m.x,m.y-1)) G.ladder[m.y-1][m.x]=1;
      break;
    case 'bridge': G.tiles[a.data.y][a.data.x]=BRIDGE; m.bridges--; updateLight(G); break;
    case 'torch': m.torches--; G.torches.push({x:m.x,y:m.y}); updateLight(G); break;
    case 'deposit': {
      const parts=[];
      for(const k in m.inv){
        G.chest[k]=(G.chest[k]||0)+m.inv[k];
        const mine=G.chestBy[m.id] || (G.chestBy[m.id]={}); mine[k]=(mine[k]||0)+m.inv[k];
        parts.push(m.inv[k]+' '+k);
      }
      log(G, `📦 ${m.name} dépose : ${parts.join(', ')}`); G.stats.trips++; m.stats.trips++;
      m.inv={}; m.load=0; break; }
    case 'stun': break;   // étourdi : il ne fait rien pendant toute l'action
    case 'attack': {
      const o=a.data.mob; if(o.hp>0){
        if(m.skill.taunt) provoke(G,o,m);   // provocation : il ne vise plus que ce mineur (tous les mobs)
        o.hp-=m.carac.damage; m.foeHit=G.t; if(o.hp<=0) killMob(G,m,o);
      } break; }
  }
}

/* chute que provoquerait un pas (dx,dy) : en marchant dans un trou, ou en creusant le bloc sous ses pieds.
   null si le pas ne fait pas tomber. */
export function stepFall(G,m,dx,dy){
  const nx=m.x+dx, ny=m.y+dy;
  if(dy===0 && isAir(G,nx,ny) && !supported(G,nx,ny)) return fallInfo(G,nx,ny);
  if(dx===0 && dy===1 && !isAir(G,nx,ny) && !G.ladder[m.y][m.x]){ const f=fallInfo(G,nx,ny); return {...f, n:f.n+1}; }
  return null;
}
/* le mineur ne se jette jamais en connaissance de cause dans un trou de plus de CFG.maxFall cases */
export const deepFall = (G,m,dx,dy) => { const f=stepFall(G,m,dx,dy); return !!f && f.known && f.n>CFG.maxFall; };

/* Un pas dans une direction : pose une passerelle, mine, pose une échelle ou se déplace, selon la case visée. */
export function stepDir(G,m,dx,dy,opt){
  const nx=m.x+dx, ny=m.y+dy;
  if(nx<0||nx>=W||ny<0) return false;
  if(noEntry(G,m,nx,ny)) return false;   // donjon où il n'a pas le droit d'entrer
  /* trou connu trop profond : par-dessus avec une passerelle s'il peut (même si on lui demandait de ne pas en poser),
     sinon il refuse le pas (celui qui l'a demandé choisit autre chose) */
  if(!(m.winchJob && dx===0) && deepFall(G,m,dx,dy)){   // en chantier de treuil, il creuse tout droit, trou ou pas
    if(dy===0 && m.bridges>0 && supported(G,m.x,m.y)){ startAction(m,'bridge', buildT(m,CFG.bridgeTime), {x:nx,y:ny+1}); return true; }
    return false;
  }
  // trou à traverser horizontalement : une passerelle (1 s) vaut mieux que tomber puis poser des échelles (2 s chacune)
  // règle : on ne pose une passerelle que s'il tient lui-même (sol ou échelle), jamais dans le vide
  if(dy===0 && m.bridges>0 && !(opt&&opt.noBridge) && supported(G,m.x,m.y) && isAir(G,nx,ny) && !supported(G,nx,ny)){
    startAction(m,'bridge', buildT(m,CFG.bridgeTime), {x:nx,y:ny+1}); return true;
  }
  if(!isAir(G,nx,ny)){
    const t=tileAt(G,nx,ny); if(!t||BLOCKS[t].unbreakable) return false;
    startAction(m,'mine', mineT(G,m,t), {x:nx,y:ny}); return true;
  }
  if(dy===-1 && m.y>0 && !G.ladder[m.y][m.x] && !isWinch(G,m.x,m.y)){ startAction(m,'ladder', buildT(m,CFG.ladderTime), {}); return true; }
  const seau = dy && (isWinch(G,m.x,m.y) || isWinch(G,nx,ny));   // dans le puits du treuil : le seau
  startAction(m,'move', seau ? winchT(G,m) : dy ? climbT(G,m) : moveT(G,m), {x:nx,y:ny,down:dy===1,fx:m.x,fy:m.y,winch:seau});
  return true;
}
