/* Instance I (le roi gobelin) : la partie et sa boucle à pas fixe (DT). Ne touche ni au DOM ni au canvas.
   Réglages INSTANCE (src/config.js), carte ./world.js, spec docs/superpowers/specs/2026-10-27-instances-design.md.

   Les mineurs partent du sol, au centre. Tant qu'il reste un spawner, le groupe va casser le même (un côté entier
   puis l'autre, le plus proche d'abord : targetSpawner) : il monte au rebord par des échelles (illimitées, partagées), va au fond
   et le « mine » (chaque seconde enlève sa vitesse de minage effective). Les gobelins qui en sortent foncent sur les
   mineurs (la provocation d'abord, puis celui qui casse un spawner à focusRange cases ou moins, puis le plus proche),
   tombent des rebords et montent aux échelles ; leur premier coup tacle (le mineur doit tuer ce gobelin) et leurs coups
   repoussent vers le centre de la salle (un mineur au bord d'un rebord peut tomber). Tous les spawners cassés, le roi
   descend de sa plateforme et se bat au sol ; à 75, 50 et 25 % de ses PV il enferme chaque mineur sur un rebord, et
   attend qu'un mineur sorte de sa cage. Roi mort = réussite ; temps écoulé = échec.

   Combat (portée, recul, tacle) : comme dans les tours (src/sim/knock.js). Sorts : Inspiration, Fast learner et
   Dynamite sur les spawners et les cages (Dynamite = INSTANCE.spawner.dynamite coups sur un spawner, casse les blocs de
   cage à son rayon) ; Cri de guerre, Cleave, Hand of Justice, Dash et Ulti shen contre les gobelins (Ulti shen et Cleave
   aussi sur le roi) ; Illumination et Bonbonne de zipette : sans effet (tout est éclairé, pas d'oxygène). */
import { INSTANCE, DT, STATS, CFG, COMBAT } from '../../config.js';
import { mulberry32 } from '../../core/rng.js';
import { SPELL } from '../../meta/spells.js';
import { log } from '../log.js';
import { ladderTime } from '../mineur.js';
import { inReach, push, driftsAway, reachOf, knockbackOf, knockOf, stopAction } from '../knock.js';
import { genInstance, isOpen, toCenter, AIR, CAGE, SPAWNER } from './world.js';

const I = INSTANCE, SP = I.spawner, GB = I.goblin, B = I.boss;
export const INSTANCE_TICKS = Math.round(I.duration / DT);

/* opts.miners : [{ name, account, color, look, auras, carac, skills, skillTree, spells }] ; opts.id ; opts.instance */
export function newInstance(seed, opts = {}){
  seed = seed ?? ((Math.random() * 2**31) | 0);
  const world = genInstance();
  const specs = opts.miners ?? [{}];
  const G = {
    mode: 'instance', instance: opts.instance ?? 'instance_1', seed, t: 0, ticks: 0, over: false, ...world,
    rng: mulberry32(seed ^ 0x1b873593), fightRng: mulberry32(seed ^ 0x85ebca6b),
    ladder: world.tiles.map(r => new Uint8Array(r.length)),
    spawners: world.ledges.map(l => ({ id: l.id, side: l.side, level: l.level, x: l.sx, y: l.y, mx: l.mx, hp: SP.hp, maxhp: SP.hp, cd: 0, alive: true })),
    goblins: [], nextGob: 0, target: null, inspire: null, warcry: null, cages: [],
    boss: { name: B.name, hp: B.hp, maxhp: B.hp, w: B.w, h: B.h, x: Math.floor((world.w - B.w) / 2), y: world.plat.row - 1,
            state: 'sleep', t: 0, cd: B.hitEvery, moveCd: 0, focus: null, taunt: null, hits: 0, phase: 0, knockRes: B.knockRes, kx: 0 },
    log: [], timeline: { spawners: [], awake: null, cages: [], rage: null },
    stats: { ladders: 0, mined: 0, drilled: 0, spawned: 0, kills: 0, dmg: 0, bossDmg: 0, knocks: 0, boosts: 0, falls: 0, blocked: 0 }, summary: null,
  };
  const cx = Math.floor(world.w / 2);
  G.miners = specs.map((s, i) => createMiner(i, s, cx - 1 + (i % 3), world.floorY));
  G.roster = [...G.miners];
  G.id = opts.id ?? `instance-${seed}-${Date.now().toString(36)}`;
  log(G, `🗝 Instance I : ${G.miners.length} mineur${G.miners.length > 1 ? 's' : ''} face aux ${G.spawners.length} spawners. Le ${B.name} attend en haut.`);
  return G;
}

function createMiner(id, s, x, y){
  return {
    id, name: s.name || ('Mineur ' + (id + 1)), color: s.color || null, look: s.look || {}, auras: s.auras || {}, account: s.account ?? null,
    carac: { ...STATS, ...(s.carac || {}) }, skill: { ...(s.skills || {}) }, skillTree: s.skillTree ?? null,
    spells: Array.isArray(s.spells) ? [...s.spells] : [], spellCd: {}, learned: 0,
    x, y, face: 1, kx: 0, ky: 0, action: null, status: 'Départ', fallN: 0, knocked: false,
    stats: { dmg: 0, bossDmg: 0, kills: 0, drilled: 0, mined: 0, ladders: 0, knocked: 0, tackled: 0, falls: 0, spells: 0 },
  };
}

/* ---------- règles de la carte ---------- */
const open = (G, x, y) => isOpen(G, x, y);
/* appui : vide dessous sans échelle ni sur la case ni juste dessous = chute (comme dans la mine et les tours) */
export const instSupported = (G, x, y) => !(y + 1 <= G.h && open(G, x, y + 1) && !G.ladder[y + 1][x] && !(y > 0 && G.ladder[y][x]));
const breakable = (G, x, y) => x >= 0 && x < G.w && y >= 0 && y < G.h && G.tiles[y][x] === CAGE;
const spawnerAt = (G, x, y) => G.spawners.find(s => s.alive && s.x === x && s.y === y) ?? null;

/* ---------- vitesses et coups ---------- */
const inspireOn = G => !!G.inspire && G.t < G.inspire.until;
export const instRate = (G, m) => m.carac.mineSpeed * (1 + (m.carac.mineSpeedPct || 0) / 100) * (1 + (inspireOn(G) ? G.inspire.pct : 0)) * (1 + (m.learned || 0));
const cageT = (G, m) => B.cageHard / instRate(G, m);
const moveT = m => 1 / m.carac.speed;
const climbT = m => 1 / m.carac.climbSpeed;
const fallT = () => 1 / CFG.fallSpeed;
const chance = (G, pct) => pct > 0 && G.fightRng() < pct / 100;
const byId = (G, id) => id == null ? null : G.miners.find(m => m.id === id) ?? null;
const manh = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
/* Cri de guerre : actif pour les mineurs à son rayon de celui qui l'a lancé */
const warcryOf = (G, m) => { const w = G.warcry, c = w && G.t < w.until ? byId(G, w.by) : null;
  return c && manh(c, m) <= SPELL.war_cry.radius ? w : null; };
const hitT = (G, m) => CFG.attackInterval / Math.max(0.1, (m.carac.attackSpeed ?? 100) / 100 * (1 + (warcryOf(G, m)?.speed || 0)));
const hitDmg = (G, m) => m.carac.damage * (1 + (m.carac.damagePct || 0) / 100) * (1 + (warcryOf(G, m)?.dmg || 0)) * (chance(G, m.carac.crit || 0) ? 2 : 1);
const strikeDmg = (G, m) => { let d = hitDmg(G, m); if(chance(G, m.carac.doubleAttack || 0)) d += hitDmg(G, m); return d; };
const ready = (G, m, id) => m.spells.includes(id) && G.t + 1e-9 >= (m.spellCd[id] || 0);
const cast = (G, m, id, cdFrom = G.t, mul = 1) => { m.spellCd[id] = cdFrom + SPELL[id].cd * mul; m.stats.spells++; };

/* ---------- gobelins ---------- */
const liveGobs = G => G.goblins.filter(o => o.hp > 0);
export const tackler = (G, m) => G.goblins.find(o => o.hp > 0 && o.grab === m.id) ?? null;
export const gobReach = (G, o, m, range = COMBAT.reach) => inReach(G, o, m, range, open);
const hitReach = (G, m, o) => gobReach(G, o, m, reachOf(m));
const canTackle = (o, m) => o.taunt == null || o.taunt === m.id;
const stunned = (G, o) => o.stunUntil != null && G.t < o.stunUntil;
/* qui il vise : la provocation, sinon un mineur qui casse un spawner à focusRange cases ou moins, sinon le plus proche */
function preyOf(G, o){
  const t = byId(G, o.taunt); if(t) return t;
  const drillers = G.miners.filter(m => m.action?.type === 'drill' && manh(o, m) <= SP.focusRange);
  const pool = drillers.length ? drillers : G.miners;
  let best = null, bd = Infinity;
  for(const m of pool){ const d = manh(o, m); if(d < bd){ bd = d; best = m; } }
  return best;
}
/* recul d'un mineur vers le centre de la salle (pas en plein pas) ; arc : petit saut à l'affichage */
export function pushMiner(G, m, k, arc = false){
  if(m.action?.type === 'move') return false;
  const dir = toCenter(G, m.x);
  push(m, { x: m.x - dir, y: m.y }, k, (x, y) => open(G, x, y));
  if(arc) m.hop = G.ticks;
  return true;
}

function spawnGoblin(G, s){
  G.goblins.push({ id: G.nextGob++, x: s.mx, y: s.y, kx: 0, hp: GB.hp, maxhp: GB.hp, grab: null, grabHit: null, taunt: null,
                   hit: GB.hitEvery, moveCd: GB.step, fall: 0, stunUntil: null, from: s.id });
  G.stats.spawned++;
}

function stepSpawners(G){
  for(const s of G.spawners){
    if(!s.alive) continue;
    s.cd -= DT;
    if(s.cd <= 1e-9){ s.cd += SP.every; spawnGoblin(G, s); }
  }
}

/* premier pas d'un gobelin vers une case d'arrivée (largeur d'abord) : marcher (puis tomber), monter / descendre une
   échelle ; null s'il n'y a pas de chemin (le mineur est sur un rebord sans échelle) */
function gobStep(G, o, goals){
  const { w } = G, start = o.y * w + o.x, goal = new Set(goals.filter(([x, y]) => x >= 0 && x < w).map(([x, y]) => y * w + x));
  if(goal.has(start)) return null;
  const prev = new Map([[start, -1]]), q = [start];
  const land = (x, y) => { while(!instSupported(G, x, y)) y++; return y; };
  for(let i = 0; i < q.length; i++){
    const c = q[i], cx = c % w, cy = (c - cx) / w;
    const next = [];
    for(const dx of [-1, 1]) if(open(G, cx + dx, cy)) next.push((land(cx + dx, cy)) * w + cx + dx);
    if(G.ladder[cy][cx] && open(G, cx, cy - 1)) next.push((cy - 1) * w + cx);
    if(cy + 1 < G.h && open(G, cx, cy + 1) && (G.ladder[cy][cx] || G.ladder[cy + 1][cx])) next.push((cy + 1) * w + cx);
    for(const n of next){
      if(prev.has(n)) continue;
      prev.set(n, c);
      if(goal.has(n)){ let k = n; while(prev.get(k) !== start) k = prev.get(k); return [k % w, (k - k % w) / w]; }
      q.push(n);
    }
  }
  return null;
}

function stepGoblins(G){
  for(const o of G.goblins){
    if(o.hp <= 0) continue;
    if(stunned(G, o)){ o.grab = null; continue; }
    /* gravité : il tombe d'une case toutes les 1/fallSpeed s */
    if(!instSupported(G, o.x, o.y)){ o.fall += DT; if(o.fall >= fallT() - 1e-9){ o.fall = 0; o.y++; o.kx = 0; } continue; }
    o.fall = 0;
    /* tacle : jusqu'à la mort du gobelin ou une provocation ; soupape comme dans les tours (il lâche un mineur qui ne le
       frappe plus depuis tackleGiveUp s, ou trop loin) */
    const held = byId(G, o.grab);
    if(held && !(canTackle(o, held) && manh(o, held) <= COMBAT.tackleLeash && G.t - (o.grabHit ?? G.t) <= COMBAT.tackleGiveUp + 1e-9)) o.grab = null;
    const p = byId(G, o.grab) ?? preyOf(G, o);
    if(!p) continue;
    if(gobReach(G, o, p)){
      o.hit -= DT;
      if(o.hit <= 1e-9){
        o.hit += GB.hitEvery; o.hits = (o.hits || 0) + 1;
        if(canTackle(o, p) && o.grab !== p.id){ o.grab = p.id; o.grabHit = G.t; p.stats.tackled++; }
        if(G.fightRng() < GB.knockChance && pushMiner(G, p, GB.knock)) G.stats.gobKnocks = (G.stats.gobKnocks || 0) + 1;   // compté s'il a lieu (pas en plein pas)
        G.stats.gobHits = (G.stats.gobHits || 0) + 1;
      }
      continue;
    }
    o.hit = Math.min(o.hit, GB.hitEvery);
    o.moveCd -= DT;
    if(o.moveCd > 1e-9) continue;
    o.moveCd = GB.step;
    const step = gobStep(G, o, [[p.x - 1, p.y], [p.x + 1, p.y], [p.x, p.y]]);
    if(step){ o.face = Math.sign(step[0] - o.x) || o.face; o.x = step[0]; o.y = step[1]; o.kx = 0; }
  }
  if(G.goblins.length > 40) G.goblins = G.goblins.filter(o => o.hp > 0);
}

function hitGoblin(G, m, o, dmg = strikeDmg(G, m)){
  if(o.hp <= 0) return;
  o.hp = Math.max(0, o.hp - dmg); G.stats.dmg += dmg; m.stats.dmg += dmg;
  if(o.grab === m.id) o.grabHit = G.t;
  if(m.skill.taunt) o.taunt = m.id;
  if(o.hp > 0 && !o.knockLock){
    const x0 = o.x;
    push(o, m, knockbackOf(m), (x, y) => y === o.y && open(G, x, y) && instSupported(G, x, y));
    if(o.x !== x0){ o.knockLock = true; if(o.grab === m.id && !gobReach(G, o, m)) o.grab = null; }
  } else if(o.knockLock && gobReach(G, o, m)) o.knockLock = false;
  if(o.hp <= 0){ o.grab = null; G.stats.kills++; m.stats.kills++; }
}

/* ---------- le roi ---------- */
const bossMid = G => G.boss.x + G.boss.w / 2;
const bossFits = (G, bx) => bx >= 0 && bx + G.boss.w - 1 < G.w;
const bossActive = G => G.boss.hp > 0 && (G.boss.state === 'fight' || G.boss.state === 'wait');
/* d'où l'on frappe le roi : au sol, à côté de lui ou sous lui */
const inContact = (G, m) => bossActive(G) && m.y === G.boss.y && instSupported(G, m.x, m.y) && m.x >= G.boss.x - 1 && m.x <= G.boss.x + G.boss.w;
const contactCells = G => { const b = G.boss, out = [];
  for(let x = b.x - 1; x <= b.x + b.w; x++) if(x >= 0 && x < G.w && open(G, x, b.y)) out.push([x, b.y]); return out; };
const rageOn = G => G.boss.hp < G.boss.maxhp * B.rageBelow;

function bossFocus(G){
  const b = G.boss, t = byId(G, b.taunt);
  if(b.taunt != null && !t) b.taunt = null;
  if(t) return (b.focus = t.id, t);
  let best = null, bd = Infinity;
  for(const m of G.miners){ const d = Math.abs(m.x + 0.5 - bossMid(G)) + Math.abs(m.y - b.y); if(d < bd){ bd = d; best = m; } }
  b.focus = best?.id ?? null;
  return best;
}

function stepBoss(G){
  const b = G.boss;
  if(G.over || b.hp <= 0) return;
  if(b.state === 'sleep'){
    if(G.spawners.every(s => !s.alive)){
      b.state = 'drop'; b.t = 0; G.timeline.awake = G.t;
      log(G, `👑 Les ${G.spawners.length} spawners sont détruits : le ${b.name} saute de sa plateforme !`);
    }
    return;
  }
  if(b.state === 'drop'){
    b.t += DT;
    if(b.t >= B.dropTime - 1e-9){ b.state = 'fight'; b.y = G.floorY; b.cd = B.hitEvery; b.moveCd = 0; }
    return;
  }
  /* enfermement : à chaque seuil de PV (une seule fois même si un coup en fait passer deux) */
  const level = B.cageAt.filter(f => b.hp <= b.maxhp * f + 1e-9).length;
  if(level > b.phase){ b.phase = level; return cage(G); }
  if(b.state === 'wait'){
    b.t += DT;
    const out = G.cages.some(c => { const m = byId(G, c.id); return m && (Math.hypot(m.x - c.x, m.y - c.y) > B.cageRadius + 0.5 || m.y >= G.floorY); });
    if(out || b.t >= B.cageMaxWait || !G.miners.length){ b.state = 'fight'; b.cd = B.hitEvery; G.cages = []; log(G, `👑 Le ${b.name} reprend le combat`); }
    return;
  }
  if(rageOn(G) && G.timeline.rage == null){ G.timeline.rage = G.t; log(G, `😡 Le ${b.name} enrage !`); }
  const f = bossFocus(G), contact = !!f && inContact(G, f), rage = rageOn(G);
  b.moveCd = Math.max(0, b.moveCd - DT);
  if(f && !contact && b.moveCd <= 1e-9){
    const dir = Math.sign(f.x + 0.5 - bossMid(G));
    if(Math.abs(f.x + 0.5 - bossMid(G)) > b.w / 2 && dir && bossFits(G, b.x + dir)){ b.x += dir; b.kx = 0; }
    b.moveCd = 1 / (STATS.speed * B.speedMul * (rage ? B.rageSpeed : 1));
  }
  b.cd -= DT;
  if(b.cd > 1e-9) return;
  b.cd += B.hitEvery;
  if(!contact) return;
  b.hits++;
  if(b.hits % B.boostEvery === 0) boost(G, f);
  else pushMiner(G, f, rage ? B.ragePush : B.push, true);
}

/* coup boosté : projeté de boostHigh cases de haut puis boostLong de long, vers le centre (il s'arrête contre un bloc),
   puis il tombe (il peut atterrir sur un rebord). La résistance au recul réduit les deux distances. */
function boost(G, m){
  const rnd = ([a, b]) => a + Math.floor(G.fightRng() * (b - a + 1));
  const high = Math.round(knockOf(m, rnd(B.boostHigh))), long = Math.round(knockOf(m, rnd(B.boostLong)));
  const dir = toCenter(G, m.x);
  let x = m.x, y = m.y;
  for(let i = 0; i < high && open(G, x, y - 1); i++) y--;
  for(let i = 0; i < long && open(G, x + dir, y); i++) x += dir;
  m.x = x; m.y = y; m.kx = 0; m.ky = 0; m.action = null; m.knocked = true; m.fallN = 0; m.hop = G.ticks; m.boosted = G.ticks;
  for(const o of G.goblins) if(o.grab === m.id) o.grab = null;
  G.stats.boosts++; G.stats.knocks++; m.stats.knocked++;
  log(G, `💥 Le ${G.boss.name} envoie ${m.name} en l'air !`);
}

/* enfermement : chaque mineur sur un rebord différent (au hasard), entouré de blocs de cage dans un rayon cageRadius,
   sur le rebord et au-dessus (pas dans le mur ni le rebord) ; le roi attend */
function cage(G){
  const b = G.boss, ledges = [...G.ledges];
  for(let i = ledges.length - 1; i > 0; i--){ const j = Math.floor(G.fightRng() * (i + 1)); [ledges[i], ledges[j]] = [ledges[j], ledges[i]]; }
  G.cages = [];
  G.miners.forEach((m, i) => {
    const l = ledges[i % ledges.length], cx = l.side === 'L' ? l.x0 + 2 : l.x1 - 2, cy = l.y;
    stopAction(m); m.action = null; m.x = cx; m.y = cy; m.kx = 0; m.ky = 0; m.knocked = false; m.hop = G.ticks;
    for(const o of G.goblins) if(o.grab === m.id) o.grab = null;
    const R = B.cageRadius;
    for(let y = cy - R; y <= cy; y++) for(let x = cx - R; x <= cx + R; x++){
      if(x < 0 || x >= G.w || y < 0 || (x === cx && y === cy) || Math.hypot(x - cx, y - cy) > R + 1e-9 || G.tiles[y][x] !== AIR) continue;
      G.tiles[y][x] = CAGE; G.ladder[y][x] = 0;
    }
    G.cages.push({ id: m.id, x: cx, y: cy });
  });
  b.state = 'wait'; b.t = 0; b.kx = 0;
  G.timeline.cages.push(G.t);
  log(G, `🧱 Le ${b.name} enferme tout le monde sur les rebords ! (${Math.round(b.hp / b.maxhp * 100)} % de PV)`);
}

function hitBoss(G, m, dmg = strikeDmg(G, m)){
  const b = G.boss;
  if(!inContact(G, m)) return;
  if(m.skill.taunt) b.taunt = m.id;
  damageBoss(G, m, dmg);
  if(b.focus === m.id && b.hp > 0){
    const from = { x: m.x + 0.5 < bossMid(G) ? b.x - 1 : b.x + b.w, y: b.y };
    push(b, from, knockbackOf(m), (x, y) => y === b.y && bossFits(G, x));
  }
}
function damageBoss(G, m, dmg){
  const b = G.boss;
  b.hp = Math.max(0, b.hp - dmg); G.stats.bossDmg += dmg; m.stats.bossDmg += dmg; m.stats.dmg += dmg; G.stats.dmg += dmg;
  if(b.hp <= 0){ log(G, `🏆 Le ${b.name} est vaincu ! Coup final de ${m.name}.`); endInstance(G, true); }
}

/* ---------- spawner visé par le groupe : un côté entier, puis l'autre (27/10/2026, Geoffrey) ----------
   Il garde le côté du spawner précédent tant qu'il y en reste un ; dans ce côté, le plus proche du groupe (au départ du
   sol : le plus bas, puis il monte rebord par rebord ; sur l'autre côté, il part de là où il est : d'en haut, il descend).
   Au premier choix : le côté du spawner le plus proche. Avant : le plus bas des deux côtés, en zigzag d'un mur à l'autre. */
function targetSpawner(G){
  const cur = G.spawners.find(s => s.id === G.target && s.alive);
  if(cur) return cur;
  const n = G.miners.length;
  const mx = n ? G.miners.reduce((a, m) => a + m.x, 0) / n : G.mid, my = n ? G.miners.reduce((a, m) => a + m.y, 0) / n : G.floorY;
  const dist = s => Math.abs(s.mx - mx) + Math.abs(s.y - my);
  const alive = G.spawners.filter(s => s.alive);
  const pool = alive.some(s => s.side === G.targetSide) ? alive.filter(s => s.side === G.targetSide) : alive;
  const next = pool.sort((a, b) => dist(a) - dist(b) || b.y - a.y || a.id - b.id)[0] ?? null;
  G.target = next?.id ?? null; G.targetSide = next?.side ?? null;
  return next;
}

/* ---------- itinéraire (Dijkstra, comme dans les tours) : marcher, tomber (au plus maxFall cases), monter en posant
   une échelle, descendre par une échelle ; creuser les blocs de cage. Renvoie le chemin (liste de cases) ou null. */
export function planTo(G, m, goals){
  const { w } = G, N = w * (G.h + 1);
  const goal = new Set(goals.map(([x, y]) => y * w + x));
  const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const start = m.y * w + m.x;
  dist[start] = 0;
  const heap = [[0, start]];
  const hpush = (d, n) => { heap.push([d, n]); let i = heap.length - 1;
    while(i > 0){ const p = (i - 1) >> 1; if(heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop();
    if(heap.length){ heap[0] = last; let i = 0;
      for(;;){ const l = 2 * i + 1, r = l + 1; let s = i;
        if(l < heap.length && heap[l][0] < heap[s][0]) s = l; if(r < heap.length && heap[r][0] < heap[s][0]) s = r;
        if(s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } }
    return top; };
  const dig = (x, y) => open(G, x, y) ? 0 : breakable(G, x, y) ? cageT(G, m) : Infinity;
  const relax = (c, d, x, y, cost) => { const n = y * w + x; if(cost < Infinity && d + cost < dist[n]){ dist[n] = d + cost; prev[n] = c; hpush(dist[n], n); } };
  const fallFrom = (x, y) => { let n = 0; while(y + 1 <= G.h && open(G, x, y + 1) && !G.ladder[y + 1][x] && !G.ladder[y][x]){ y++; n++; } return { y, n }; };
  const ladT = ladderTime(m);
  while(heap.length){
    const [d, c] = pop();
    if(d > dist[c]) continue;
    if(goal.has(c)){
      const path = [];
      for(let k = c; k !== start; k = prev[k]) path.push([k % w, (k - k % w) / w]);
      return path.reverse();
    }
    const cx = c % w, cy = (c - cx) / w;
    for(const dx of [-1, 1]){
      const x = cx + dx; if(x < 0 || x >= w) continue;
      const dg = dig(x, cy); if(dg === Infinity) continue;
      const l = fallFrom(x, cy); if(l.n > I.maxFall) continue;
      relax(c, d, x, l.y, dg + moveT(m) + l.n * fallT());
    }
    if(cy - 1 >= 0){
      const dg = dig(cx, cy - 1), lad = G.ladder[cy][cx];
      if(dg < Infinity) relax(c, d, cx, cy - 1, dg + (lad ? 0 : ladT) + climbT(m));
    }
    if(cy + 1 < G.h && open(G, cx, cy + 1) && (G.ladder[cy][cx] || G.ladder[cy + 1][cx])) relax(c, d, cx, cy + 1, climbT(m));
  }
  return null;
}

/* ---------- décision ---------- */
function act(m, type, dur, data, status){ m.action = { type, dur: Math.max(0.05, dur), t: 0, data }; m.status = status; }
const busy = (G, m, type, x, y) => G.miners.some(o => o !== m && o.action?.type === type &&
  (type === 'ladder' ? o.x === x && o.y === y : o.action.data.x === x && o.action.data.y === y));

/* coup sur un gobelin ou le roi : il part tout de suite, puis le mineur attend son intervalle (m.atkReady) */
function strike(G, m, target, status){
  const boss = target === G.boss;
  m.face = Math.sign((boss ? bossMid(G) - 0.5 : target.x) - m.x) || m.face;
  if(G.t + 1e-9 >= (m.atkReady || 0)){
    combatSpells(G, m, target);
    if(boss) hitBoss(G, m); else hitGoblin(G, m, target);
    m.atkReady = G.t + hitT(G, m);
  }
  return act(m, 'attack', Math.max(DT, (m.atkReady || 0) - G.t), { done: true, boss }, status);
}

export function decide(G, m){
  if(!instSupported(G, m.x, m.y)) return act(m, 'move', fallT(), { x: m.x, y: m.y + 1, fall: true }, 'Tombe');
  supportSpells(G, m);
  if(G.over) return;
  /* taclé : il ne fait que combattre le gobelin qui le tient */
  const tk = tackler(G, m);
  if(tk){
    const st = 'Taclé par un gobelin';
    if(hitReach(G, m, tk)) return strike(G, m, tk, st);
    if(dash(G, m, tk)) return strike(G, m, tk, st);
    if(driftsAway(m, tk)) return act(m, 'move', moveT(m) * Math.abs(m.kx || 0), { x: m.x, y: m.y, fight: true }, st);
    const path = planTo(G, m, [[tk.x - 1, tk.y], [tk.x + 1, tk.y], [tk.x, tk.y]]);
    if(path?.length){ follow(G, m, path, st); m.action.data.fight = true; return; }
    return act(m, 'wait', 0.3, { fight: true }, st);
  }
  /* un gobelin à portée : on le frappe (le plus faible d'abord) */
  const near = liveGobs(G).filter(o => hitReach(G, m, o)).sort((a, b) => a.hp - b.hp)[0];
  if(near) return strike(G, m, near, 'Combat un gobelin');
  /* les spawners */
  const s = targetSpawner(G);
  if(s){
    const st = `Casse un spawner (${s.side === 'L' ? 'gauche' : 'droite'}, rebord ${s.level})`;
    if(m.x === s.mx && m.y === s.y){ m.face = Math.sign(s.x - m.x) || m.face; drillSpells(G, m, s); return act(m, 'drill', 0.5, { x: s.x, y: s.y, sp: s.id }, st); }
    const path = planTo(G, m, [[s.mx, s.y]]);
    if(path?.length) return follow(G, m, path, st);
    G.stats.blocked++;
    return act(m, 'wait', 0.5, {}, 'Bloqué');
  }
  /* le roi */
  const b = G.boss;
  if(b.hp <= 0) return act(m, 'wait', 0.5, {}, 'Victoire');
  if(!bossActive(G)) return act(m, 'wait', 0.2, {}, `Le ${b.name} descend !`);
  if(inContact(G, m)) return strike(G, m, b, `Combat le ${b.name}`);
  const path = planTo(G, m, contactCells(G));
  if(path?.length) return follow(G, m, path, G.cages.some(c => c.id === m.id) ? 'Sort de sa cage' : `Va au contact du ${b.name}`);
  G.stats.blocked++;
  return act(m, 'wait', 0.5, {}, 'Bloqué');
}

function follow(G, m, path, status){
  const [nx, ny] = path[0];
  if(nx !== m.x){
    m.face = nx > m.x ? 1 : -1;
    if(!open(G, nx, m.y)) return startMine(G, m, nx, m.y, status);
    return act(m, 'move', moveT(m), { x: nx, y: m.y }, status);
  }
  if(ny < m.y){
    if(!open(G, m.x, m.y - 1)) return startMine(G, m, m.x, m.y - 1, status);
    if(!G.ladder[m.y][m.x] && busy(G, m, 'ladder', m.x, m.y)) return act(m, 'wait', 0.2, {}, 'Attend l\'échelle');
    if(!G.ladder[m.y][m.x]) return act(m, 'ladder', ladderTime(m), { x: m.x, y: m.y }, 'Pose une échelle');
    return act(m, 'move', climbT(m), { x: m.x, y: m.y - 1 }, 'Grimpe');
  }
  const lad = G.ladder[m.y][m.x] || G.ladder[m.y + 1]?.[m.x];
  return act(m, 'move', lad ? climbT(m) : fallT(), { x: m.x, y: m.y + 1 }, status);
}

function startMine(G, m, x, y, status){
  if(!breakable(G, x, y)) return act(m, 'wait', 0.1, {}, status);
  if(busy(G, m, 'mine', x, y)) return act(m, 'wait', 0.2, {}, status);
  if(mineSpells(G, m, x, y)) return act(m, 'wait', 0.1, {}, status);     // la dynamite a ouvert la cage
  act(m, 'mine', chance(G, m.carac.oneTap || 0) ? 0 : cageT(G, m), { x, y }, status);
}

/* ---------- sorts ---------- */
/* Inspiration, Fast learner, Dynamite (6 coups) quand il casse un spawner */
function drillSpells(G, m, s){
  mineBuffs(G, m);
  if(ready(G, m, 'dynamite')){
    cast(G, m, 'dynamite');
    drain(G, m, s, SP.dynamite);
    blastDamage(G, m, blastHurt(G, m, s.x, s.y));   // 28/10 : 50 % de ses dégâts aux gobelins et au roi du rayon
    log(G, `🧨 ${m.name} : Dynamite sur le spawner (${SP.dynamite} coups)`);
  }
}
function mineBuffs(G, m){
  if(ready(G, m, 'inspiration') && !inspireOn(G)){
    const S = SPELL.inspiration; G.inspire = { until: G.t + S.duration, pct: S.mineSpeed };
    cast(G, m, 'inspiration', G.inspire.until);
    log(G, `🎺 ${m.name} : Inspiration, tout le monde mine ${Math.round(S.mineSpeed * 100)} % plus vite`);
  }
  if(ready(G, m, 'fast_learner')){ m.learned = Math.round((m.learned + SPELL.fast_learner.bonus) * 1e6) / 1e6; cast(G, m, 'fast_learner'); }
}
/* Dynamite (rework du 28/10/2026, Geoffrey, aligné sur la mine) : sur un bloc de cage, elle ne casse les blocs de cage
   à son rayon (cercle) que si leur dureté (cageHard) est < hardMul × sa vitesse de minage ; elle inflige dmg × ses dégâts
   aux gobelins et au roi de son rayon. Renvoie true si elle est partie (elle ne part que si elle casse ou touche). */
const dynHard = m => SPELL.dynamite.hardMul * m.carac.mineSpeed * (1 + (m.carac.mineSpeedPct || 0) / 100);
function blastHurt(G, m, x, y){
  const S = SPELL.dynamite, R2 = S.radius * S.radius, b = G.boss;
  const gobs = liveGobs(G).filter(o => (o.x - x) ** 2 + (o.y - y) ** 2 <= R2 + 1e-9);
  let king = false;
  if(bossActive(G)) for(let yy = b.y - b.h + 1; yy <= b.y && !king; yy++) for(let xx = Math.round(b.x); xx < Math.round(b.x) + b.w; xx++) if((xx - x) ** 2 + (yy - y) ** 2 <= R2 + 1e-9){ king = true; break; }
  return { gobs, king };
}
function blastDamage(G, m, hurt){
  const d = () => hitDmg(G, m) * SPELL.dynamite.dmg;
  for(const o of hurt.gobs) hitGoblin(G, m, o, d());
  if(hurt.king) damageBoss(G, m, d());
}
function mineSpells(G, m, x, y){
  mineBuffs(G, m);
  if(!ready(G, m, 'dynamite')) return false;
  const R = SPELL.dynamite.radius, cells = [];
  if(B.cageHard < dynHard(m))
    for(let yy = y - R; yy <= y + R; yy++) for(let xx = x - R; xx <= x + R; xx++)
      if(breakable(G, xx, yy) && Math.hypot(xx - x, yy - y) <= R + 1e-9) cells.push([xx, yy]);
  const hurt = blastHurt(G, m, x, y);
  if(!cells.length && !hurt.gobs.length && !hurt.king) return false;
  cast(G, m, 'dynamite');
  for(const [xx, yy] of cells){ G.tiles[yy][xx] = AIR; G.stats.mined++; m.stats.mined++; }
  blastDamage(G, m, hurt);
  log(G, `🧨 ${m.name} : Dynamite sur sa cage${cells.length ? '' : ' (trop dure : rien de cassé)'}`);
  return true;
}
/* en combat : Cri de guerre (lui et les mineurs à son rayon), Cleave (les gobelins à son rayon, le roi s'il est au
   contact) */
function combatSpells(G, m, target){
  if(ready(G, m, 'war_cry') && !(G.warcry && G.t < G.warcry.until)){
    const S = SPELL.war_cry; G.warcry = { until: G.t + S.duration, by: m.id, dmg: S.dmgPct, speed: S.atkSpeed };
    cast(G, m, 'war_cry', G.warcry.until);
    log(G, `📯 ${m.name} : Cri de guerre`);
  }
  if(ready(G, m, 'cleave')){
    const S = SPELL.cleave; cast(G, m, 'cleave');
    for(const o of liveGobs(G)) if(o !== target && manh(o, m) <= S.radius) hitGoblin(G, m, o, hitDmg(G, m) * S.dmg);
    if(target !== G.boss && inContact(G, m)) damageBoss(G, m, hitDmg(G, m) * S.dmg);
  }
}
/* à chaque décision : Hand of Justice (un gobelin qui tacle un allié, puis lui, à sa portée : étourdi), Ulti shen (un
   allié taclé, ou qui se bat contre le roi : il se téléporte à lui et frappe) */
function supportSpells(G, m){
  if(ready(G, m, 'hand_of_justice')){
    const S = SPELL.hand_of_justice;
    const o = liveGobs(G).filter(o => o.grab != null && !stunned(G, o) && manh(o, m) <= S.range).sort((a, b) => (a.grab === m.id) - (b.grab === m.id))[0];
    if(o){ cast(G, m, 'hand_of_justice'); o.stunUntil = G.t + S.stun; o.grab = null; log(G, `⚖ ${m.name} : Hand of Justice étourdit un gobelin`); }
  }
  if(ready(G, m, 'ulti_shen') && !tackler(G, m)){
    const S = SPELL.ulti_shen;
    const ally = G.miners.find(a => a !== m && tackler(G, a)), fighting = G.miners.find(a => a !== m && inContact(G, a));
    const to = ally ?? fighting;
    if(to){
      cast(G, m, 'ulti_shen'); stopAction(m); m.action = null; m.x = to.x; m.y = to.y; m.kx = 0; m.hop = G.ticks;
      if(ally){ const o = tackler(G, ally); hitGoblin(G, m, o, o.maxhp * S.hpPct); }
      else damageBoss(G, m, G.boss.maxhp * S.bossPct);
      log(G, `🌀 ${m.name} : Ulti shen auprès de ${to.name}`);
    }
  }
}
/* Dash vers le gobelin qui le tacle, sur sa ligne, à sa portée : il arrive au contact et frappe (dmg × ses dégâts),
   le gobelin est étourdi ; recharge × hitCd */
function dash(G, m, o){
  if(!ready(G, m, 'dash') || o.y !== m.y) return false;
  const S = SPELL.dash, dir = Math.sign(o.x - m.x), n = Math.abs(o.x - m.x) - 1;
  if(!dir || n < S.minCells || n > S.range) return false;
  for(let x = m.x + dir; x !== o.x; x += dir) if(!open(G, x, m.y) || !instSupported(G, x, m.y)) return false;
  cast(G, m, 'dash', G.t, S.hitCd);
  m.x = o.x - dir; m.kx = 0; m.face = dir;
  hitGoblin(G, m, o, strikeDmg(G, m) * S.dmg);
  if(o.hp > 0){ o.stunUntil = G.t + S.stun; o.grab = null; }
  log(G, `💨 ${m.name} : Dash`);
  return true;
}

/* ---------- boucle ---------- */
export function tickInstance(G){
  if(G.over) return;
  G.ticks++; G.t = G.ticks * DT;
  stepSpawners(G);
  stepGoblins(G);
  for(const m of G.miners){
    const a = m.action;
    if(a?.type === 'move' && a.data.y === m.y && a.data.x !== m.x && !a.data.fall && liveGobs(G).some(o => hitReach(G, m, o))) stopAction(m);
  }
  for(const m of [...G.miners]) if(G.miners.includes(m) && !G.over) stepMiner(G, m);
  stepBoss(G);
  if(!G.over && G.ticks >= INSTANCE_TICKS) endInstance(G, false);
}

function drain(G, m, s, n){
  if(!s.alive || !(n > 0)) return;
  const d = Math.min(s.hp, n);
  s.hp -= d; m.stats.drilled += d; G.stats.drilled += d;
  if(s.hp > 1e-9) return;
  s.hp = 0; s.alive = false; G.tiles[s.y][s.x] = AIR;
  G.timeline.spawners.push(G.t);
  for(const o of G.miners) if(o.action?.type === 'drill' && o.action.data.sp === s.id) o.action = null;
  const left = G.spawners.filter(q => q.alive).length;
  log(G, left ? `💥 ${m.name} détruit un spawner (encore ${left})` : `💥 ${m.name} détruit le dernier spawner !`);
}

function stepMiner(G, m){
  const a0 = m.action;
  if(a0 && a0.type !== 'attack' && !a0.data.fall && !a0.data.fight && instSupported(G, m.x, m.y) && tackler(G, m)) stopAction(m);
  if(!G.ladder[m.y]?.[m.x]) m.ky = 0;
  let budget = DT, guard = 0;
  while(budget > 1e-9 && guard++ < 30 && !G.over){
    if(!m.action){ decide(G, m); if(!m.action) break; }
    const a = m.action, need = a.dur - a.t, used = Math.min(budget, need);
    /* casser un spawner : il perd la vitesse de minage × le temps passé (au tick près, même entre deux actions) */
    if(a.type === 'drill'){ const s = G.spawners.find(q => q.id === a.data.sp); if(s?.alive) drain(G, m, s, instRate(G, m) * used); }
    if(budget >= need){ budget -= need; m.action = null; finishAction(G, m, a); }
    else { a.t += budget; budget = 0; }
  }
}

function finishAction(G, m, a){
  if(a.type === 'move'){
    m.x = a.data.x; m.y = a.data.y; m.kx = 0; m.ky = 0;
    if(a.data.fall) m.fallN++;
    if(instSupported(G, m.x, m.y)){ if(m.knocked && m.fallN > 0){ G.stats.falls++; m.stats.falls++; } m.fallN = 0; m.knocked = false; }
  } else if(a.type === 'ladder'){
    const put = (x, y) => { if(!G.ladder[y][x] && open(G, x, y)){ G.ladder[y][x] = 1; G.stats.ladders++; m.stats.ladders++; } };
    put(m.x, m.y);
    if(m.skill.tall_ladder && open(G, m.x, m.y - 1)) put(m.x, m.y - 1);
  } else if(a.type === 'mine'){
    const { x, y } = a.data;
    if(!breakable(G, x, y)) return;
    G.tiles[y][x] = AIR; G.stats.mined++; m.stats.mined++;
    for(const o of G.miners) if(o !== m && o.action?.type === 'mine' && o.action.data.x === x && o.action.data.y === y) o.action = null;
  }
}

/* Un joueur quitte : son mineur disparaît. Idempotent. */
export function leaveInstance(G, who){
  if(G.over) return false;
  const m = typeof who === 'object' ? who : G.miners.find(x => x.account !== null && x.account === who);
  if(!m || m.left != null || !G.miners.includes(m)) return false;
  m.left = G.t; m.action = null; m.status = 'A quitté l\'instance';
  G.miners = G.miners.filter(x => x !== m);
  for(const o of G.goblins){ if(o.grab === m.id) o.grab = null; if(o.taunt === m.id) o.taunt = null; }
  if(G.boss.focus === m.id) G.boss.focus = null;
  if(G.boss.taunt === m.id) G.boss.taunt = null;
  log(G, `${m.name} a quitté l'instance`);
  if(!G.miners.length) endInstance(G, false);
  return true;
}

export const brokenSpawners = G => G.spawners.filter(s => !s.alive).length;

/* fin : réussite (roi vaincu) ou échec. Pas de récompense pour l'instant. Idempotent. */
export function endInstance(G, success){
  if(G.summary) return;
  G.over = true;
  if(!success && G.miners.length) log(G, `⌛ Temps écoulé : ${brokenSpawners(G)} spawner${brokenSpawners(G) > 1 ? 's' : ''} sur ${G.spawners.length}, le ${G.boss.name} tient toujours (${Math.ceil(G.boss.hp)} PV).`);
  G.summary = {
    mode: 'instance', instance: G.instance, id: G.id, seed: G.seed, success: !!success, t: G.t,
    spawners: brokenSpawners(G), spawnersMax: G.spawners.length, bossHp: Math.ceil(G.boss.hp), bossMax: G.boss.maxhp, kills: G.stats.kills,
    awake: G.timeline.awake, loot: {},
    shares: G.roster.map(m => ({ miner: m.name, color: m.color, account: m.account, left: m.left != null, bag: {},
                                 stats: { dmg: Math.round(m.stats.dmg), bossDmg: Math.round(m.stats.bossDmg), kills: m.stats.kills,
                                          drilled: Math.round(m.stats.drilled), knocked: m.stats.knocked, tackled: m.stats.tackled } })),
  };
}

export function runInstance(seed, opts = {}){
  const G = newInstance(seed, opts);
  while(!G.over) tickInstance(G);
  return G;
}
