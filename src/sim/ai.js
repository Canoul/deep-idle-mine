/* IA du mineur : chaque appel à decide() choisit UNE action. Elle lit m.prefs (préférences) et la config ;
   ajouter un comportement = ajouter une préférence et la lire ici, pas réécrire l'IA. */
import { W, AREA_H, STATS, CFG, BLOCKS, BARRIER, MOBS, CHEST_X, SKILLS, WINCH, HELP, MULE, DUCK, DT } from '../config.js';
import { DIRS, isOre, isTarget, isResidue, typeOf, areaOf, areaTop, maxRow, tileAt, isAir, supported, rowDone, fallInfo, landing, ontoLadder } from './world.js';
import { search, firstStep, planReturn, planDown } from './path.js';
import { stepDir, deepFall } from './actions.js';
import { startAction, nowOf, idle, curLum, dk, moveT, climbT, mineT, lightR, compassR, baseMoveT, baseWinchT, warcryOf, timeLeft } from './mineur.js';
import { mulePlaced, isCarrier, muleFits, nearMule, muleAfterWinch } from './mule.js';
import { log } from './log.js';
import { mulberry32 } from '../core/rng.js';
import { tackler, channeler, revealMimic } from './mobs.js';
import { inReach, driftsAway, reachOf, nearCell } from './knock.js';
import { fleshAt, fleshSlow } from './flesh.js';
import { landHit } from './actions.js';
export { tackler } from './mobs.js';
import { targetVal, dropDepleted, focusGoal, workArea, activeOres, areaGood, oreFocus } from './focus.js';
import { active, mayEnter, isIn, inRoom, bossOf, hasBarbarian, isBarbarian, front } from './dungeon.js';

/* boussole : minerais sur la ligne du mineur, et sur carac.compassRows lignes au-dessus et en dessous (Boussole en or) */
export function compassScan(G,m,R){
  const out=[], rows=m.carac.compassRows||0;
  for(let y=Math.max(1,m.y-rows); y<=Math.min(maxRow(G),m.y+rows); y++){
    for(let x=Math.max(0,m.x-R); x<=Math.min(W-1,m.x+R); x++){
      const t=G.tiles[y][x];
      if(isOre(t) && !G.mimicCells.has(y*W+x) && !fleshAt(G,x,y)) out.push({x,y,t,seen:G.seen[y][x]===1});   // mimic dévoilé : plus un minerai
    }
  }
  m.pings=out; return out;
}

const targetStatus = t => typeOf(t)==='treasure' ? 'Va ouvrir un treasure' : isResidue(t) ? 'Va chercher un résidu' : 'Suit un filon ('+BLOCKS[t].name+')';

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
/* fond visé par « descendre par l'existant » : pas là où un autre travaille déjà. Pas de limite de secteur : on se
   répartit au fond, pas pendant la descente (seed 1924731460 : le mineur de droite recreusait un puits depuis la
   surface pendant que les deux autres reprenaient le leur) */
const downAvoid = (G,m) => (x,y) => crowdAt(G,m,x,y)>0;

/* Fond de l'area verrouillé (ou area du dessous épuisée pour le focus) : creuser des galeries horizontales
   (une ligne sur 3) dans l'area k pour trouver les minerais manquants. */
function explore(G,m,k,cap=Infinity){
  const base=areaTop(k)-1;   // couches base+1 … base+AREA_H
  m.exploring=true; m.exploreArea=k;  // évite l'oscillation « descend / change de galerie » ; levé au déblocage de l'area suivante
  const primary=[], secondary=[];
  for(let r=1;r<=AREA_H;r++){ const y=base+r; if(y>cap||rowDone(G,y)||m.skipRows.has(y)) continue; (r%3===0 && r<AREA_H ? primary : secondary).push(y); }
  let pool = primary.length ? primary : secondary;
  if(!pool.length){
    /* fin de session : il reste des galeries, mais toutes trop profondes pour le temps qu'il reste. Il remonte déposer
       au lieu d'attendre la fin sur place, le sac plein (seed 15838 : ~100 s immobile avec 45 de chargement) */
    let deeper=false; for(let r=1;r<=AREA_H && !deeper;r++){ const y=base+r; deeper = y>cap && !rowDone(G,y) && !m.skipRows.has(y); }
    if(deeper && m.y>0){ m.mode='return'; m.reason='fin de session'; m.returnStart=G.t; log(G, `↑ ${m.name} remonte : fin de session`); return decideReturn(G,m); }
    m.status='Plus rien à explorer'; idle(m,1); return;
  }
  const free = pool.filter(y=>!rowTaken(G,m,y));     // lignes que personne d'autre ne creuse
  if(free.length) pool=free;
  const quiet = pool.filter(y=>!rowCrowd(G,m,y));    // … et où aucun autre mineur ne se trouve (±1 ligne)
  if(quiet.length) pool=quiet;
  /* engagement : il garde la galerie choisie tant qu'elle reste possible. La plus proche de SA ligne changeait à chaque
     pas quand l'itinéraire passait par une autre ligne de galerie (153 → 152 → 153… : seed 23757, trou d'un piège vidé) */
  const target = pool.includes(m.galleryRow) ? m.galleryRow : pool.reduce((a,b)=>Math.abs(b-m.y)<Math.abs(a-m.y)?b:a);
  m.galleryRow=target;
  m.status = target===m.y ? 'Creuse une galerie' : 'Change de galerie';
  /* Objectif : se tenir SUR la ligne de la galerie, à côté d'un bloc à creuser, par un itinéraire où il tient toujours. */
  const solidAt=(x,y)=> x>=0 && x<W && !isAir(G,x,y) && !fleshAt(G,x,y) && tileAt(G,x,y)!==BARRIER && !BLOCKS[tileAt(G,x,y)].unbreakable;
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
  // voisin : il le mine d'ici… sauf si ça le ferait tomber dans un trou connu trop profond (il passe par la case bn)
  if(Math.abs(dx)+Math.abs(dy)===1 && !deepFall(G,m,dx,dy)){ if(!stepDir(G,m,dx,dy)) idle(m,0.3); return; }
  const s=firstStep(r,bn);
  if(s && (s.dx||s.dy) && stepDir(G,m,s.dx,s.dy,{noBridge:!s.bridge})) return;
  idle(m,0.3);
}

/* un mob (bestiole ou mimic dévoilé) ne déclenche le combat que dans le champ de vision. Salle du k hole (seeAll) :
   s'il n'en voit aucun, il va vers le plus proche de la salle (le premier à égalité : le groupe tape le même) */
function nearestThreat(G,m){
  const R=lightR(G,m); let best=null,bd=1e9,far=null,fd=1e9;
  for(const o of G.mobs){
    if(o.hp<=0 || m.ignored.has(o.id) || o.dungeon!=null) continue;   // boss de donjon : voir dungeonGoal
    const c=o.h ? nearCell(o,m) : o, d=Math.hypot(c.x-m.x,c.y-m.y);   // mur de chair : depuis sa case la plus proche
    if(o.type==='mimic' && !o.revealed && d<=MOBS.mimicRevealDist) revealMimic(G,o);
    if(o.type==='mimic' && !o.revealed) continue;
    if(d>R){ if(d<fd){fd=d;far=o;} continue; }
    if(d<bd){bd=d;best=o;}
  }
  return best ?? (G.khole?.map.seeAll ? far : null);
}

/* combat : il frappe le mob s'il est à portée (COMBAT.reach) ; repoussé par un coup, il revient au contact (il se
   recentre dans sa case, ou fait un pas vers le mob) */
function fight(G,m,o){
  const c=o.h ? nearCell(o,m) : o, dx=c.x-m.x, dy=c.y-m.y;   // mur de chair (o.h cases) : vers sa case la plus proche
  m.status='Combat ('+o.type+')';
  /* à portée : le coup part tout de suite, puis il attend son intervalle (m.atkReady) avant le suivant (25/10/2026 :
     avant, le coup partait à la fin de l'élan, et un mob arrivé à portée avait le temps de tacler le premier) */
  if(inReach(G,m,o,reachOf(m))){
    if(dx) m.face=Math.sign(dx);
    const now=nowOf(G,m);   // heure exacte dans le tick (28/10/2026 : sinon paliers de 0,1 s)
    if(now+1e-9 >= (m.atkReady||0)){ landHit(G,m,o); m.atkReady=now+CFG.attackInterval*100/(m.carac.attackSpeed*(1+(warcryOf(G,m)?.speed||0))*dk(G,m)*fleshSlow(m)); }   // Cri de guerre : vitesse +5 % ; mur de chair : −10 % par stack
    startAction(m,'attack', m.atkReady-now, {mob:o, done:true}); return;
  }
  if(Math.abs(dx)+Math.abs(dy)<=1 && driftsAway(m,o)){
    const k=Math.max(Math.abs(m.kx||0), Math.abs(m.ky||0));
    startAction(m,'move', k*(dy ? climbT(G,m) : moveT(G,m)), {x:m.x,y:m.y,fx:m.x+(m.kx||0),fy:m.y+(m.ky||0)}); return;
  }
  /* mob de piège : un barbare doit les tuer (trapGoal). Il prend TOUJOURS le vrai chemin (en minant, en posant des
     échelles ; goFight, qui ne les laisse que s'ils sont vraiment inatteignables), jamais le pas droit vers le mob :
     les deux se contredisaient (pas droit vers la colonne du mob, puis chemin qui repart à côté : allers-retours sans
     fin, seed 23757 arbres mixtes, 25/10/2026). Avant le 25/10, il les ignorait pour de bon (barbare juste au-dessus
     de la salle). Pas sur une case voisine : goFight y rappellerait fight. */
  const d=Math.abs(dx)+Math.abs(dy);
  if(o.trap!=null && isBarbarian(m) && d>1){ goFight(G,m,o,d,m.status,'Va au piège'); return; }
  const ok = dx!==0 ? stepDir(G,m,Math.sign(dx),0) : stepDir(G,m,0,Math.sign(dy));
  if(ok) return;
  /* mob de piège resté dans sa salle (il ne grimpe pas) qu'il ne peut pas approcher : les autres le laissent tout de
     suite, sinon ils attendaient foeGiveUp s par mob (5 mobs : plus d'une minute sans rien faire ; seed 15838) */
  if(o.trap!=null && !isBarbarian(m)){ m.ignored.add(o.id); m.foe=null; }
  idle(m,0.3);
}

/* Profondeur maximale (couche) où il peut encore aller travailler : aller et retour depuis la surface en au plus
   (1 − CFG.endWorkShare) du temps restant, marge de 12 s. Calculée au départ de la surface (m.tripCap) : la remontée
   à l'heure reste décidée comme avant (temps de retour estimé). Secondes par couche : remontée mesurée à sa dernière
   remontée (m.secPerRow), sinon estimée par la vitesse de montée (×1,25, comme le retour) ; descente mesurée à sa
   dernière descente jusqu'au front (m.secPerRowDown), sinon comptée comme la remontée. Grande en début de session.
   27/10/2026 (Geoffrey) : avant, descente = remontée et 25 % de marge en plus sur la remontée mesurée (2,25 × la
   remontée) ; avec le treuil la descente prend ≈ 75 % de la remontée : il s'arrêtait 90 couches au-dessus du front
   dès 6-7 min de la fin (session dev du 27/10, seed 468608167). */
const secPerRow = m => m.secPerRow ?? 1.25/m.carac.climbSpeed;
const secPerRowDown = m => m.secPerRowDown ?? secPerRow(m);
export function depthCap(G,m){
  const left=timeLeft(G), budget=left*(1-CFG.endWorkShare)-12;
  return Math.max(0, Math.floor(budget/(secPerRowDown(m)+secPerRow(m))));
}
/* descente mesurée (m.secPerRowDown) : du départ de la surface jusqu'à la profondeur de sa dernière remontée (le front),
   bornée par la profondeur max du trajet ; abandonnée s'il remonte avant (pods, oxygène…) */
function trackDescent(G,m){
  if(m.descentStart==null) return;
  if(m.mode==='return' || m.mode==='fetch' || m.y===0 && G.t>m.descentStart+1){ m.descentStart=null; return; }
  if(m.y>=m.descentGoal){ m.secPerRowDown=(G.t-m.descentStart)/m.y; m.descentStart=null; }
}

function decideSurface(G,m){
  const left=timeLeft(G);
  if(huntDuck(G,m,left)) return;
  if(m.x!==CHEST_X){ m.status='Va au coffre'; if(!stepDir(G,m,Math.sign(CHEST_X-m.x),0)) idle(m); return; }
  if(m.load>0 || bagToEmpty(G,m)){ m.status='Dépose au coffre'; startAction(m,'deposit',1,{}); return; }
  if(m.ox<m.carac.oxygenMax-0.5){ m.status='Recharge en oxygène'; idle(m,0.5); return; }
  // repartir ne vaut le coup que s'il reste un peu de temps ; près de la fin, il ira miner moins profond (depthCap)
  /* Mule : son sac est encore en bas. S'il n'aura plus le temps de le chercher après un autre trajet, il y va
     maintenant (s'il a encore le temps ; sinon le sac est perdu et il fait comme d'habitude) */
  if(isCarrier(G,m) && mulePlaced(G) && G.mule.load>0 && !pickBlocked(G,m)){
    const need=fetchT(G,m);
    if(left>need && (left<need+CFG.endStayMin || left<CFG.endStayMin || depthCap(G,m)<3)){
      m.mode='fetch'; m.reason='fin de session'; m.returnStart=G.t; log(G, `🎒 ${m.name} redescend chercher son sac (fin de session)`);
      return decideFetch(G,m);
    }
  }
  if(left<CFG.endStayMin || depthCap(G,m)<3){ m.status='Fin de session proche'; idle(m,1); return; }
  if(m.winchJob){ m.mode='winch'; return decideWinch(G,m); }   // chantier du treuil : il repart d'en haut, au milieu
  m.mode='departure';
  /* profondeur max de ce trajet, fixée quand il décide de repartir (sinon il remonterait sans cesse pour la suivre ;
     et avant de rejoindre son puits : il peut tomber dans le treuil en chemin, et partir sans repasser ici) */
  m.tripCap=depthCap(G,m);
  const goal=Math.min(m.lastReturnFromY ?? 0, m.tripCap)-5;   // un peu au-dessus du front : il y mine déjà
  m.descentStart = goal>=10 ? G.t : null; m.descentGoal=goal;
  decideDeparture(G,m);
}

/* à la surface, sac vidé au coffre : il va frapper le Gallianix le plus proche (réglage « combat » sur Combattre) avant
   de repartir, s'il a le temps de revenir au coffre ensuite (ce qu'il lâche est dans son sac). Avant, seulement en fin
   de session : les mineurs encore en remontée à la fin laissaient tous les canards en vie (seed 87312228, 24/10/2026).
   Il ne marche que sur du sol (il ne tombe pas dans la mine), donc pas vers un canard de l'autre côté d'un trou. */
function huntDuck(G,m,left){
  if(m.prefs.fightMobs!==true || m.load>0 || bagToEmpty(G,m)) return false;
  if(isCarrier(G,m) && mulePlaced(G) && G.mule.load>0) return false;   // Mule : son sac passe avant (decideSurface)
  let best=null, bd=Infinity;
  for(const o of G.mobs){
    if(o.type!==DUCK.type || o.hp<=0 || o.y!==0) continue;
    const d=Math.abs(o.x-m.x);
    if(d>=bd || !surfaceWalk(G,m.x,o.x)) continue;
    if(left < (d+Math.abs(o.x-CHEST_X))*moveT(G,m)*1.25 + DUCK.huntMargin) continue;   // aller, retour au coffre, le combat
    best=o; bd=d;
  }
  if(!best) return false;
  if(bd<=1 || inReach(G,m,best,reachOf(m))){ fight(G,m,best); m.status=`Combat (Gallianix ${best.name})`; return true; }
  m.status=`Chasse le Gallianix ${best.name}`;
  if(stepDir(G,m,Math.sign(best.x-m.x),0,{noBridge:true})) return true;
  idle(m,0.3); return true;
}
/* de a à b à la surface, chaque case a un appui (pas de trou où tomber) */
function surfaceWalk(G,a,b){
  for(let x=Math.min(a,b); x<=Math.max(a,b); x++) if(!supported(G,x,0)) return false;
  return true;
}

/* en équipe : au départ du coffre, il reprend une descente existante si elle vaut le coup, sinon il rejoint sa colonne */
function decideDeparture(G,m){
  // une descente par l'existant vaut le coup depuis le coffre (treuil ou puits déjà creusé) : il la prend tout de suite,
  // sans passer par sa colonne (seed 1250570735 : en rejoignant sa colonne, il tombait dans un trou sans échelle et
  // creusait un nouveau puits au lieu de prendre le treuil ; seed 1924731460 : le mineur de droite allait jusqu'à sa
  // colonne recreuser un puits depuis la surface). On se répartit au fond (secteurs), pas pendant la descente.
  // Sinon il rejoint sa colonne pour ouvrir son puits.
  const away = m.homeX!=null && m.x!==m.homeX;
  if(away && planDown(G,m,downAvoid(G,m))) m.status='Descend par l\'existant';
  else if(away){
    m.status='Rejoint son puits';
    if(stepDir(G,m,Math.sign(m.homeX-m.x),0,{noBridge:true})) return;
  }
  m.mode='work'; m.dir=0; m.target=null; m.skipRows.clear();   // repart de la surface : pas obligé de retourner à l'ancien front
  m.exploring=false;
  decideWork(G,m);
}

/* au retour, une échelle à poser sur sa case alors qu'un logisticien remonte juste à côté (en dessous ou à sa hauteur) :
   c'est à lui de la poser (il est plus rapide). On l'attend, au plus SKILLS.ladderYieldMax secondes. */
const needsLadder = (G,m,dy) => dy===-1 && m.y>0 && !G.ladder[m.y][m.x] && isAir(G,m.x,m.y-1);
function yieldLadder(G,m){
  if(m.skillTree==='logisticien') return false;
  const near = others(G,m).some(o=>o.skillTree==='logisticien' && o.mode==='return' && o.y>=m.y
    && Math.abs(o.x-m.x)+Math.abs(o.y-m.y)<=SKILLS.ladderYieldRadius);
  if(!near){ m.yieldSince=null; return false; }
  m.yieldSince ??= G.t;
  return G.t-m.yieldSince < SKILLS.ladderYieldMax;
}

/* Légende de la flemme (skill Mineur, 23/10) : un tirage par remontée, la première fois qu'il décide de son trajet de
   retour (donc après un tacle ou un étourdissement, qui passent avant), sauf en fin de session. Hasard à part (même
   seed, même résultat ; ne change pas les autres tirages). Réussi : il apparaît au-dessus du coffre, sur la surface. */
export function lazyTeleport(G,m){
  if(!m.skill.lazy_legend || m.y<=0 || m.lazyTry===m.returnStart || m.reason==='fin de session') return false;
  m.lazyTry=m.returnStart;
  G.lazyRng ??= mulberry32(G.seed ^ 0x1a2e5e);
  if(!(G.lazyRng() < m.skill.lazy_legend)) return false;
  m.x=CHEST_X; m.y=0; m.fall=null; m.target=null; m.foe=null; m.digCol=null; m.galleryRow=null; m.exploring=false;
  m.stats.lazy=(m.stats.lazy||0)+1; G.stats.lazy=(G.stats.lazy||0)+1;
  log(G, `💤 ${m.name} a la flemme : il se téléporte au-dessus du coffre (${m.reason})`);
  return true;
}

function decideReturn(G,m,rp){
  planPickup(G,m);
  if(needsPickup(G,m)){ m.mode='fetch'; return decideFetch(G,m); }   // Mule : prolongation du treuil ou fin de session
  if(lazyTeleport(G,m)) rp=null;
  if(m.y===0){
    m.mode='surface'; m.lastReturnDur=G.t-m.returnStart;
    /* vitesse de remontée mesurée (secondes par couche), pour la profondeur maximale de fin de session */
    if(m.returnFromY>=10 && m.lastReturnDur>0) m.secPerRow=m.lastReturnDur/m.returnFromY;
    m.lastReturnFromY=m.returnFromY; m.returnFromY=null;
    return decideSurface(G,m);
  }
  m.returnFromY ??= m.y;
  const p = rp || planReturn(G,m);
  m.status='Retour ('+m.reason+')';
  const dy = p && (p.dx||p.dy) ? p.dy : -1;
  if((!p || !p.dx) && needsLadder(G,m,dy) && yieldLadder(G,m)){ m.status='Laisse le logisticien poser l\'échelle'; idle(m,0.3); return; }
  m.yieldSince=null;
  if(p && (p.dx||p.dy) && stepDir(G,m,p.dx,p.dy,{noBridge:!p.bridge})) return;
  if(!stepDir(G,m,0,-1)) idle(m);
}

function decideWork(G,m){
  const left=timeLeft(G);
  m.goingDown=false;   // redescend au front par l'existant (skill Logisticien) : remis à vrai par digDown
  m.digCol=null;   // réservations rafraîchies à chaque décision
  if(!m.exploring) m.galleryRow=null;
  const rp=m.y>0 && !G.khole ? planReturn(G,m) : null;
  let tRet = rp ? rp.cost*1.25 : 0;
  /* Mule : en fin de session, le porteur passe d'abord par son sac ; son retour compte ce détour */
  /* (seulement si c'est encore possible : sinon le sac est perdu, et compter ce détour le faisait remonter aussitôt
     reparti, en boucle, seed 39595) */
  if(rp && isCarrier(G,m) && mulePlaced(G) && G.mule.load>0){ const via=muleEstT(G,m); if(left>=via) tRet=Math.max(tRet, via); }
  if(m.y>0){
    let reason=null;
    if(G.khole);                    // dimension du k hole : pas de surface, aucune remontée (il attend la fin du compteur)
    else if(m.ox<=0) reason='oxygène';   // à 0 d'oxygène il remonte ; la remontée n'en consomme pas (pas de ralentissement)
    else if(m.load>=m.carac.pods-2) reason='pods pleins';
    else if(left<=tRet+12) reason='fin de session';
    else if(m.torches<=0) reason='plus de torches';
    /* donjon (25/10/2026, Geoffrey) : aller au donjon, attendre le barbare, le rejoindre et combattre le boss passent
       avant l'oxygène, les pods et les torches ; seule la fin de session passe avant (sortir du donjon : non) */
    if(reason && reason!=='fin de session' && left>tRet+12 && dungeonGoal(G,m,true)) return;
    /* Mule : pods pleins et un sac pas plein, plus près que la surface : il va y déposer */
    if(reason==='pods pleins' && muleWorth(G,m,rp)){ m.mode='mule'; log(G, `🎒 ${m.name} va déposer dans le sac`); return decideMule(G,m); }
    if(reason){ m.mode='return'; m.reason=reason; m.returnStart=G.t; log(G, `↑ ${m.name} remonte : ${reason}`); return decideReturn(G,m,rp); }
    if(curLum(G,m)<CFG.torchThreshold && m.torches>0 && !torchByOther(G,m)){ m.status='Pose une torche'; startAction(m,'torch',m.carac.torchTime,{}); return; }
  }
  if(trapGoal(G,m)) return;
  if(dungeonGoal(G,m)) return;
  /* focus minerai : abandonne les minerais épuisés partout, change d'area si la sienne est épuisée */
  dropDepleted(G,m);
  const goal=focusGoal(G,m);
  // en route vers une cible de l'area visée, il peut déborder sur l'area voisine (chemin par la ligne du dessus) :
  // le rappeler effacerait sa cible, qu'il reprendrait aussitôt (oscillation à la frontière). Vaut pour le focus
  // d'area comme pour le focus minerai (l'area visée est alors la plus proche qui a encore le minerai), et pour la
  // galerie qu'il va creuser (seed 23757 : galerie en haut de l'area 3, chemin par la dernière ligne de l'area 2)
  // … et pour un treasure ou un résidu visé hors de l'area de travail (voir inFocus plus bas)
  const onTheWay = goal!==null && ((m.target && (areaOf(m.target.y)===goal || !isOre(G.tiles[m.target.y][m.target.x])))
    || (m.exploring && m.galleryRow!=null && areaOf(m.galleryRow)===goal));
  if(goal!==null && !onTheWay) return changeArea(G,m,goal);
  const R=compassR(G,m), ores=compassScan(G,m,R);
  let best=null,bs=0;
  /* l'IA ne vise que les minerais découverts (révélés) ou signalés par la boussole (sa ligne),
     et les coffres au trésor découverts (la boussole ne les signale pas) */
  const known=new Map(ores.map(o=>[o.y*W+o.x,o]));
  for(let y=1;y<=maxRow(G);y++) for(let x=0;x<W;x++){
    const t=G.tiles[y][x];
    if(isTarget(t) && G.seen[y][x] && !known.has(y*W+x) && !G.mimicCells.has(y*W+x) && !fleshAt(G,x,y)) known.set(y*W+x,{x,y,t});
  }
  /* coût réel (au temps) pour atteindre chaque minerai : une seule recherche d'itinéraire qui réutilise échelles,
     galeries et passerelles, et compte les échelles à poser. « Voyage futur » = trajet retour ajouté. */
  const r=search(G,m,m.x,m.y,true,null,CFG.planMaxCost); let bestN=-1;
  /* case voisine d'où miner o au plus court. Pas celle du dessus si miner o le ferait tomber dans un trou connu de plus
     de CFG.maxFall cases (le pas serait refusé : il resterait planté devant, à recommencer) */
  const nbrBest = o => { let bd=Infinity, bn=-1;
    for(const [dx,dy] of DIRS){ const nx=o.x+dx, ny=o.y+dy; if(nx<0||nx>=W||ny<1||ny>maxRow(G)) continue;
      if(dy===-1 && deepFall(G,{...m,x:nx,y:ny},0,1)) continue;
      const n=ny*W+nx; if(r.dist[n]<bd){ bd=r.dist[n]; bn=n; } }
    return {bd,bn}; };
  // engagement : on garde la cible tant qu'elle existe et reste atteignable (évite les va-et-vient entre deux choix)
  // … sauf si un autre mineur (plus petit numéro) la vise aussi
  // focus d'area : seules les cibles de cette area comptent (sinon il en sortirait, puis y reviendrait : oscillation).
  // focus minerai : pas de cible dans une area épuisée pour ses minerais visés (il y monterait, le focus le renverrait
  // aussitôt dans la sienne, et il recommencerait : va-et-vient sur l'échelle à la frontière, seed 770973224)
  // « Plus profond » : pareil, avec l'area la plus profonde débloquée (workArea)
  const A=workArea(G,m), act=activeOres(oreFocus(G,m));
  /* fin de session : rien sous la profondeur maximale du trajet, fixée au départ de la surface (il mine plus haut) */
  const cap=m.tripCap ?? Infinity;
  /* un treasure ou un résidu découvert à portée (CFG.oreReach) est visé quel que soit le focus d'area : sinon celui
     d'une area du dessus restait là toute la partie, même à 3 cases du treuil où tout le monde passe (seed 1384517703) */
  const inFocus = (y,t) => y<=cap && (!isOre(t) || (A!==null ? areaOf(y)===A : !act.length || areaGood(G,areaOf(y),act)));
  const tg=m.target;
  if(tg){ const t=G.tiles[tg.y][tg.x], nb=nbrBest(tg), rival=oreTakenBy(G,m,tg.x,tg.y);
    if(isTarget(t) && targetVal(G,m,t)!==null && inFocus(tg.y,t) && nb.bn>=0 && !(rival && rival.id<m.id)){ m.status=targetStatus(t); return goOre(G,m,tg,r,nb.bn); }
    m.target=null; }
  for(const o of known.values()){
    if(!inFocus(o.y,o.t)) continue;
    const dist=Math.abs(o.x-m.x)+Math.abs(o.y-m.y);
    if(dist>CFG.oreReach) continue;   // un filon lointain n'est pas plus attirant que creuser du neuf
    if(oreTakenBy(G,m,o.x,o.y)) continue;   // déjà visé ou en cours de minage par un autre
    if(veinTaken(G,m,o.x,o.y)) continue;    // filon réservé : un autre vise un minerai tout près
    const val=targetVal(G,m,o.t);
    if(val===null) continue;                // focus « only » : les autres minerais sont ignorés
    const {bd,bn}=nbrBest(o);
    if(bn<0) continue;
    const travel=Math.abs(o.x-m.x)*moveT(G,m)+Math.abs(o.y-m.y)*climbT(G,m);
    // un filon où travaille déjà un autre mineur, ou hors de son secteur, est moins attirant : on se répartit la mine
    const s=val/(bd+mineT(G,m,o.t)+CFG.futureTravelWeight*travel+1)
      /(1+CFG.crowdPenalty*crowdAt(G,m,o.x,o.y))/(1+CFG.sectorPenalty*outOfSector(m,o.x))
      /(1+CFG.rowCrowdPenalty*rowCrowd(G,m,o.y));   // cible sur la ligne d'un autre mineur (±1) : moins intéressante
    if(s>bs){ bs=s; best=o; bestN=bn; }
  }
  // descend tant que la case du dessous n'est pas une barrière, sauf en phase d'exploration (fond de l'area verrouillé)
  // … et ne passe pas dans une area épuisée pour son focus : il explore la sienne en galeries
  const stopK=focusStop(G,m);
  const down = !m.exploring && stopK===null && tileAt(G,m.x,m.y+1) !== BARRIER && m.y<cap;
  const range = (m.prefs.priority==='minerais'||!down) ? R : 3;
  if(best && Math.abs(best.x-m.x)<=range){ m.target={x:best.x,y:best.y}; m.status=targetStatus(best.t); return goOre(G,m,best,r,bestN); }
  if(down) return digDown(G,m);
  const k = stopK ?? (m.exploring && m.exploreArea!=null ? m.exploreArea : G.unlockedAreas-1);
  explore(G,m, Math.min(k, Math.max(0,areaOf(cap))), cap);   // fin de session : galeries au-dessus de la profondeur max
}

function digDown(G,m){
  // ne pas descendre là où un autre travaille déjà
  const pd=planDown(G,m,downAvoid(G,m));
  if(pd && (pd.dx||pd.dy) && stepDir(G,m,pd.dx,pd.dy,{noBridge:!pd.bridge})){ m.status='Descend par l\'existant'; m.goingDown=true; return; }
  // un autre creuse déjà ce puits sous moi : je me décale pour ouvrir le mien
  if(columnTaken(G,m,m.x) && shiftColumn(G,m)) return;
  m.digCol=m.x; m.status='Creuse vers le bas';
  if(stepDir(G,m,0,1)) return;
  /* bloc incassable sous ses pieds (mur de donjon) : il se décale vers une colonne où l'on peut creuser */
  const under=tileAt(G,m.x,m.y+1);
  if(under && under!==BARRIER && BLOCKS[under].unbreakable){
    if(shiftColumn(G,m,(x,y)=>{ const t=tileAt(G,x,y+1); return !t || !BLOCKS[t].unbreakable; })) return;
    return explore(G,m,Math.max(0,areaOf(m.y)));
  }
  /* un trou connu de plus de CFG.maxFall cases sous ses pieds : il ne s'y jette pas, il creuse ailleurs */
  if(deepFall(G,m,0,1)){
    if(shiftColumn(G,m,(x,y)=>!deepFall(G,{...m,x,y},0,1))) return;
    return explore(G,m,Math.max(0,areaOf(m.y)));
  }
  idle(m);
}

/* focus : l'area juste en dessous est hors du focus d'area (ou de « Plus profond »), ou épuisée pour ses minerais visés → renvoie l'area où
   rester (sinon null) */
function focusStop(G,m){
  const A=workArea(G,m);
  if(A!==null) return areaOf(m.y+1)>A ? A : null;
  const act=activeOres(oreFocus(G,m));
  if(!act.length) return null;
  const cur=Math.max(0,areaOf(m.y)), below=areaOf(m.y+1);
  return below>cur && below<G.unlockedAreas && !areaGood(G,below,act) ? cur : null;
}

/* focus : il n'est pas dans l'area visée, ou la sienne est épuisée pour ses minerais visés → il rejoint l'area goal
   (descend, ou remonte au plus court) */
function changeArea(G,m,goal){
  m.exploring=false; m.target=null; m.galleryRow=null;
  const label=`Change d'area → area ${goal} (focus)`;
  if(goal>areaOf(m.y)){ digDown(G,m); m.status=label; return; }
  m.status=label;
  const r=search(G,m,m.x,m.y,true,(x,y)=>areaOf(y)===goal,Infinity,1), s=r && firstStep(r,r.n);
  if(s && (s.dx||s.dy) && stepDir(G,m,s.dx,s.dy,{noBridge:!s.bridge})) return;
  idle(m,0.3);
}

/* se décaler sur la même ligne vers une colonne libre (au moins CFG.shaftGap colonnes des puits des autres) ;
   ok(x,y) : condition en plus sur la case d'arrivée */
function shiftColumn(G,m,ok=null){
  const cols=others(G,m).flatMap(o=>[o.digCol, o.y>m.y ? o.x : null]).filter(c=>c!=null);
  const r=search(G,m,m.x,m.y,true,(x,y)=>y===m.y && x!==m.x && cols.every(c=>Math.abs(c-x)>=CFG.shaftGap) && (!ok || ok(x,y)),CFG.planMaxCost);
  const s=r && firstStep(r,r.n);
  if(!s || !(s.dx||s.dy)) return false;
  m.status='Se décale (puits occupé)';
  return stepDir(G,m,s.dx,s.dy,{noBridge:!s.bridge});
}

/* tacle : src/sim/mobs.js (tackler, réexporté plus haut) */

/* ---- Donjon (src/sim/dungeon.js) : une fois découvert, et tant que son boss vit ----
   - dedans sans en avoir le droit (effrayé, ou avant le barbare) : il ressort ;
   - un barbare dans la partie : le barbare va combattre le boss ; les autres se rassemblent devant l'entrée et
     attendent ; quand le barbare est entré, ils entrent combattre aussi, sauf « Fuir » (ils reprennent leur travail) ;
   - pas de barbare : rien (il mine comme d'habitude, sans jamais y entrer).
   duty : appelé alors qu'il devrait remonter (oxygène, pods, torches) : seulement son rôle au donjon, pas la sortie.
   Renvoie true s'il a choisi une action. */
function dungeonGoal(G,m,duty=false){
  if(m.y<=0 || m.mode==='winch' || m.winchJob) return false;
  for(const d of G.dungeons){
    if(!active(G,d)) continue;
    const inside=isIn(d,m), may=mayEnter(G,m,d);
    if(inside && !may && duty) continue;
    if(inside && !may) return goTo(G,m,(x,y)=>!inRoom(d,x,y), m.scaredUntil>G.t ? 'Effrayé ! Sort du donjon' : 'Sort du donjon');
    if(!hasBarbarian(G)) continue;
    m.helping=true;   // il va au boss (ou attend le barbare devant l'entrée)
    const boss=bossOf(G,d);
    if(may){
      if(Math.abs(boss.x-m.x)+Math.abs(boss.y-m.y)<=1 || inReach(G,m,boss,reachOf(m))){ m.foe=boss.id; m.foeHit=G.t; fight(G,m,boss); m.status='Combat le '+boss.type; return true; }
      if(goTo(G,m,(x,y)=>inRoom(d,x,y) && Math.abs(x-boss.x)+Math.abs(y-boss.y)<=1, isBarbarian(m) ? 'Entre dans le donjon' : 'Rejoint le barbare dans le donjon')) return true;
      continue;
    }
    if(d.barbIn) continue;                         // « Fuir » : il ne rentre pas, il reprend son travail
    const f=front(d), near=(x,y)=>!inRoom(d,x,y) && Math.abs(x-d.hx)+Math.abs(y-d.hy)<=2;
    if(near(m.x,m.y)){ m.target=null; m.status='Attend le barbare devant le donjon'; idle(m,0.5); return true; }
    if(goTo(G,m,(x,y)=>(x===f.x && y===f.y) || near(x,y), 'Rejoint l\'entrée du donjon')) return true;
  }
  return false;
}
/* va vers la case la plus proche qui remplit goal (en creusant si besoin) ; false si aucune n'est atteignable */
function goTo(G,m,goal,status){
  const r=search(G,m,m.x,m.y,true,goal,Infinity), s=r && firstStep(r,r.n);   // tout le monde se rejoint, même de loin
  if(!s) return false;
  m.target=null; m.exploring=false; m.status=status;
  if(!(s.dx||s.dy)){ idle(m,0.3); return true; }
  if(stepDir(G,m,s.dx,s.dy,{noBridge:!s.bridge})) return true;
  idle(m,0.3); return true;
}

/* Chantier du treuil (logisticien) : depuis la surface, au milieu de la mine (WINCH.x), il descend (par le treuil déjà
   posé s'il y en a un) et creuse tout droit jusqu'à la ligne visée, puis pose tout le treuil d'un coup. Il remonte
   comme d'habitude si l'oxygène, les pods, les torches ou le temps l'exigent (le chantier reprend ensuite). */
function decideWinch(G,m){
  const job=m.winchJob, left=timeLeft(G);
  if(m.y===0){
    m.status='Va installer le treuil';
    if(m.x!==WINCH.x){ if(!stepDir(G,m,Math.sign(WINCH.x-m.x),0,{noBridge:true})) idle(m); return; }
  } else {
    let reason=null;
    if(m.x===WINCH.x) m.winchDepth=Math.max(m.winchDepth ?? 0, m.y);
    else {
      /* sorti du puits (combat, tacle) : il y retourne par le chemin le plus court s'il est proche, à une hauteur déjà
         creusée ; sinon il repart d'en haut (avec des mobs résistants, repartir d'en haut à chaque combat tournait en rond) */
      /* hauteur déjà creusée : celle de ce chantier, le treuil déjà posé qu'il prolonge, ou la colonne du treuil déjà
         vide depuis la surface (seed 1209172417, 23/10 : tombé à côté du puits en allant le prolonger, il remontait,
         retombait, remontait… jusqu'à la fin ; seed 39595 : entraîné dans un combat dès la 1re case du puits, sa
         hauteur n'était jamais notée, même boucle) */
      let open=0; while(open<maxRow(G) && isAir(G,WINCH.x,open+1)) open++;
      const top=Math.max(m.winchDepth ?? 0, G.winch?.bottom ?? 0, open);
      const r=top>0 && search(G,m,m.x,m.y,true,(x,y)=>x===WINCH.x && y>=1 && y<=top,CFG.planMaxCost);
      const st=r && firstStep(r,r.n);
      if(st && (st.dx||st.dy)){ m.status='Retourne au puits du treuil'; if(!stepDir(G,m,st.dx,st.dy,{noBridge:!st.bridge})) idle(m,0.3); return; }
      reason='treuil';                                           // pas dans le puits : il repart d'en haut
    }
    if(reason){ /* déjà décidé */ }
    else if(m.ox<=0) reason='oxygène';
    else if(m.load>=m.carac.pods-2) reason='pods pleins';
    else if(left<=m.y/m.carac.climbSpeed*1.25+12) reason='fin de session';
    else if(m.torches<=0) reason='plus de torches';
    if(reason){ m.mode='return'; m.reason=reason; m.returnStart=G.t; return decideReturn(G,m); }
    /* Mule : en descendant par le puits, il reprend son sac posé à côté de l'ancien bas du treuil (il le reposera en bas) */
    if(isCarrier(G,m) && mulePlaced(G) && nearMule(G,m.x,m.y) && G.mule.y<job.bottom){ m.status='Ramasse son sac'; startAction(m,'mulePick',MULE.pickTime,{}); return; }
    if(m.y>=job.bottom){
      G.winch={ x:WINCH.x, bottom:Math.max(G.winch?.bottom ?? 0, m.y) };
      if(job.lift || G.winch.lift) G.winch.lift=true;   // Glyphe Treuil : un ascenseur (une fois posé, il le reste)
      /* il retire les échelles du puits : le treuil prend toute la colonne, de la surface jusqu'en bas */
      let removed=0;
      for(let y=1;y<=G.winch.bottom;y++) if(G.ladder[y][WINCH.x]){ G.ladder[y][WINCH.x]=0; removed++; }
      log(G, `🪣 ${m.name} a posé ${G.winch.lift ? 'l\'ascenseur' : 'le treuil'} : de la surface jusqu'à la couche ${G.winch.bottom}`+(removed ? ` (${removed} échelle${removed>1?'s':''} retirée${removed>1?'s':''})` : ''));
      m.winchJob=null; m.winchDepth=null; m.mode='work';
      m.muleJob=muleAfterWinch(G,m);   // Mule : il pose son sac à côté du bas du treuil (null : pas de sac à poser)
      return m.muleJob ? decideMulePlace(G,m) : decideWork(G,m);
    }
    if(curLum(G,m)<CFG.torchThreshold && m.torches>0 && !torchByOther(G,m)){ m.status='Pose une torche'; startAction(m,'torch',m.carac.torchTime,{}); return; }
    m.status='Creuse le puits du treuil';
  }
  if(stepDir(G,m,0,1)) return;
  log(G, `🪣 ${m.name} ne peut pas creuser plus bas : treuil abandonné`);   // bloc incassable sous lui
  m.winchJob=null; m.mode=m.y>0 ? 'work' : 'surface'; idle(m,0.5);
}

/* Aider allié (préférence helpAllies) : dès qu'un mob a pris un AUTRE mineur en chasse (état « combat » de la session,
   o.chase), il va tout de suite le combattre, sauf les types de mob qu'il ignore (prefs.helpIgnore). Pas en retour vers
   la surface. Le mob mort, il reprend sa décision normale (sa priorité), sans revenir où il était. */
function helpAlly(G,m){
  // pas pendant un retour, ni pendant le chantier du treuil (il devrait ensuite le reprendre depuis la surface : boucle)
  if(!m.prefs.helpAllies || !G.combat || m.mode==='return' || m.mode==='winch' || m.winchJob) return false;
  const ign=m.prefs.helpIgnore||[];
  let best=null, bd=Infinity;
  for(const o of G.mobs){
    /* le mob qu'il est allé combattre reste sa cible s'il se retourne contre lui : un mob chasse le mineur le plus
       proche, donc en approchant l'aidant devenait la proie, lâchait (hors de sa lumière), s'éloignait, et le mob
       rechassait l'allié : aller-retour sans fin (seed 1928461225, deux mineurs en Aider allié, 24/10/2026) */
    if(o.hp<=0 || o.chase==null || (o.chase===m.id && o.id!==m.helpFoe) || ign.includes(o.type) || m.ignored.has(o.id) || o.dungeon!=null) continue;
    if(o.id===m.helpSkip) continue;   // aide abandonnée (trop loin) : il ne revient pas sur ce mob
    const d=Math.abs(o.x-m.x)+Math.abs(o.y-m.y), mine=o.id===m.helpFoe;
    /* sa cible garde une marge (HELP.keep) ; au-delà, il l'abandonne pour de bon : sinon le chemin (contournement)
       le fait passer et repasser la limite à chaque pas (seed 7919) */
    if(mine && d>HELP.keep){ m.helpSkip=o.id; m.helpFoe=null; continue; }
    if(d<=(mine ? HELP.keep : HELP.range) && (mine || d<bd) && best?.id!==m.helpFoe){ bd=d; best=o; }
  }
  if(!best) return false;
  // le mob s'est retourné contre lui : c'est son combat, plus une aide
  if(best.chase===m.id){ m.helping=true; m.target=null; m.galleryRow=null; return goFight(G,m,best,bd,'Combat ('+best.type+')','Combat ('+best.type+')'); }
  const who=(G.miners.find(a=>a.id===best.chase)?.name ?? 'un allié')+' ('+best.type+')';
  m.helping=true; m.helpFoe=best.id;
  /* il lâche sa cible et sa galerie : le mob mort, il choisit son travail là où il est, au lieu de retraverser la mine
     pour reprendre l'ancien (23/10/2026, Geoffrey) */
  m.target=null; m.galleryRow=null;
  return goFight(G,m,best,bd,'Aide '+who,'Va aider '+who);
}

/* va frapper le mob o (à d cases, Manhattan) : il frappe s'il est au contact, sinon il fait un pas vers lui (en minant
   s'il le faut). Inatteignable : il l'ignore désormais et renvoie false. */
function goFight(G,m,o,d,fighting,going){
  if(d<=1 || inReach(G,m,o,reachOf(m))){ if(m.foe!==o.id){ m.foe=o.id; m.foeHit=G.t; } fight(G,m,o); m.status=fighting; return true; }
  const at=(x,y)=>o.h ? nearCell(o,{x,y}) : o;   // mur de chair : à côté de n'importe laquelle de ses cases
  const r=search(G,m,m.x,m.y,true,(x,y)=>{ const c=at(x,y); return Math.abs(x-c.x)+Math.abs(y-c.y)<=1 && !(x===c.x && y===c.y && !isAir(G,x,y)); });
  const s=r && firstStep(r,r.n);
  if(!s || !(s.dx||s.dy)){ m.ignored.add(o.id); m.foe=null; return false; }   // inatteignable : il le laisse
  m.status=going;
  if(stepDir(G,m,s.dx,s.dy,{noBridge:!s.bridge})) return true;
  idle(m,0.3); return true;
}

/* Piège (TRAP) : un barbare va tuer les mobs sortis d'un piège, où qu'ils soient et quels que soient ses réglages
   (Ignorer, Fuir, Aider allié), comme au donjon. Appelé depuis decideWork : les raisons de remonter passent avant. */
function trapGoal(G,m){
  if(!isBarbarian(m) || m.y<=0 || m.mode==='winch' || m.winchJob || !G.traps?.some(t=>t.sprung)) return false;
  let best=null, bd=Infinity;
  for(const o of G.mobs){
    if(o.hp<=0 || o.trap==null || m.ignored.has(o.id)) continue;
    const d=Math.abs(o.x-m.x)+Math.abs(o.y-m.y); if(d<bd){ bd=d; best=o; }
  }
  if(!best) return false;
  const t=G.traps[best.trap], who=G.miners.find(a=>a.id===t.by && a!==m)?.name;
  m.helping=true; m.helpFoe=best.id;
  return goFight(G,m,best,bd,'Combat ('+best.type+', piège)', who ? 'À la rescousse de '+who : 'Va au piège');
}

/* ---- Mule (skill Logisticien, étage 4 ; src/sim/mule.js) ---- */
/* au coffre, le porteur vide aussi le sac qu'il transporte */
const bagToEmpty = (G,m) => isCarrier(G,m) && !G.mule.placed && Object.keys(G.mule.inv).length>0;
/* recherche vers le sac ratée il y a peu : on ne la relance pas à chaque décision */
const pickBlocked = (G,m) => m.pickFail!=null && G.t-m.pickFail<CFG.foeGiveUp;
/* le porteur ramasse son sac posé quand il remonte pour prolonger le treuil (m.muleFetch : le sac est sur son chemin,
   voir decide), ou en fin de session : quand cette remontée est la dernière qui lui laisse le temps de récupérer le
   sac (après, un aller-retour depuis la surface ne passerait plus), et s'il a encore le temps d'aller le chercher */
const needsPickup = (G,m) => {
  if(!isCarrier(G,m) || !mulePlaced(G) || pickBlocked(G,m)) return false;
  if(m.muleFetch) return true;
  if(!(G.mule.load>0)) return false;                       // sac vide : rien à perdre, pas de détour
  if(m.reason==='fin de session') return timeLeft(G)>=muleEstT(G,m);
  return m.pickPlan===m.returnStart;                        // décidé au début de cette remontée (planPickup)
};
/* au début de chaque remontée (une seule fois : sinon la fenêtre s'ouvrait en route et il redescendait, seed 79190) :
   est-ce la dernière qui lui laisse le temps de récupérer son sac ? */
function planPickup(G,m){
  /* décidé pour cette remontée, sauf si le sac était vide et qu'un mineur vient d'y déposer (seed 39595) */
  if(m.pickPlanAt===m.returnStart && !(m.pickPlanEmpty && G.mule?.load>0)) return;
  m.pickPlanAt=m.returnStart; m.pickPlan=null; m.pickPlanEmpty=!(G.mule?.load>0);
  if(!isCarrier(G,m) || !mulePlaced(G) || !(G.mule.load>0)) return;
  const left=timeLeft(G), via=muleEstT(G,m);
  if(left>=via && left<via+fetchFromTop(G,m)+CFG.endStayMin) m.pickPlan=m.returnStart;
}
/* temps estimé (avec la marge de 1,25 du retour) pour aller du sac au coffre : par le seau, puis à pied */
const muleToChestT = (G,m) => (G.mule.y*baseWinchT(G,m) + Math.abs(G.mule.x-CHEST_X)*baseMoveT(m))*1.25;
/* temps estimé d'un retour qui passe par le sac : jusqu'au sac (par le puits), le ramasser, puis jusqu'au coffre.
   Une estimation (pas de recherche d'itinéraire) : elle est calculée à chaque décision. */
const muleEstT = (G,m) => (Math.abs(m.y-G.mule.y)*baseWinchT(G,m) + Math.abs(m.x-G.mule.x)*baseMoveT(m))*1.25 + MULE.pickTime + muleToChestT(G,m);
/* depuis la surface : aller chercher le sac et revenir, avec une marge (fetchT : depuis là où il est ; fetchFromTop :
   depuis le coffre) */
const fetchT = (G,m) => muleEstT(G,m) + 12;
const fetchFromTop = (G,m) => 2*muleToChestT(G,m) + MULE.pickTime + 12;

/* il va ramasser son sac (mode 'fetch' : pas un retour, il peut descendre) ; ramassé (ou plus besoin) : il remonte */
function decideFetch(G,m){
  if(!needsPickup(G,m)){ m.mode='return'; m.muleFetch=false; return decideReturn(G,m); }
  return goPickup(G,m);
}
/* un sac posé où il reste de la place pour ce qu'il porte, plus près (en temps) que le coffre */
function muleWorth(G,m,rp){
  if(!muleFits(G,m)) return false;
  return !!search(G,m,m.x,m.y,true,(x,y)=>nearMule(G,x,y), rp ? rp.cost : Infinity, 1);
}

function goPickup(G,m){
  if(nearMule(G,m.x,m.y)){ m.status='Ramasse son sac'; startAction(m,'mulePick',MULE.pickTime,{}); return; }
  const r=search(G,m,m.x,m.y,true,(x,y)=>nearMule(G,x,y),Infinity,1), s=r && firstStep(r,r.n);
  if(!s || !(s.dx||s.dy)){ m.pickFail=G.t; log(G, `🎒 ${m.name} ne peut pas rejoindre son sac`); idle(m,0.3); return; }
  m.status='Va ramasser son sac';
  if(stepDir(G,m,s.dx,s.dy,{noBridge:!s.bridge})) return;
  idle(m,0.3);
}

/* pods pleins : il va déposer dans le sac. Déposé (ou sac devenu plein, ramassé, trop loin) : il reprend son travail
   s'il a de la place, sinon il remonte au coffre comme d'habitude. Oxygène et fin de session passent avant. */
function decideMule(G,m){
  const left=timeLeft(G);
  const back = reason => { m.mode='return'; m.reason=reason; m.returnStart=G.t; log(G, `↑ ${m.name} remonte : ${reason}`); return decideReturn(G,m); };
  if(m.load<m.carac.pods-2){ m.mode='work'; return decideWork(G,m); }
  if(m.ox<=0) return back('oxygène');
  if(left<=m.y/m.carac.climbSpeed*1.25+12) return back('fin de session');
  if(!muleFits(G,m)) return back('pods pleins');   // sac plein (ou plus assez de place pour ce qu'il porte)
  if(nearMule(G,m.x,m.y)){ m.status='Dépose dans le sac'; startAction(m,'muleDeposit',MULE.depositTime,{}); return; }
  const r=search(G,m,m.x,m.y,true,(x,y)=>nearMule(G,x,y),Infinity,1), s=r && firstStep(r,r.n);
  if(!s || !(s.dx||s.dy)) return back('pods pleins');
  m.status='Va au sac';
  if(stepDir(G,m,s.dx,s.dy,{noBridge:!s.bridge})) return;
  idle(m,0.3);
}

/* treuil posé : il pose son sac sur la case m.muleJob, à côté du bas du treuil (il la mine si besoin) */
function decideMulePlace(G,m){
  const s=m.muleJob;
  const drop = why => { if(why) log(G, `🎒 ${m.name} ne peut pas poser son sac (${why})`); m.muleJob=null; return decideWork(G,m); };
  if(!G.mule || G.mule.placed || G.mule.carrier!==m.id) return drop(null);
  const d=Math.abs(s.x-m.x)+Math.abs(s.y-m.y);
  if(d<=1 && isAir(G,s.x,s.y)){ m.status='Pose son sac'; startAction(m,'mulePlace',MULE.pickTime,{x:s.x,y:s.y}); return; }
  if(d===1){ m.status='Fait la place du sac'; if(stepDir(G,m,s.x-m.x,s.y-m.y,{noBridge:true})) return; return drop('bloc incassable'); }
  const r=search(G,m,m.x,m.y,true,(x,y)=>Math.abs(x-s.x)+Math.abs(y-s.y)===1,Infinity,1), st=r && firstStep(r,r.n);
  if(!st || !(st.dx||st.dy)) return drop('case inatteignable');
  m.status='Va poser son sac';
  if(stepDir(G,m,st.dx,st.dy,{noBridge:!st.bridge})) return;
  idle(m,0.3);
}

export function decide(G,m){
  m.helping=false;   // skill braum : remis à vrai par une aide (helpAlly, trapGoal, dungeonGoal) ou le combat qui suit
  // gravité : sans appui, il tombe d'une case. Au début de la chute, on note d'où il part et s'il connaissait le trou.
  if(!supported(G,m.x,m.y)){
    if(!m.fall) m.fall={ y0:m.y, blind:!fallInfo(G,m.x,m.y).known };
    m.status='Tombe'; G.stats.falls++; m.stats.falls++; startAction(m,'move', ontoLadder(G,m.x,landing(G,m.x,m.y).y) ? climbT(G,m) : 1/CFG.fallSpeed, {x:m.x,y:m.y+1,down:true,fall:true,fx:m.x,fy:m.y}); return;
  }
  // atterrissage : une chute imprévue (vide pas encore découvert) d'au moins CFG.stunFall cases l'étourdit, et toute
  // chute de plus de CFG.maxFall cases aussi, même dans un trou connu : il ne s'y jette jamais, c'est donc que son appui
  // a disparu (ex. puits d'un autre mineur creusé sous lui)
  if(m.fall){
    const n=m.y-m.fall.y0, blind=m.fall.blind; m.fall=null;
    if((blind || n>CFG.maxFall) && n>=CFG.stunFall && !m.winchJob){          // en chantier de treuil : jamais étourdi
      G.stats.stuns=(G.stats.stuns||0)+1; m.stats.stuns++;
      log(G, `💫 ${m.name} tombe de ${n} blocs sans s'y attendre : étourdi ${CFG.stunTime} s`);
      m.status='Étourdi (chute)'; startAction(m,'stun', CFG.stunTime, {cause:'fall'}); return;
    }
  }
  // canalisation d'un occultiste sur lui : étourdi tant qu'elle dure (il ne peut ni bouger, ni miner, ni frapper)
  { const oc=channeler(G,m); if(oc){ m.status='Étourdi (occultiste)'; startAction(m,'stun', oc.channel.left, {hex:true, cause:'hex'}); return; } }
  // ébranlement d'un golem (src/sim/golem.js) : étourdi jusqu'à m.quakeUntil
  if(m.quakeUntil>G.t+1e-9){ m.status='Étourdi (golem)'; startAction(m,'stun', m.quakeUntil-G.t, {cause:'quake'}); return; }
  /* taclé : il ne peut rien faire d'autre que combattre ce mob (même si « combat » est sur non, même en retour) ; il peut
     bouger pour rester à portée (25/10 ; avant : immobilisé). Ses pas sont marqués (data.fight) : le tacle ne les
     interrompt pas (src/sim/session.js) */
  { const tk=tackler(G,m); if(tk){ m.foe=tk.id; m.foeHit=G.t; fight(G,m,tk); if(m.action) m.action.data.fight=true; m.status='Taclé ! ('+tk.type+')'; return; } }
  if(m.mode==='surface' && m.y>0){ m.mode='return'; m.reason='chute'; m.returnStart=G.t; }  // tombé dans un trou en rejoignant le coffre
  if(m.mode==='departure' && m.y>0) m.mode='work';                       // tombé en rejoignant son puits : il est parti
  trackDescent(G,m);
  if(m.y>0){
    /* engagement : une fois déclenché, le combat continue même si le mob sort du champ de vision.
       On lâche s'il s'éloigne trop ; on l'ignore si aucun coup n'a porté depuis foeGiveUp secondes. Sauf un barbare
       face à un mob de piège : il le lâche sans l'ignorer, la rescousse (trapGoal) le reprend par le vrai chemin
       (25/10/2026 : en creusant jusqu'à la salle, il les ignorait un par un, seed 39595) */
    let th=null;
    const foe=m.foe && G.mobs.find(o=>o.id===m.foe && o.hp>0 && o.dungeon==null);   // le boss : voir dungeonGoal
    if(foe && G.t-m.foeHit>CFG.foeGiveUp){ if(!(foe.trap!=null && isBarbarian(m))) m.ignored.add(foe.id); m.foe=null; }
    else if(foe && (c=>Math.hypot(c.x-m.x,c.y-m.y))(foe.h ? nearCell(foe,m) : foe)<=CFG.foeLeash) th=foe;
    else m.foe=null;
    m.helping = !!th && th.id===m.helpFoe;   // il continue le combat commencé pour un allié
    if(!th) th=nearestThreat(G,m);
    // en retour, il ne se bat que contre un mimic qui lui bloque le passage (sinon il le « mine » à l'infini)
    const blocking = th && th.type==='mimic' && Math.abs(th.x-m.x)+Math.abs(th.y-m.y)<=1;
    /* Ignorer ou Fuir : il n'engage pas ; sauf dans une salle de combat du k hole (allFight : arène, vagues), où tout le
       monde se bat (27/10/2026, Geoffrey) */
    if(th && (((m.prefs.fightMobs===true || G.khole?.map.allFight) && m.mode!=='return') || blocking)){
      if(m.foe!==th.id){ m.foe=th.id; m.foeHit=G.t; }
      fight(G,m,th); return;
    }
    if(helpAlly(G,m)) return;
  }
  /* chantier du treuil : il arrête ce qu'il fait et remonte (le chantier commence toujours d'en haut) */
  if(m.winchJob && (m.mode==='work' || m.mode==='departure' || m.mode==='mule')){
    if(m.y>0){ m.mode='return'; m.reason='treuil'; m.returnStart=G.t; log(G, `↑ ${m.name} remonte : treuil à installer`);
      /* Mule : il repasse par son sac (pour le vider au coffre) s'il est sur son chemin ; sinon il le reprendra en
         redescendant par le puits */
      m.muleFetch = isCarrier(G,m) && mulePlaced(G) && G.mule.y<=m.y+MULE.pickBelow; }
    else m.mode='winch';
  }
  if(m.mode==='winch')     return decideWinch(G,m);
  if(m.mode==='mule')      return decideMule(G,m);
  if(m.mode==='fetch')     return decideFetch(G,m);
  if(m.muleJob && m.mode==='work' && m.y>0) return decideMulePlace(G,m);
  if(m.mode==='surface')   return decideSurface(G,m);
  if(m.mode==='departure') return decideDeparture(G,m);
  if(m.mode==='return')    return decideReturn(G,m);
  return decideWork(G,m);
}
