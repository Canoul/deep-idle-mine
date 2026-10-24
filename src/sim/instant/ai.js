/* Mine instantanée : IA du mineur. Tous les blocs valent pareil (aucune priorité de minerai, même pas le temps de
   minage) : il vise le bloc le moins cher en temps de trajet, plus une pénalité près des autres mineurs et de leurs
   cibles (MI.crowdRadius / crowdWeight), et sur un bloc qu'un autre mine déjà (MI.takenPenalty). Après
   MI.interruptMax blocs perdus d'affilée, il évite pendant MI.fleeTime s les blocs à moins de MI.fleeDist cases de
   l'endroit (m.flee, posé par la session). Ramassage opportuniste : un tas de plumes accessible à au plus
   MI.featherReach pas passe avant tout (m.goal) ; si un autre le prend avant lui, il reprend son travail.

   Gravité et échelles (décision du créateur, 22/10/2026 ; avant : il volait dans les galeries) : comme dans la mine
   normale, une case sans appui (vide dessous, sans échelle ni sur la case ni juste dessous) fait tomber le mineur.
   Pour monter, il pose une échelle sur sa case (échelles illimitées, partagées : tout le monde peut prendre celles des
   autres). Différence avec la mine normale : pas de limite de hauteur de chute ni d'étourdissement (mine de 5 min). */
import { INSTANT_MINE as MI, BLOCKS, CFG } from '../../config.js';

/* durées (pas de lumière ni d'oxygène ici) ; Ruée (skill ore_rush) comme dans la mine normale */
export const miMoveT = (G,m) => 1/(m.carac.speed*(1 + (G.t < m.rushUntil ? (m.skill.ore_rush||0) : 0)));
export const miMineT = (m,t) => BLOCKS[t].hard/(m.carac.mineSpeed*(1 + (m.carac.mineSpeedPct||0)/100));
export const miClimbT = m => 1/m.carac.climbSpeed;
export const miFallT = () => 1/CFG.fallSpeed;
/* pose d'une échelle ; en planification, l'échelle de 2 (tall_ladder) en pose une sur deux */
export const miLadderT = () => CFG.ladderTime;
const planLadderT = m => miLadderT(m)*(m.skill.tall_ladder ? 0.5 : 1);

const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
export const miAir = (G,x,y) => x>=0 && x<G.w && y>=0 && y<=G.h && G.tiles[y][x] === 0;
const solid = (G,x,y) => x>=0 && x<G.w && y>=1 && y<=G.h && G.tiles[y][x] !== 0;
/* appui : non s'il y a du vide dessous sans échelle (ni sur la case, ni juste dessous) ; le fond de la mine porte */
export const miSupported = (G,x,y) =>
  !(y+1 <= G.h && miAir(G,x,y+1) && !G.ladder[y+1][x] && !(y>0 && G.ladder[y][x]));
/* case où l'on finit en tombant depuis (x,y) ; n = nombre de cases de chute */
export function miLanding(G,x,y){ let n = 0; while(!miSupported(G,x,y)){ y++; n++; } return { y, n }; }

const minedByOther = (G,m,x,y) => G.miners.some(o => o !== m && o.action?.type === 'mine' && o.action.data.x === x && o.action.data.y === y);
const replan = m => { m.target = null; m.goal = null; m.path = []; };

export function decide(G, m, depth = 0){
  /* gravité d'abord : sans appui, il tombe d'une case (rien d'autre n'est possible dans le vide) */
  if(!miSupported(G, m.x, m.y)){
    m.action = { type:'move', dur:miFallT(), t:0, data:{ x:m.x, y:m.y+1, fall:true } };
    m.status = 'Tombe';
    return;
  }
  const tg = m.target;
  if(tg && !solid(G, tg.x, tg.y)){ m.target = null; m.path = []; }           // miné par un autre en chemin
  if(m.goal && !G.feathers.has(m.goal.y*G.w + m.goal.x)){ m.goal = null; m.path = []; }   // tas pris par un autre
  if((m.target || m.goal) && m.path.length){
    if(step(G, m)) return;
    if(m.goal || m.path.length){ replan(m); }
  }
  m.goal = null;
  /* arrivé : si un autre mine déjà ce bloc, il compare encore une fois (la pénalité peut le faire changer d'avis) */
  if(m.target && minedByOther(G, m, m.target.x, m.target.y) && !m.recheck){ m.recheck = true; m.target = null; }
  /* la cible doit toucher sa case (un détour imprévu, une chute : on replanifie) */
  if(m.target && Math.abs(m.target.x - m.x) + Math.abs(m.target.y - m.y) !== 1) m.target = null;
  if(!m.target){
    plan(G, m);
    if((m.goal || m.path.length) && depth < 3) return decide(G, m, depth+1);
  }
  m.recheck = false;
  if(!m.target || m.path.length){ m.action = { type:'wait', dur:0.5, t:0, data:{} }; m.status = 'Plus rien à miner'; return; }
  const { x, y } = m.target, t = G.tiles[y][x];
  if(x !== m.x) m.face = x > m.x ? 1 : -1;
  m.action = { type:'mine', dur:Math.max(0.05, miMineT(m, t)), t:0, data:{ x, y } };
  if(m.status !== 'Change de zone' || !m.flee || G.t >= m.flee.until) m.status = 'Mine';
}

/* une étape vers le prochain nœud du chemin (case où il tient) : marcher d'une case (la chute éventuelle suit par
   la gravité), poser une échelle puis grimper, ou descendre par l'échelle. false = rien à faire (arrivé) ou étape
   impossible (le chemin ne colle plus à la mine : à replanifier). */
function step(G, m){
  while(m.path.length && m.path[0][0] === m.x && m.path[0][1] === m.y) m.path.shift();
  if(!m.path.length) return false;
  const [nx, ny] = m.path[0];
  const what = m.goal ? 'Va chercher des plumes' : 'Se déplace';
  if(nx !== m.x){
    if(Math.abs(nx - m.x) !== 1 || !miAir(G, nx, m.y)) return false;
    m.face = nx > m.x ? 1 : -1;
    m.action = { type:'move', dur:Math.max(0.05, miMoveT(G, m)), t:0, data:{ x:nx, y:m.y } };
    m.status = what;
    return true;
  }
  if(ny < m.y){                                                                  // monter
    if(ny !== m.y-1 || !miAir(G, m.x, ny)) return false;
    if(!G.ladder[m.y][m.x]){
      m.action = { type:'ladder', dur:Math.max(0.05, miLadderT(m)), t:0, data:{ x:m.x, y:m.y } };
      m.status = 'Pose une échelle';
      return true;
    }
    m.action = { type:'move', dur:Math.max(0.05, miClimbT(m)), t:0, data:{ x:m.x, y:ny } };
    m.status = 'Grimpe';
    return true;
  }
  if(!miAir(G, m.x, m.y+1)) return false;                                        // descendre (par l'échelle)
  const lad = G.ladder[m.y][m.x] || G.ladder[m.y+1][m.x];
  m.action = { type:'move', dur:Math.max(0.05, lad ? miClimbT(m) : miFallT()), t:0, data:{ x:m.x, y:m.y+1 } };
  m.status = what;
  return true;
}

/* pénalité de foule pour le bloc (x,y) : autres mineurs et leurs cibles, plus forte quand ils sont tout près */
function crowd(G, m, x, y){
  let p = 0;
  for(const o of G.miners){
    if(o === m) continue;
    for(const q of [o, o.target]){
      if(!q) continue;
      const d = Math.abs(q.x - x) + Math.abs(q.y - y);
      if(d < MI.crowdRadius) p += MI.crowdWeight*(MI.crowdRadius - d)/MI.crowdRadius;
    }
    if(o.target && o.target.x === x && o.target.y === y) p += MI.takenPenalty;
    else if(o.action?.type === 'mine' && o.action.data.x === x && o.action.data.y === y) p += MI.takenPenalty;
  }
  return p;
}

/* Itinéraires au moindre temps (Dijkstra) sur les cases où le mineur tient : marcher (+ chute), poser une échelle et
   grimper, descendre par une échelle. Chaque bloc plein qui touche une case atteinte est un candidat, coté trajet +
   foule ; on garde le moins cher (hors zone fuie si possible) et le chemin pour y aller.
   Le premier tas de plumes traversé à au plus MI.featherReach pas l'emporte (m.goal ; le chemin va jusqu'à la case
   où il tient après l'avoir ramassé, chute comprise). */
export function plan(G, m){
  const { w, h } = G, N = w*(h+1);
  const mv = 1/m.carac.speed, cl = miClimbT(m), fall = miFallT(), lt = planLadderT(m);
  const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), hops = new Int32Array(N);
  const done = new Uint8Array(N), closed = new Uint8Array(N);
  const start = m.y*w + m.x;
  dist[start] = 0;
  const flee = m.flee && G.t < m.flee.until ? m.flee : null;
  const mine = featherChase(G, m), chase = mine.best, head = chase ? null : heading(G, m);
  let best = null, bestFled = null, goal = null;
  /* file de priorité : tas binaire en deux tableaux (distance, nœud) */
  const hd = [0], hn = [start];
  const push = (d, n) => {
    let i = hd.length; hd.push(d); hn.push(n);
    while(i > 0){ const p = (i-1) >> 1; if(hd[p] <= hd[i]) break;
      const td = hd[p]; hd[p] = hd[i]; hd[i] = td; const tn = hn[p]; hn[p] = hn[i]; hn[i] = tn; i = p; }
  };
  let popD = 0, popN = 0;
  const pop = () => {
    popD = hd[0]; popN = hn[0];
    const ld = hd.pop(), ln = hn.pop(), len = hd.length;
    if(len){ hd[0] = ld; hn[0] = ln; let i = 0;
      for(;;){ const l = 2*i+1, r = l+1; let s = i;
        if(l < len && hd[l] < hd[s]) s = l; if(r < len && hd[r] < hd[s]) s = r; if(s === i) break;
        const td = hd[s]; hd[s] = hd[i]; hd[i] = td; const tn = hn[s]; hn[s] = hn[i]; hn[i] = tn; i = s; } }
  };
  /* arête de c vers le nœud (x, y), en traversant les cases de la colonne x entre les lignes y0 et y */
  const relax = (c, d, x, y, cost, y0) => {
    const n = y*w + x, nh = hops[c] + Math.abs(y - y0) + 1;
    if(nh <= MI.featherReach)
      for(let yy = Math.min(y0, y); yy <= Math.max(y0, y); yy++)
        if(mine.keys.has(yy*w + x)){ goal = { x, y:yy, node:n, from:c }; return; }   // seulement un tas déjà découvert
    if(d + cost < dist[n]){ dist[n] = d + cost; prev[n] = c; hops[n] = nh; push(dist[n], n); }
  };
  while(hd.length && !goal){
    pop(); const d = popD, c = popN;
    if(d > dist[c] || closed[c]) continue;
    closed[c] = 1;
    const cx = c % w, cy = (c - cx)/w;
    for(const [dx, dy] of DIRS){                                                 // blocs qu'il peut miner d'ici
      const x = cx+dx, y = cy+dy;
      if(!solid(G, x, y)) continue;
      const k = y*w + x;
      if(done[k]) continue;
      done[k] = 1;
      /* tas découvert : creuser droit vers lui (foule et cap ignorés) ; sinon cap du mineur + foule */
      let cost = chase ? d + 4*(Math.abs(x-chase.x) + Math.abs(y-chase.y))
        : d + crowd(G, m, x, y) + headPenalty(head, x-cx, y-cy) + (dy === 1 ? MI.downWeight*mv : 0);
      cost += G.rng()*0.01;                                // un soupçon de hasard départage les égalités
      const fled = flee && Math.abs(x-flee.x) + Math.abs(y-flee.y) < MI.fleeDist;
      const cand = { x, y, from:c, cost };
      if(fled){ if(!bestFled || cost < bestFled.cost) bestFled = cand; }
      else if(!best || cost < best.cost) best = cand;
    }
    for(const dx of [-1, 1]){                                                    // marcher (et tomber si pas de sol)
      const x = cx+dx;
      if(goal || !miAir(G, x, cy)) continue;
      const l = miLanding(G, x, cy);
      relax(c, d, x, l.y, mv + l.n*fall, cy);
    }
    if(!goal && cy >= 1 && miAir(G, cx, cy-1))                                   // monter : échelle posée ou à poser
      relax(c, d, cx, cy-1, (G.ladder[cy][cx] ? 0 : lt) + cl, cy-1);
    if(!goal && miAir(G, cx, cy+1)){                                             // descendre par l'échelle
      const lad = G.ladder[cy][cx] || G.ladder[cy+1][cx], l = miLanding(G, cx, cy+1);
      relax(c, d, cx, l.y, (lad ? cl : fall) + l.n*fall, cy+1);
    }
  }
  if(goal){
    m.goal = { x:goal.x, y:goal.y }; m.target = null;
    m.path = [...pathTo(goal.from, start, prev, w), [goal.node % w, Math.floor(goal.node / w)]];
    return;
  }
  const pick = best ?? bestFled;
  if(!pick){ m.target = null; m.path = []; return; }
  m.target = { x:pick.x, y:pick.y }; m.path = pathTo(pick.from, start, prev, w);
}

/* tas de plumes découvert à chasser : le plus proche (Manhattan, ≤ MI.featherReach) dont aucun autre mineur n'est plus
   proche (égalité : le plus petit numéro d'abord) */
function featherChase(G, m){
  let best = null, bd = Infinity;
  const keys = new Set(), idx = G.miners.indexOf(m);
  for(const k of G.feathers.keys()){
    const x = k % G.w, y = (k - x)/G.w;
    if(G.seen && !G.seen[y][x]) continue;
    const d = Math.abs(x-m.x) + Math.abs(y-m.y);
    if(d > MI.featherReach) continue;
    if(G.miners.some((o, i) => { if(o === m) return false; const od = Math.abs(x-o.x) + Math.abs(y-o.y); return od < d || (od === d && i < idx); })) continue;
    keys.add(k);
    if(d < bd){ best = { x, y }; bd = d; }
  }
  return { keys, best };
}

/* cap du mineur : tiré au hasard (pondéré) parmi MI.headings, gardé turnBlocks[0..1] choix de bloc ; renvoie [dx, dy] */
function heading(G, m){
  if(!m.head || m.headLeft <= 0){
    const hs = MI.headings, tot = hs.reduce((a, q) => a + q[2], 0);
    let r = G.rng()*tot, q = hs[hs.length-1];
    for(const c of hs){ r -= c[2]; if(r < 0){ q = c; break; } }
    m.head = [q[0], q[1]];
    const [a, b] = MI.turnBlocks; m.headLeft = a + Math.floor(G.rng()*(b-a+1));
  }
  m.headLeft--;
  return m.head;
}
/* pénalité d'un bloc voisin dans la direction (dx, dy) : 0 dans le sens du cap, headingWeight à l'opposé */
function headPenalty(head, dx, dy){
  if(!head) return 0;
  const dot = (head[0]*dx + head[1]*dy) / Math.hypot(head[0], head[1]);   // 1 aligné, 0 de côté, -1 opposé
  return MI.headingWeight*(1 - dot)/2;
}

/* cases où il tient, de celle après le départ jusqu'à `end` comprise (vide si end est le départ) */
function pathTo(end, start, prev, w){
  const path = [];
  for(let c = end; c !== start; c = prev[c]) path.push([c % w, Math.floor(c / w)]);
  return path.reverse();
}
