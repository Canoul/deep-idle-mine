/* Mine instantanée : la partie et sa boucle à pas fixe (DT). Chacun pour soi : ce qu'un mineur mine va dans son sac,
   gardé jusqu'à la fin ; pas de coffre, pas de partage, pas d'XP. Ni oxygène, ni pods, ni mobs, ni lumière. Gravité et
   échelles comme dans la mine normale (22/10, voir ai.js) : G.ladder[y][x], échelles illimitées et partagées. Ne
   touche ni au DOM ni au canvas.
   Bloc disputé : quand un mineur finit un bloc, les autres qui minaient ce même bloc perdent leur travail (« bloc
   perdu ») ; après MI.interruptMax blocs perdus d'affilée, il change de zone (voir ai.js). */
import { INSTANT_MINE as MI, DT, STATS, BLOCKS, ITEMS, SHINY, FORTUNE, SKILLS } from '../../config.js';
import { mulberry32 } from '../../core/rng.js';
import { shinyOf, fortuneExtra } from '../actions.js';
import { rushTime } from '../mineur.js';
import { log } from '../log.js';
import { genInstantMine, spawnColumns } from './world.js';
import { decide, miSupported } from './ai.js';
export { miMoveT, miMineT } from './ai.js';

/* fin jugée au compteur de ticks (jamais au temps flottant) */
export const INSTANT_TICKS = Math.round(MI.duration/DT);

/* opts.miners : liste de { name, account, color, look, carac, skills } (un joueur = un mineur), dans l'ordre de
   départ (de gauche à droite) ; opts.id : id unique de la partie (sert à ne verser le butin qu'une fois) */
export function newInstant(seed, opts={}){
  seed = seed ?? ((Math.random()*2**31)|0);
  const specs = opts.miners ?? [{}];
  const world = genInstantMine(seed);
  const cols = spawnColumns(specs.length, world.w);
  const G = {
    mode:'mi', seed, t:0, ticks:0, over:false, ...world,
    rng:mulberry32(seed^0x3c6ef372), shinyRng:mulberry32(seed^SHINY.salt), fortuneRng:mulberry32(seed^FORTUNE.salt),
    ladder: world.tiles.map(r => new Uint8Array(r.length)),   // échelles posées (1 = échelle sur la case)
    seen: world.tiles.map((r, y) => new Uint8Array(r.length).fill(y === 0 ? 1 : 0)),   // cases découvertes (surface : oui)
    log:[], stats:{ mined:0, contested:0, feathers:0, shiny:0, ladders:0 }, summary:null,
    miners: specs.map((s,i) => createInstantMiner(i, s, cols[i])),
  };
  G.id = opts.id ?? `mi-${seed}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  G.roster = [...G.miners];             // tous les joueurs, y compris ceux qui sont partis ; G.miners = les présents
  log(G, `Mine instantanée ouverte (seed ${seed}, ${G.miners.length} mineur${G.miners.length>1?'s':''})`);
  for(const m of G.miners) revealAround(G, m);
  return G;
}

function createInstantMiner(id, s, x){
  return {
    id, name:s.name || ('Mineur '+(id+1)), color:s.color || null, look:s.look || {}, auras:s.auras || {}, account:s.account ?? null,
    carac:{ ...STATS, ...(s.carac||{}) }, skill:{ ...(s.skills||{}) }, skillTree:s.skillTree ?? null,
    x, y:0, face:1, action:null, status:'Départ', inv:{}, rushUntil:-1,
    target:null, path:[],               // bloc visé et cases vides à traverser pour l'atteindre
    goal:null,                          // tas de plumes visé (ramassage opportuniste, MI.featherReach)
    interrupts:0, flee:null,            // blocs perdus d'affilée ; zone à fuir { x, y, until }
    stats:{ mined:0, lost:0, feathers:0, shiny:0, fortune:0, idle:0, ladders:0 },
  };
}

const collect = (m, item, n) => { m.inv[item] = (m.inv[item]||0) + n; };
const remaining = m => m.action ? m.action.dur - m.action.t : 0;

export function tickInstant(G){
  if(G.over) return;
  G.ticks++; G.t = G.ticks*DT;
  /* le mineur dont l'action finit le plus tôt joue d'abord : sur un bloc disputé, le premier qui finit gagne même à
     l'intérieur d'un tick ; à égalité, l'ordre tourne à chaque tick (personne n'est favorisé par sa place) */
  const n = G.miners.length;
  const order = G.miners.map((m,i) => ({ m, k:remaining(m), r:(i+G.ticks)%n })).sort((a,b) => a.k-b.k || a.r-b.r);
  for(const { m } of order) if(G.miners.includes(m)){ stepMiner(G, m); revealAround(G, m); }
  if(G.ticks >= INSTANT_TICKS) endInstant(G);
}

/* découverte : les cases à au plus discoverMax (au moins 1) du mineur, comme dans la mine normale en pleine lumière.
   Une seule carte pour tous (comme les échelles) : ce qu'un mineur découvre, tout le monde le voit. */
export function revealAround(G, m){
  const R = Math.max(1, m.carac.discoverMax), r = Math.ceil(R);
  for(let dy = -r; dy <= r; dy++){ const y = m.y + dy; if(y < 0 || y > G.h) continue;
    for(let dx = -r; dx <= r; dx++){ const x = m.x + dx; if(x < 0 || x >= G.w) continue;
      if(dx*dx + dy*dy <= R*R) G.seen[y][x] = 1; } }
}

function stepMiner(G, m){
  let budget = DT, guard = 0;
  while(budget > 1e-9 && guard++ < 30){
    if(!m.action){ decide(G, m); if(!m.action) break; }
    const a = m.action, need = a.dur - a.t;
    if(budget >= need){ budget -= need; m.action = null; finish(G, m, a); }
    else { a.t += budget; budget = 0; }
  }
}

function finish(G, m, a){
  if(a.type === 'move'){ m.x = a.data.x; m.y = a.data.y; pickFeathers(G, m); }
  else if(a.type === 'ladder') placeLadder(G, m);
  else if(a.type === 'mine') mineCell(G, m, a.data.x, a.data.y);
  else if(a.type === 'wait') m.stats.idle += a.dur;
  revealAround(G, m);   // après chaque action : rien ne passe sans être vu, même plusieurs actions dans un tick
}

/* échelle sur la case du mineur (et celle du dessus si elle est vide, avec l'échelle de 2 : skill tall_ladder) */
function placeLadder(G, m){
  const put = (x, y) => { if(!G.ladder[y][x]){ G.ladder[y][x] = 1; G.stats.ladders++; m.stats.ladders++; } };
  put(m.x, m.y);
  if(m.skill.tall_ladder && m.y-1 >= 1 && G.tiles[m.y-1][m.x] === 0) put(m.x, m.y-1);
}

/* tas de plumes : le premier mineur qui arrive sur la case le ramasse en entier */
function pickFeathers(G, m){
  const k = m.y*G.w + m.x, n = G.feathers.get(k);
  if(!n) return;
  G.feathers.delete(k);
  collect(m, MI.featherItem, n); m.stats.feathers += n; G.stats.feathers += n;
  log(G, `${m.name} ramasse ${n} ${n>1 ? MI.featherItem.replace('Plume', 'Plumes') : MI.featherItem} !`);
}

function mineCell(G, m, x, y){
  const t = G.tiles[y][x]; if(!t) return;
  G.tiles[y][x] = 0; G.stats.mined++; m.stats.mined++; m.interrupts = 0;
  const shiny = shinyOf(G, t), got = shiny ?? BLOCKS[t].name;
  if(shiny){ G.stats.shiny++; m.stats.shiny++; log(G, `✨ ${m.name} trouve un ${shiny} !`); }
  const extra = fortuneExtra(G, m);
  collect(m, got, 1 + extra); m.stats.fortune += extra;
  if(m.skill.ore_rush) m.rushUntil = G.t + rushTime(m);   // Glyphe Ruée compris
  if(m.target && m.target.x === x && m.target.y === y) m.target = null;
  for(const o of G.miners) if(o !== m && o.action?.type === 'mine' && o.action.data.x === x && o.action.data.y === y) blockLost(G, o);
  /* le bloc portait quelqu'un (posé dessus, ou en train de poser une échelle) : il perd son action et tombe */
  for(const o of G.miners)
    if(o.x === x && o.y === y-1 && o.action && o.action.type !== 'move' && !miSupported(G, o.x, o.y)){ o.action = null; o.path = []; o.target = null; }
}

/* un autre a fini avant lui le bloc qu'il minait : travail perdu ; au bout de interruptMax d'affilée, il fuit la zone */
function blockLost(G, m){
  m.action = null; m.target = null; m.path = [];
  m.stats.lost++; G.stats.contested++;
  if(++m.interrupts >= MI.interruptMax){
    m.flee = { x:m.x, y:m.y, until:G.t + MI.fleeTime }; m.interrupts = 0;
    m.status = 'Change de zone';
  }
}

/* Un joueur quitte : son mineur disparaît, son sac est perdu (quitter = rien). Idempotent. */
export function leaveInstant(G, who){
  if(G.over) return false;
  const m = typeof who === 'object' ? who : G.miners.find(x => x.account !== null && x.account === who);
  if(!m || m.left != null || !G.miners.includes(m)) return false;
  m.left = G.t; m.action = null; m.status = 'A quitté la mine';
  G.miners = G.miners.filter(x => x !== m);
  log(G, `${m.name} a quitté la mine (son butin est perdu)`);
  if(!G.miners.length) endInstant(G);
  return true;
}

/* fin : chacun garde son sac (rien pour ceux qui sont partis). Idempotent. */
export function endInstant(G){
  if(G.summary) return;
  G.over = true;
  G.summary = {
    mode:'mi', id:G.id, seed:G.seed, mined:G.stats.mined, contested:G.stats.contested, feathers:G.stats.feathers,
    total:G.w*G.h,
    shares: G.roster.map(m => ({ miner:m.name, color:m.color, account:m.account, left:m.left != null,
      bag: m.left != null ? {} : { ...m.inv }, stats:{ ...m.stats } })),
  };
}

/* partie complète d'un coup (tests, simulation) ; opts.onTick(G) après chaque tick */
export function runInstant(seed, opts={}){
  const G = newInstant(seed, opts);
  for(let i=0; i<=INSTANT_TICKS && !G.over; i++){ tickInstant(G); opts.onTick?.(G, i); }
  return G;
}

/* objets connus du catalogue (sert aux tests : tout ce qui sort du MI existe dans ITEMS) */
export const instantItems = G => G.roster.flatMap(m => Object.keys(m.inv)).filter(k => !ITEMS[k]);
