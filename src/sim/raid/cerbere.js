/* Raid 1 : Cerbère, l'arène (1,−1) (04/11/2026, Geoffrey ; spec docs/superpowers/specs/2026-11-04-raid-cerbere-design.md ;
   RAID.cerbere en config). Partie à pas fixe (DT), sans DOM ni canvas, sur le modèle du Golbute (src/sim/instance/golbute.js).

   Arène sans oxygène, sol plat ; on y entre par la gauche. Cerbère (8 × 6, résistance au recul 100 %) au sol, à droite ;
   on le frappe depuis la case collée à son flanc gauche.
   - Autoattaque : toutes les 10 s (7 s enragé), sur 3 cibles : d'abord ceux qui le provoquent, puis au hasard. Si ses
     cibles sont TOUTES déjà mordues, elles meurent ; sinon chacune reçoit « Morsure » (20 s ; la ténacité l'évite).
   - Balayage : toutes les 5 s, à 2 cases de lui : repoussé de 5 cases et 3 de haut (6 et 4 enragé) ; la ténacité l'évite.
   - Magma gazeux : toutes les 30 s, 50 % (65 % enragé) par joueur d'être « Durci » ; la ténacité ne joue que pour la spé
     Mineur. Durci = en pierre (dureté 50), intouchable, jusqu'à ce que d'autres le minent. Les tanks (ceux qui le
     provoquent, donc ceux qu'il attaque) n'aident pas, sauf si personne d'autre ne peut.
   - Enragé sous 33 % de ses PV.
   Cerbère mort = réussite ; temps écoulé, tous morts (ou tous morts et en pierre) = échec.
   Sorts : Cri de guerre, Dynamite, Dash, Ulti shen en combat ; Inspiration et Fast learner pour libérer un allié ;
   les autres : sans effet. */
import { tenacityTry } from '../tenacity.js';
import { RAID, DT, STATS, CFG } from '../../config.js';
import { mulberry32 } from '../../core/rng.js';
import { SPELL } from '../../meta/spells.js';
import { log } from '../log.js';
import { cleanRings } from '../effects.js';
import { oneTapBonus } from '../one-tap.js';

const C = RAID.cerbere;

/* opts.miners : specs ({ name, account, color, look, auras, carac, skills, skillTree, spells }) ; opts.ticks : durée (ticks) */
export function newCerbere(seed, opts = {}){
  seed = seed ?? ((Math.random() * 2**31) | 0);
  const { w, h } = C, B = C.boss;
  const tiles = Array.from({ length: h + 1 }, (_, y) => new Uint8Array(w).fill(y === h ? 1 : 0));
  const G = {
    mode: 'raid', phase: 'boss', seed, t: 0, ticks: 0, over: false, endTick: opts.ticks ?? Math.round(RAID.duration / DT),
    w, h, tiles, floorY: h - 1,
    rng: mulberry32(seed ^ 0x2545f491), fightRng: mulberry32(seed ^ 0x51f15e5d),
    boss: { name: B.name, hp: opts.hp ?? B.hp, maxhp: opts.hp ?? B.hp, w: B.w, h: B.h, x: B.bossX, y: h - 1, knockRes: B.knockRes,
            rage: false, biteAt: null, sweepAt: null, magmaAt: null, targets: [], taunts: new Set() },
    next: { bite: C.bite.every, sweep: C.sweep.every, magma: C.magma.every },
    inspire: null, warcry: null, log: [],
    stats: { dmg: 0, bossDmg: 0, bites: 0, bitten: 0, sweeps: 0, knocks: 0, magmas: 0, stoned: 0, freed: 0, dodges: 0, deaths: 0, mineT: 0, fightT: 0 },
    timeline: { rage: null, deaths: [] },
    summary: null,
  };
  const specs = opts.miners ?? [{}];
  G.miners = specs.map((s, i) => createMiner(i, s, C.spawn[i % C.spawn.length], G.floorY));
  G.roster = [...G.miners];
  G.id = opts.id ?? `cerbere-${seed}-${Date.now().toString(36)}`;
  log(G, `🔥 ${G.miners.length} mineur${G.miners.length > 1 ? 's' : ''} face à ${B.name} !`);
  return G;
}

function createMiner(id, s, x, y){
  return {
    id, name: s.name || ('Mineur ' + (id + 1)), color: s.color || null, look: s.look || {}, auras: s.auras || {}, account: s.account ?? null,
    carac: { ...STATS, ...(s.carac || {}) }, skill: { ...(s.skills || {}) }, skillTree: s.skillTree ?? null,
    spells: Array.isArray(s.spells) ? [...s.spells] : [], spellCd: {}, learned: 0, rings: cleanRings(s.rings),
    x, y, face: 1, kx: 0, ky: 0, action: null, status: 'Entre dans l\'arène', fallN: 0, fallT: 0, knocked: false,
    bitUntil: 0, stone: null, dead: false,
    stats: { dmg: 0, bossDmg: 0, bitten: 0, knocked: 0, stoned: 0, freed: 0, stuns: 0, spells: 0, mined: 0 },
  };
}

/* ---------- carte ---------- */
const bossHere = G => G.boss.hp > 0;
const inBoss = (G, x, y) => { const b = G.boss; return bossHere(G) && x >= b.x && x < b.x + b.w && y > b.y - b.h && y <= b.y; };
export const cerOpen = (G, x, y) => x >= 0 && x < G.w && y >= 0 && y < G.h && !inBoss(G, x, y);
const grounded = (G, m) => m.y >= G.floorY || !cerOpen(G, m.x, m.y + 1);
const gapX = (G, x) => { const b = G.boss; return x < b.x ? b.x - x : x > b.x + b.w - 1 ? x - (b.x + b.w - 1) : 0; };
const contactX = G => G.boss.x - 1;
const inContact = (G, m) => bossHere(G) && active(m) && m.y === G.floorY && m.x === contactX(G);

/* ---------- états ---------- */
export const active = m => !m.dead && !m.stone;                     // ni mort, ni en pierre : il agit, il est ciblé
export const bitten = (G, m) => m.bitUntil > G.t + 1e-9;
const alive = G => G.miners.filter(m => !m.dead);
const actives = G => G.miners.filter(active);
/* tank : il provoque Cerbère (skill de provocation, coup porté) ; ce sont ceux qu'il attaque d'abord */
export const isTank = (G, m) => G.boss.taunts.has(m.id);

/* ---------- vitesses et coups ---------- */
const inspireOn = G => !!G.inspire && G.t < G.inspire.until;
const mineRate = (G, m) => m.carac.mineSpeed * (1 + (m.carac.mineSpeedPct || 0) / 100) * (1 + (inspireOn(G) ? G.inspire.pct : 0)) * (1 + (m.learned || 0));
const moveT = m => 1 / m.carac.speed;
const fallT = () => 1 / CFG.fallSpeed;
const chance = (G, pct) => pct > 0 && G.fightRng() < pct / 100;
const byId = (G, id) => id == null ? null : G.miners.find(m => m.id === id) ?? null;
const manh = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const warcryOf = (G, m) => { const w = G.warcry, c = w && G.t < w.until ? byId(G, w.by) : null;
  return c && manh(c, m) <= SPELL.war_cry.radius ? w : null; };
const hitT = (G, m) => CFG.attackInterval / Math.max(0.1, (m.carac.attackSpeed ?? 100) / 100 * (1 + (warcryOf(G, m)?.speed || 0)));
const hitDmg = (G, m) => m.carac.damage * (1 + (m.carac.damagePct || 0) / 100) * (1 + (warcryOf(G, m)?.dmg || 0)) * (chance(G, m.carac.crit || 0) ? 2 : 1);
const strikeDmg = (G, m) => { let d = hitDmg(G, m); if(chance(G, m.carac.doubleAttack || 0)) d += hitDmg(G, m); return d; };
const ready = (G, m, id) => m.spells.includes(id) && G.t + 1e-9 >= (m.spellCd[id] || 0);
const cast = (G, m, id, cdFrom = G.t, mul = 1) => { m.spellCd[id] = cdFrom + SPELL[id].cd * mul; m.stats.spells++; };
const act = (m, type, dur, data, status) => { m.action = { type, dur: Math.max(0.05, dur), t: 0, data: data || {} }; m.status = status; };
const stunFor = (m, s, cause) => { const left = m.action?.type === 'stun' ? m.action.dur - m.action.t : 0;
  m.action = { type: 'stun', dur: Math.max(left, s), t: 0, data: { cause } }; m.status = 'Étourdi'; m.stats.stuns++; };

/* ---------- Cerbère ---------- */
const rage = G => G.boss.rage;
const biteEvery = G => rage(G) ? C.rage.biteEvery : C.bite.every;

/* ses cibles : ceux qui le provoquent d'abord (les plus récents), puis au hasard parmi les autres actifs */
export function pickTargets(G){
  const pool = actives(G), n = C.bite.targets;
  const tanks = pool.filter(m => isTank(G, m)).slice(-n);
  const rest = pool.filter(m => !tanks.includes(m));
  for(let i = rest.length - 1; i > 0; i--){ const j = Math.floor(G.rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return [...tanks, ...rest].slice(0, n);
}

function bite(G){
  const b = G.boss, B = C.bite;
  G.next.bite = G.t + biteEvery(G); b.biteAt = G.ticks; G.stats.bites++;
  const ts = pickTargets(G);
  b.targets = ts.map(m => m.id);
  if(!ts.length) return;
  /* Geoffrey, 04/11 : la Morsure frappe ses cibles en même temps ; si toutes sont mordues (aucune ne l'évite par la
     ténacité), elles meurent ; si une seule résiste, la Morsure se dissipe pour toutes. Rien ne persiste d'une Morsure
     à l'autre (bitUntil : simple affichage, bite.show s). */
  const hit = [], dodged = [];
  for(const m of ts){
    if(tenacityTry(m, 'cerbere', G.fightRng)){ dodged.push(m); G.stats.dodges++; continue; }
    m.bitUntil = G.t + B.show; m.stats.bitten++; G.stats.bitten++; hit.push(m);
  }
  if(!dodged.length){
    for(const m of ts) die(G, m);
    log(G, `💀 ${b.name} : Morsure sur ${ts.map(m => m.name).join(', ')}, personne ne résiste : ils meurent`);
    return checkEnd(G);
  }
  log(G, `🐺 Morsure${hit.length ? ` : ${hit.map(m => m.name).join(', ')}` : ''} · ${dodged.map(m => m.name).join(', ')} résiste : elle se dissipe`);
}

function sweep(G){
  const b = G.boss, back = rage(G) ? C.rage.back : C.sweep.back, high = rage(G) ? C.rage.high : C.sweep.high;
  G.next.sweep = G.t + C.sweep.every; b.sweepAt = G.ticks; G.stats.sweeps++;
  for(const m of actives(G)){
    if(gapX(G, m.x) > C.sweep.range || m.y < G.floorY - high) continue;
    if(tenacityTry(m, 'cerbere', G.fightRng)){ G.stats.dodges++; continue; }
    let { x, y } = m;
    for(let i = 0; i < high && cerOpen(G, x, y - 1); i++) y--;
    for(let i = 0; i < back && cerOpen(G, x - 1, y); i++) x--;
    m.x = x; m.y = y; m.kx = 0; m.ky = 0; m.action = null; m.knocked = true; m.fallN = 0; m.fallT = 0; m.hop = G.ticks; m.boosted = G.ticks;
    G.stats.knocks++; m.stats.knocked++;
  }
}

function magma(G){
  const b = G.boss, p = rage(G) ? C.rage.chance : C.magma.chance;
  G.next.magma = G.t + C.magma.every; b.magmaAt = G.ticks; G.stats.magmas++;
  const hard = [];
  for(const m of actives(G)){
    if(!(G.fightRng() < p)) continue;
    /* la ténacité ne joue que pour la spé Mineur */
    if(m.skillTree === 'mineur' && tenacityTry(m, 'cerbere', G.fightRng)){ G.stats.dodges++; continue; }
    m.stone = { hp: C.stone.hard, max: C.stone.hard }; m.action = null; m.status = 'Durci'; m.knocked = false;
    m.stats.stoned++; G.stats.stoned++; hard.push(m.name);
  }
  if(hard.length) log(G, `🌋 Magma gazeux : ${hard.join(', ')} durci${hard.length > 1 ? 's' : ''} !`);
  checkEnd(G);
}

function die(G, m){
  m.dead = true; m.stone = null; m.action = null; m.status = 'Mort'; m.knocked = false;
  G.boss.taunts.delete(m.id);
  G.stats.deaths++; G.timeline.deaths.push(G.t);
}
/* plus personne pour agir : tous morts, ou les vivants tous en pierre (personne ne peut les libérer) */
function checkEnd(G){ if(!G.over && !actives(G).length) endCerbere(G, false); }

function stepBoss(G){
  const b = G.boss;
  if(G.over || b.hp <= 0) return;
  if(G.t + 1e-9 >= G.next.bite){ bite(G); if(G.over) return; }
  if(G.t + 1e-9 >= G.next.sweep) sweep(G);
  if(G.t + 1e-9 >= G.next.magma) magma(G);
}

function damageBoss(G, m, dmg){
  const b = G.boss;
  if(!bossHere(G) || !(dmg > 0)) return;
  const d = Math.min(dmg, b.hp);
  b.hp -= d; G.stats.bossDmg += d; G.stats.dmg += d; m.stats.bossDmg += d; m.stats.dmg += d;
  if(m.skill.taunt) b.taunts.add(m.id);
  if(b.hp <= 1e-9){ b.hp = 0; log(G, `🏆 ${b.name} est vaincu ! Coup final de ${m.name}.`); return endCerbere(G, true); }
  if(!b.rage && b.hp <= b.maxhp * C.rage.below + 1e-9){
    b.rage = true; G.timeline.rage = G.t;
    if(G.next.bite - G.t > biteEvery(G)) G.next.bite = G.t + biteEvery(G);
    log(G, `😡 ${b.name} enrage !`);
  }
}

/* libérer un allié en pierre : coups de minage (dureté C.stone.hard) */
function drainStone(G, m, ally, n){
  if(!ally?.stone || !(n > 0)) return;
  const d = Math.min(ally.stone.hp, n);
  ally.stone.hp -= d; m.stats.mined += d;
  if(ally.stone.hp > 1e-9) return;
  ally.stone = null; ally.status = 'Libéré'; ally.action = null; ally.stats.freed++; m.stats.freed++; G.stats.freed++;
  for(const o of G.miners) if(o.action?.type === 'drill' && o.action.data.ally === ally.id) o.action = null;
  log(G, `⛏ ${m.name} libère ${ally.name}`);
}

/* ---------- décision des mineurs ---------- */
function strike(G, m, status){
  const now = m.now ?? G.t;
  m.face = 1;
  if(now + 1e-9 >= (m.atkReady || 0)){
    combatSpells(G, m);
    damageBoss(G, m, strikeDmg(G, m));
    m.atkReady = now + hitT(G, m);
  }
  return act(m, 'attack', (m.atkReady || 0) - now, { done: true, boss: true }, status);
}
function walkTo(G, m, tx, status){
  const dir = Math.sign(tx - m.x);
  if(!dir) return act(m, 'wait', 0.2, {}, status);
  if(!cerOpen(G, m.x + dir, m.y)) return act(m, 'wait', 0.2, {}, 'Bloqué');
  m.face = dir;
  return act(m, 'move', moveT(m), { x: m.x + dir, y: m.y }, status);
}
/* qui doit aller libérer : pas un tank, sauf s'il ne reste que des tanks pour agir */
function helper(G, m){
  const stones = G.miners.filter(o => !o.dead && o.stone);
  if(!stones.length) return null;
  if(isTank(G, m) && actives(G).some(o => o !== m && !isTank(G, o))) return null;
  return stones.sort((a, c) => manh(m, a) - manh(m, c))[0];
}

export function decide(G, m){
  supportSpells(G, m);
  if(G.over) return;
  const b = G.boss;
  if(b.hp <= 0) return act(m, 'wait', 0.5, {}, 'Victoire');
  const ally = helper(G, m);
  if(ally){
    if(m.y === ally.y && Math.abs(m.x - ally.x) <= 1){ mineBuffs(G, m); return act(m, 'drill', 0.5, { ally: ally.id }, `Libère ${ally.name}`); }
    return walkTo(G, m, ally.x - Math.sign(ally.x - m.x || -1), `Va libérer ${ally.name}`);
  }
  if(inContact(G, m)) return strike(G, m, `Combat ${b.name}`);
  if(dashBoss(G, m)) return act(m, 'wait', DT, {}, `Dash sur ${b.name}`);
  return walkTo(G, m, contactX(G), `Va au contact de ${b.name}`);
}

/* ---------- sorts ---------- */
function mineBuffs(G, m){
  if(ready(G, m, 'inspiration') && !inspireOn(G)){
    const S = SPELL.inspiration; G.inspire = { until: G.t + S.duration, pct: S.mineSpeed };
    cast(G, m, 'inspiration', G.inspire.until);
    log(G, `🎺 ${m.name} : Inspiration`);
  }
  if(ready(G, m, 'fast_learner')){ m.learned = Math.round((m.learned + SPELL.fast_learner.bonus) * 1e6) / 1e6; cast(G, m, 'fast_learner'); }
}
function combatSpells(G, m){
  if(ready(G, m, 'war_cry') && !(G.warcry && G.t < G.warcry.until)){
    const S = SPELL.war_cry; G.warcry = { until: G.t + S.duration, by: m.id, dmg: S.dmgPct, speed: S.atkSpeed };
    cast(G, m, 'war_cry', G.warcry.until);
    log(G, `📯 ${m.name} : Cri de guerre`);
  }
  if(ready(G, m, 'dynamite')){
    cast(G, m, 'dynamite');
    damageBoss(G, m, hitDmg(G, m) * SPELL.dynamite.dmg);
    log(G, `🧨 ${m.name} : Dynamite sur ${G.boss.name}`);
  }
}
/* Ulti shen : rejoint un allié qui frappe Cerbère (dégâts : une part de ses PV, comme au Golbute) */
function supportSpells(G, m){
  if(!active(m) || !ready(G, m, 'ulti_shen') || inContact(G, m)) return;
  const to = actives(G).find(a => a !== m && inContact(G, a));
  if(!to || helper(G, m)) return;
  cast(G, m, 'ulti_shen'); m.action = null; m.x = to.x; m.y = to.y; m.kx = 0; m.hop = G.ticks;
  damageBoss(G, m, G.boss.maxhp * SPELL.ulti_shen.bossPct);
  log(G, `🌀 ${m.name} : Ulti shen auprès de ${to.name}`);
}
function dashBoss(G, m){
  if(!ready(G, m, 'dash') || !bossHere(G) || m.y !== G.floorY) return false;
  const tx = contactX(G), S = SPELL.dash, dir = Math.sign(tx - m.x), n = Math.abs(tx - m.x);
  if(!dir || n < S.minCells || n > S.range) return false;
  cast(G, m, 'dash', G.t);
  m.x = tx; m.kx = 0; m.face = dir;
  log(G, `💨 ${m.name} : Dash sur ${G.boss.name}`);
  damageBoss(G, m, strikeDmg(G, m) * S.dmg);
  return true;
}

/* ---------- boucle ---------- */
export function tickCerbere(G){
  if(G.over) return;
  G.ticks++; G.t = G.ticks * DT;
  for(const m of [...G.miners]) if(!G.over) stepMiner(G, m);
  stepBoss(G);
  if(!G.over && G.ticks >= G.endTick) endCerbere(G, false);
}

function gravity(G, m){
  if(grounded(G, m)){
    if(m.knocked){
      if(m.fallN >= CFG.stunFall && active(m)) stunFor(m, CFG.stunTime, 'fall');
      m.knocked = false; m.fallN = 0;
    }
    m.fallT = 0;
    return false;
  }
  if(m.action && m.action.type !== 'stun') m.action = null;
  m.fallT += DT;
  if(m.fallT + 1e-9 >= fallT()){ m.fallT = 0; m.y++; m.fallN++; }
  return true;
}

function stepMiner(G, m){
  if(gravity(G, m) || !active(m)) return;
  let budget = DT, guard = 0;
  while(budget > 1e-9 && guard++ < 30 && !G.over){
    if(!m.action){ m.now = G.t - budget; decide(G, m); m.now = null; if(!m.action) break; }
    const a = m.action, need = a.dur - a.t, used = Math.min(budget, need);
    if(a.type === 'drill'){ const r = mineRate(G, m); drainStone(G, m, byId(G, a.data.ally), r * used + oneTapBonus(m, used, r, G.fightRng)); G.stats.mineT += used; }
    else if(a.type === 'attack') G.stats.fightT += used;
    if(!m.action) break;
    if(budget >= need){ budget -= need; m.action = null; if(a.type === 'move'){ if(cerOpen(G, a.data.x, a.data.y)) m.x = a.data.x; } }
    else { a.t += budget; budget = 0; }
  }
}

/* Un joueur quitte : son mineur disparaît. Idempotent. */
export function leaveCerbere(G, who){
  if(G.over) return false;
  const m = typeof who === 'object' ? who : G.miners.find(x => x.account !== null && x.account === who);
  if(!m || m.left != null || !G.miners.includes(m)) return false;
  m.left = G.t; m.action = null; m.status = 'A quitté le raid';
  G.miners = G.miners.filter(x => x !== m);
  G.boss.taunts.delete(m.id);
  log(G, `${m.name} a quitté le raid`);
  checkEnd(G);
  return true;
}

export function endCerbere(G, success){
  if(G.summary) return;
  G.over = true;
  const b = G.boss;
  if(!success && G.miners.length) log(G, actives(G).length ? `⌛ Temps écoulé : ${b.name} tient toujours (${Math.ceil(b.hp)} PV).` : `💀 Plus personne debout.`);
  G.summary = { success: !!success, t: G.t, bossHp: Math.ceil(b.hp), bossMax: b.maxhp, rage: b.rage, deaths: G.stats.deaths };
}

export function runCerbere(seed, opts = {}){
  const G = newCerbere(seed, opts);
  while(!G.over) tickCerbere(G);
  return G;
}
