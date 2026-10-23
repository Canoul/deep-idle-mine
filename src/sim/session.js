/* Session : création de la partie et boucle de simulation à pas fixe (DT).
   Ne touche ni au DOM ni au canvas : tourne aussi bien dans le navigateur que dans Node (tests, simulate). */
import { W, DT, SESSION_LEN, TOP_DIRT_ROWS, STATS, CFG, IDS, CHEST_X, CHEST_BASE, MOBS, SPAWN_X, TEAM, SHINY, FORTUNE, GEAR_RNG } from '../config.js';
import { mulberry32 } from '../core/rng.js';
import { genArea, maxRow } from './world.js';
import { createMiner, curLum } from './mineur.js';
import { finishAction } from './actions.js';
import { decide } from './ai.js';
import { updateMobs, tackler, channeler } from './mobs.js';
import { updateDungeons } from './dungeon.js';
import { updateTraps, veiled } from './trap.js';
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
    seed, t:0, ticks:0, over:false, rng:mulberry32(seed^0x51ed270b), shinyRng:mulberry32(seed^SHINY.salt), fortuneRng:mulberry32(seed^FORTUNE.salt), gearRng:mulberry32(seed^GEAR_RNG.salt),
    tiles:[new Uint8Array(W)], ladder:[new Uint8Array(W)], seen:[new Uint8Array(W).fill(1)],
    areas:[], unlockedAreas:0, winch:null, treasures:new Map(), dungeons:[], traps:[], veil:new Set(), mobs:[], chest:{}, chestBy:{}, mobId:1, log:[], torches:[], light:new Map(),
    spawnTimer:MOBS.firstSpawn, spawnTurn:0, mimicCells:new Set(), combat:false,
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
  G.shareMarks = [];          // coupures du partage (un départ = une coupure), voir shareBySegments
  for(let y=1;y<=TOP_DIRT_ROWS;y++){   // couche(s) de terre sous la surface, visibles dès le départ
    G.tiles.push(new Uint8Array(W).fill(IDS.dirt)); G.ladder.push(new Uint8Array(W)); G.seen.push(new Uint8Array(W).fill(1));
  }
  G.tiles[1][CHEST_X] = CHEST_BASE;   // socle incassable sous le coffre (23/10)
  genArea(G,0); G.unlockedAreas = 1;
  log(G, `Session démarrée (seed ${seed}, ${G.miners.length} mineur${G.miners.length>1?'s':''})`);
  return G;
}

/* zone de découverte : discoverMax × luminosité (au moins 1 bloc dès qu'il y a de la lumière), autour du mineur ;
   l'intérieur d'un piège pas encore déclenché reste caché (src/sim/trap.js) */
function revealAround(G,m){
  const lum=curLum(G,m), R=lum>0 ? Math.max(1,m.carac.discoverMax*lum) : 0, r=Math.ceil(R);
  for(let dy=-r;dy<=r;dy++){ const y=m.y+dy; if(y<1||y>maxRow(G)) continue;
    for(let dx=-r;dx<=r;dx++){ const x=m.x+dx; if(x<0||x>=W) continue;
      if(dx*dx+dy*dy<=R*R && !veiled(G,x,y)) G.seen[y][x]=1; } }
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
  updateTraps(G);   // un bloc de paroi de piège a disparu : le piège s'ouvre
  updateMobs(G);
  for(const m of G.miners){
    // un mob vient de le tacler : l'action en cours est interrompue (sauf une chute, un étourdissement, et sauf s'il frappe déjà)
    if(m.action && m.action.type!=='attack' && m.action.type!=='stun' && !m.action.data.fall && tackler(G,m)){ m.action=null; m.stats.tackled++; }
    // un occultiste canalise sur lui : tout s'arrête (même un coup), sauf une chute ; il est étourdi pendant la canalisation
    if(m.action && m.action.type!=='stun' && !m.action.data.fall && channeler(G,m)) m.action=null;
    // canalisation arrêtée avant la fin (occultiste provoqué ou tué) : il est libéré tout de suite
    if(m.action?.data.hex && !channeler(G,m)) m.action=null;
    revealAround(G,m);
  }
  updateDungeons(G);   // découverte d'un donjon, barbare entré, effroi, boss vaincu
  if(G.ticks>=SESSION_TICKS) endSession(G);
}

/* Un joueur quitte la session : son mineur disparaît de la mine, ce qu'il portait est perdu, et il ne recevra
   rien du coffre (sa part revient aux joueurs encore présents à la fin). S'il ne reste personne, la session s'arrête.
   Idempotent : quitter deux fois, ou après la fin, ne fait rien. Renvoie true si le départ a eu lieu. */
export function leaveSession(G, who){
  if(G.over) return false;
  const m = typeof who==='object' ? who : G.miners.find(x => x.account!==null && x.account===who);
  if(!m || m.left!=null || !G.miners.includes(m)) return false;
  /* anti-boosting : le butin déposé jusqu'ici se partage entre les joueurs présents jusqu'ici (lui compris : sa part
     de cette tranche est perdue, elle ne revient pas aux autres) */
  G.shareMarks.push({ t:G.t, chest:{ ...G.chest }, xp:G.stats.xp||0, present:G.roster.filter(x => x.left==null) });
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
    /* le détail de ce que chacun portait encore (perdu : il fallait le déposer au coffre), pour le bilan */
    lostBags: G.roster.filter(m=>Object.keys(m.inv).length).map(m=>({ name:m.name, items:{...m.inv} })),
    miners: G.roster.map(m=>({ name:m.name, color:m.color, account:m.account, left:m.left!=null, stats:{...m.stats} })),
  };
  const present = G.roster.filter(m => m.left==null);
  const { bags, xp, segments } = shareBySegments(G, present);
  G.summary.segments = segments;
  G.summary.shares = G.roster.map(m => ({ miner:m.name, color:m.color, account:m.account,
    left: m.left!=null, bag: m.left!=null ? {} : bags.get(m), xp: m.left!=null ? 0 : xp.get(m) }));
}

/* Partage par tranches (anti-boosting) : la session est coupée à chaque départ. Le butin déposé (et l'XP gagnée)
   pendant une tranche est partagé à parts égales entre les joueurs présents PENDANT cette tranche ; la part d'un joueur
   parti est perdue (quitter = 0). Ex. : 3 joueurs pendant 50 min, puis 1 seul pendant 10 min → le dernier reçoit 1/3
   du butin des 50 premières minutes et tout celui des 10 dernières. Sans départ : une seule tranche, comme avant. */
function shareBySegments(G, present){
  const bags = new Map(present.map(m => [m, {}])), xp = new Map(present.map(m => [m, 0]));
  const marks = [...G.shareMarks, { t:G.t, chest:G.chest, xp:G.stats.xp||0, present }];
  let prevChest = {}, prevXp = 0;
  const segments = [];
  marks.forEach((mk, i) => {
    const delta = {};
    for(const k in mk.chest){ const q = mk.chest[k] - (prevChest[k] || 0); if(q > 0) delta[k] = q; }
    const n = mk.present.length, dxp = Math.max(0, mk.xp - prevXp);
    const parts = shareChest(delta, n, (G.seed + i * 0x9e37) | 0), px = xpShare(dxp, n);
    mk.present.forEach((m, j) => {
      if(!bags.has(m)) return;                                       // parti avant la fin : sa part est perdue
      const b = bags.get(m);
      for(const k in parts[j]) b[k] = (b[k] || 0) + parts[j][k];
      xp.set(m, xp.get(m) + px);
    });
    segments.push({ until:mk.t, players:n });
    prevChest = mk.chest; prevXp = mk.xp;
  });
  return { bags, xp, segments };
}

/* simule une session complète d'un coup (Node, tests) */
export function runSession(seed, opts={}){
  const G=newSession(seed, opts), maxTicks=Math.ceil(SESSION_LEN/DT)+1;
  for(let i=0;i<maxTicks && !G.over;i++){ tick(G); if(opts.onTick) opts.onTick(G,i); }
  return G;
}
