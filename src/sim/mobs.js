/* Mobs : bestioles (se déplacent, taclent) et mimics (immobiles, faux minerais, générés avec l'area). */
import { W, DT, CFG, MOBS } from '../config.js';
import { maxRow, isAir, supported } from './world.js';

const manhattan = (a,b) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

/* mineur poursuivi par une bestiole : le plus proche (à égalité, le premier de la liste) */
function preyOf(G,o){
  let best=null, bd=Infinity;
  for(const m of G.miners){ const d=manhattan(m,o); if(d<bd){ bd=d; best=m; } }
  return best;
}

/* bestioles : même physique que le mineur. Gravité (même règle d'appui), pas de saut,
   montée uniquement par une échelle, descente par l'échelle ou en se laissant tomber.
   Elles ne creusent pas et ne posent rien ; elles ne remontent pas jusqu'à la surface.
   Elles vont jusque SUR le mineur pour le tacler. */
export function updateMobs(G){
  for(const o of G.mobs){
    if(o.type!=='bestiole'||o.hp<=0) continue;
    if(!supported(G,o.x,o.y)){                      // chute, à la même vitesse que le mineur
      o.fall=(o.fall||0)+DT*CFG.fallSpeed;
      while(o.fall>=1 && !supported(G,o.x,o.y)){ o.y++; o.fall-=1; }
      if(supported(G,o.x,o.y)) o.fall=0;
      continue;
    }
    o.cd=(o.cd||0)-DT;
    if(o.cd>0) continue;
    const m=preyOf(G,o);
    const dx=Math.sign(m.x-o.x), dy=Math.sign(m.y-o.y), dist=manhattan(m,o);
    o.cd=CFG.mobStep;
    if(dist===0||dist>CFG.mobChaseRange) continue;
    if(dy<0 && o.y-1>=1 && G.ladder[o.y][o.x] && isAir(G,o.x,o.y-1)){ o.y--; o.cd=CFG.mobStep/CFG.climbFactor; }   // grimpe
    else if(dy>0 && isAir(G,o.x,o.y+1)){ o.y++; o.cd=CFG.mobStep/CFG.climbFactor; }   // descend l'échelle (sinon la gravité s'en charge)
    else if(dx && isAir(G,o.x+dx,o.y)) o.x+=dx;                                        // marche (et tombera s'il n'y a pas de sol)
  }
  spawnBugs(G);
}

/* Apparitions : hasard « live » (G.rng, séparé de la génération du monde). Autour des mineurs sous terre,
   chacun son tour, posées au sol dans une galerie à distance 5–10. */
function spawnBugs(G){
  G.spawnTimer-=DT;
  if(G.spawnTimer>0) return;
  const k=G.unlockedAreas-1;
  G.spawnTimer = MOBS.bugSpawnDelay(G.rng, k);
  const live=G.mobs.filter(o=>o.type==='bestiole'&&o.hp>0).length;
  const n=G.miners.length, m=G.miners[G.spawnTurn % n]; G.spawnTurn++;
  if(live>=MOBS.bugCap(k) || m.y<=0) return;
  const cand=[];
  for(let y=Math.max(1,m.y-MOBS.bugSpawnMax);y<=Math.min(maxRow(G),m.y+MOBS.bugSpawnMax);y++)
    for(let x=0;x<W;x++){ const d=Math.abs(x-m.x)+Math.abs(y-m.y); if(d>=MOBS.bugSpawnMin&&d<=MOBS.bugSpawnMax&&isAir(G,x,y)&&supported(G,x,y)) cand.push([x,y]); }
  if(!cand.length) return;
  const [x,y]=cand[Math.floor(G.rng()*cand.length)], hp=MOBS.bugHp(k);
  G.mobs.push({id:G.mobId++,type:'bestiole',x,y,hp,maxhp:hp,cd:1});
}
