/* Session : création de la partie et boucle de simulation à pas fixe (DT).
   Ne touche ni au DOM ni au canvas : tourne aussi bien dans le navigateur que dans Node (tests, simulate). */
import { W, DT, SESSION_LEN, TOP_DIRT_ROWS, STATS, CFG, IDS, MOBS, SPAWN_X, TEAM } from '../config.js';
import { mulberry32 } from '../core/rng.js';
import { genArea, maxRow } from './world.js';
import { createMiner, curLum } from './miner.js';
import { finishAction } from './actions.js';
import { decide, tackler } from './ai.js';
import { updateMobs } from './mobs.js';
import { log } from './log.js';

/* opts.miners : nombre de mineurs (1 = mineur seul ; 2-3 = l'équipe TEAM) ou liste de {name, color, prefs, x} */
export function newSession(seed, opts={}){
  seed = seed ?? ((Math.random()*2**31)|0);
  const n = opts.miners ?? 1;
  const specs = Array.isArray(n) ? n : (n>1 ? TEAM.slice(0,n) : [{}]);
  const G = {
    seed, t:0, over:false, rng:mulberry32(seed^0x51ed270b),
    tiles:[new Uint8Array(W)], ladder:[new Uint8Array(W)], seen:[new Uint8Array(W).fill(1)],
    areas:[], unlockedAreas:0, treasures:new Map(), mobs:[], chest:{}, chestBy:{}, mobId:1, log:[], torches:[], light:new Map(),
    spawnTimer:MOBS.bugFirstSpawn, spawnTurn:0,
    stats:{mined:0, kills:0, maxDepth:0, trips:0, falls:0, treasures:0},
    miners: specs.map((s,i)=>createMiner(i, {x:SPAWN_X, ...s})),
    summary:null,
  };
  for(let y=1;y<=TOP_DIRT_ROWS;y++){   // couche(s) de terre sous la surface, visibles dès le départ
    G.tiles.push(new Uint8Array(W).fill(IDS.dirt)); G.ladder.push(new Uint8Array(W)); G.seen.push(new Uint8Array(W).fill(1));
  }
  genArea(G,0); G.unlockedAreas = 1;
  log(G, `Session démarrée (seed ${seed}, ${G.miners.length} mineur${G.miners.length>1?'s':''})`);
  return G;
}

/* zone de découverte : discoverMax × luminosité (au moins 1 bloc dès qu'il y a de la lumière), autour du mineur */
function revealAround(G,m){
  const lum=curLum(G,m), R=lum>0 ? Math.max(1,STATS.discoverMax*lum) : 0, r=Math.ceil(R);
  for(let dy=-r;dy<=r;dy++){ const y=m.y+dy; if(y<1||y>maxRow(G)) continue;
    for(let dx=-r;dx<=r;dx++){ const x=m.x+dx; if(x<0||x>=W) continue;
      if(dx*dx+dy*dy<=R*R) G.seen[y][x]=1; } }
}

/* fait avancer un mineur de DT secondes : enchaîne ses actions dans le budget de temps disponible */
function stepMiner(G,m){
  if(m.y===0){
    m.ox=Math.min(STATS.oxygenMax, m.ox+CFG.refillRate*DT);
    m.torches=STATS.torches; m.bridges=STATS.bridges;
  } else {
    m.ox=Math.max(0,m.ox-DT);
  }
  let budget = DT*(m.ox<=0?CFG.oxygenOutSlow:1), guard=0;
  while(budget>1e-9 && guard++<30){
    if(!m.action){ decide(G,m); if(!m.action) break; }
    const a=m.action, need=a.dur-a.t;
    if(budget>=need){ budget-=need; m.action=null; finishAction(G,m,a); }
    else { a.t+=budget; budget=0; }
  }
}

export function tick(G){
  if(G.over) return;
  G.t+=DT;
  for(const m of G.miners) stepMiner(G,m);
  updateMobs(G);
  for(const m of G.miners){
    // une bestiole vient de le tacler : l'action en cours est interrompue (sauf une chute, et sauf s'il frappe déjà)
    if(m.action && m.action.type!=='attack' && !m.action.data.fall && tackler(G,m)){ m.action=null; m.stats.tackled++; }
    revealAround(G,m);
  }
  if(G.t>=SESSION_LEN) endSession(G);
}

/* fin de session : le coffre est figé dans G.summary ; c'est l'UI qui le verse dans l'inventaire global */
export function endSession(G){
  G.over=true;
  G.summary = {
    seed:G.seed, maxDepth:G.stats.maxDepth, areasUnlocked:G.unlockedAreas-1, mined:G.stats.mined,
    kills:G.stats.kills, trips:G.stats.trips, treasures:G.stats.treasures, chest:{...G.chest}, chestBy:JSON.parse(JSON.stringify(G.chestBy)),
    lost: G.miners.filter(m=>Object.keys(m.inv).length).map(m=>m.name),
  };
}

/* simule une session complète d'un coup (Node, tests) */
export function runSession(seed, opts={}){
  const G=newSession(seed, opts), maxTicks=Math.ceil(SESSION_LEN/DT)+1;
  for(let i=0;i<maxTicks && !G.over;i++){ tick(G); if(opts.onTick) opts.onTick(G,i); }
  return G;
}
