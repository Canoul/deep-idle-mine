/* Mobs (GAME_DESIGN §4) : bestioles, gobelins et occultistes (se déplacent), mimics (immobiles, faux minerais).
   Tous les mobs TACLENT : à 1 case ou moins (Manhattan) du mineur qu'ils visent, ils l'immobilisent (un seul mineur
   par mob) jusqu'à leur mort. Le gobelin vole des minerais ; l'occultiste se téléporte et étourdit sa cible. */
import { W, DT, CFG, MOBS, BLOCKS, mobHp } from '../config.js';
import { maxRow, isAir, isOre, supported, areaOf } from './world.js';
import { log } from './log.js';
import { dungeonAt, inRoom, interior } from './dungeon.js';

/* mobs qui marchent (même physique que le mineur) */
export const WALKERS = new Set(['bestiole', 'gobelin', 'occultiste']);
export const isWalker = o => WALKERS.has(o.type);
export const MOB_TYPES = Object.keys(MOBS.hpBase);

/* ce que vole un gobelin : les minerais de la mine (blocs de type ore, charbon compris), avec leur poids */
const ORE_W = new Map(Object.values(BLOCKS).filter(b=>b.type==='ore').map(b=>[b.name, b.w]));

const manhattan = (a,b) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const byId = (G,id) => id==null ? null : G.miners.find(m=>m.id===id) ?? null;

/* provocation (skill Barbare « taunt ») : un mob frappé par un barbare ne vise plus que lui, jusqu'à sa mort (ou au
   départ du barbare). o.taunt = id du mineur. Chaque coup d'un barbare provocateur interrompt la canalisation en cours
   d'un occultiste ; l'occultiste peut ensuite en relancer une (sur le barbare, sa seule cible) : 21/10, Geoffrey. */
export const tauntedBy = (G,o) => byId(G, o.taunt);
/* ce mob peut-il tacler ce mineur ? (pas s'il est provoqué par un autre) */
export const canTackle = (G,o,m) => { const t=tauntedBy(G,o); return !t || t===m; };
export function provoke(G,o,m){
  if(o.channel){ endChannel(G,o); log(G, `😤 ${m.name} interrompt la canalisation de l'occultiste`); }
  o.taunt=m.id;
}

/* ténacité : le mineur ignore-t-il ce sort ? un tirage par sort (hasard « live ») ; sans ténacité, aucun tirage
   (les parties sans ténacité gardent exactement le même hasard) */
export function resists(G,m){
  const t=m.carac?.tenacity || 0;
  if(t<=0 || !(G.rng()*100 < t)) return false;
  m.stats.resisted=(m.stats.resisted||0)+1; G.stats.resisted=(G.stats.resisted||0)+1;
  return true;
}

/* tacle : le mob qui immobilise ce mineur (o.grab = id du mineur), ou null */
export const tackler = (G,m) => G.mobs.find(o=>o.hp>0 && o.grab===m.id) || null;
/* occultiste qui canalise sur ce mineur (il est étourdi tant que dure la canalisation), ou null */
export const channeler = (G,m) => G.mobs.find(o=>o.hp>0 && o.channel && o.channel.target===m.id) || null;

/* mimic dévoilé : sa case n'est plus un minerai pour l'IA (ni cible, ni bloc à creuser) */
export function revealMimic(G,o,msg){
  if(o.revealed) return;
  o.revealed=true; G.mimicCells.add(o.y*W+o.x);
  log(G, msg || '⚠ Un mimic se dévoile !');
}

/* mineur visé par un mob : celui qui l'a provoqué, sinon le plus proche sous terre (à égalité, le premier de la liste) */
function preyOf(G,o){
  const t=tauntedBy(G,o); if(t) return t;
  let best=null, bd=Infinity;
  for(const m of G.miners){ if(m.y<=0) continue; const d=manhattan(m,o); if(d<bd){ bd=d; best=m; } }
  return best;
}

/* tacle d'un mob : il garde son mineur tant qu'il est à côté ; sinon il prend sa cible si elle est à 1 case ou moins */
function updateGrab(G,o){
  if(o.channel || (o.type==='mimic' && !o.revealed)){ o.grab=null; return; }
  const held=byId(G,o.grab);
  if(held && held.y>0 && manhattan(held,o)<=1 && canTackle(G,o,held)) return;
  const p=preyOf(G,o);
  o.grab = p && manhattan(p,o)<=1 && canTackle(G,o,p) ? p.id : null;
}

/* mineur que ce mob a pris en chasse (état « combat » de la session, que suivent les mineurs qui aident leurs alliés) */
function chaseOf(G,o){
  if(o.channel) return o.channel.target;
  if(o.grab!=null) return o.grab;
  if(!isWalker(o)) return null;
  const p=preyOf(G,o);
  return p && manhattan(p,o)<=CFG.mobChaseRange ? p.id : null;
}

/* ---- boss de donjon (minotaure) : enfermé dans sa salle, il ne vise que les mineurs qui y sont (intérieur ou entrée),
   marche vers eux sans jamais sortir et les tacle à 1 case. Rien d'autre. */
function updateBoss(G,o){
  const d=G.dungeons.find(x=>x.id===o.dungeon);
  const inside=m => m.y>0 && d && inRoom(d,m.x,m.y);
  const prey=()=>{ const t=tauntedBy(G,o); if(t && inside(t)) return t;
    let best=null, bd=Infinity; for(const m of G.miners){ if(!inside(m)) continue; const k=manhattan(m,o); if(k<bd){ bd=k; best=m; } } return best; };
  const held=byId(G,o.grab);
  if(!(held && inside(held) && manhattan(held,o)<=1 && canTackle(G,o,held))){
    const p=prey(); o.grab = p && manhattan(p,o)<=1 && canTackle(G,o,p) ? p.id : null;
  }
  const p=prey(); o.chase = o.grab ?? p?.id ?? null;
  o.cd=(o.cd||0)-DT;
  if(o.cd>0 || o.grab!=null || !p) return;
  o.cd=CFG.mobStep;
  const dx=Math.sign(p.x-o.x);
  if(dx && interior(d,o.x+dx,o.y) && isAir(G,o.x+dx,o.y)) o.x+=dx;   // il marche sur le sol de sa salle, sans en sortir
}

export function updateMobs(G){
  for(const o of G.mobs){
    if(o.hp<=0) continue;
    if(o.dungeon!=null){ updateBoss(G,o); continue; }
    if(o.type==='mimic'){
      if(!o.revealed && G.miners.some(m=>m.y>0 && Math.hypot(o.x-m.x,o.y-m.y)<=MOBS.mimicRevealDist)) revealMimic(G,o);
      updateGrab(G,o); o.chase=chaseOf(G,o); continue;
    }
    if(!supported(G,o.x,o.y)){                      // chute, à la même vitesse que le mineur
      o.fall=(o.fall||0)+DT*CFG.fallSpeed;
      while(o.fall>=1 && !supported(G,o.x,o.y)){ o.y++; o.fall-=1; }
      if(supported(G,o.x,o.y)) o.fall=0;
      o.grab=null; o.chase=chaseOf(G,o); continue;
    }
    if(o.type==='occultiste' && occult(G,o)){ o.grab=null; o.chase=chaseOf(G,o); continue; }
    updateGrab(G,o);
    if(o.type==='gobelin') goblinSteal(G,o);
    o.chase=chaseOf(G,o);
    o.cd=(o.cd||0)-DT;
    if(o.cd>0 || o.grab!=null) continue;           // il tacle : il ne bouge plus
    const m=preyOf(G,o); if(!m) continue;
    const dx=Math.sign(m.x-o.x), dy=Math.sign(m.y-o.y), dist=manhattan(m,o);
    o.cd=CFG.mobStep;
    if(dist<=1||dist>CFG.mobChaseRange) continue;
    if(dy<0 && o.y-1>=1 && G.ladder[o.y][o.x] && isAir(G,o.x,o.y-1)){ o.y--; o.cd=CFG.mobStep/CFG.climbFactor; }   // grimpe
    else if(dy>0 && isAir(G,o.x,o.y+1)){ o.y++; o.cd=CFG.mobStep/CFG.climbFactor; }   // descend l'échelle (sinon la gravité s'en charge)
    else if(dx && isAir(G,o.x+dx,o.y)) o.x+=dx;                                        // marche (et tombera s'il n'y a pas de sol)
  }
  G.combat = G.mobs.some(o=>o.hp>0 && o.chase!=null);   // état « combattrigger » : un mob a pris un mineur en chasse
  spawnMobs(G);
}

/* vol du gobelin : tant qu'il tacle un mineur, un minerai toutes les goblinStealEvery secondes, tiré au hasard parmi
   les minerais portés (chaque unité a la même chance). Le minerai est perdu. Le compteur repart de zéro quand il ne
   tacle plus personne. */
function goblinSteal(G,o){
  const m=byId(G,o.grab);
  if(!m){ o.steal=0; return; }
  o.steal=(o.steal||0)+DT;
  if(o.steal < MOBS.goblinStealEvery-1e-9) return;
  o.steal-=MOBS.goblinStealEvery;
  const ores=Object.keys(m.inv).filter(k=>ORE_W.has(k) && m.inv[k]>0);
  const total=ores.reduce((s,k)=>s+m.inv[k],0);
  if(!total) return;
  if(resists(G,m)){ log(G, `💪 ${m.name} résiste au vol du gobelin`); return; }
  let r=Math.floor(G.rng()*total), name=ores[0];
  for(const k of ores){ if(r<m.inv[k]){ name=k; break; } r-=m.inv[k]; }
  m.inv[name]--; m.load-=ORE_W.get(name);
  if(!m.inv[name]) delete m.inv[name];
  G.stats.stolen++; m.stats.stolen++;
  log(G, `👺 Un gobelin vole 1 ${name} à ${m.name}`);
}

/* ---- occultiste ----
   o.cast : temps avant que le sort soit prêt ; o.channel = { target, left } pendant la canalisation.
   Renvoie true s'il est occupé (canalisation) : il ne bouge pas et ne tacle pas. */
function endChannel(G,o){ o.channel=null; }
function occult(G,o){
  const C=MOBS.occult;
  o.cast=(o.cast ?? C.cooldown)-DT;
  if(o.channel){
    const t=byId(G,o.channel.target);
    o.channel.left-=DT;
    if(!t || t.y<=0 || o.channel.left<=1e-9) endChannel(G,o);
    return !!o.channel;
  }
  if(o.cast>0) return false;
  const p=preyOf(G,o);
  if(!p || manhattan(p,o)>CFG.mobChaseRange) return false;
  const spot=tpSpot(G,p); if(!spot) return false;   // pas de case possible : il réessaie au tick suivant
  o.x=spot.x; o.y=spot.y; o.fall=0; o.grab=null; o.cd=CFG.mobStep;
  o.cast=C.cooldown;
  if(resists(G,p)){ log(G, `💪 ${p.name} résiste à la canalisation de l'occultiste`); return false; }   // téléporté, sort perdu
  o.channel={ target:p.id, left:C.channel };
  p.stats.hexed=(p.stats.hexed||0)+1; G.stats.hexed=(G.stats.hexed||0)+1;
  log(G, `🌑 Un occultiste se téléporte et canalise sur ${p.name} (étourdi ${C.channel} s)`);
  return true;
}

/* case de téléportation : vide, où l'on tient, à tpDist cases (Manhattan) de la cible, qu'on rejoint depuis la cible
   sans miner (cases vides voisines, au plus tpReach pas). Sinon une case à tpDist+1, puis tpDist−1 (jamais au contact).
   Tirage au hasard « live » (G.rng) parmi les cases possibles, dans l'ordre de la recherche (déterministe). */
function tpSpot(G,p){
  const C=MOBS.occult, H=maxRow(G), seen=new Map([[p.y*W+p.x,0]]), q=[[p.x,p.y]], byDist=new Map();
  for(let i=0;i<q.length;i++){
    const [x,y]=q[i], d=seen.get(y*W+x);
    const md=Math.abs(x-p.x)+Math.abs(y-p.y);
    if(md>=2 && supported(G,x,y)) (byDist.get(md) ?? byDist.set(md,[]).get(md)).push({x,y});
    if(d>=C.tpReach) continue;
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
      const nx=x+dx, ny=y+dy, n=ny*W+nx;
      if(nx<0||nx>=W||ny<1||ny>H||seen.has(n)||!isAir(G,nx,ny)) continue;
      seen.set(n,d+1); q.push([nx,ny]);
    }
  }
  for(const md of [C.tpDist, C.tpDist+1, C.tpDist-1]){
    const c=byDist.get(md); if(c?.length && md>=2) return c[Math.floor(G.rng()*c.length)];
  }
  return null;
}

/* ---- apparitions ----
   Hasard « live » (G.rng, séparé de la génération du monde). Une tentative toutes les spawnDelay secondes, autour des
   mineurs sous terre, chacun son tour. Le type est tiré dans MOBS.spawnTable selon l'area du mineur visé :
   - mimic : un minerai de la roche à spawnMin–spawnMax cases devient un mimic caché ;
   - les autres : posés au sol dans une galerie déjà découverte à spawnMin–spawnMax cases, dans une area où ce type
     peut naître (MOBS.minArea), tant qu'il y a moins de walkerCap mobs qui marchent.
   Les PV dépendent de l'area où le mob naît (mobHp). */
const tableOf = k => MOBS.spawnTable[Math.max(0, Math.min(MOBS.spawnTable.length-1, k))];
export function pickType(table, r){
  let acc=0; const types=Object.keys(table);
  for(const t of types){ acc+=table[t]; if(r<acc) return t; }
  return types[types.length-1];
}

function spawnMobs(G){
  G.spawnTimer-=DT;
  if(G.spawnTimer>0) return;
  const k=G.unlockedAreas-1;
  G.spawnTimer = MOBS.spawnDelay(G.rng, k);
  const n=G.miners.length; if(!n) return;
  const m=G.miners[G.spawnTurn % n]; G.spawnTurn++;
  if(m.y<=0) return;
  const type=pickType(tableOf(areaOf(m.y)), G.rng());
  if(type==='mimic') return spawnMimic(G,m);
  const live=G.mobs.filter(o=>isWalker(o)&&o.hp>0).length;
  if(live>=MOBS.walkerCap(k)) return;
  const cand=[];
  for(let y=Math.max(1,m.y-MOBS.spawnMax);y<=Math.min(maxRow(G),m.y+MOBS.spawnMax);y++){
    if(areaOf(y)<MOBS.minArea[type]) continue;
    for(let x=0;x<W;x++){ const d=Math.abs(x-m.x)+Math.abs(y-m.y); if(d>=MOBS.spawnMin&&d<=MOBS.spawnMax&&isAir(G,x,y)&&G.seen[y][x]&&supported(G,x,y)&&!dungeonAt(G,x,y)) cand.push([x,y]); }   // jamais dans un donjon
  }
  if(!cand.length) return;
  const [x,y]=cand[Math.floor(G.rng()*cand.length)];
  const hp=mobHp(type, areaOf(y));
  const o={id:G.mobId++,type,x,y,hp,maxhp:hp,cd:1};
  if(type==='occultiste') o.cast=MOBS.occult.cooldown;
  G.mobs.push(o);
}

/* un minerai de la roche (pas visé ni en train d'être miné, pas déjà un mimic) devient un mimic caché */
function spawnMimic(G,m){
  const busy=new Set(G.mobs.map(o=>o.y*W+o.x));
  for(const o of G.miners){
    if(o.target) busy.add(o.target.y*W+o.target.x);
    if(o.action?.type==='mine') busy.add(o.action.data.y*W+o.action.data.x);
  }
  const cand=[];
  for(let y=Math.max(1,m.y-MOBS.spawnMax);y<=Math.min(maxRow(G),m.y+MOBS.spawnMax);y++)
    for(let x=0;x<W;x++){ const d=Math.abs(x-m.x)+Math.abs(y-m.y);
      if(d>=MOBS.spawnMin&&d<=MOBS.spawnMax&&isOre(G.tiles[y][x])&&!busy.has(y*W+x)) cand.push([x,y]); }
  if(!cand.length) return;
  const [x,y]=cand[Math.floor(G.rng()*cand.length)];
  const hp=mobHp('mimic', areaOf(y));
  G.mobs.push({id:G.mobId++, type:'mimic', x, y, hp, maxhp:hp, revealed:false, ore:G.tiles[y][x]});
}
