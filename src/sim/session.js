/* Session : création de la partie et boucle de simulation à pas fixe (DT).
   Ne touche ni au DOM ni au canvas : tourne aussi bien dans le navigateur que dans Node (tests, simulate). */
import { W, DT, SESSION_LEN, TOP_DIRT_ROWS, STATS, CFG, IDS, MOBS, SPAWN_X, TEAM, SHINY, FORTUNE } from '../config.js';
import { mulberry32 } from '../core/rng.js';
import { genArea, maxRow } from './world.js';
import { createMiner, curLum } from './miner.js';
import { finishAction } from './actions.js';
import { decide, tackler } from './ai.js';
import { updateMobs } from './mobs.js';
import { log } from './log.js';
import { shareChest } from '../meta/share.js';
import { xpShare } from '../meta/level.js';

/* opts.miners : nombre de mineurs (1 = mineur seul ; 2-3 = l'équipe TEAM) ou liste de {name, color, prefs, x}
   opts.accounts : ID de compte de chaque mineur, dans l'ordre (un joueur = un mineur) ; sert au partage du coffre */
export function newSession(seed, opts={}){
  seed = seed ?? ((Math.random()*2**31)|0);
  const n = opts.miners ?? 1;
  const specs = Array.isArray(n) ? n : (n>1 ? TEAM.slice(0,n) : [{}]);
  const G = {
    seed, t:0, ticks:0, over:false, rng:mulberry32(seed^0x51ed270b), shinyRng:mulberry32(seed^SHINY.salt), fortuneRng:mulberry32(seed^FORTUNE.salt),
    tiles:[new Uint8Array(W)], ladder:[new Uint8Array(W)], seen:[new Uint8Array(W).fill(1)],
    areas:[], unlockedAreas:0, winch:null, treasures:new Map(), mobs:[], chest:{}, chestBy:{}, mobId:1, log:[], torches:[], light:new Map(),
    spawnTimer:MOBS.bugFirstSpawn, spawnTurn:0,
    stats:{mined:0, kills:0, maxDepth:0, trips:0, falls:0, treasures:0, stolen:0, xp:0, stuns:0, shiny:0},
    miners: specs.map((s,i)=>createMiner(i, {x:SPAWN_X, ...s, account:opts.accounts?.[i] ?? s.account ?? null})),
    summary:null,
  };
  /* id unique de la session (distinct de la seed : rejouer une seed = une autre session) ; sert à ne créditer
     qu'une seule fois le coffre d'une session dans un inventaire */
  G.id = opts.id ?? `${seed}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  /* roster : tous les joueurs de la session, dans l'ordre, y compris ceux qui sont partis.
     G.miners ne contient que les mineurs encore présents : toute la simulation (IA, mobs, rendu) ne voit qu'eux. */
  G.roster = [...G.miners];
  for(let y=1;y<=TOP_DIRT_ROWS;y++){   // couche(s) de terre sous la surface, visibles dès le départ
    G.tiles.push(new Uint8Array(W).fill(IDS.dirt)); G.ladder.push(new Uint8Array(W)); G.seen.push(new Uint8Array(W).fill(1));
  }
  genArea(G,0); G.unlockedAreas = 1;
  log(G, `Session démarrée (seed ${seed}, ${G.miners.length} mineur${G.miners.length>1?'s':''})`);
  return G;
}

/* zone de découverte : discoverMax × luminosité (au moins 1 bloc dès qu'il y a de la lumière), autour du mineur */
function revealAround(G,m){
  const lum=curLum(G,m), R=lum>0 ? Math.max(1,m.carac.discoverMax*lum) : 0, r=Math.ceil(R);
  for(let dy=-r;dy<=r;dy++){ const y=m.y+dy; if(y<1||y>maxRow(G)) continue;
    for(let dx=-r;dx<=r;dx++){ const x=m.x+dx; if(x<0||x>=W) continue;
      if(dx*dx+dy*dy<=R*R) G.seen[y][x]=1; } }
}

/* fait avancer un mineur de DT secondes : enchaîne ses actions dans le budget de temps disponible */
function stepMiner(G,m){
  if(m.y===0){
    m.ox=Math.min(m.carac.oxygenMax, m.ox+CFG.refillRate*DT);
    m.torches=m.carac.torches; m.bridges=m.carac.bridges;
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

/* nombre de ticks d'une session : la fin se juge au compteur de ticks, jamais au temps flottant
   (36 000 additions de 0,1 donnent 3599,9999999978 : la session ne se terminait jamais au dernier tick) */
export const SESSION_TICKS = Math.round(SESSION_LEN/DT);

export function tick(G){
  if(G.over) return;
  G.ticks++; G.t=G.ticks*DT;   // temps recalculé depuis le compteur : aucune dérive d'arrondi
  for(const m of G.miners) stepMiner(G,m);
  updateMobs(G);
  for(const m of G.miners){
    // une bestiole vient de le tacler : l'action en cours est interrompue (sauf une chute, un étourdissement, et sauf s'il frappe déjà)
    if(m.action && m.action.type!=='attack' && m.action.type!=='stun' && !m.action.data.fall && tackler(G,m)){ m.action=null; m.stats.tackled++; }
    revealAround(G,m);
  }
  if(G.ticks>=SESSION_TICKS) endSession(G);
}

/* Un joueur quitte la session : son mineur disparaît de la mine, ce qu'il portait est perdu, et il ne recevra
   rien du coffre (sa part revient aux joueurs encore présents à la fin). S'il ne reste personne, la session s'arrête.
   Idempotent : quitter deux fois, ou après la fin, ne fait rien. Renvoie true si le départ a eu lieu. */
export function leaveSession(G, who){
  if(G.over) return false;
  const m = typeof who==='object' ? who : G.miners.find(x => x.account!==null && x.account===who);
  if(!m || m.left!=null || !G.miners.includes(m)) return false;
  m.left = G.t; m.action = null; m.status = 'A quitté la session';
  G.miners = G.miners.filter(x => x!==m);
  log(G, `${m.name} a quitté la session`+(Object.keys(m.inv).length ? ' (ce qu\'il portait est perdu)' : ''));
  if(!G.miners.length) endSession(G);
  return true;
}

/* fin de session : le coffre est figé dans G.summary et partagé entre les joueurs encore présents
   (summary.shares : une entrée par joueur du roster, vide pour ceux qui sont partis) ;
   c'est l'UI (plus tard le serveur) qui verse la part du joueur dans son inventaire.
   Idempotent : un second appel ne recalcule rien. */
export function endSession(G){
  if(G.summary) return;
  G.over=true;
  G.summary = {
    seed:G.seed, maxDepth:G.stats.maxDepth, areasUnlocked:G.unlockedAreas-1, mined:G.stats.mined,
    kills:G.stats.kills, stolen:G.stats.stolen, xp:G.stats.xp, trips:G.stats.trips, treasures:G.stats.treasures, chest:{...G.chest}, chestBy:JSON.parse(JSON.stringify(G.chestBy)),
    id:G.id, lost: G.roster.filter(m=>Object.keys(m.inv).length).map(m=>m.name),
    miners: G.roster.map(m=>({ name:m.name, color:m.color, account:m.account, left:m.left!=null, stats:{...m.stats} })),
  };
  const present = G.roster.filter(m => m.left==null);
  const bags = shareChest(G.chest, present.length, G.seed);
  /* XP : pot commun partagé à parts égales entre les présents (arrondi vers le bas) ; rien pour qui est parti */
  const xp = xpShare(G.stats.xp, present.length);
  G.summary.shares = G.roster.map(m => ({ miner:m.name, color:m.color, account:m.account,
    left: m.left!=null, bag: m.left!=null ? {} : bags[present.indexOf(m)], xp: m.left!=null ? 0 : xp }));
}

/* simule une session complète d'un coup (Node, tests) */
export function runSession(seed, opts={}){
  const G=newSession(seed, opts), maxTicks=Math.ceil(SESSION_LEN/DT)+1;
  for(let i=0;i<maxTicks && !G.over;i++){ tick(G); if(opts.onTick) opts.onTick(G,i); }
  return G;
}
