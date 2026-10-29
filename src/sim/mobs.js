/* Mobs (GAME_DESIGN §4) : bestioles, gobelins, occultistes et méphites (se déplacent), mimics (immobiles, faux minerais).
   Tous les mobs TACLENT : à portée d'attaque (COMBAT.reach) du mineur qu'ils visent, ils le forcent à les combattre
   (un seul mineur par mob) jusqu'à leur mort ou une provocation ; le mineur taclé peut bouger, mais seulement pour les
   frapper (25/10, avant : immobilisé). Recul et portée : src/sim/knock.js. Le gobelin vole des minerais ; l'occultiste se téléporte et étourdit sa cible ; le méphite
   vole (pas de gravité) et asphyxie le mineur qu'il tacle. Le golem (2 × 2) casse les blocs et ébranle la mine
   (src/sim/golem.js). */
import { W, DT, CFG, MOBS, BLOCKS, DUCK, COMBAT, mobHp } from '../config.js';
import { maxRow, isAir, isOre, supported, areaOf } from './world.js';
import { log } from './log.js';
import { dungeonAt, inRoom, interior, noEntry } from './dungeon.js';
import { veiled } from './trap.js';
import { spawnDucks, updateDuck, duckCanEnter } from './duck.js';
import { inReach, push, recenter, driftsAway, gap, nearCell } from './knock.js';
import { fitsAt, clearAt, golemCanEnter, golemFalls, golemStep, quake } from './golem.js';
import { thrallOwner, enslave } from './thrall.js';
import { isFlesh, fleshSpot, fleshStep, fleshAura, syncFlesh } from './flesh.js';
import { isMinotaur, enrage, rageHit, charge, breakCharge } from './minotaur.js';

/* mobs qui se déplacent (ils comptent dans walkerCap et prennent les mineurs en chasse) ; les volants n'ont pas de
   gravité, les autres ont la même physique que le mineur */
export const WALKERS = new Set(['bestiole', 'gobelin', 'occultiste', 'mephite', 'golem', 'chair']);
export const isWalker = o => WALKERS.has(o.type);
export const FLYERS = new Set(['mephite']);
export const isFlyer = o => FLYERS.has(o.type);
export const MOB_TYPES = Object.keys(MOBS.hpBase);

/* ce que vole un gobelin : les minerais de la mine (blocs de type ore, charbon compris), avec leur poids */
const ORE_W = new Map(Object.values(BLOCKS).filter(b=>b.type==='ore').map(b=>[b.name, b.w]));

const manhattan = (a,b) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
/* distance d'un mob à un mineur ; le mur de chair (o.h cases de haut) : depuis sa case la plus proche */
const reachDist = (o,m) => o.h ? manhattan(nearCell(o,m),m) : manhattan(m,o);
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

/* cases où ce mob peut être repoussé : vide, dans la mine, pas dans un piège encore caché ; le boss reste dans sa
   salle, les autres n'entrent pas dans un donjon ; le Gallianix reste sur le sol de la surface ; un mimic ne bouge
   jamais. Les mobs ne s'entassent pas : ils peuvent partager une case avec un autre mob ou un mineur (25/10). */
export function mobCanEnter(G,o){
  if(o.type==='mimic') return () => false;
  if(o.type===DUCK.type) return (x,y) => y===o.y && duckCanEnter(G,x);
  if(o.type==='golem') return golemCanEnter(G);
  if(isFlesh(o)) return () => false;   // mur de chair : ne se fait jamais repousser
  const d=o.dungeon!=null ? G.dungeons.find(q=>q.id===o.dungeon) : null;
  return (x,y) => x>=0 && x<W && y>=1 && y<=maxRow(G) && isAir(G,x,y) && !veiled(G,x,y)
    && (d ? interior(d,x,y) : !dungeonAt(G,x,y));
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

/* mineur visé par un mob : celui qui l'a provoqué, sinon celui qu'il chasse (mob de piège, o.hunt) s'il est sous terre,
   sinon le plus proche sous terre (à égalité, le premier de la liste) */
function preyOf(G,o){
  const t=tauntedBy(G,o); if(t) return t;
  const h=byId(G,o.hunt); if(h && h.y>0) return h;
  let best=null, bd=Infinity;
  for(const m of G.miners){ if(m.y<=0) continue; const d=reachDist(o,m); if(d<bd){ bd=d; best=m; } }
  return best;
}

/* tacle d'un mob (25/10) : il prend sa cible dès qu'elle est à portée d'attaque, et la garde jusqu'à sa mort ou une
   provocation (le mineur peut bouger, mais seulement pour le frapper). Soupape contre les blocages : le tacle saute si
   le mineur taclé ne l'a pas frappé depuis COMBAT.tackleGiveUp s, ou s'il est à plus de COMBAT.tackleLeash cases. */
const keepsGrab = (G,o,m,stay=()=>true) => m && m.y>0 && stay(m) && canTackle(G,o,m)
  && reachDist(o,m)<=COMBAT.tackleLeash && G.t-(o.grabHit ?? G.t)<=COMBAT.tackleGiveUp+1e-9;
function grab(G,o,p){
  const id = p && inReach(G,o,p) && canTackle(G,o,p) ? p.id : null;
  if(id!=null && id!==o.grab) o.grabHit=G.t;   // nouveau tacle : la soupape part de maintenant
  o.grab=id;
}
function updateGrab(G,o){
  if(o.channel || (o.type==='mimic' && !o.revealed)){ o.grab=null; return; }
  if(!keepsGrab(G,o,byId(G,o.grab))) grab(G,o,preyOf(G,o));
  /* revenu à portée de tacle : il peut de nouveau être repoussé (verrou du recul, src/sim/actions.js landHit) */
  const t=byId(G,o.grab) ?? preyOf(G,o);
  if(o.knockLock && t && inReach(G,o,t)) o.knockLock=false;
}

/* coup d'un mob qui tacle (MOBS.hitEvery) : il repousse sa cible de MOBS.knock[type] blocs s'il est à portée (les
   autres mobs ont 0 de poussée : leur coup, c'est leur effet, vol ou asphyxie). Minotaure enragé : sa cadence et son
   recul de rage (src/sim/minotaur.js) */
function strike(G,o){
  const r=rageHit(o), m=byId(G,o.grab);
  const k=r?.knock ?? (MOBS.knock[o.type] || 0), every=r?.every ?? MOBS.hitEveryBy[o.type] ?? MOBS.hitEvery;
  if(!(k>0) || !m){ o.hit=every; return; }
  o.hit=(o.hit ?? every)-DT;
  if(o.hit>1e-9 || !inReach(G,o,m)) return;
  o.hit+=every;
  if(m.action?.type==='move') return;   // en plein pas (ou en chute) : le coup ne le déplace pas
  push(m, nearCell(o,m), k, (x,y) => isAir(G,x,y) && !noEntry(G,m,x,y));   // golem : depuis sa case la plus proche
  m.stats.knocked=(m.stats.knocked||0)+1;
}

/* pas d'un mob vers sa cible quand elle n'est plus à portée (après un recul, il revient au contact) : s'il est déjà à
   côté, il se recentre dans sa case ; renvoie true s'il n'a pas à bouger plus loin */
function closeIn(G,o,m){
  if(inReach(G,o,m)) return true;
  if(manhattan(m,o)<=1){ if(driftsAway(o,m)){ recenter(o); o.cd=stepOf(o)/2; } return true; }
  return false;
}

/* mineur que ce mob a pris en chasse (état « combat » de la session, que suivent les mineurs qui aident leurs alliés) */
function chaseOf(G,o){
  if(o.channel) return o.channel.target;
  if(o.grab!=null) return o.grab;
  if(!isWalker(o)) return null;
  const p=preyOf(G,o);
  return p && inChase(o,p) ? p.id : null;
}
/* le mob poursuit-il ce mineur ? à mobChaseRange cases au plus, sans limite pour le mineur qu'il chasse (piège) */
const inChase = (o,p) => p.id===o.hunt || reachDist(o,p)<=CFG.mobChaseRange;
/* temps d'un pas : mobStep, divisé par la vitesse du mob (mobs de piège : TRAP.speedMul) */
const stepOf = o => CFG.mobStep/(o.speed||1);

/* ---- golem (src/sim/golem.js) : tacle, coups et poursuite comme les autres ; il tombe, ébranle la mine, et casse les
   blocs pour rejoindre sa proie (il s'arrête à portée) */
function updateGolem(G,o){
  if(golemFalls(G,o)){ updateGrab(G,o); o.chase=chaseOf(G,o); return; }
  quake(G,o,resists);
  updateGrab(G,o);
  strike(G,o);
  o.chase=chaseOf(G,o);
  o.cd=(o.cd||0)-DT; o.dig=(o.dig||0)-DT;
  const m=byId(G,o.grab) ?? preyOf(G,o); if(!m) return;
  if(o.grab==null && !inChase(o,m)) return;
  if(inReach(G,o,m)) return;
  golemStep(G,o,m,stepOf(o));
}

/* ---- mur de chair (src/sim/flesh.js) : tacle comme les autres (sans coup ni recul), avance à l'horizontale vers sa
   proie et s'arrête à portée */
function updateFlesh(G,o){
  updateGrab(G,o);
  o.chase=chaseOf(G,o);
  o.cd=(o.cd||0)-DT;
  const m=byId(G,o.grab) ?? preyOf(G,o); if(!m) return;
  if(o.grab==null && !inChase(o,m)) return;
  if(inReach(G,o,m)) return;
  fleshStep(G,o,m,stepOf(o));
}

/* ---- boss de donjon (minotaure) : enfermé dans sa salle, il ne vise que les mineurs qui y sont (intérieur ou entrée),
   marche vers eux sans jamais sortir et les tacle à 1 case. Charge et Rage (30/10/2026, src/sim/minotaur.js) : il fonce
   à travers sa salle, sans en sortir. */
function updateBoss(G,o){
  const d=G.dungeons.find(x=>x.id===o.dungeon);
  const inside=m => m.y>0 && d && inRoom(d,m.x,m.y);
  const prey=()=>{ const t=tauntedBy(G,o); if(t && inside(t)) return t;
    let best=null, bd=Infinity; for(const m of G.miners){ if(!inside(m)) continue; const k=manhattan(m,o); if(k<bd){ bd=k; best=m; } } return best; };
  enrage(G,o);
  { const p=byId(G,o.grab) ?? prey();
    if(charge(G,o,p,(x,y)=>interior(d,x,y) && isAir(G,x,y),resists)){ o.chase=p?.id ?? null; return; } }
  if(!keepsGrab(G,o,byId(G,o.grab),inside)) grab(G,o,prey());
  strike(G,o);
  const p=byId(G,o.grab) ?? prey(); o.chase = p?.id ?? null;
  o.cd=(o.cd||0)-DT;
  if(o.cd>0 || !p) return;
  o.cd=CFG.mobStep;
  if(closeIn(G,o,p)) return;
  const dx=Math.sign(p.x-o.x);
  if(dx && interior(d,o.x+dx,o.y) && isAir(G,o.x+dx,o.y)){ o.x+=dx; recenter(o); }   // il marche sur le sol de sa salle, sans en sortir
}

export function updateMobs(G){
  for(const o of G.mobs){
    if(o.hp<=0) continue;
    if(o.stunUntil>G.t){ o.grab=null; breakCharge(o); continue; }   // étourdi (Dash) : il ne tacle pas, ne bouge pas, ne lance rien ; la charge d'un minotaure est coupée
    if(o.dungeon!=null){ updateBoss(G,o); continue; }
    if(o.type===DUCK.type){ updateDuck(G,o); continue; }   // Gallianix : surface, ne tacle pas (src/sim/duck.js)
    if(o.type==='golem'){ updateGolem(G,o); continue; }
    if(isFlesh(o)){ updateFlesh(G,o); continue; }
    if(o.type==='mimic'){
      if(!o.revealed && G.miners.some(m=>m.y>0 && Math.hypot(o.x-m.x,o.y-m.y)<=MOBS.mimicRevealDist)) revealMimic(G,o);
      updateGrab(G,o); o.chase=chaseOf(G,o); continue;
    }
    if(!isFlyer(o) && !supported(G,o.x,o.y)){       // chute, à la même vitesse que le mineur (un volant flotte)
      o.fall=(o.fall||0)+DT*CFG.fallSpeed;
      while(o.fall>=1 && !supported(G,o.x,o.y)){ o.y++; o.fall-=1; }
      if(supported(G,o.x,o.y)) o.fall=0;
      o.ky=0; updateGrab(G,o); o.chase=chaseOf(G,o); continue;   // il garde son tacle en tombant (soupape : tackleLeash)
    }
    if(!isFlyer(o) && !G.ladder[o.y]?.[o.x]) o.ky=0;   // poussé vers le haut hors d'une échelle : il retombe
    if(o.type==='occultiste' && occult(G,o)){ o.grab=null; o.chase=chaseOf(G,o); continue; }
    if(isMinotaur(o)){                                // minotaure à découvert (Arène du k hole) : Charge et Rage
      enrage(G,o);
      const p=byId(G,o.grab) ?? preyOf(G,o), q=p && (o.grab!=null || inChase(o,p)) ? p : null;
      if(charge(G,o,q,mobCanEnter(G,o),resists)){ o.chase=q?.id ?? null; continue; }
    }
    updateGrab(G,o);
    if(o.type==='gobelin') goblinSteal(G,o);
    strike(G,o);
    o.chase=chaseOf(G,o);
    o.cd=(o.cd||0)-DT;
    const m=byId(G,o.grab) ?? preyOf(G,o); if(!m) continue;   // il tacle : il suit son mineur pour rester au contact
    if(o.grab==null && !inChase(o,m)) continue;
    if(isFlyer(o)){                                   // volant : case par case, comme avant…
      /* …sauf au contact : repoussé, il revient en glissant vers sa case (sinon les reculs s'empilaient et il sortait de
         portée, 25/10/2026) */
      if(manhattan(m,o)<=1 && (Math.abs(o.kx||0)>1e-9 || Math.abs(o.ky||0)>1e-9)){
        const v=DT/stepOf(o), back=k => Math.abs(k||0)<=v ? 0 : k-Math.sign(k)*v;
        o.kx=back(o.kx); o.ky=back(o.ky); continue;
      }
      if(o.cd>0) continue;
      o.cd=stepOf(o);
      if(closeIn(G,o,m)) continue;
      const s=flyStep(G,o,m); if(s){ o.x=s.x; o.y=s.y; recenter(o); } continue;
    }
    walk(G,o,m);
  }
  asphyxia(G);
  fleshAura(G,resists);
  G.combat = G.mobs.some(o=>o.hp>0 && o.chase!=null);   // état « combattrigger » : un mob a pris un mineur en chasse
  spawnMobs(G);
  spawnDucks(G);
  syncFlesh(G);   // cases du mur de chair (nouveau, déplacé ou mort)
}

/* Marche d'un mob (25/10/2026, Geoffrey : mouvement continu). Sur sa ligne, il GLISSE vers sa proie à 1/stepOf blocs
   par seconde (son décalage kx avance un peu à chaque tick, il passe sur la case voisine au-delà d'une demi-case) et
   s'arrête au contact (écart 0) : il est donc vraiment entre deux cases pendant qu'il avance, et la portée d'attaque
   (COMBAT.reach, stat reach du mineur) se mesure en continu. Les échelles restent case par case (stepOf / climbFactor),
   après s'être recentré dans sa case. Avant le 25/10 : un saut d'une case toutes les stepOf s. */
function walk(G,o,m){
  const dx=Math.sign(m.x-o.x), dy=Math.sign(m.y-o.y), v=DT/stepOf(o), k=o.kx||0;
  if(o.y===m.y && gap(o,m)<=1e-9) return;                                   // au contact
  const climb = dy<0 && o.y-1>=1 && G.ladder[o.y][o.x] && isAir(G,o.x,o.y-1);
  const down = dy>0 && isAir(G,o.x,o.y+1);
  if(climb || down){
    if(Math.abs(k)>1e-9){ o.kx = Math.abs(k)<=v ? 0 : k-Math.sign(k)*v; return; }   // d'abord au centre de sa case
    if(o.cd>0) return;
    o.y += climb ? -1 : 1; recenter(o); o.cd=stepOf(o)/CFG.climbFactor;       // grimpe / descend l'échelle
    return;
  }
  if(!dx){ o.kx = Math.abs(k)<=v ? 0 : k-Math.sign(k)*v; return; }          // sous / sur sa proie : il se recentre
  const step = o.y===m.y ? Math.min(v, gap(o,m)) : v;                       // jamais plus près que le contact
  let nk = k + dx*step;
  const open = isAir(G,o.x+dx,o.y);
  if(!open && nk*dx>0) nk = Math.max(0, k*dx) === 0 ? 0 : k;                 // un bloc devant : il ne dépasse pas le centre
  if(nk*dx > 0.5+1e-9 && open){ o.x += dx; nk -= dx; }                      // marche (et tombera s'il n'y a pas de sol)
  o.kx = nk;
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

/* ---- méphite ----
   Vol : à chaque pas, le plus court chemin par les cases vides (4 directions, sans échelle ni gravité) jusqu'à une case
   voisine de sa proie ; il évite les donjons et l'intérieur caché des pièges. Pas de chemin : il ne bouge pas. */
function flyStep(G,o,m){
  const H=maxRow(G), start=o.y*W+o.x, from=new Map([[start,-1]]), q=[start];
  const ok=(x,y)=>x>=0 && x<W && y>=1 && y<=H && isAir(G,x,y) && !veiled(G,x,y) && !dungeonAt(G,x,y);
  for(let i=0;i<q.length && i<MOBS.mephite.flyReach;i++){
    const c=q[i], x=c%W, y=(c-x)/W;
    if(c!==start && Math.abs(x-m.x)+Math.abs(y-m.y)===1){
      let s=c; while(from.get(s)!==start) s=from.get(s);   // remonte au premier pas
      return { x:s%W, y:(s-s%W)/W };
    }
    for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){
      const nx=x+dx, ny=y+dy, n=ny*W+nx;
      if(!from.has(n) && ok(nx,ny) && !(nx===m.x && ny===m.y)){ from.set(n,c); q.push(n); }
    }
  }
  return null;
}

/* asphyxie : tant qu'au moins un méphite tacle un mineur, il perd MOBS.mephite.oxygen d'oxygène toutes les
   MOBS.mephite.every secondes (un seul compteur par mineur : plusieurs méphites ne se cumulent pas). Le compteur repart
   de zéro quand plus aucun méphite ne le tient. Chaque pulse est ignorable par la ténacité. */
function asphyxia(G){
  const C=MOBS.mephite;
  for(const m of G.miners){
    if(!G.mobs.some(o=>o.hp>0 && o.type==='mephite' && o.grab===m.id)){ m.choke=0; continue; }
    m.choke=(m.choke||0)+DT;
    if(m.choke < C.every-1e-9) continue;
    m.choke-=C.every;
    if(resists(G,m)) continue;
    m.ox=Math.max(0, m.ox-C.oxygen);
    m.stats.choked=(m.stats.choked||0)+1; G.stats.choked=(G.stats.choked||0)+1;
  }
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
  if(!p || !inChase(o,p)) return false;
  const spot=tpSpot(G,p); if(!spot) return false;   // pas de case possible : il réessaie au tick suivant
  o.x=spot.x; o.y=spot.y; o.fall=0; o.grab=null; o.cd=stepOf(o);
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
     peut naître (MOBS.minArea), tant qu'il y a moins de walkerCap mobs qui marchent (hors mobs de piège).
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
  const live=G.mobs.filter(o=>isWalker(o)&&o.hp>0&&o.trap==null).length;   // les mobs de piège ne comptent pas
  if(live>=MOBS.walkerCap(k)) return;
  if(type==='chair') return spawnFlesh(G,m);
  const cand=[];
  for(let y=Math.max(1,m.y-MOBS.spawnMax);y<=Math.min(maxRow(G),m.y+MOBS.spawnMax);y++){
    if(areaOf(y)<MOBS.minArea[type]) continue;
    for(let x=0;x<W;x++){ const d=Math.abs(x-m.x)+Math.abs(y-m.y); if(d>=MOBS.spawnMin&&d<=MOBS.spawnMax&&isAir(G,x,y)&&G.seen[y][x]&&(FLYERS.has(type)||supported(G,x,y))&&!dungeonAt(G,x,y)&&(type!=='golem'||fitsAt(G,x,y))) cand.push([x,y]); }   // jamais dans un donjon ; un volant naît aussi en l'air ; un golem là où il tient (2 × 2)
  }
  if(!cand.length) return;
  const [x,y]=cand[Math.floor(G.rng()*cand.length)];
  /* Couronne du Roi Gobelin (27/10) : un gobelin qui naît près d'un porteur est asservi (src/sim/thrall.js), pas un mob */
  if(type==='gobelin'){ const w=thrallOwner(G,x,y); if(w){ enslave(G,G.mobId++,x,y,w); return; } }
  const hp=mobHp(type, areaOf(y));
  const o={id:G.mobId++,type,x,y,hp,maxhp:hp,cd:1};
  if(MOBS.speed[type]) o.speed=MOBS.speed[type];
  if(type==='occultiste') o.cast=MOBS.occult.cooldown;
  if(type==='golem'){ o.size=MOBS.golem.size; o.knockRes=MOBS.golem.knockRes; clearAt(G,x,y); log(G, '🗿 Un golem sort de la roche !'); }
  G.mobs.push(o);
}

/* mur de chair : dans la roche, à côté du mineur visé (sa ligne vers le milieu du mur), assez loin pour qu'on le voie avancer (MOBS.chair.spawnDist) */
function spawnFlesh(G,m){
  if(areaOf(m.y)<MOBS.minArea.chair) return;
  const at=fleshSpot(G,m); if(!at) return;
  const hp=mobHp('chair', areaOf(m.y));
  G.mobs.push({id:G.mobId++, type:'chair', x:at.x, y:at.y, h:MOBS.chair.h, hp, maxhp:hp, cd:1, speed:MOBS.speed.chair, knockRes:MOBS.chair.knockRes});
  syncFlesh(G);
  log(G, '🩸 Un mur de chair recouvre la roche !');
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
