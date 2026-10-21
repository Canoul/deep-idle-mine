/* Mine instantanée : IA du mineur. Tous les blocs valent pareil (aucune priorité de minerai, même pas le temps de
   minage) : il vise le bloc le plus proche en temps de trajet, plus une pénalité près des autres mineurs et de leurs
   cibles (MI.crowdRadius / crowdWeight), et sur un bloc qu'un autre mine déjà (MI.takenPenalty). Après
   MI.interruptMax blocs perdus d'affilée, il évite pendant MI.fleeTime s les blocs à moins de MI.fleeDist cases de
   l'endroit (m.flee, posé par la session). Ramassage opportuniste : un tas de plumes accessible à au plus
   MI.featherReach pas passe avant tout (m.goal) ; si un autre le prend avant lui, il reprend son travail. */
import { INSTANT_MINE as MI, BLOCKS } from '../../config.js';

/* durées (pas de lumière ni d'oxygène ici) ; Ruée (skill ore_rush) comme dans la mine normale */
export const miMoveT = (G,m) => 1/(m.carac.speed*(1 + (G.t < m.rushUntil ? (m.skill.ore_rush||0) : 0)));
export const miMineT = (m,t) => BLOCKS[t].hard/m.carac.mineSpeed;

const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const solid = (G,x,y) => x>=0 && x<G.w && y>=1 && y<=G.h && G.tiles[y][x] !== 0;
const minedByOther = (G,m,x,y) => G.miners.some(o => o !== m && o.action?.type === 'mine' && o.action.data.x === x && o.action.data.y === y);

export function decide(G, m){
  const tg = m.target;
  if(tg && !solid(G, tg.x, tg.y)){ m.target = null; m.path = []; }           // miné par un autre en chemin
  if(m.goal && !G.feathers.has(m.goal.y*G.w + m.goal.x)){ m.goal = null; m.path = []; }   // tas pris par un autre
  if((m.target || m.goal) && m.path.length){                                    // avance d'une case
    const [x, y] = m.path.shift();
    if(x !== m.x) m.face = x > m.x ? 1 : -1;
    m.action = { type:'move', dur:Math.max(0.05, miMoveT(G, m)), t:0, data:{ x, y } };
    m.status = m.goal ? 'Va chercher des plumes' : 'Se déplace';
    return;
  }
  m.goal = null;
  /* arrivé : si un autre mine déjà ce bloc, il compare encore une fois (la pénalité peut le faire changer d'avis) */
  if(m.target && minedByOther(G, m, m.target.x, m.target.y) && !m.recheck){ m.recheck = true; m.target = null; }
  if(!m.target) plan(G, m);
  m.recheck = false;
  if(m.goal) return decide(G, m);
  if(!m.target){ m.action = { type:'wait', dur:0.5, t:0, data:{} }; m.status = 'Plus rien à miner'; return; }
  if(m.path.length) return decide(G, m);
  const { x, y } = m.target, t = G.tiles[y][x];
  if(x !== m.x) m.face = x > m.x ? 1 : -1;
  m.action = { type:'mine', dur:Math.max(0.05, miMineT(m, t)), t:0, data:{ x, y } };
  if(m.status !== 'Change de zone' || !m.flee || G.t >= m.flee.until) m.status = 'Mine';
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

/* parcours en largeur dans les cases vides depuis le mineur ; chaque bloc plein au bord est un candidat, coté
   trajet + foule ; on garde le moins cher (hors zone fuie si possible) et le chemin pour y aller.
   Le premier tas de plumes atteint à au plus MI.featherReach pas l'emporte (m.goal, chemin jusqu'au tas). */
export function plan(G, m){
  const { w, h } = G, N = w*(h+1), step = 1/m.carac.speed;
  const dist = new Int32Array(N).fill(-1), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const start = m.y*w + m.x, queue = [start];
  dist[start] = 0;
  const flee = m.flee && G.t < m.flee.until ? m.flee : null;
  let best = null, bestFled = null;
  for(let qi=0; qi<queue.length; qi++){
    const c = queue[qi], cx = c % w, cy = (c - cx)/w;
    for(const [dx, dy] of DIRS){
      const x = cx+dx, y = cy+dy;
      if(x<0 || x>=w || y<0 || y>h) continue;
      const k = y*w + x;
      if(G.tiles[y][x] === 0){
        if(dist[k] >= 0) continue;
        dist[k] = dist[c]+1; prev[k] = c; queue.push(k);
        if(dist[k] <= MI.featherReach && G.feathers.has(k)){ m.goal = { x, y }; m.target = null; m.path = pathTo(k, start, prev, w); return; }
        continue;
      }
      if(done[k]) continue;
      done[k] = 1;
      const cost = dist[c]*step + crowd(G, m, x, y) + G.rng()*0.01;   // un soupçon de hasard départage les égalités
      const fled = flee && Math.abs(x-flee.x) + Math.abs(y-flee.y) < MI.fleeDist;
      const cand = { x, y, from:c, cost };
      if(fled){ if(!bestFled || cost < bestFled.cost) bestFled = cand; }
      else if(!best || cost < best.cost) best = cand;
    }
  }
  const pick = best ?? bestFled;
  if(!pick){ m.target = null; m.path = []; return; }
  m.target = { x:pick.x, y:pick.y }; m.path = pathTo(pick.from, start, prev, w);
}

/* cases à traverser, de la case après le départ jusqu'à `end` comprise */
function pathTo(end, start, prev, w){
  const path = [];
  for(let c = end; c !== start; c = prev[c]) path.push([c % w, Math.floor(c / w)]);
  return path.reverse();
}
