/* Effets des actions du mineur sur le monde, et choix de l'action pour un pas dans une direction. */
import { W, STATS, CFG, BLOCKS, BRIDGE, MOBS, TREASURE } from '../config.js';
import { areaOf, isOre, typeOf, isAir, tileAt, supported, tryUnlock } from './world.js';
import { updateLight } from './light.js';
import { startAction, collect, mineT, moveT, climbT } from './miner.js';
import { log } from './log.js';

function oreMinedIn(G,y){ G.areas[areaOf(y)].oreMined++; tryUnlock(G); }

export function mineBlock(G,m,x,y){
  const mim=G.mobs.find(o=>o.type==='mimic'&&o.hp>0&&o.x===x&&o.y===y);
  if(mim){ if(!mim.revealed){ mim.revealed=true; log(G,'⚠ Un mimic se cachait dans la roche !'); } return; }
  const t=G.tiles[y][x]; if(!t) return;
  G.tiles[y][x]=0; G.stats.mined++; m.stats.mined++; updateLight(G);
  if(!BLOCKS[t].noDrop) collect(m, BLOCKS[t].name, BLOCKS[t].w, 1);
  if(isOre(t)){ m.stats.ore++; oreMinedIn(G,y); }
  if(typeOf(t)==='treasure') openTreasure(G,m,x,y);
}

/* coffre au trésor : son butin va dans l'inventaire du mineur (minerais de l'area + objet Trésor).
   Les minerais du butin ne comptent pas pour le déblocage de l'area. */
function openTreasure(G,m,x,y){
  const tr=G.treasures.get(y*W+x), parts=[];
  if(tr){
    tr.opened=true;
    for(const id in tr.loot){ const b=BLOCKS[id]; collect(m, b.name, b.w, tr.loot[id]); parts.push(tr.loot[id]+' '+b.name); }
  }
  collect(m, TREASURE.item, TREASURE.itemWeight, TREASURE.itemCount);
  parts.push(TREASURE.itemCount+' '+TREASURE.item);
  G.stats.treasures++; m.stats.treasures++;
  log(G, `💰 ${m.name} ouvre un coffre au trésor : ${parts.join(', ')}`);
}

export function killMob(G,m,o){
  o.hp=0; G.stats.kills++; m.stats.kills++;
  if(o.type==='mimic'){
    G.tiles[o.y][o.x]=0; updateLight(G); const b=BLOCKS[o.ore];
    collect(m, b.name, b.w, MOBS.mimicLoot); oreMinedIn(G,o.y);
    log(G, `🗡 ${m.name} : mimic vaincu (+${MOBS.mimicLoot} ${b.name})`);
  } else {
    const n=MOBS.bugLoot(G.rng); collect(m,'Chitine',1,n);
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
      { const ai=areaOf(m.y); if(ai>=0 && ai!==m.lastArea){ m.lastArea=ai; log(G, `⬇ ${m.name} entre dans l'area ${ai}`); } }
      break;
    case 'mine': mineBlock(G,m,a.data.x,a.data.y); break;
    case 'ladder': G.ladder[m.y][m.x]=1; break;
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
    case 'attack': {
      const o=a.data.mob; if(o.hp>0){ o.hp-=STATS.damage; m.foeHit=G.t; if(o.hp<=0) killMob(G,m,o); } break; }
  }
}

/* Un pas dans une direction : pose une passerelle, mine, pose une échelle ou se déplace, selon la case visée. */
export function stepDir(G,m,dx,dy,opt){
  const nx=m.x+dx, ny=m.y+dy;
  if(nx<0||nx>=W||ny<0) return false;
  // trou à traverser horizontalement : une passerelle (1 s) vaut mieux que tomber puis poser des échelles (2 s chacune)
  // règle : on ne pose une passerelle que s'il tient lui-même (sol ou échelle), jamais dans le vide
  if(dy===0 && m.bridges>0 && !(opt&&opt.noBridge) && supported(G,m.x,m.y) && isAir(G,nx,ny) && !supported(G,nx,ny)){
    startAction(m,'bridge', CFG.bridgeTime, {x:nx,y:ny+1}); return true;
  }
  if(!isAir(G,nx,ny)){
    const t=tileAt(G,nx,ny); if(!t||BLOCKS[t].unbreakable) return false;
    startAction(m,'mine', mineT(G,m,t), {x:nx,y:ny}); return true;
  }
  if(dy===-1 && m.y>0 && !G.ladder[m.y][m.x]){ startAction(m,'ladder', CFG.ladderTime, {}); return true; }
  startAction(m,'move', dy? climbT(G,m) : moveT(G,m), {x:nx,y:ny,down:dy===1,fx:m.x,fy:m.y});
  return true;
}
