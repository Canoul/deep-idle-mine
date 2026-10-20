/* Mobs : bestioles et gobelins (se déplacent, taclent ; le gobelin vole des minerais)
   et mimics (immobiles, faux minerais, générés avec l'area). */
import { W, DT, CFG, MOBS, BLOCKS } from '../config.js';
import { maxRow, isAir, supported, areaOf } from './world.js';
import { log } from './log.js';

/* mobs qui marchent et taclent (même physique que le mineur) */
export const WALKERS = new Set(['bestiole', 'gobelin']);
export const isWalker = o => WALKERS.has(o.type);

/* ce que vole un gobelin : les minerais de la mine (blocs de type ore, charbon compris), avec leur poids */
const ORE_W = new Map(Object.values(BLOCKS).filter(b=>b.type==='ore').map(b=>[b.name, b.w]));

const manhattan = (a,b) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

/* provocation (skill Barbare « taunt ») : un mob frappé par un barbare ne vise plus que lui, jusqu'à sa mort (ou au
   départ du barbare). o.taunt = id du mineur. */
export const tauntedBy = (G,o) => o.taunt==null ? null : G.miners.find(m=>m.id===o.taunt) ?? null;
/* ce mob peut-il tacler ce mineur ? (pas s'il est provoqué par un autre) */
export const canTackle = (G,o,m) => { const t=tauntedBy(G,o); return !t || t===m; };

/* mineur poursuivi par une bestiole : celui qui l'a provoquée, sinon le plus proche (à égalité, le premier de la liste) */
function preyOf(G,o){
  const t=tauntedBy(G,o); if(t) return t;
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
    if(!isWalker(o)||o.hp<=0) continue;
    if(!supported(G,o.x,o.y)){                      // chute, à la même vitesse que le mineur
      o.fall=(o.fall||0)+DT*CFG.fallSpeed;
      while(o.fall>=1 && !supported(G,o.x,o.y)){ o.y++; o.fall-=1; }
      if(supported(G,o.x,o.y)) o.fall=0;
      continue;
    }
    if(o.type==='gobelin') goblinSteal(G,o);
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

/* vol du gobelin : tant qu'il est sur la case d'un mineur (tacle), un minerai toutes les goblinStealEvery
   secondes, tiré au hasard parmi les minerais portés (chaque unité a la même chance). Le minerai est perdu.
   Le compteur repart de zéro quand il ne tacle plus personne. */
function goblinSteal(G,o){
  const m=G.miners.find(m=>m.x===o.x && m.y===o.y && canTackle(G,o,m));
  if(!m){ o.steal=0; return; }
  o.steal=(o.steal||0)+DT;
  if(o.steal < MOBS.goblinStealEvery-1e-9) return;
  o.steal-=MOBS.goblinStealEvery;
  const ores=Object.keys(m.inv).filter(k=>ORE_W.has(k) && m.inv[k]>0);
  const total=ores.reduce((s,k)=>s+m.inv[k],0);
  if(!total) return;
  let r=Math.floor(G.rng()*total), name=ores[0];
  for(const k of ores){ if(r<m.inv[k]){ name=k; break; } r-=m.inv[k]; }
  m.inv[name]--; m.load-=ORE_W.get(name);
  if(!m.inv[name]) delete m.inv[name];
  G.stats.stolen++; m.stats.stolen++;
  log(G, `👺 Un gobelin vole 1 ${name} à ${m.name}`);
}

/* Apparitions : hasard « live » (G.rng, séparé de la génération du monde). Autour des mineurs sous terre,
   chacun son tour, posées au sol dans une galerie à distance 5–10. Jamais dans une poche de vide encore
   cachée (non découverte) : une bestiole y serait coincée derrière la roche.
   Dans les areas >= goblinMinArea, une partie des apparitions sont des gobelins (même plafond). */
function spawnBugs(G){
  G.spawnTimer-=DT;
  if(G.spawnTimer>0) return;
  const k=G.unlockedAreas-1;
  G.spawnTimer = MOBS.bugSpawnDelay(G.rng, k);
  const live=G.mobs.filter(o=>isWalker(o)&&o.hp>0).length;
  const n=G.miners.length, m=G.miners[G.spawnTurn % n]; G.spawnTurn++;
  if(live>=MOBS.bugCap(k) || m.y<=0) return;
  const cand=[];
  for(let y=Math.max(1,m.y-MOBS.bugSpawnMax);y<=Math.min(maxRow(G),m.y+MOBS.bugSpawnMax);y++)
    for(let x=0;x<W;x++){ const d=Math.abs(x-m.x)+Math.abs(y-m.y); if(d>=MOBS.bugSpawnMin&&d<=MOBS.bugSpawnMax&&isAir(G,x,y)&&G.seen[y][x]&&supported(G,x,y)) cand.push([x,y]); }
  if(!cand.length) return;
  const [x,y]=cand[Math.floor(G.rng()*cand.length)];
  // tirage du gobelin seulement dans ses areas : les parties qui n'y arrivent pas restent inchangées
  const goblin = areaOf(y)>=MOBS.goblinMinArea && G.rng()<MOBS.goblinChance;
  const hp = goblin ? MOBS.goblinHp(k) : MOBS.bugHp(k);
  G.mobs.push({id:G.mobId++,type:goblin?'gobelin':'bestiole',x,y,hp,maxhp:hp,cd:1});
}
