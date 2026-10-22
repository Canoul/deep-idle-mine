/* Tours de l'Ange et du Démon : la partie et sa boucle à pas fixe (DT). Ne touche ni au DOM ni au canvas.
   Spec : docs/superpowers/specs/2026-10-22-ange-demon-design.md, réglages TOWER (config).

   Les mineurs partent du rez-de-chaussée et creusent vers le toit (gravité, échelles posées dans la tour seulement,
   partagées). Sur le toit, ils vont au contact du boss (devant ou derrière lui) et le frappent. Le boss vise le premier
   arrivé sur le toit qui y est encore ; chaque coup peut le projeter hors de la tour : chute imprévue (étourdi), puis
   il revient par une porte et remonte par le chemin creusé. Boss mort = fin (réussite) ; temps écoulé = fin (échec).
   Pas de butin dans la partie : le serveur donne les coffres à la fin (server/game/service.js). */
import { TOWER, DT, STATS, BLOCKS, CFG } from '../../config.js';
import { mulberry32 } from '../../core/rng.js';
import { log } from '../log.js';
import { genTower, inTower, onRoof, inBoss } from './world.js';

export const TOWER_TICKS = Math.round(TOWER.duration / DT);
const B = TOWER.boss;

/* opts.miners : [{ name, account, color, look, carac, skills, skillTree }] ; opts.side : 'angel' | 'demon' ; opts.id */
export function newTower(seed, opts = {}){
  seed = seed ?? ((Math.random() * 2**31) | 0);
  const side = opts.side ?? 'angel';
  const world = genTower(seed, side);
  const specs = opts.miners ?? [{}];
  const inner = world.x1 - world.x0 - 1;
  const G = {
    mode: 'tower', side, seed, t: 0, ticks: 0, over: false, ...world,
    rng: mulberry32(seed ^ 0x2545f491), fightRng: mulberry32(seed ^ 0x6a09e667),
    ladder: world.tiles.map(r => new Uint8Array(r.length)),
    boss: { name: TOWER.sides[side].boss, hp: B.hp, maxhp: B.hp, cd: B.hitEvery, x: world.bx, y: world.by, w: B.w, h: B.h, target: null },
    arrivals: [],                         // ids des mineurs dans l'ordre d'arrivée sur le toit (encore dessus)
    log: [], stats: { mined: 0, ladders: 0, hits: 0, knocks: 0, dmg: 0 }, summary: null,
    miners: specs.map((s, i) => createMiner(i, s, world.x0 + 1 + Math.floor((i + 0.5) * inner / specs.length), world.floor)),
  };
  G.id = opts.id ?? `tower-${seed}-${Date.now().toString(36)}`;
  G.roster = [...G.miners];
  log(G, `${TOWER.sides[side].tower} : ${G.miners.length} mineur${G.miners.length > 1 ? 's' : ''} au pied de la tour. ${G.boss.name} attend au sommet.`);
  return G;
}

function createMiner(id, s, x, y){
  return {
    id, name: s.name || ('Mineur ' + (id + 1)), color: s.color || null, look: s.look || {}, account: s.account ?? null,
    carac: { ...STATS, ...(s.carac || {}) }, skill: { ...(s.skills || {}) }, skillTree: s.skillTree ?? null,
    x, y, face: 1, action: null, status: 'Départ', fallN: 0, knocked: false,
    stats: { mined: 0, ladders: 0, dmg: 0, hits: 0, knocked: 0 },
  };
}

/* ---------- règles de la carte ---------- */
const inGrid = (G, x, y) => x >= 0 && x < G.w && y >= 0 && y <= G.h;
/* case vide où l'on peut être (le boss occupe ses cases) */
export const towerAir = (G, x, y) => inGrid(G, x, y) && G.tiles[y][x] === 0 && !inBoss(G, x, y);
const breakable = (G, x, y) => inTower(G, x, y) && G.tiles[y][x] !== 0 && !BLOCKS[G.tiles[y][x]].unbreakable;
/* appui : comme dans la mine (vide dessous sans échelle ni sur la case ni juste dessous = chute) ; le sol porte */
export const towerSupported = (G, x, y) =>
  !(y + 1 <= G.h && towerAir(G, x, y + 1) && !G.ladder[y + 1][x] && !(y > 0 && G.ladder[y][x]));
function landing(G, x, y){ let n = 0; while(!towerSupported(G, x, y) && y < G.h){ y++; n++; } return { y, n }; }

/* durées */
const mineT = (m, t) => BLOCKS[t].hard / (m.carac.mineSpeed * (1 + (m.carac.mineSpeedPct || 0) / 100));
const moveT = m => 1 / m.carac.speed;
const climbT = m => 1 / m.carac.climbSpeed;
const ladderT = m => CFG.ladderTime * (1 - (m.skill.build_time || 0));
const fallT = () => 1 / CFG.fallSpeed;
const hitT = m => CFG.attackInterval / Math.max(0.1, (m.carac.attackSpeed ?? 100) / 100);
const chance = (G, pct) => pct > 0 && G.fightRng() < pct / 100;

/* cases d'où l'on frappe le boss : à côté de lui, sur le toit */
export const contactCells = G => [[G.bx - 1, G.roof - 1], [G.bx + B.w, G.roof - 1]];
const inContact = (G, m) => m.y >= G.by && m.y < G.roof && (m.x === G.bx - 1 || m.x === G.bx + B.w);

/* ---------- itinéraire (Dijkstra) : cases où il tient, en creusant et en posant des échelles ----------
   Arêtes depuis (x, y) : à côté (creuser la case si besoin ; s'il n'y a pas d'appui, il tombe : au plus CFG.maxFall
   cases), monter (creuser au-dessus, poser une échelle sur sa case si besoin : dans la tour seulement), descendre par
   une échelle ou en tombant (au plus CFG.maxFall). Un bloc qu'un autre mineur creuse déjà coûte plus cher (on se
   répartit les puits). Renvoie le chemin (liste de cases) vers la case d'arrivée la moins chère, ou null. */
export function planTo(G, m, goals){
  const { w } = G, N = w * (G.h + 1);
  const goal = new Set(goals.map(([x, y]) => y * w + x));
  const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const start = m.y * w + m.x;
  dist[start] = 0;
  const taken = new Set(G.miners.filter(o => o !== m && o.action?.type === 'mine').map(o => o.action.data.y * w + o.action.data.x));
  const heap = [[0, start]];
  const push = (d, n) => { heap.push([d, n]); let i = heap.length - 1;
    while(i > 0){ const p = (i - 1) >> 1; if(heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop();
    if(heap.length){ heap[0] = last; let i = 0;
      for(;;){ const l = 2 * i + 1, r = l + 1; let s = i;
        if(l < heap.length && heap[l][0] < heap[s][0]) s = l; if(r < heap.length && heap[r][0] < heap[s][0]) s = r;
        if(s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } }
    return top; };
  const dig = (x, y) => towerAir(G, x, y) ? 0 : breakable(G, x, y) ? mineT(m, G.tiles[y][x]) + (taken.has(y * w + x) ? 8 : 0) : Infinity;
  const relax = (c, d, x, y, cost) => { const n = y * w + x; if(cost < Infinity && d + cost < dist[n]){ dist[n] = d + cost; prev[n] = c; push(dist[n], n); } };
  /* appui en supposant la case (x, y) creusée : une case pleine sous elle porte */
  /* où il finit après être arrivé en (x, y) (la case supposée creusée) : il tombe tant qu'il n'a pas d'appui */
  const fallFrom = (x, y) => { let n = 0; while(y + 1 <= G.h && towerAir(G, x, y + 1) && !G.ladder[y + 1][x] && !G.ladder[y][x]){ y++; n++; } return { y, n }; };
  while(heap.length){
    const [d, c] = pop();
    if(d > dist[c]) continue;
    if(goal.has(c)){
      const path = [];
      for(let k = c; k !== start; k = prev[k]) path.push([k % w, (k - k % w) / w]);
      return path.reverse();
    }
    const cx = c % w, cy = (c - cx) / w;
    for(const dx of [-1, 1]){                                                   // à côté
      const x = cx + dx; if(x < 0 || x >= w) continue;
      const dg = dig(x, cy); if(dg === Infinity) continue;
      const l = fallFrom(x, cy); if(l.n > CFG.maxFall) continue;
      relax(c, d, x, l.y, dg + moveT(m) + l.n * fallT());
    }
    if(cy - 1 >= 0){                                                            // monter
      const dg = dig(cx, cy - 1), lad = G.ladder[cy][cx];
      if(dg < Infinity && (lad || inTower(G, cx, cy))) relax(c, d, cx, cy - 1, dg + (lad ? 0 : ladderT(m)) + climbT(m));
    }
    /* descendre : par une échelle (une case où il tient avec le vide dessous en a forcément une) */
    if(cy + 1 <= G.h && towerAir(G, cx, cy + 1) && (G.ladder[cy][cx] || G.ladder[cy + 1][cx])) relax(c, d, cx, cy + 1, climbT(m));
  }
  return null;
}

/* ---------- décision ---------- */
function act(m, type, dur, data, status){ m.action = { type, dur: Math.max(0.05, dur), t: 0, data }; m.status = status; }

export function decide(G, m){
  if(!towerSupported(G, m.x, m.y)) return act(m, 'move', fallT(), { x: m.x, y: m.y + 1, fall: true }, 'Tombe');
  if(inContact(G, m) && G.boss.hp > 0){
    m.face = m.x < G.bx ? 1 : -1;
    return act(m, 'attack', hitT(m), {}, `Combat ${G.boss.name}`);
  }
  /* aller au contact du boss : le côté le moins occupé à coût égal (le chemin le dit) */
  const path = planTo(G, m, contactCells(G));
  if(!path?.length) return act(m, 'wait', 0.5, {}, 'Bloqué');
  const [nx, ny] = path[0];
  const status = m.y >= G.roof ? 'Creuse vers le sommet' : `Va au contact de ${G.boss.name}`;
  if(nx !== m.x){
    m.face = nx > m.x ? 1 : -1;
    if(!towerAir(G, nx, m.y)) return startMine(G, m, nx, m.y, status);
    return act(m, 'move', moveT(m), { x: nx, y: m.y }, status);
  }
  if(ny < m.y){
    if(!towerAir(G, m.x, m.y - 1)) return startMine(G, m, m.x, m.y - 1, status);
    if(!G.ladder[m.y][m.x]) return act(m, 'ladder', ladderT(m), { x: m.x, y: m.y }, 'Pose une échelle');
    return act(m, 'move', climbT(m), { x: m.x, y: m.y - 1 }, 'Grimpe');
  }
  const lad = G.ladder[m.y][m.x] || G.ladder[m.y + 1]?.[m.x];
  return act(m, 'move', lad ? climbT(m) : fallT(), { x: m.x, y: m.y + 1 }, status);
}

function startMine(G, m, x, y, status){
  const t = G.tiles[y][x];
  act(m, 'mine', chance(G, m.carac.oneTap || 0) ? 0 : mineT(m, t), { x, y }, status);
}

/* ---------- boucle ---------- */
export function tickTower(G){
  if(G.over) return;
  G.ticks++; G.t = G.ticks * DT;
  for(const m of [...G.miners]) if(G.miners.includes(m)) stepMiner(G, m);
  updateArrivals(G);
  stepBoss(G);
  if(!G.over && G.ticks >= TOWER_TICKS) endTower(G, false);
}

function stepMiner(G, m){
  let budget = DT, guard = 0;
  while(budget > 1e-9 && guard++ < 30 && !G.over){
    if(!m.action){ decide(G, m); if(!m.action) break; }
    const a = m.action, need = a.dur - a.t;
    if(budget >= need){ budget -= need; m.action = null; finish(G, m, a); }
    else { a.t += budget; budget = 0; }
  }
}

function finish(G, m, a){
  if(a.type === 'move'){
    m.x = a.data.x; m.y = a.data.y;
    if(a.data.fall) m.fallN++;
    if(towerSupported(G, m.x, m.y)) land(G, m);
  } else if(a.type === 'ladder'){
    const put = (x, y) => { if(!G.ladder[y][x] && inTower(G, x, y)){ G.ladder[y][x] = 1; G.stats.ladders++; m.stats.ladders++; } };
    put(m.x, m.y);
    if(m.skill.tall_ladder && towerAir(G, m.x, m.y - 1)) put(m.x, m.y - 1);
  } else if(a.type === 'mine') mineCell(G, m, a.data.x, a.data.y);
  else if(a.type === 'attack') hitBoss(G, m);
}

/* fin d'une chute : une chute imprévue (projeté par le boss) d'au moins CFG.stunFall cases étourdit */
function land(G, m){
  if(m.knocked && m.fallN >= CFG.stunFall){
    m.action = { type: 'stun', dur: CFG.stunTime, t: 0, data: {} }; m.status = 'Étourdi';
    log(G, `💫 ${m.name} s'écrase au pied de la tour (${m.fallN} cases) : étourdi ${CFG.stunTime} s`);
  }
  m.fallN = 0; m.knocked = false;
}

function mineCell(G, m, x, y){
  if(!breakable(G, x, y)) return;
  G.tiles[y][x] = 0; G.stats.mined++; m.stats.mined++;
  for(const o of G.miners)                                  // un autre creusait le même bloc : travail perdu
    if(o !== m && o.action?.type === 'mine' && o.action.data.x === x && o.action.data.y === y) o.action = null;
  for(const o of G.miners)                                  // le bloc portait quelqu'un : il tombe
    if(o.x === x && o.y === y - 1 && o.action && o.action.type !== 'move' && !towerSupported(G, o.x, o.y)) o.action = null;
  if(y === G.roof) log(G, `⛏ ${m.name} perce le toit !`);
}

function hitBoss(G, m){
  if(G.boss.hp <= 0 || !inContact(G, m)) return;
  const crit = chance(G, m.carac.crit || 0);
  const dmg = m.carac.damage * (1 + (m.carac.damagePct || 0) / 100) * (crit ? 2 : 1);
  G.boss.hp = Math.max(0, G.boss.hp - dmg);
  G.stats.dmg += dmg; m.stats.dmg += dmg; m.stats.hits++;
  if(G.boss.hp <= 0){
    log(G, `🏆 ${G.boss.name} est vaincu ! Coup final de ${m.name}.`);
    endTower(G, true);
  }
}

/* ordre d'arrivée sur le toit : on y entre en s'y tenant, on en sort en le quittant (chute) */
function updateArrivals(G){
  G.arrivals = G.arrivals.filter(id => { const m = G.miners.find(x => x.id === id); return m && onRoof(G, m.x, m.y); });
  for(const m of G.miners) if(onRoof(G, m.x, m.y) && towerSupported(G, m.x, m.y) && !G.arrivals.includes(m.id)){
    G.arrivals.push(m.id);
    if(G.arrivals.length === 1) log(G, `⚔ ${m.name} arrive au sommet : ${G.boss.name} le prend pour cible`);
  }
}

function stepBoss(G){
  const b = G.boss;
  if(G.over || b.hp <= 0) return;
  const target = G.miners.find(m => m.id === G.arrivals[0]) ?? null;
  b.target = target?.id ?? null;
  b.cd -= DT;
  if(b.cd > 1e-9) return;
  const rage = b.hp < b.maxhp * B.rageBelow;
  b.cd += rage ? B.rageEvery : B.hitEvery;
  if(!target || !inContact(G, target)) return;
  G.stats.hits++;
  const p = target.skillTree === 'barbare' ? B.knockBarb : B.knockChance;
  if(G.fightRng() < p) knock(G, target);
}

/* projection : la cible part de B.knock cases vers l'extérieur (elle s'arrête contre un bloc), puis tombe */
function knock(G, m){
  const dir = m.x < G.bx ? -1 : 1;
  let x = m.x;
  for(let i = 0; i < B.knock && towerAir(G, x + dir, m.y); i++) x += dir;
  m.x = x; m.action = null; m.knocked = true; m.fallN = 0;
  G.stats.knocks++; m.stats.knocked++;
  log(G, `💥 ${G.boss.name} projette ${m.name} !`);
}

/* Un joueur quitte : son mineur disparaît (il ne recevra rien). Idempotent. */
export function leaveTower(G, who){
  if(G.over) return false;
  const m = typeof who === 'object' ? who : G.miners.find(x => x.account !== null && x.account === who);
  if(!m || m.left != null || !G.miners.includes(m)) return false;
  m.left = G.t; m.action = null; m.status = 'A quitté la tour';
  G.miners = G.miners.filter(x => x !== m);
  log(G, `${m.name} a quitté la tour (il ne recevra rien)`);
  if(!G.miners.length) endTower(G, false);
  return true;
}

/* fin : réussite (boss vaincu) ou échec. Les coffres sont donnés par le serveur aux présents si réussite. Idempotent. */
export function endTower(G, success){
  if(G.summary) return;
  G.over = true;
  if(!success && G.boss.hp > 0 && G.miners.length) log(G, `⌛ Temps écoulé : ${G.boss.name} tient toujours (${Math.ceil(G.boss.hp)} PV).`);
  G.summary = {
    mode: 'tower', id: G.id, seed: G.seed, side: G.side, success: !!success, t: G.t,
    bossHp: Math.ceil(G.boss.hp), bossMax: G.boss.maxhp, mined: G.stats.mined, knocks: G.stats.knocks,
    shares: G.roster.map(m => ({ miner: m.name, color: m.color, account: m.account, left: m.left != null, bag: {},
                                 stats: { mined: m.stats.mined, dmg: Math.round(m.stats.dmg), knocked: m.stats.knocked } })),
  };
}

export function runTower(seed, opts = {}){
  const G = newTower(seed, opts);
  while(!G.over) tickTower(G);
  return G;
}
