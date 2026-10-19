/* IA du mineur : chaque appel à decide() choisit UNE action. Elle lit m.prefs (préférences) et la config ;
   ajouter un comportement = ajouter une préférence et la lire ici, pas réécrire l'IA. */
import { W, AREA_H, SESSION_LEN, STATS, CFG, BLOCKS, BARRIER, MOBS, CHEST_X } from '../config.js';
import { DIRS, isOre, isTarget, typeOf, areaTop, maxRow, tileAt, isAir, supported, rowDone } from './world.js';
import { search, firstStep, planReturn, planDown } from './path.js';
import { stepDir } from './actions.js';
import { startAction, idle, curLum, dk, moveT, climbT, mineT, lightR, compassR } from './miner.js';
import { log } from './log.js';

/* boussole : minerais sur la ligne du mineur uniquement */
export function compassScan(G,m,R){
  const out=[], y=m.y;
  if(y>=1 && y<=maxRow(G)){
    for(let x=Math.max(0,m.x-R); x<=Math.min(W-1,m.x+R); x++){
      const t=G.tiles[y][x];
      if(isOre(t)) out.push({x,y,t,seen:G.seen[y][x]===1});
    }
  }
  m.pings=out; return out;
}

const targetStatus = t => typeOf(t)==='treasure' ? 'Va ouvrir un coffre au trésor' : 'Suit un filon ('+BLOCKS[t].name+')';

/* ---- coordination entre mineurs : réservation des cibles ----
   Chacun reste indépendant, mais ne vise pas ce qu'un autre vise déjà (minerai, ligne de galerie, puits).
   En cas de conflit, le plus petit numéro garde la cible. */
const others = (G,m) => G.miners.filter(o=>o!==m);
function oreTakenBy(G,m,x,y){
  for(const o of others(G,m)){
    if(o.target && o.target.x===x && o.target.y===y) return o;
    if(o.action && o.action.type==='mine' && o.action.data.x===x && o.action.data.y===y) return o;
  }
  return null;
}
const rowTaken = (G,m,y) => others(G,m).some(o=>o.galleryRow===y && o.exploring);
/* un autre mineur creuse ce puits (ou s'y trouve) plus bas que moi : inutile de le suivre */
const columnTaken = (G,m,x) => others(G,m).some(o=>(o.digCol===x || o.x===x) && o.y>m.y);
/* nombre d'autres mineurs (ou de leurs cibles) à moins de crowdRadius de (x,y), sous terre */
const near = (a,x,y) => a && Math.abs(a.x-x)+Math.abs(a.y-y) < CFG.crowdRadius;
const crowdAt = (G,m,x,y) => others(G,m).filter(o=>(o.y>0 && near(o,x,y)) || near(o.target,x,y)).length;
/* nombre d'autres mineurs (sous terre) sur la ligne y, ou juste au-dessus / en dessous */
const rowCrowd = (G,m,y) => others(G,m).filter(o=>o.y>0 && Math.abs(o.y-y)<=1).length;
/* filon réservé : un autre mineur vise un minerai à moins de crowdRadius (sinon ils font tout le trajet ensemble) */
const veinTaken = (G,m,x,y) => others(G,m).some(o=>near(o.target,x,y));
/* un autre est déjà en train de poser une torche juste à côté */
const torchByOther = (G,m) => others(G,m).some(o=>o.action && o.action.type==='torch' && Math.abs(o.x-m.x)+Math.abs(o.y-m.y)<=2);
/* éloignement relatif hors de son secteur (0 dans le secteur ; 1 = une demi-largeur de secteur en dehors…) */
const outOfSector = (m,x) => m.homeX==null ? 0 : Math.max(0, Math.abs(x-m.homeX)-CFG.sectorHalf)/CFG.sectorHalf;

/* Fond de l'area verrouillé : creuser des galeries horizontales (une ligne sur 3) pour trouver les minerais manquants. */
function explore(G,m){
  const k=G.unlockedAreas-1, base=areaTop(k)-1;   // couches base+1 … base+AREA_H
  m.exploring=true;  // évite l'oscillation « descend / change de galerie » ; levé au déblocage de l'area suivante
  const primary=[], secondary=[];
  for(let r=1;r<=AREA_H;r++){ const y=base+r; if(rowDone(G,y)||m.skipRows.has(y)) continue; (r%3===0 && r<AREA_H ? primary : secondary).push(y); }
  let pool = primary.length ? primary : secondary;
  if(!pool.length){ m.status='Plus rien à explorer'; idle(m,1); return; }
  const free = pool.filter(y=>!rowTaken(G,m,y));     // lignes que personne d'autre ne creuse
  if(free.length) pool=free;
  const quiet = pool.filter(y=>!rowCrowd(G,m,y));    // … et où aucun autre mineur ne se trouve (±1 ligne)
  if(quiet.length) pool=quiet;
  const target = pool.reduce((a,b)=>Math.abs(b-m.y)<Math.abs(a-m.y)?b:a);
  m.galleryRow=target;
  m.status = target===m.y ? 'Creuse une galerie' : 'Change de galerie';
  /* Objectif : se tenir SUR la ligne de la galerie, à côté d'un bloc à creuser, par un itinéraire où il tient toujours. */
  const solidAt=(x,y)=> x>=0 && x<W && !isAir(G,x,y) && tileAt(G,x,y)!==BARRIER;
  const r=search(G,m,m.x,m.y,true,(x,y)=>y===target && (solidAt(x-1,y)||solidAt(x+1,y)),2*CFG.planMaxCost);
  if(!r){ m.skipRows.add(target); idle(m,0.2); return; }   // galerie inatteignable : on en prendra une autre
  if(r.n===r.start){                                       // déjà en place : on creuse, en gardant la direction si possible
    const L=solidAt(m.x-1,m.y), R=solidAt(m.x+1,m.y);
    if(!((m.dir===-1&&L)||(m.dir===1&&R))) m.dir = (L&&R) ? (G.rng()<0.5?-1:1) : (L?-1:1);
    if(!stepDir(G,m,m.dir,0)) idle(m,0.5);
    return;
  }
  const s=firstStep(r,r.n);
  if(s && (s.dx||s.dy) && stepDir(G,m,s.dx,s.dy,{noBridge:!s.bridge})) return;
  m.skipRows.add(target); idle(m,0.2);
}

/* va vers un minerai : le mine s'il est adjacent, sinon suit l'itinéraire jusqu'à sa case voisine bn */
function goOre(G,m,o,r,bn){
  const dx=o.x-m.x, dy=o.y-m.y;
  if(Math.abs(dx)+Math.abs(dy)===1){ if(!stepDir(G,m,dx,dy)) idle(m,0.3); return; }
  const s=firstStep(r,bn);
  if(s && (s.dx||s.dy) && stepDir(G,m,s.dx,s.dy,{noBridge:!s.bridge})) return;
  idle(m,0.3);
}

function nearestThreat(G,m){
  const R=lightR(G,m); let best=null,bd=1e9;
  for(const o of G.mobs){
    if(o.hp<=0 || m.ignored.has(o.id)) continue;
    const d=Math.hypot(o.x-m.x,o.y-m.y);
    if(o.type==='mimic' && !o.revealed && d<=MOBS.mimicRevealDist){ o.revealed=true; log(G,'⚠ Un mimic se dévoile !'); }
    if(o.type==='mimic' && !o.revealed) continue;
    if(d>R) continue;   // un mob (bestiole ou mimic dévoilé) ne déclenche le combat que dans le champ de vision
    if(d<bd){bd=d;best=o;}
  }
  return best;
}

function fight(G,m,o){
  const dx=o.x-m.x, dy=o.y-m.y;
  m.status='Combat ('+(o.type==='mimic'?'mimic':'bestiole')+')';
  if(Math.abs(dx)+Math.abs(dy)<=1){ startAction(m,'attack', CFG.attackInterval/dk(G,m), {mob:o}); return; }
  const ok = dx!==0 ? stepDir(G,m,Math.sign(dx),0) : stepDir(G,m,0,Math.sign(dy));
  if(!ok) idle(m,0.3);
}

function decideSurface(G,m){
  const left=SESSION_LEN-G.t;
  if(m.x!==CHEST_X){ m.status='Va au coffre'; if(!stepDir(G,m,Math.sign(CHEST_X-m.x),0)) idle(m); return; }
  if(m.load>0){ m.status='Dépose au coffre'; startAction(m,'deposit',1,{}); return; }
  if(m.ox<STATS.oxygenMax-0.5){ m.status='Recharge en oxygène'; idle(m,0.5); return; }
  // repartir ne vaut le coup que s'il reste le temps d'aller au front, d'y travailler un peu et de revenir
  if(left<Math.max(CFG.endStayMin, 2*m.lastReturnDur+CFG.minWorkTime)){ m.status='Fin de session proche'; idle(m,1); return; }
  m.mode='departure';
  decideDeparture(G,m);
}

/* en équipe : chacun rejoint sa colonne de départ avant de redescendre (sinon tous repartent du coffre en file) */
function decideDeparture(G,m){
  if(m.homeX!=null && m.x!==m.homeX){
    m.status='Rejoint son puits';
    if(stepDir(G,m,Math.sign(m.homeX-m.x),0,{noBridge:true})) return;
  }
  m.mode='work'; m.dir=0; m.target=null; m.skipRows.clear();   // repart de la surface : pas obligé de retourner à l'ancien front
  m.exploring=false;
  decideWork(G,m);
}

function decideReturn(G,m,rp){
  if(m.y===0){ m.mode='surface'; m.lastReturnDur=G.t-m.returnStart; return decideSurface(G,m); }
  const p = rp || planReturn(G,m);
  m.status='Retour ('+m.reason+')';
  if(p && (p.dx||p.dy) && stepDir(G,m,p.dx,p.dy,{noBridge:!p.bridge})) return;
  if(!stepDir(G,m,0,-1)) idle(m);
}

function decideWork(G,m){
  const left=SESSION_LEN-G.t;
  m.digCol=null;   // réservations rafraîchies à chaque décision
  if(!m.exploring) m.galleryRow=null;
  const rp=m.y>0 ? planReturn(G,m) : null;
  const tRet = rp ? rp.cost*1.25 : 0;
  if(m.y>0){
    let reason=null;
    if(m.ox<=tRet+CFG.returnMargin) reason='oxygène';
    else if(m.load>=STATS.pods-2) reason='pods pleins';
    else if(left<=tRet+12) reason='fin de session';
    else if(m.torches<=0) reason='plus de torches';
    if(reason){ m.mode='return'; m.reason=reason; m.returnStart=G.t; log(G, `↑ ${m.name} remonte : ${reason}`); return decideReturn(G,m,rp); }
    if(curLum(G,m)<CFG.torchThreshold && m.torches>0 && !torchByOther(G,m)){ m.status='Pose une torche'; startAction(m,'torch',1,{}); return; }
  }
  const R=compassR(G,m), ores=compassScan(G,m,R);
  let best=null,bs=0;
  /* l'IA ne vise que les minerais découverts (révélés) ou signalés par la boussole (sa ligne),
     et les coffres au trésor découverts (la boussole ne les signale pas) */
  const known=new Map(ores.map(o=>[o.y*W+o.x,o]));
  for(let y=1;y<=maxRow(G);y++) for(let x=0;x<W;x++){
    const t=G.tiles[y][x];
    if(isTarget(t) && G.seen[y][x] && !known.has(y*W+x)) known.set(y*W+x,{x,y,t});
  }
  /* coût réel (au temps) pour atteindre chaque minerai : une seule recherche d'itinéraire qui réutilise échelles,
     galeries et passerelles, et compte les échelles à poser. « Voyage futur » = trajet retour ajouté. */
  const r=search(G,m,m.x,m.y,true,null,CFG.planMaxCost); let bestN=-1;
  const nbrBest = o => { let bd=Infinity, bn=-1;
    for(const [dx,dy] of DIRS){ const nx=o.x+dx, ny=o.y+dy; if(nx<0||nx>=W||ny<1||ny>maxRow(G)) continue;
      const n=ny*W+nx; if(r.dist[n]<bd){ bd=r.dist[n]; bn=n; } }
    return {bd,bn}; };
  // engagement : on garde la cible tant qu'elle existe et reste atteignable (évite les va-et-vient entre deux choix)
  // … sauf si un autre mineur (plus petit numéro) la vise aussi
  const tg=m.target;
  if(tg){ const t=G.tiles[tg.y][tg.x], nb=nbrBest(tg), rival=oreTakenBy(G,m,tg.x,tg.y);
    if(isTarget(t) && nb.bn>=0 && !(rival && rival.id<m.id)){ m.status=targetStatus(t); return goOre(G,m,tg,r,nb.bn); }
    m.target=null; }
  for(const o of known.values()){
    const dist=Math.abs(o.x-m.x)+Math.abs(o.y-m.y);
    if(dist>CFG.oreReach) continue;   // un filon lointain n'est pas plus attirant que creuser du neuf
    if(oreTakenBy(G,m,o.x,o.y)) continue;   // déjà visé ou en cours de minage par un autre
    if(veinTaken(G,m,o.x,o.y)) continue;    // filon réservé : un autre vise un minerai tout près
    const {bd,bn}=nbrBest(o);
    if(bn<0) continue;
    const travel=Math.abs(o.x-m.x)*moveT(G,m)+Math.abs(o.y-m.y)*climbT(G,m);
    // un filon où travaille déjà un autre mineur, ou hors de son secteur, est moins attirant : on se répartit la mine
    const s=BLOCKS[o.t].val/(bd+mineT(G,m,o.t)+CFG.futureTravelWeight*travel+1)
      /(1+CFG.crowdPenalty*crowdAt(G,m,o.x,o.y))/(1+CFG.sectorPenalty*outOfSector(m,o.x))
      /(1+CFG.rowCrowdPenalty*rowCrowd(G,m,o.y));   // cible sur la ligne d'un autre mineur (±1) : moins intéressante
    if(s>bs){ bs=s; best=o; bestN=bn; }
  }
  // descend tant que la case du dessous n'est pas une barrière, sauf en phase d'exploration (fond de l'area verrouillé)
  const down = !m.exploring && tileAt(G,m.x,m.y+1) !== BARRIER;
  const range = (m.prefs.priority==='minerais'||!down) ? R : 3;
  if(best && Math.abs(best.x-m.x)<=range){ m.target={x:best.x,y:best.y}; m.status=targetStatus(best.t); return goOre(G,m,best,r,bestN); }
  if(down){
    // ne pas descendre là où un autre travaille déjà, ni loin de son secteur
    const pd=planDown(G,m,(x,y)=>crowdAt(G,m,x,y)>0 || outOfSector(m,x)>1);
    if(pd && (pd.dx||pd.dy) && stepDir(G,m,pd.dx,pd.dy,{noBridge:!pd.bridge})){ m.status='Descend par l\'existant'; return; }
    // un autre creuse déjà ce puits sous moi : je me décale pour ouvrir le mien
    if(columnTaken(G,m,m.x) && shiftColumn(G,m)) return;
    m.digCol=m.x; m.status='Creuse vers le bas'; if(!stepDir(G,m,0,1)) idle(m); return;
  }
  explore(G,m);
}

/* se décaler sur la même ligne vers une colonne libre (au moins CFG.shaftGap colonnes des puits des autres) */
function shiftColumn(G,m){
  const cols=others(G,m).flatMap(o=>[o.digCol, o.y>m.y ? o.x : null]).filter(c=>c!=null);
  const r=search(G,m,m.x,m.y,true,(x,y)=>y===m.y && cols.every(c=>Math.abs(c-x)>=CFG.shaftGap),CFG.planMaxCost);
  const s=r && firstStep(r,r.n);
  if(!s || !(s.dx||s.dy)) return false;
  m.status='Se décale (puits occupé)';
  return stepDir(G,m,s.dx,s.dy,{noBridge:!s.bridge});
}

/* tacle : une bestiole sur la case du mineur l'immobilise jusqu'à ce qu'elle soit tuée */
export const tackler = (G,m) => G.mobs.find(o=>o.type==='bestiole' && o.hp>0 && o.x===m.x && o.y===m.y) || null;

export function decide(G,m){
  // gravité : sans appui, il tombe d'une case
  if(!supported(G,m.x,m.y)){ m.status='Tombe'; G.stats.falls++; m.stats.falls++; startAction(m,'move', 1/CFG.fallSpeed, {x:m.x,y:m.y+1,down:true,fall:true,fx:m.x,fy:m.y}); return; }
  // taclé : il ne peut plus bouger, il doit tuer la bestiole (même si « combat » est sur non, même en retour)
  { const tk=tackler(G,m); if(tk){ m.foe=tk.id; m.foeHit=G.t; fight(G,m,tk); m.status='Taclé ! (bestiole)'; return; } }
  if(m.mode==='surface' && m.y>0){ m.mode='return'; m.reason='chute'; m.returnStart=G.t; }  // tombé dans un trou en rejoignant le coffre
  if(m.mode==='departure' && m.y>0) m.mode='work';                       // tombé en rejoignant son puits : il est parti
  if(m.y>0){
    /* engagement : une fois déclenché, le combat continue même si le mob sort du champ de vision.
       On lâche s'il s'éloigne trop ; on l'ignore si aucun coup n'a porté depuis foeGiveUp secondes. */
    let th=null;
    const foe=m.foe && G.mobs.find(o=>o.id===m.foe && o.hp>0);
    if(foe && G.t-m.foeHit>CFG.foeGiveUp){ m.ignored.add(foe.id); m.foe=null; }
    else if(foe && Math.hypot(foe.x-m.x,foe.y-m.y)<=CFG.foeLeash) th=foe;
    else m.foe=null;
    if(!th) th=nearestThreat(G,m);
    // en retour, il ne se bat que contre un mimic qui lui bloque le passage (sinon il le « mine » à l'infini)
    const blocking = th && th.type==='mimic' && Math.abs(th.x-m.x)+Math.abs(th.y-m.y)<=1;
    if(th && ((m.prefs.fightMobs && m.mode!=='return') || blocking)){
      if(m.foe!==th.id){ m.foe=th.id; m.foeHit=G.t; }
      fight(G,m,th); return;
    }
  }
  if(m.mode==='surface')   return decideSurface(G,m);
  if(m.mode==='departure') return decideDeparture(G,m);
  if(m.mode==='return')    return decideReturn(G,m);
  return decideWork(G,m);
}
