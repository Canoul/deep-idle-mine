/* Tours de l'Ange et du Démon : la partie et sa boucle à pas fixe (DT). Ne touche ni au DOM ni au canvas.
   Réglages TOWER (config) ; carte : ./world.js. Refonte du 23/10 (Geoffrey) : étages en serpentin, Séraphins /
   Diablotins, lumière, boss qui se déplace.

   Les mineurs partent de l'étage 0 et montent étage par étage (gravité, échelles posées dans la tour seulement,
   partagées ; torches illimitées dans le noir). Un étage « mobs » se réveille quand un mineur y entre : il faut tuer ses
   mobs pour que la porte de son plafond s'ouvre. Sur le toit, ils vont au contact du boss (le barbare du côté opposé
   aux autres mineurs) et le frappent. Le boss frappe le premier arrivé parmi ceux à son contact ; chaque coup peut le
   projeter : s'il passe le bord, il tombe jusqu'en bas et remonte. Boss mort = fin (réussite) ; temps écoulé = échec.
   Pas de butin dans la partie : le serveur donne les trésors à la fin (server/game/service.js). */
import { TOWER, DT, STATS, BLOCKS, CFG, COMBAT } from '../../config.js';
import { mulberry32 } from '../../core/rng.js';
import { aoeOf } from '../../meta/skills.js';
import { log } from '../log.js';
import { inReach, push, recenter, driftsAway } from '../knock.js';
import { genTower, inTower, onRoof, floorOf, floorTop, floorBottom, floorCeil, gateCols, isCeil, towerLight } from './world.js';

export const TOWER_TICKS = Math.round(TOWER.duration / DT);
const B = TOWER.boss, MB = TOWER.mobs;

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
    /* découvert : tout l'extérieur de la tour ; l'intérieur se découvre étage par étage (revealFloor) */
    seen: world.tiles.map((r, y) => Uint8Array.from(r, (_, x) => inTower(world, x, y) ? 0 : 1)),
    floorSeen: new Array(TOWER.floors).fill(false),
    torches: [], light: new Map(),
    mobs: placeMobs(world, seed),
    boss: { name: TOWER.sides[side].boss, hp: B.hp, maxhp: B.hp, cd: B.hitEvery, x: world.bx, y: world.by, w: B.w, h: B.h,
            target: null, focus: null, taunt: null, engaged: false, moveCd: 0, knockRes: B.knockRes,
            phase: 0, air: null, lift: 0 },
    arrivals: [],                         // ids des mineurs dans l'ordre d'arrivée sur le toit (encore dessus)
    log: [], timeline: { floors: [0], roof: null, engaged: null },
    stats: { mined: 0, ladders: 0, torches: 0, hits: 0, knocks: 0, falls: 0, dmg: 0, kills: 0, blocked: 0 }, summary: null,
    miners: specs.map((s, i) => createMiner(i, s, world.x0 + 1 + Math.floor((i + 0.5) * inner / specs.length), world.floor)),
  };
  G.blocksLeft = world.kinds.map((k, f) => k === 'blocks' ? blockCells(G, f).length : 0);
  G.id = opts.id ?? `tower-${seed}-${Date.now().toString(36)}`;
  G.roster = [...G.miners];
  revealFloor(G, 0);
  log(G, `${TOWER.sides[side].tower} : ${G.miners.length} mineur${G.miners.length > 1 ? 's' : ''} au pied de la tour. ${G.boss.name} attend au sommet.`);
  return G;
}

function createMiner(id, s, x, y){
  return {
    id, name: s.name || ('Mineur ' + (id + 1)), color: s.color || null, look: s.look || {}, auras: s.auras || {}, account: s.account ?? null,
    carac: { ...STATS, ...(s.carac || {}) }, skill: { ...(s.skills || {}) }, skillTree: s.skillTree ?? null,
    x, y, face: 1, action: null, status: 'Départ', fallN: 0, knocked: false,
    stats: { mined: 0, ladders: 0, dmg: 0, hits: 0, knocked: 0, falls: 0, kills: 0, tackled: 0 },
  };
}
const isBarb = m => m.skillTree === 'barbare';

/* mobs des étages « mobs » : mobs.count par étage, sur la ligne du bas, à des colonnes différentes, loin de la porte
   d'entrée (porte du plafond de l'étage du dessous ± 1). Endormis jusqu'à ce qu'un mineur entre dans l'étage. */
function placeMobs(L, seed){
  const r = mulberry32(seed ^ 0x3b0b5), out = [];
  for(let k = 1; k < TOWER.floors; k++){
    if(L.kinds[k] !== 'mobs') continue;
    const entry = gateCols(L, k - 1), cols = [];
    for(let x = L.x0 + 1; x < L.x1; x++) if(!entry.some(g => Math.abs(g - x) <= 1)) cols.push(x);
    for(let i = 0; i < MB.count && cols.length; i++){
      const x = cols.splice(Math.floor(r() * cols.length), 1)[0];
      out.push({ id: out.length, floor: k, x, y: floorBottom(L, k), hp: MB.hp, maxhp: MB.hp, awake: false, cd: MB.step, grab: null, taunt: null });
    }
  }
  return out;
}

/* ---------- règles de la carte ---------- */
const inGrid = (G, x, y) => x >= 0 && x < G.w && y >= 0 && y <= G.h;
/* case vide où l'on peut être (on passe derrière le boss et les mobs) */
export const towerAir = (G, x, y) => inGrid(G, x, y) && G.tiles[y][x] === 0;
/* blocs d'un étage « blocs » encore là : l'intérieur (murs exclus), de la ligne du haut à celle du bas de l'étage */
export function blockCells(G, k){
  const out = [];
  for(let y = floorTop(G, k); y <= floorBottom(G, k); y++) for(let x = G.x0 + 1; x < G.x1; x++) if(G.tiles[y][x] !== 0) out.push([x, y]);
  return out;
}
const inBlockFloor = (G, x, y) => { const k = floorOf(G, y);
  return k >= 0 && k < TOWER.floors && G.kinds[k] === 'blocks' && y >= floorTop(G, k) && y <= floorBottom(G, k) && x > G.x0 && x < G.x1 ? k : -1; };
/* porte d'un plafond scellée : étage « mobs » avec un mob vivant, ou étage « blocs » avec un bloc pas encore miné
   (25/10, Geoffrey : il faut vider tout l'étage) */
export const sealedFloor = (G, k) => G.kinds[k] === 'mobs' ? G.mobs.some(o => o.floor === k && o.hp > 0)
  : G.kinds[k] === 'blocks' && (G.blocksLeft?.[k] ?? 0) > 0;
const sealed = (G, x, y) => isCeil(G, y) && sealedFloor(G, floorOf(G, y));
const breakable = (G, x, y) => inTower(G, x, y) && G.tiles[y][x] !== 0 && !BLOCKS[G.tiles[y][x]].unbreakable && !sealed(G, x, y);

/* un mineur entre dans un étage : tout l'étage et son plafond se découvrent, ses mobs se réveillent */
export function revealFloor(G, k){
  if(k < 0 || k >= TOWER.floors || G.floorSeen[k]) return;
  G.floorSeen[k] = true;
  for(let y = floorCeil(G, k); y <= floorBottom(G, k); y++) for(let x = G.x0; x <= G.x1; x++) G.seen[y][x] = 1;
  if(G.timeline.floors[k] == null) G.timeline.floors[k] = G.t;
  const mobs = G.mobs.filter(o => o.floor === k);
  for(const o of mobs) o.awake = true;
  if(k > 0) log(G, mobs.length ? `👁 Étage ${k} : ${mobs.length} ${TOWER.sides[G.side].mob}s se réveillent !` : `Étage ${k} atteint`);
}
function checkFloors(G){
  for(const m of G.miners){
    const k = floorOf(G, m.y);
    if(k >= 0 && k < TOWER.floors && m.y >= floorTop(G, k) && m.x > G.x0 && m.x < G.x1) revealFloor(G, k);
  }
}

/* ---------- lumière : comme dans la mine (calcul dans ./world.js, partagé avec l'affichage) ---------- */
export function updateTowerLight(G){ G.light = towerLight(G); }
export const towerLum = (G, x, y) => inTower(G, x, y) ? (G.light.get(y * G.w + x) || 0) : 1;
const dk = (G, m) => towerLum(G, m.x, m.y) >= CFG.darkLum ? 1 : CFG.darkSlow;

/* appui : comme dans la mine (vide dessous sans échelle ni sur la case ni juste dessous = chute) ; le sol porte */
export const towerSupported = (G, x, y) =>
  !(y + 1 <= G.h && towerAir(G, x, y + 1) && !G.ladder[y + 1][x] && !(y > 0 && G.ladder[y][x]));

/* durées (sans lumière : ralenti comme dans la mine) */
const mineT = (m, t) => BLOCKS[t].hard / (m.carac.mineSpeed * (1 + (m.carac.mineSpeedPct || 0) / 100));
const moveT = m => 1 / m.carac.speed;
const climbT = m => 1 / m.carac.climbSpeed;
const fallT = () => 1 / CFG.fallSpeed;
const hitT = m => CFG.attackInterval / Math.max(0.1, (m.carac.attackSpeed ?? 100) / 100);
const chance = (G, pct) => pct > 0 && G.fightRng() < pct / 100;
const hitDmg = (G, m) => m.carac.damage * (1 + (m.carac.damagePct || 0) / 100) * (chance(G, m.carac.crit || 0) ? 2 : 1);

/* ---------- mobs ---------- */
/* distance (Manhattan) d'un mineur à un mob (2 cases de haut : (x, y) et (x, y - 1)) */
export const mobDist = (o, m) => Math.abs(m.x - o.x) + (m.y > o.y ? m.y - o.y : m.y < o.y - 1 ? o.y - 1 - m.y : 0);
const liveMobs = G => G.mobs.filter(o => o.hp > 0 && o.awake);
export const tackler = (G, m) => G.mobs.find(o => o.hp > 0 && o.grab === m.id) ?? null;
const byId = (G, id) => id == null ? null : G.miners.find(m => m.id === id) ?? null;
/* mineurs à portée d'un mob : dans son étage, plafond et trou d'entrée compris */
const inFloorZone = (G, o, m) => m.x > G.x0 && m.x < G.x1 && m.y >= floorCeil(G, o.floor) && m.y <= floorBottom(G, o.floor) + 1;
function preyOf(G, o){
  const t = byId(G, o.taunt); if(t) return t;
  let best = null, bd = Infinity;
  for(const m of G.miners){ if(!inFloorZone(G, o, m)) continue; const d = mobDist(o, m); if(d < bd){ bd = d; best = m; } }
  return best;
}
const canTackle = (o, m) => o.taunt == null || o.taunt === m.id;
/* portée (combat dynamique, 25/10 ; src/sim/knock.js) : un mob fait 2 cases de haut, on mesure depuis sa case la plus
   proche du mineur (sa tête si le mineur est à hauteur de sa tête ou au-dessus) */
const mobCell = (o, m) => ({ x: o.x, y: m.y <= o.y - 1 ? o.y - 1 : o.y, kx: o.kx });
export const mobReach = (G, o, m) => inReach(G, mobCell(o, m), m, COMBAT.reach, towerAir);
/* case où un mob peut marcher ou être repoussé : la ligne du bas de son étage, sans trou dessous. Les mobs ne
   s'entassent pas : ils peuvent partager une case entre eux et avec un mineur (25/10, Geoffrey). */
const mobFits = (G, o, nx) => towerAir(G, nx, o.y) && towerAir(G, nx, o.y - 1) && inTower(G, nx, o.y) && !towerAir(G, nx, o.y + 1);
/* recul d'un mineur : il entre dans une case vide (il tombe s'il passe un bord) ; jamais en plein pas. arc : petit
   saut à l'affichage (m.hop change à chaque recul du boss). Renvoie true s'il a été poussé. */
function pushMiner(G, m, from, k, arc = false){
  if(m.action?.type === 'move') return false;
  push(m, from, k, (x, y) => towerAir(G, x, y));
  if(arc) m.hop = G.ticks;
  return true;
}

/* tacle (25/10, comme dans la mine) : à portée, jusqu'à la mort du mob ou une provocation ; soupape : il saute si le
   mineur ne l'a pas frappé depuis COMBAT.tackleGiveUp s, ou s'il est à plus de COMBAT.tackleLeash cases. Toutes les
   MB.hitEvery s, le mob repousse le mineur qu'il tacle de MB.knock blocs, s'il est à portée. */
function stepMobs(G){
  for(const o of G.mobs){
    if(o.hp <= 0 || !o.awake) continue;
    const held = byId(G, o.grab);
    if(!(held && canTackle(o, held) && mobDist(o, held) <= COMBAT.tackleLeash && G.t - (o.grabHit ?? G.t) <= COMBAT.tackleGiveUp + 1e-9)){
      const p = preyOf(G, o);
      const id = p && mobReach(G, o, p) && canTackle(o, p) ? p.id : null;
      if(id != null && id !== o.grab){ o.grabHit = G.t; p.stats.tackled++; }
      o.grab = id;
    }
    const v = byId(G, o.grab);
    o.hit = v ? (o.hit ?? MB.hitEvery) - DT : MB.hitEvery;
    if(v && o.hit <= 1e-9 && mobReach(G, o, v)){ o.hit += MB.hitEvery; pushMiner(G, v, mobCell(o, v), MB.knock); }
    o.cd -= DT;
    if(o.cd > 1e-9) continue;
    o.cd = MB.step;
    const p = v ?? preyOf(G, o); if(!p) continue;   // il tacle : il suit son mineur pour rester au contact
    if(mobReach(G, o, p)) continue;
    if(mobDist(o, p) <= 1){ if(driftsAway(mobCell(o, p), p)){ recenter(o); o.cd = MB.step / 2; } continue; }
    const dx = Math.sign(p.x - o.x), nx = o.x + dx;
    /* il marche sur la ligne du bas de son étage, sans tomber dans le trou d'entrée */
    if(dx && mobFits(G, o, nx)){ o.x = nx; recenter(o); }
  }
}

function hitMob(G, m, o){
  if(o.hp <= 0 || !mobReach(G, o, m)) return;
  const dmg = hitDmg(G, m);
  o.hp = Math.max(0, o.hp - dmg); G.stats.dmg += dmg; m.stats.dmg += dmg; m.stats.hits++;
  if(o.grab === m.id) o.grabHit = G.t;   // soupape du tacle
  if(m.skill.taunt) o.taunt = m.id;
  if(o.hp > 0) push(o, m, COMBAT.knock, (x, y) => y === o.y && mobFits(G, o, x));   // recul (horizontal : il reste au sol)
  /* dégâts de zone (Force brute) : les mobs voisins de la cible prennent une part du coup */
  const k = aoeOf(m.skill);
  if(k > 0) for(const q of G.mobs) if(q !== o && q.hp > 0 && q.awake && Math.abs(q.x - o.x) + Math.abs(q.y - o.y) <= 1){
    q.hp = Math.max(0, q.hp - dmg * k); G.stats.dmg += dmg * k; m.stats.dmg += dmg * k;
    q.splash = { v: dmg * k, t: G.t };   // affiché au-dessus du mob (src/render/splash.js)
    if(q.hp <= 0) mobDied(G, m, q);
  }
  if(o.hp > 0) return;
  mobDied(G, m, o);
}
function mobDied(G, m, o){
  o.grab = null; G.stats.kills++; m.stats.kills++;
  const left = G.mobs.filter(q => q.floor === o.floor && q.hp > 0).length;
  log(G, left ? `⚔ ${m.name} abat un ${TOWER.sides[G.side].mob} (étage ${o.floor} : encore ${left})`
              : `🚪 Étage ${o.floor} nettoyé : la porte du plafond s'ouvre`);
}

/* ---------- boss ---------- */
/* cases d'où l'on frappe le boss : à côté de lui, sur le toit (où l'on tient) */
export function contactCells(G){
  const b = G.boss, y = G.roof - 1;
  return [[b.x - 1, y, 'L'], [b.x + B.w, y, 'R']].filter(([x]) => x >= G.x0 && x <= G.x1 && towerSupported(G, x, y));
}
/* d'où il frappe le boss : 'L' / 'R' (case à côté de lui), 'in' (sur la terrasse dans sa largeur : il peut frapper
   aussi, 25/10, Geoffrey), null sinon */
const contactSide = (G, m) => m.y === G.roof - 1 && towerSupported(G, m.x, m.y)
  ? (m.x === G.boss.x - 1 ? 'L' : m.x === G.boss.x + B.w ? 'R' : m.x >= G.boss.x && m.x < G.boss.x + B.w ? 'in' : null) : null;
const bossMid = G => G.boss.x + B.w / 2;
/* côté où arrivent les autres : celui de la porte du toit tant qu'ils sont dans la tour, sinon leur position */
const sideOfMiner = (G, m) => m.y < G.roof ? (m.x + 0.5 < bossMid(G) ? 'L' : 'R') : (gateCols(G, TOWER.floors - 1)[0] < bossMid(G) ? 'L' : 'R');
/* côté voulu par un barbare : à l'opposé des autres mineurs (la majorité) ; sans autre mineur, les barbares se
   répartissent (le premier à gauche, le deuxième à droite…). null = n'importe lequel (les autres mineurs). */
export function wantedSide(G, m){
  if(!isBarb(m)) return null;
  const others = G.miners.filter(o => !isBarb(o));
  if(!others.length){ const barbs = G.miners.filter(isBarb); return barbs.indexOf(m) % 2 ? 'R' : 'L'; }
  const left = others.filter(o => sideOfMiner(G, o) === 'L').length;
  return left * 2 >= others.length ? 'R' : 'L';
}

/* ---------- itinéraire (Dijkstra) : cases où il tient, en creusant et en posant des échelles ----------
   Arêtes depuis (x, y) : à côté (creuser la case si besoin ; s'il n'y a pas d'appui, il tombe : au plus CFG.maxFall
   cases), monter (creuser au-dessus, poser une échelle sur sa case si besoin : dans la tour seulement), descendre par
   une échelle. Une case pas encore découverte de l'intérieur est supposée de la stonebrick. Un bloc qu'un autre mineur
   creuse déjà coûte plus cher (on se répartit le travail). Renvoie le chemin (liste de cases) vers la case d'arrivée
   la moins chère, ou null. */
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
  const brick = TOWER.sides[G.side].brick;
  const known = (x, y) => !inGrid(G, x, y) || G.seen[y][x];
  const airK = (x, y) => known(x, y) ? towerAir(G, x, y) : false;
  const dig = (x, y) => airK(x, y) ? 0
    : !known(x, y) ? (inTower(G, x, y) ? mineT(m, brick) : Infinity)
    : breakable(G, x, y) ? mineT(m, G.tiles[y][x]) + (taken.has(y * w + x) ? 8 : 0) : Infinity;
  const relax = (c, d, x, y, cost) => { const n = y * w + x; if(cost < Infinity && d + cost < dist[n]){ dist[n] = d + cost; prev[n] = c; push(dist[n], n); } };
  /* où il finit après être arrivé en (x, y) (la case supposée creusée) : il tombe tant qu'il n'a pas d'appui */
  const fallFrom = (x, y) => { let n = 0; while(y + 1 <= G.h && airK(x, y + 1) && !G.ladder[y + 1][x] && !G.ladder[y][x]){ y++; n++; } return { y, n }; };
  const ladT = CFG.ladderTime;
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
      if(dg < Infinity && (lad || inTower(G, cx, cy))) relax(c, d, cx, cy - 1, dg + (lad ? 0 : ladT) + climbT(m));
    }
    /* descendre : par une échelle */
    if(cy + 1 <= G.h && airK(cx, cy + 1) && (G.ladder[cy][cx] || G.ladder[cy + 1][cx])) relax(c, d, cx, cy + 1, climbT(m));
  }
  return null;
}

/* étage « blocs » à vider pour ce mineur : le plus bas pas encore vidé, à son étage ou au-dessus ; -1 sinon */
function blockFloorFor(G, m){
  const here = floorOf(G, m.y);
  for(let k = Math.max(1, here); k < TOWER.floors; k++) if(G.kinds[k] === 'blocks' && G.blocksLeft[k] > 0) return k;
  return -1;
}

/* ---------- décision ---------- */
function act(m, type, dur, data, status){ m.action = { type, dur: Math.max(0.05, dur), t: 0, data }; m.status = status; }
const torchByOther = (G, m) => G.miners.some(o => o !== m && o.action?.type === 'torch' && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= 2);

export function decide(G, m){
  if(!towerSupported(G, m.x, m.y)) return act(m, 'move', fallT(), { x: m.x, y: m.y + 1, fall: true }, 'Tombe');
  const mobName = TOWER.sides[G.side].mob;
  /* taclé : il ne fait que combattre le mob qui le tient ; repoussé, il revient au contact (pas marqués data.fight :
     le tacle ne les interrompt pas) */
  const tk = tackler(G, m);
  if(tk){
    const st = `Taclé par un ${mobName}`;
    if(mobReach(G, tk, m)){ m.face = Math.sign(tk.x - m.x) || m.face; return act(m, 'attack', hitT(m) / dk(G, m), { mob: tk.id }, st); }
    if(driftsAway(m, mobCell(tk, m))) return act(m, 'move', moveT(m) * Math.abs(m.kx || 0), { x: m.x, y: m.y, fight: true }, st);
    const path = planTo(G, m, [[tk.x - 1, tk.y], [tk.x + 1, tk.y]]);
    if(path?.length){ follow(G, m, path, st); m.action.data.fight = true; return; }
    return act(m, 'wait', 0.3, { fight: true }, st);
  }
  /* dans le noir (dans la tour) : une torche */
  if(inTower(G, m.x, m.y) && towerLum(G, m.x, m.y) < CFG.torchThreshold && !torchByOther(G, m))
    return act(m, 'torch', CFG.torchTime, {}, 'Pose une torche');
  /* des mobs réveillés : on les tue (la porte de leur étage reste fermée sinon) */
  const mobs = liveMobs(G);
  if(mobs.length){
    const near = mobs.filter(o => mobReach(G, o, m)).sort((a, b) => a.hp - b.hp)[0];
    if(near){ m.face = Math.sign(near.x - m.x) || m.face; return act(m, 'attack', hitT(m) / dk(G, m), { mob: near.id }, `Combat un ${mobName}`); }
    /* à côté d'un mob mais repoussé hors de portée : il se recentre (sa case est déjà une case d'arrivée du chemin) */
    const back = mobs.find(o => mobDist(o, m) <= 1 && driftsAway(m, mobCell(o, m)));
    if(back) return act(m, 'move', moveT(m) * Math.abs(m.kx || 0), { x: m.x, y: m.y }, `Combat un ${mobName}`);
    const goals = mobs.flatMap(o => [[o.x - 1, o.y], [o.x + 1, o.y]]);
    const path = planTo(G, m, goals);
    if(path?.length) return follow(G, m, path, `Va combattre les ${mobName}s`);
  }
  /* étage « blocs » pas encore vidé (le plus bas, au niveau du mineur ou au-dessus) : il mine ses blocs, le plus proche
     d'abord, en laissant ceux qu'un autre mine déjà ; la porte du plafond ne s'ouvre qu'une fois l'étage vide */
  const kb = blockFloorFor(G, m);
  if(kb >= 0){
    const st = `Vide l'étage ${kb}`;
    const left = blockCells(G, kb).filter(([x, y]) => !busy(G, m, 'mine', x, y));
    const adj = left.find(([x, y]) => Math.abs(x - m.x) + Math.abs(y - m.y) === 1 && (y >= m.y || towerSupported(G, m.x, m.y)));
    if(adj){ m.face = Math.sign(adj[0] - m.x) || m.face; return startMine(G, m, adj[0], adj[1], st); }
    const path = left.length ? planTo(G, m, left) : null;
    if(path?.length) return follow(G, m, path, st);
    return act(m, 'wait', 0.3, {}, st);
  }
  /* le boss */
  if(G.boss.hp <= 0) return act(m, 'wait', 0.5, {}, 'Victoire');
  /* boss en l'air (saut) : on s'écarte de sa zone d'atterrissage et on l'attend juste à côté */
  if(G.boss.air){
    const want = wantedSide(G, m), cells = landCells(G), goals = cells.filter(c => !want || c[2] === want);
    const at = (goals.length ? goals : cells).some(([x, y]) => x === m.x && y === m.y);
    if(at) return act(m, 'wait', 0.2, {}, `Attend ${G.boss.name}`);
    const path = planTo(G, m, goals.length ? goals : cells);
    if(path?.length) return follow(G, m, path, underLanding(G, m) ? 'S\'écarte !' : `Va au contact de ${G.boss.name}`);
    return act(m, 'wait', 0.3, {}, `Attend ${G.boss.name}`);
  }
  const want = wantedSide(G, m), here = contactSide(G, m);
  if(here === 'in' || (here && (!want || want === here))){   // dans le boss : il frappe d'où il est
    m.face = here === 'L' ? 1 : here === 'R' ? -1 : (Math.sign(bossMid(G) - (m.x + 0.5)) || m.face);
    return act(m, 'attack', hitT(m), { boss: true }, `Combat ${G.boss.name}`);
  }
  const cells = contactCells(G), goals = cells.filter(c => !want || c[2] === want);
  if(here && !goals.length){ m.face = here === 'L' ? 1 : -1; return act(m, 'attack', hitT(m), { boss: true }, `Combat ${G.boss.name}`); }   // son côté n'existe pas (boss au bord)
  const path = planTo(G, m, goals.length ? goals : cells);
  if(!path?.length){ G.stats.blocked++; return act(m, 'wait', 0.5, {}, mobs.length ? `Attend (${mobName}s)` : 'Bloqué'); }
  return follow(G, m, path, m.y >= G.roof ? 'Monte vers le sommet' : `Va au contact de ${G.boss.name}`);
}

function follow(G, m, path, status){
  const [nx, ny] = path[0], slow = dk(G, m);
  if(nx !== m.x){
    m.face = nx > m.x ? 1 : -1;
    if(!towerAir(G, nx, m.y)) return startMine(G, m, nx, m.y, status);
    return act(m, 'move', moveT(m) / slow, { x: nx, y: m.y }, status);
  }
  if(ny < m.y){
    if(!towerAir(G, m.x, m.y - 1)) return startMine(G, m, m.x, m.y - 1, status);
    if(!G.ladder[m.y][m.x] && busy(G, m, 'ladder', m.x, m.y)) return act(m, 'wait', 0.2, {}, 'Attend l\'échelle');
    if(!G.ladder[m.y][m.x]) return act(m, 'ladder', CFG.ladderTime, { x: m.x, y: m.y }, 'Pose une échelle');
    return act(m, 'move', climbT(m) / slow, { x: m.x, y: m.y - 1 }, 'Grimpe');
  }
  const lad = G.ladder[m.y][m.x] || G.ladder[m.y + 1]?.[m.x];
  return act(m, 'move', lad ? climbT(m) / slow : fallT(), { x: m.x, y: m.y + 1 }, status);
}

/* un autre mineur fait déjà cette action sur cette case (échelle, bloc) : on attend au lieu de la doubler */
const busy = (G, m, type, x, y) => G.miners.some(o => o !== m && o.action?.type === type &&
  (type === 'ladder' ? o.x === x && o.y === y : o.action.data.x === x && o.action.data.y === y));

function startMine(G, m, x, y, status){
  if(!breakable(G, x, y)) return act(m, 'wait', 0.1, {}, status);     // indestructible ou scellé : on replanifie
  if(busy(G, m, 'mine', x, y)) return act(m, 'wait', 0.2, {}, status);
  act(m, 'mine', chance(G, m.carac.oneTap || 0) ? 0 : mineT(m, G.tiles[y][x]) / dk(G, m), { x, y }, status);
}

/* ---------- boucle ---------- */
export function tickTower(G){
  if(G.over) return;
  G.ticks++; G.t = G.ticks * DT;
  stepMobs(G);
  for(const m of [...G.miners]) if(G.miners.includes(m)) stepMiner(G, m);
  checkFloors(G);
  updateArrivals(G);
  stepBoss(G);
  if(!G.over && G.ticks >= TOWER_TICKS) endTower(G, false);
}

function stepMiner(G, m){
  /* un mob vient de le tacler : l'action en cours est interrompue (sauf une chute, un étourdissement, un coup) */
  const a0 = m.action;
  if(a0 && a0.type !== 'attack' && a0.type !== 'stun' && !a0.data.fall && !a0.data.fight && towerSupported(G, m.x, m.y) && tackler(G, m)) m.action = null;
  if(!G.ladder[m.y]?.[m.x]) m.ky = 0;   // poussé vers le haut hors d'une échelle : il retombe
  let budget = DT, guard = 0;
  while(budget > 1e-9 && guard++ < 30 && !G.over){
    if(!m.action){ decide(G, m); if(!m.action) break; }
    const a = m.action, need = a.dur - a.t;
    if(budget >= need){ budget -= need; m.action = null; finishAction(G, m, a); }
    else { a.t += budget; budget = 0; }
  }
}

function finishAction(G, m, a){
  if(a.type === 'move'){
    m.x = a.data.x; m.y = a.data.y; m.kx = 0; m.ky = 0;   // un pas le recentre (recul)
    if(a.data.fall) m.fallN++;
    if(towerSupported(G, m.x, m.y)) land(G, m);
  } else if(a.type === 'ladder'){
    const put = (x, y) => { if(!G.ladder[y][x] && inTower(G, x, y)){ G.ladder[y][x] = 1; G.stats.ladders++; m.stats.ladders++; } };
    put(m.x, m.y);
    if(m.skill.tall_ladder && towerAir(G, m.x, m.y - 1)) put(m.x, m.y - 1);
  } else if(a.type === 'torch'){
    if(!G.torches.some(t => t.x === m.x && t.y === m.y)){ G.torches.push({ x: m.x, y: m.y }); G.stats.torches++; updateTowerLight(G); }
  } else if(a.type === 'mine') mineCell(G, m, a.data.x, a.data.y);
  else if(a.type === 'attack'){
    if(a.data.boss) hitBoss(G, m);
    else { const o = G.mobs.find(q => q.id === a.data.mob); if(o) hitMob(G, m, o); }
  }
}

/* fin d'une chute : une chute imprévue (projeté par le boss) d'au moins CFG.stunFall cases étourdit */
function land(G, m){
  if(m.knocked){
    if(m.fallN >= CFG.stunFall){
      m.action = { type: 'stun', dur: CFG.stunTime, t: 0, data: {} }; m.status = 'Étourdi';
      log(G, `💫 ${m.name} s'écrase ${m.y >= G.floor ? 'au pied de la tour' : 'plus bas'} (${m.fallN} cases) : étourdi ${CFG.stunTime} s`);
    }
    if(m.y >= G.roof){ G.stats.falls++; m.stats.falls++; }
  }
  m.fallN = 0; m.knocked = false;
}

function mineCell(G, m, x, y){
  if(!breakable(G, x, y)) return;
  const kb = inBlockFloor(G, x, y);
  G.tiles[y][x] = 0; G.stats.mined++; m.stats.mined++;
  if(kb >= 0 && --G.blocksLeft[kb] === 0) log(G, `🚪 Étage ${kb} vidé : la porte du plafond s'ouvre`);
  for(const o of G.miners)                                  // un autre creusait le même bloc : travail perdu
    if(o !== m && o.action?.type === 'mine' && o.action.data.x === x && o.action.data.y === y) o.action = null;
  for(const o of G.miners)                                  // le bloc portait quelqu'un : il tombe
    if(o.x === x && o.y === y - 1 && o.action && o.action.type !== 'move' && !towerSupported(G, o.x, o.y)) o.action = null;
  if(G.torches.length) updateTowerLight(G);
  if(y === G.roof) log(G, `⛏ ${m.name} perce le toit !`);
}

function hitBoss(G, m){
  if(G.boss.hp <= 0 || G.boss.air || !contactSide(G, m)) return;   // en l'air : intouchable
  if(m.skill.taunt) G.boss.taunt = m.id;   // provocation du barbare : il le focus (25/10)
  const dmg = hitDmg(G, m);
  G.boss.hp = Math.max(0, G.boss.hp - dmg);
  G.stats.dmg += dmg; m.stats.dmg += dmg; m.stats.hits++;
  if(!G.boss.engaged){ G.boss.engaged = true; G.timeline.engaged = G.t; log(G, `⚔ ${m.name} engage le combat contre ${G.boss.name}`); }
  if(G.boss.hp <= 0){
    log(G, `🏆 ${G.boss.name} est vaincu ! Coup final de ${m.name}.`);
    endTower(G, true);
  }
}

/* ordre d'arrivée sur le toit : on y entre en s'y tenant, on en sort en le quittant (chute) */
function updateArrivals(G){
  G.arrivals = G.arrivals.filter(id => { const m = G.miners.find(x => x.id === id); return m && m.y < G.roof; });
  for(const m of G.miners) if(onRoof(G, m.x, m.y) && towerSupported(G, m.x, m.y) && !G.arrivals.includes(m.id)){
    G.arrivals.push(m.id);
    if(G.timeline.roof == null){ G.timeline.roof = G.t; log(G, `⛰ ${m.name} arrive au sommet`); }
  }
}

/* le boss peut-il se tenir en bx ? sur le toit, entièrement au-dessus de cases pleines */
const bossFits = (G, bx) => bx >= G.x0 && bx + B.w - 1 <= G.x1 && Array.from({ length: B.w }, (_, i) => G.tiles[G.roof][bx + i]).every(t => t !== 0);

/* focus du boss (25/10, Geoffrey) : le barbare qui l'a provoqué s'il est sur le toit ; sinon son focus tant qu'il est
   sur le toit ; sinon le premier arrivé à son contact, puis le premier arrivé sur le toit ; personne : null. Il ignore
   les autres mineurs. */
const onTop = (G, m) => !!m && onRoof(G, m.x, m.y);
function focusOf(G){
  const b = G.boss, t = byId(G, b.taunt);
  if(b.taunt != null && !onTop(G, t)) b.taunt = null;
  if(b.taunt != null) return (b.focus = b.taunt, t);
  const f = byId(G, b.focus); if(onTop(G, f)) return f;
  const inContact = G.miners.filter(m => contactSide(G, m));
  const n = G.arrivals.map(id => inContact.find(m => m.id === id)).find(Boolean) ?? inContact[0]
         ?? G.arrivals.map(id => byId(G, id)).find(m => onTop(G, m)) ?? null;
  b.focus = n?.id ?? null;
  return n;
}
/* mineurs sur la terrasse dans le boss (sa largeur) */
const underBoss = (G, m, bx = G.boss.x) => onTop(G, m) && m.x >= bx && m.x < bx + B.w;
function stepBoss(G){
  const b = G.boss;
  if(G.over || b.hp <= 0) return;
  if(b.air) return stepJump(G);
  /* saut : à chaque tranche de jumpEvery de ses PV (une seule fois même si un coup en fait passer deux) */
  const level = Math.min(Math.round(1 / B.jumpEvery) - 1, Math.floor((1 - b.hp / b.maxhp) / B.jumpEvery + 1e-9));
  if(level > b.phase) return startJump(G, level);
  const focus = focusOf(G), contact = !!focus && !!contactSide(G, focus);
  b.target = focus?.id ?? null;
  /* il suit son focus (à travers les autres mineurs, qui restent où ils sont, même sur lui : 25/10, Geoffrey) ; plus
     personne sur le toit : il retourne au centre */
  b.moveCd = Math.max(0, b.moveCd - DT);
  if(b.engaged && b.moveCd <= 1e-9){
    const dir = focus ? (contact || underBoss(G, focus) ? 0 : Math.sign(focus.x + 0.5 - bossMid(G)))
              : G.miners.some(m => onTop(G, m)) ? 0 : Math.sign(G.bx - b.x);
    if(dir && bossFits(G, b.x + dir)){ b.x += dir; b.moveCd = 1 / (STATS.speed * B.speedMul); }
  }
  b.cd -= DT;
  if(b.cd > 1e-9) return;
  const rage = b.hp < b.maxhp * B.rageBelow;
  b.cd += rage ? B.rageEvery : B.hitEvery;
  if(!contact) return;
  G.stats.hits++;
  const p = isBarb(focus) ? (rage ? B.rageKnockBarb : B.knockBarb) : (rage ? B.rageKnock : B.knockChance);
  if(G.fightRng() < p) knock(G, focus);
  else pushMiner(G, focus, { x: focus.x < bossMid(G) ? focus.x + 1 : focus.x - 1, y: focus.y }, B.push, true);   // recul ; lui ne recule pas
}

/* ---------- saut du boss (25/10, Geoffrey) ----------
   Il file au centre du toit (G.bx) en jumpFly s en montant à jumpHigh blocs, reste jumpHover s en l'air (intouchable,
   il ne frappe plus), puis retombe en jumpFall s : les mineurs du toit qui étaient sous lui sont projetés de B.knock
   cases sur le côté le plus proche, et tous ceux du toit sont étourdis jumpStun s (la ténacité peut l'ignorer). */
const landCells = G => [[G.bx - 1, G.roof - 1, 'L'], [G.bx + B.w, G.roof - 1, 'R']].filter(([x]) => x >= G.x0 && x <= G.x1 && towerSupported(G, x, G.roof - 1));
const underLanding = (G, m) => underBoss(G, m, G.bx);
function startJump(G, level){
  const b = G.boss;
  b.phase = level; b.air = { stage: 'fly', t: 0, x0: b.x }; b.target = null;
  log(G, `🦅 ${G.boss.name} s'envole au-dessus du toit !`);
}
function stepJump(G){
  const b = G.boss, a = b.air;
  a.t += DT;
  if(a.stage === 'fly'){
    const p = Math.min(1, a.t / B.jumpFly);
    b.x = Math.round(a.x0 + (G.bx - a.x0) * p); b.lift = B.jumpHigh * p;
    if(p >= 1){ a.stage = 'hover'; a.t = 0; }
  } else if(a.stage === 'hover'){
    if(a.t >= B.jumpHover - 1e-9){ a.stage = 'fall'; a.t = 0; }
  } else {
    const p = Math.min(1, a.t / B.jumpFall);
    b.lift = B.jumpHigh * (1 - p);
    if(p >= 1) landBoss(G);
  }
}
function landBoss(G){
  const b = G.boss;
  b.air = null; b.lift = 0; b.cd = B.hitEvery; b.moveCd = 0;
  log(G, `💥 ${G.boss.name} retombe sur le toit !`);
  for(const m of [...G.miners]){
    if(!onTop(G, m)) continue;
    if(underBoss(G, m)) knock(G, m);
    if(!towerSupported(G, m.x, m.y)) continue;   // projeté hors du toit : il tombe
    if((m.carac.tenacity || 0) > 0 && G.fightRng() * 100 < m.carac.tenacity){ log(G, `💪 ${m.name} résiste à l'atterrissage`); continue; }
    m.action = { type: 'stun', dur: B.jumpStun, t: 0, data: {} }; m.status = 'Étourdi (atterrissage)';
    m.stats.stunned = (m.stats.stunned || 0) + 1;
  }
}

/* projection : la cible part de B.knock cases vers l'extérieur (elle s'arrête contre un bloc), puis tombe si elle n'a
   plus d'appui (au-delà du bord de la tour : jusqu'au sol) ; petit arc à l'affichage */
function knock(G, m){
  const dir = m.x + 0.5 < bossMid(G) ? -1 : 1;
  let x = m.x;
  for(let i = 0; i < B.knock && towerAir(G, x + dir, m.y); i++) x += dir;
  m.x = x; m.kx = 0; m.action = null; m.knocked = true; m.fallN = 0; m.hop = G.ticks;
  G.stats.knocks++; m.stats.knocked++;
  const off = x < G.x0 || x > G.x1;
  log(G, off ? `💥 ${G.boss.name} projette ${m.name} hors de la tour !` : `💥 ${G.boss.name} projette ${m.name}`);
}

/* Un joueur quitte : son mineur disparaît (il ne recevra rien). Idempotent. */
export function leaveTower(G, who){
  if(G.over) return false;
  const m = typeof who === 'object' ? who : G.miners.find(x => x.account !== null && x.account === who);
  if(!m || m.left != null || !G.miners.includes(m)) return false;
  m.left = G.t; m.action = null; m.status = 'A quitté la tour';
  G.miners = G.miners.filter(x => x !== m);
  for(const o of G.mobs){ if(o.grab === m.id) o.grab = null; if(o.taunt === m.id) o.taunt = null; }
  if(G.boss.focus === m.id) G.boss.focus = null;
  if(G.boss.taunt === m.id) G.boss.taunt = null;
  log(G, `${m.name} a quitté la tour (il ne recevra rien)`);
  if(!G.miners.length) endTower(G, false);
  return true;
}

/* étage le plus haut atteint (floors = le toit) */
export const reached = G => G.timeline.roof != null ? TOWER.floors : G.floorSeen.lastIndexOf(true);

/* fin : réussite (boss vaincu) ou échec. Les trésors sont donnés par le serveur aux présents si réussite. Idempotent. */
export function endTower(G, success){
  if(G.summary) return;
  G.over = true;
  if(!success && G.boss.hp > 0 && G.miners.length) log(G, `⌛ Temps écoulé : ${G.boss.name} tient toujours (${Math.ceil(G.boss.hp)} PV).`);
  G.summary = {
    mode: 'tower', id: G.id, seed: G.seed, side: G.side, success: !!success, t: G.t,
    bossHp: Math.ceil(G.boss.hp), bossMax: G.boss.maxhp, mined: G.stats.mined, knocks: G.stats.knocks, falls: G.stats.falls,
    floor: reached(G), kills: G.stats.kills,
    shares: G.roster.map(m => ({ miner: m.name, color: m.color, account: m.account, left: m.left != null, bag: {},
                                 stats: { mined: m.stats.mined, dmg: Math.round(m.stats.dmg), knocked: m.stats.knocked, kills: m.stats.kills } })),
  };
}

export function runTower(seed, opts = {}){
  const G = newTower(seed, opts);
  while(!G.over) tickTower(G);
  return G;
}
