/* Itinéraires au moindre TEMPS (Dijkstra), pas au nombre de cases.
   Arêtes : marcher dans le vide (+ chute éventuelle), poser une passerelle, miner en galerie, monter
   (échelle existante = montée ; sinon poser une échelle ; bloc au-dessus = on le mine d'abord),
   descendre (échelle ou chute), creuser vers le bas.
   Chaque nœud est une case où le mineur TIENT : il ne peut rien faire dans le vide, toute arrivée
   sur une case sans appui continue donc en chute (landing). Jamais de chute de plus de CFG.maxFall cases. */
import { W, CFG, CHEST_X, BLOCKS, BARRIER } from '../config.js';
import { isAir, tileAt, landing } from './world.js';
import { baseMoveT, baseClimbT, baseMineT } from './miner.js';

/* build=false : uniquement l'existant (pas de minage, pas de nouvelle échelle).
   lw : poids de planification d'une NOUVELLE échelle (>1 pousse à réutiliser l'existant ; 1 = temps réel). */
export function search(G,m,sx,sy,build,goalFn,maxCost=Infinity,lw=CFG.ladderPlanWeight){
  const H=G.tiles.length, N=H*W, dist=new Float64Array(N).fill(Infinity), par=new Int32Array(N).fill(-1), typ=new Uint8Array(N);
  /* tas binaire (file de priorité) en deux tableaux parallèles : distance hd, nœud hn. Mêmes comparaisons et mêmes
     échanges qu'un tas de paires [d,n] : les nœuds sortent dans le même ordre (itinéraires identiques, à égalité
     comprise), sans créer de petits tableaux à chaque opération. popD/popN : le dernier élément sorti. */
  const hd=[], hn=[];
  let popD=0, popN=0;
  const push=(d,n)=>{
    let i=hd.length; hd.push(d); hn.push(n);
    while(i>0){ const p=(i-1)>>1; if(hd[p]<=hd[i]) break;
      const td=hd[p]; hd[p]=hd[i]; hd[i]=td; const tn=hn[p]; hn[p]=hn[i]; hn[i]=tn; i=p; }
  };
  const pop=()=>{
    popD=hd[0]; popN=hn[0];
    const ld=hd.pop(), ln=hn.pop(), len=hd.length;
    if(len){ hd[0]=ld; hn[0]=ln; let i=0;
      for(;;){ const l=2*i+1, r=l+1; let s=i;
        if(l<len&&hd[l]<hd[s]) s=l; if(r<len&&hd[r]<hd[s]) s=r; if(s===i) break;
        const td=hd[s]; hd[s]=hd[i]; hd[i]=td; const tn=hn[s]; hn[s]=hn[i]; hn[i]=tn; i=s; } }
  };
  /* lignes occupées par les autres mineurs (leur ligne, celle du dessus et celle du dessous) : un chemin qui y passe
     coûte plus cher, pour que chacun travaille sur ses propres lignes */
  const busy=new Uint8Array(H+2);
  for(const o of G.miners) if(o!==m && o.y>0) for(let k=-1;k<=1;k++) if(o.y+k>=1 && o.y+k<H) busy[o.y+k]=1;
  const relax=(from,d,x,y,c,ty=0)=>{ const n=y*W+x, nd=d+c+(busy[y]?CFG.rowCrowdCost:0); if(nd<dist[n]){ dist[n]=nd; par[n]=from; typ[n]=ty; push(nd,n); } };
  /* durées de base calculées une fois par recherche (mêmes formules que baseMoveT, baseClimbT, baseMineT) */
  const mv=baseMoveT(m), cl=baseClimbT(m), moveT=()=>mv, climbT=()=>cl, fall=1/CFG.fallSpeed, maxFall=CFG.maxFall;
  const mineCache=new Map(), mineT=t=>{ let v=mineCache.get(t); if(v===undefined){ v=baseMineT(m,t); mineCache.set(t,v); } return v; };
  const start=sy*W+sx; dist[start]=0; push(0,start);
  while(hd.length){
    pop(); const d=popD, n=popN; if(d>dist[n]) continue;
    if(d>maxCost) break;
    const x=n%W, y=(n/W)|0;
    if(goalFn && goalFn(x,y)) return {n,dist,par,typ,start,sx,sy};
    for(const dx of [-1,1]){                       // marcher (et tomber si pas de sol)
      const nx=x+dx; if(nx<0||nx>=W) continue;
      if(!isAir(G,nx,y)){                         // galerie : miner horizontalement (build uniquement)
        const t=tileAt(G,nx,y);
        if(build && t && t!==BARRIER && !BLOCKS[t].unbreakable){
          const l=landing(G,nx,y); if(l.n<=maxFall) relax(n,d,nx,l.y,mineT(t)+moveT()+l.n*fall);
        }
        continue;
      }
      const l=landing(G,nx,y); if(l.n<=maxFall) relax(n,d,nx,l.y,moveT()+l.n*fall);
      if(l.n>0 && m.bridges>0) relax(n,d,nx,y,moveT()+CFG.bridgeTime,1);   // combler le trou (typ 1 = passerelle)
    }
    if(y>=1){                                       // monter (build=false : uniquement par les échelles existantes)
      const t=tileAt(G,x,y-1), has=y>0&&G.ladder[y][x], lad=has ? 0 : CFG.ladderTime*lw;
      if(t===0){ if(build||has) relax(n,d,x,y-1,lad+climbT()); }
      else if(build && t!==BARRIER && !BLOCKS[t].unbreakable) relax(n,d,x,y-1,mineT(t)+lad+climbT());
    }
    if(isAir(G,x,y+1)){                             // descendre (par l'échelle, ou se laisser tomber)
      const l=landing(G,x,y+1), lad=G.ladder[y][x]||G.ladder[y+1][x];
      if(l.n+(lad?0:1)<=maxFall) relax(n,d,x,l.y,(lad ? climbT() : fall)+l.n*fall);
    } else if(build){                               // creuser vers le bas : miner + chute ; l'échelle ne se pose qu'au retour,
      const t=tileAt(G,x,y+1);                      // on compte donc d'avance ce « voyage futur » (pose + montée)
      if(t!==BARRIER && !BLOCKS[t].unbreakable){
        const l=landing(G,x,y+1);
        if(1+l.n<=maxFall) relax(n,d,x,l.y,mineT(t)+(1+l.n)*fall+CFG.futureTravelWeight*(CFG.ladderTime*lw+climbT()));
      }
    }
  }
  return goalFn ? null : {dist,par,typ,start,sx,sy};
}

/* premier pas pour atteindre le nœud n d'une recherche : {dx,dy,bridge} */
export function firstStep(r,n){
  if(n===r.start) return {dx:0,dy:0};
  let c=n; while(r.par[c]!==r.start){ c=r.par[c]; if(c<0) return null; }
  const cx=c%W, cy=(c/W)|0;
  return cx!==r.sx ? {dx:Math.sign(cx-r.sx),dy:0,bridge:r.typ[c]===1} : {dx:0,dy:Math.sign(cy-r.sy)};
}

/* retour au coffre, au temps réel (poids 1) : {cost, dx, dy, bridge} ou null */
export function planReturn(G,m){
  const r=search(G,m,m.x,m.y,true,(x,y)=>y===0&&x===CHEST_X,Infinity,1); if(!r) return null;
  const s=firstStep(r,r.n); return s && {cost:r.dist[r.n],...s};
}

/* Descendre en réutilisant l'existant : si une échelle/galerie déjà posée mène bien plus bas, y aller coûte moins
   cher que creuser un nouveau puits. Renvoie le premier pas, ou null → creuser du neuf. */
export function planDown(G,m,avoid=null){
  const r=search(G,m,m.x,m.y,false,null); let best=-1;
  for(let n=0;n<r.dist.length;n++){
    if(r.dist[n]===Infinity) continue;
    if(avoid && avoid(n%W,(n/W)|0)) continue;   // zone déjà occupée (équipe)
    if(best<0 || (n/W|0)>(best/W|0) || ((n/W|0)===(best/W|0) && r.dist[n]<r.dist[best])) best=n;
  }
  const gain=(best/W|0)-m.y;
  // nouveau puits : mine ~1 s + chute par case + échelle à poser au retour ; existant : trajet aller + retour
  const fresh=gain*(1+1/CFG.fallSpeed+CFG.futureTravelWeight*(CFG.ladderTime*CFG.ladderPlanWeight+baseClimbT(m)));
  if(gain<3 || r.dist[best]*(1+CFG.futureTravelWeight) >= fresh) return null;
  return firstStep(r,best);
}
