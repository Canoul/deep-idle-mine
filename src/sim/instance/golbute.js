/* Instance II : le Golbute (30/10/2026, Geoffrey). La partie et sa boucle à pas fixe (DT), sans DOM ni canvas.
   Réglages INSTANCE.golbute (src/config.js) ; GAME_DESIGN §« Instance II ».

   Arène vide : sol plat (ligne h), les mineurs partent à gauche, le Golbute (5 × 5, résistance au recul 100 %) au sol,
   au milieu ; il ne bouge pas. Ses cases sont un mur tant qu'il est là. On le frappe depuis la case collée à lui.
   - Autoattack (slam) : toutes les 2 s, les mineurs au sol à 3 cases de lui au plus peuvent être propulsés (3 cases vers
     le haut, 1 en arrière) ; la chute qui suit les étourdit.
   - Avalanche : toutes les 60 s, sur tous les mineurs vivants : étourdis 5 s + un stack « Sonné » (90 s, réactualisé) ;
     à 6 stacks, mort. La ténacité l'esquive (étourdissement et stack).
   - Division : toutes les 3 min, il disparaît et laisse 10 golems (PV de l'area 8) ; il revient quand ils sont morts.
   - Cristal : à 66 % et 33 % de ses PV, insensible aux coups : il faut le miner (coups de minage, comme un spawner).
   - Enrage : après le cristal des 33 %.
   Golbute mort = réussite ; temps écoulé ou tout le monde mort = échec.

   Sorts : Cri de guerre, Cleave, Dash, Hand of Justice et Ulti shen en combat ; Dynamite sur le boss, les golems et le
   cristal ; Inspiration et Fast learner sur le cristal ; Illumination et Bonbonne de zipette : sans effet. */
import { INSTANCE, DT, STATS, CFG } from '../../config.js';
import { mulberry32 } from '../../core/rng.js';
import { SPELL } from '../../meta/spells.js';
import { log } from '../log.js';
import { cleanRings } from '../effects.js';
import { knockOf } from '../knock.js';
import { mobHp } from '../../config.js';

const C = INSTANCE.golbute;
export const GOLBUTE_TICKS = Math.round(INSTANCE.duration / DT);
export const isGolbute = G => G?.instance === 'instance_2';

/* opts.miners : [{ name, account, color, look, auras, carac, skills, skillTree, spells }] ; opts.id */
export function newGolbute(seed, opts = {}){
  seed = seed ?? ((Math.random() * 2**31) | 0);
  const { w, h } = C, B = C.boss;
  const tiles = Array.from({ length: h + 1 }, (_, y) => new Uint8Array(w).fill(y === h ? 1 : 0));
  const G = {
    mode: 'instance', instance: 'instance_2', level: 1, seed, t: 0, ticks: 0, over: false,
    w, h, tiles, floorY: h - 1, mid: w / 2,
    rng: mulberry32(seed ^ 0x2545f491), fightRng: mulberry32(seed ^ 0x9e3779b9),
    boss: { name: B.name, hp: B.hp, maxhp: B.hp, w: B.w, h: B.h, x: Math.floor((w - B.w) / 2), y: h - 1, knockRes: B.knockRes,
            state: 'fight', cd: C.slam.every, phase: 0, rage: false, crystal: null, slamAt: null, focus: null, taunt: null },
    golems: [], nextGolem: 0, rocks: [], inspire: null, warcry: null,
    next: { avalanche: C.avalanche.every, split: C.split.every },
    log: [], timeline: { splits: [], crystals: [], rage: null, avalanches: [], deaths: [] },
    stats: { dmg: 0, bossDmg: 0, kills: 0, mined: 0, slams: 0, knocks: 0, avalanches: 0, dodges: 0, deaths: 0, mineT: 0, fightT: 0 },
    summary: null,
  };
  const specs = opts.miners ?? [{}];
  G.miners = specs.map((s, i) => createMiner(i, s, C.spawn[i % C.spawn.length], G.floorY));
  G.roster = [...G.miners];
  G.id = opts.id ?? `golbute-${seed}-${Date.now().toString(36)}`;
  log(G, `🗿 Instance II : ${G.miners.length} mineur${G.miners.length > 1 ? 's' : ''} face au ${B.name}.`);
  return G;
}

function createMiner(id, s, x, y){
  return {
    id, name: s.name || ('Mineur ' + (id + 1)), color: s.color || null, look: s.look || {}, auras: s.auras || {}, account: s.account ?? null,
    carac: { ...STATS, ...(s.carac || {}) }, skill: { ...(s.skills || {}) }, skillTree: s.skillTree ?? null,
    spells: Array.isArray(s.spells) ? [...s.spells] : [], spellCd: {}, learned: 0,
    rings: cleanRings(s.rings),
    x, y, face: 1, kx: 0, ky: 0, action: null, status: 'Départ', fallN: 0, fallT: 0, knocked: false,
    dazed: 0, dazedUntil: 0, dead: false,
    stats: { dmg: 0, bossDmg: 0, kills: 0, mined: 0, knocked: 0, stuns: 0, dazed: 0, spells: 0, drilled: 0, tackled: 0 },
  };
}

/* ---------- carte ---------- */
const bossHere = G => G.boss.hp > 0 && G.boss.state !== 'split';
const inBoss = (G, x, y) => { const b = G.boss; return bossHere(G) && x >= b.x && x < b.x + b.w && y > b.y - b.h && y <= b.y; };
export const golOpen = (G, x, y) => x >= 0 && x < G.w && y >= 0 && y < G.h && !inBoss(G, x, y);
const grounded = (G, m) => m.y >= G.floorY || !golOpen(G, m.x, m.y + 1);
/* écart horizontal entre la case x et le boss (0 : sous lui ou dedans) */
const gapX = (G, x) => { const b = G.boss; return x < b.x ? b.x - x : x > b.x + b.w - 1 ? x - (b.x + b.w - 1) : 0; };
/* au contact : au sol, sur une case collée à lui */
const inContact = (G, m) => bossHere(G) && !m.dead && m.y === G.floorY && gapX(G, m.x) === 1;

/* ---------- vitesses et coups ---------- */
const inspireOn = G => !!G.inspire && G.t < G.inspire.until;
export const golRate = (G, m) => m.carac.mineSpeed * (1 + (m.carac.mineSpeedPct || 0) / 100) * (1 + (inspireOn(G) ? G.inspire.pct : 0)) * (1 + (m.learned || 0));
const moveT = m => 1 / m.carac.speed;
const fallT = () => 1 / CFG.fallSpeed;
const chance = (G, pct) => pct > 0 && G.fightRng() < pct / 100;
const byId = (G, id) => id == null ? null : G.miners.find(m => m.id === id) ?? null;
const alive = G => G.miners.filter(m => !m.dead);
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

/* ---------- golems de la Division ---------- */
const liveGolems = G => G.golems.filter(o => o.hp > 0);
const golemStunned = (G, o) => o.stunUntil != null && G.t < o.stunUntil;
export const golTackler = (G, m) => G.golems.find(o => o.hp > 0 && o.grab === m.id && !golemStunned(G, o)) ?? null;
const near = (a, b) => a.y === b.y && Math.abs(a.x - b.x) <= 1;

function split(G){
  const b = G.boss, S = C.split, hp = mobHp('golem', S.area);
  b.state = 'split'; G.next.split = Infinity;
  for(let i = 0; i < S.count; i++){
    const x = b.x + (i % b.w);
    G.golems.push({ id: G.nextGolem++, x, y: G.floorY, hp, maxhp: hp, face: -1, grab: null, hit: S.hitEvery, moveCd: S.step * (0.5 + G.rng()), stunUntil: null, taunt: null });
  }
  G.timeline.splits.push(G.t);
  log(G, `🪨 Le ${b.name} se divise en ${S.count} golems !`);
}
function stepGolems(G){
  const S = C.split;
  for(const o of G.golems){
    if(o.hp <= 0) continue;
    if(golemStunned(G, o)){ o.grab = null; continue; }
    const taunt = byId(G, o.taunt);
    const prey = taunt && !taunt.dead ? taunt : alive(G).sort((a, c) => manh(o, a) - manh(o, c))[0];
    if(!prey){ o.grab = null; continue; }
    if(near(o, prey) && grounded(G, prey)){
      o.grab = prey.id;
      o.hit -= DT;
      if(o.hit <= 1e-9){
        o.hit += S.hitEvery;
        const k = knockOf(prey, S.knock), dir = Math.sign(prey.x - o.x) || (prey.x < G.mid ? -1 : 1);
        if(k >= 0.5 && golOpen(G, prey.x + dir, prey.y) && prey.action?.type !== 'stun'){ prey.x += dir; prey.action = null; }
      }
      continue;
    }
    o.grab = null;
    o.moveCd -= DT;
    if(o.moveCd > 1e-9) continue;
    o.moveCd = S.step;
    const dir = Math.sign(prey.x - o.x);
    if(dir && golOpen(G, o.x + dir, o.y)){ o.x += dir; o.face = dir; }
  }
  if(G.boss.state === 'split' && !liveGolems(G).length){
    G.golems = [];
    G.boss.state = 'fight'; G.boss.cd = slamEvery(G); G.next.split = G.t + C.split.every;
    log(G, `🗿 Tous les golems sont morts : le ${G.boss.name} se reforme !`);
  }
}
function hitGolem(G, m, o, dmg = strikeDmg(G, m)){
  if(o.hp <= 0) return;
  o.hp = Math.max(0, o.hp - dmg); G.stats.dmg += dmg; m.stats.dmg += dmg;
  if(m.skill.taunt) o.taunt = m.id;
  if(o.hp <= 0){ o.grab = null; G.stats.kills++; m.stats.kills++; }
}

/* ---------- le Golbute ---------- */
const slamEvery = G => C.slam.every / (G.boss.rage ? 1 + C.rage.atkSpeed : 1);
const avalancheEvery = G => C.avalanche.every * (G.boss.rage ? 1 + C.rage.avalancheCd : 1);
/* chance d'être propulsé : chance × (1 − recul %) × (1 − ténacité %) */
export const slamChance = (G, m) => (G.boss.rage ? C.rage.chance : C.slam.chance)
  * (1 - Math.min(100, Math.max(0, m.carac.knockRes || 0)) / 100) * (1 - Math.min(100, Math.max(0, m.carac.tenacity || 0)) / 100);

function slam(G){
  const b = G.boss;
  b.slamAt = G.ticks; G.stats.slams++;
  for(const m of alive(G)){
    /* déjà étourdi : pas propulsé (choix de Claude, 30/10 : sinon un mineur au contact reste étourdi presque tout le temps) */
    if(!grounded(G, m) || gapX(G, m.x) > C.slam.range || m.action?.type === 'stun') continue;
    if(!(G.fightRng() < slamChance(G, m))) continue;
    const back = m.x < b.x ? -1 : 1;
    let { x, y } = m;
    for(let i = 0; i < C.slam.high && golOpen(G, x, y - 1); i++) y--;
    for(let i = 0; i < C.slam.back && golOpen(G, x + back, y); i++) x += back;
    m.x = x; m.y = y; m.kx = 0; m.ky = 0; m.action = null; m.knocked = true; m.fallN = 0; m.fallT = 0; m.hop = G.ticks; m.boosted = G.ticks;
    for(const o of G.golems) if(o.grab === m.id) o.grab = null;
    G.stats.knocks++; m.stats.knocked++;
  }
}

function avalanche(G){
  const A = C.avalanche;
  G.next.avalanche = G.t + avalancheEvery(G);
  G.stats.avalanches++; G.timeline.avalanches.push(G.t);
  const hit = [], dodged = [];
  for(const m of alive(G)){
    G.rocks.push({ x: m.x, at: G.ticks });
    if(chance(G, m.carac.tenacity || 0)){ dodged.push(m.name); G.stats.dodges++; continue; }
    if(G.t > m.dazedUntil + 1e-9) m.dazed = 0;
    m.dazed++; m.dazedUntil = G.t + A.dazed; m.stats.dazed++;
    hit.push(m);
    if(m.dazed >= A.deathStacks){ die(G, m); continue; }
    stunFor(m, A.stun, 'avalanche');
  }
  for(let i = 0; i < 4; i++) G.rocks.push({ x: Math.floor(G.rng() * G.w), at: G.ticks });   // rochers pour le décor
  G.rocks = G.rocks.filter(r => G.ticks - r.at < 20);
  log(G, `🪨 Avalanche !${hit.length ? ` ${hit.map(m => `${m.name}${m.dead ? ' (mort)' : ` (sonné ×${m.dazed})`}`).join(', ')}` : ''}${dodged.length ? ` · esquivée par ${dodged.join(', ')}` : ''}`);
  if(!alive(G).length) endGolbute(G, false);
}
function die(G, m){
  m.dead = true; m.action = null; m.status = 'Mort'; m.knocked = false;
  for(const o of G.golems){ if(o.grab === m.id) o.grab = null; if(o.taunt === m.id) o.taunt = null; }
  G.stats.deaths++; G.timeline.deaths.push(G.t);
}

function stepBoss(G){
  const b = G.boss;
  if(G.over || b.hp <= 0) return;
  if(G.t + 1e-9 >= G.next.avalanche){ avalanche(G); if(G.over) return; }
  if(b.state === 'split' || b.state === 'crystal') return;
  if(G.t + 1e-9 >= G.next.split) return split(G);
  b.cd -= DT;
  if(b.cd > 1e-9) return;
  b.cd += slamEvery(G);
  slam(G);
}

function damageBoss(G, m, dmg){
  const b = G.boss;
  if(!bossHere(G) || b.state === 'crystal' || !(dmg > 0)) return;
  const at = C.crystal.at[b.phase], floor = at != null ? b.maxhp * at : 0;
  const d = Math.min(dmg, b.hp - floor);
  b.hp -= d; G.stats.bossDmg += d; m.stats.bossDmg += d; m.stats.dmg += d; G.stats.dmg += d;
  if(b.hp <= 1e-9){ b.hp = 0; log(G, `🏆 Le ${b.name} est vaincu ! Coup final de ${m.name}.`); return endGolbute(G, true); }
  if(at != null && b.hp <= floor + 1e-9){
    b.hp = floor; b.state = 'crystal'; b.crystal = { hp: C.crystal.hp, max: C.crystal.hp };
    G.timeline.crystals.push(G.t);
    log(G, `💎 Le ${b.name} se cristallise (${Math.round(at * 100)} %) : il faut le miner !`);
  }
}
/* minage du cristal (coups de minage, comme un spawner) */
function drainCrystal(G, m, n){
  const b = G.boss, c = b.crystal;
  if(b.state !== 'crystal' || !c || !(n > 0)) return;
  const d = Math.min(c.hp, n);
  c.hp -= d; m.stats.mined += d; G.stats.mined += d;
  if(c.hp > 1e-9) return;
  b.state = 'fight'; b.crystal = null; b.phase++; b.cd = slamEvery(G);
  for(const o of G.miners) if(o.action?.type === 'drill') o.action = null;
  if(b.phase >= C.crystal.at.length && !b.rage){
    b.rage = true; b.cd = slamEvery(G); G.timeline.rage = G.t;
    if(G.next.avalanche - G.t > avalancheEvery(G)) G.next.avalanche = G.t + avalancheEvery(G);
    log(G, `😡 Le cristal éclate : le ${b.name} enrage !`);
  } else log(G, `💥 Le cristal éclate : le ${b.name} redevient vulnérable`);
}

/* ---------- décision des mineurs ---------- */
function strike(G, m, target, status){
  const boss = target === G.boss, now = m.now ?? G.t;
  m.face = Math.sign((boss ? G.boss.x + G.boss.w / 2 - 0.5 : target.x) - m.x) || m.face;
  if(now + 1e-9 >= (m.atkReady || 0)){
    combatSpells(G, m, target);
    if(boss) damageBoss(G, m, strikeDmg(G, m)); else hitGolem(G, m, target);
    m.atkReady = now + hitT(G, m);
  }
  return act(m, 'attack', (m.atkReady || 0) - now, { done: true, boss }, status);
}
function walkTo(G, m, tx, status){
  const dir = Math.sign(tx - m.x);
  if(!dir) return act(m, 'wait', 0.2, {}, status);
  if(!golOpen(G, m.x + dir, m.y)) return act(m, 'wait', 0.2, {}, 'Bloqué');
  m.face = dir;
  return act(m, 'move', moveT(m), { x: m.x + dir, y: m.y }, status);
}
/* case de contact visée : le côté du Golbute où est le mineur */
const contactX = (G, m) => m.x < G.boss.x + G.boss.w / 2 ? G.boss.x - 1 : G.boss.x + G.boss.w;

export function decide(G, m){
  supportSpells(G, m);
  if(G.over) return;
  const b = G.boss;
  /* golems : celui qui le tient, puis celui à côté, puis le plus proche */
  const gs = liveGolems(G);
  if(gs.length){
    const tk = golTackler(G, m);
    const nb = tk && near(m, tk) ? tk : gs.filter(o => near(m, o)).sort((a, c) => a.hp - c.hp)[0];
    if(nb) return strike(G, m, nb, tk ? 'Retenu par un golem' : 'Combat un golem');
    const far = gs.sort((a, c) => manh(m, a) - manh(m, c))[0];
    if(dash(G, m, far)) return act(m, 'wait', DT, {}, 'Dash sur un golem');
    return walkTo(G, m, far.x - Math.sign(far.x - m.x), 'Va combattre un golem');
  }
  if(b.hp <= 0) return act(m, 'wait', 0.5, {}, 'Victoire');
  if(b.state === 'split') return act(m, 'wait', 0.2, {}, `Le ${b.name} se reforme`);
  if(inContact(G, m)){
    if(b.state === 'crystal'){ mineSpells(G, m); return act(m, 'drill', 0.5, {}, 'Mine le cristal'); }
    return strike(G, m, b, `Combat le ${b.name}`);
  }
  if(b.state !== 'crystal' && dashBoss(G, m)) return act(m, 'wait', DT, {}, `Dash sur le ${b.name}`);
  return walkTo(G, m, contactX(G, m), b.state === 'crystal' ? 'Va miner le cristal' : `Va au contact du ${b.name}`);
}

/* ---------- sorts ---------- */
function mineBuffs(G, m){
  if(ready(G, m, 'inspiration') && !inspireOn(G)){
    const S = SPELL.inspiration; G.inspire = { until: G.t + S.duration, pct: S.mineSpeed };
    cast(G, m, 'inspiration', G.inspire.until);
    log(G, `🎺 ${m.name} : Inspiration, tout le monde mine ${Math.round(S.mineSpeed * 100)} % plus vite`);
  }
  if(ready(G, m, 'fast_learner')){ m.learned = Math.round((m.learned + SPELL.fast_learner.bonus) * 1e6) / 1e6; cast(G, m, 'fast_learner'); }
}
function mineSpells(G, m){
  mineBuffs(G, m);
  if(ready(G, m, 'dynamite')){
    cast(G, m, 'dynamite');
    drainCrystal(G, m, C.crystal.dynamite);
    log(G, `🧨 ${m.name} : Dynamite sur le cristal (${C.crystal.dynamite} coups)`);
  }
}
const golemsAround = (G, x, y, r) => liveGolems(G).filter(o => (o.x - x) ** 2 + (o.y - y) ** 2 <= r * r + 1e-9);
function combatSpells(G, m, target){
  if(ready(G, m, 'war_cry') && !(G.warcry && G.t < G.warcry.until)){
    const S = SPELL.war_cry; G.warcry = { until: G.t + S.duration, by: m.id, dmg: S.dmgPct, speed: S.atkSpeed };
    cast(G, m, 'war_cry', G.warcry.until);
    log(G, `📯 ${m.name} : Cri de guerre`);
  }
  if(ready(G, m, 'cleave')){
    const S = SPELL.cleave; cast(G, m, 'cleave');
    for(const o of liveGolems(G)) if(o !== target && manh(o, m) <= S.radius) hitGolem(G, m, o, hitDmg(G, m) * S.dmg);
    if(target !== G.boss && inContact(G, m)) damageBoss(G, m, hitDmg(G, m) * S.dmg);
  }
  if(ready(G, m, 'dynamite')){
    const S = SPELL.dynamite, boss = target === G.boss;
    const gs = boss ? [] : golemsAround(G, target.x, target.y, S.radius);
    if(boss || gs.length >= S.fightFoes){
      cast(G, m, 'dynamite');
      log(G, `🧨 ${m.name} : Dynamite (${boss ? `le ${G.boss.name}` : `${gs.length} golems`})`);
      const d = () => hitDmg(G, m) * S.dmg;
      for(const o of gs) hitGolem(G, m, o, d());
      if(boss) damageBoss(G, m, d());
    }
  }
}
/* Hand of Justice (un golem qui tient un allié, puis lui : étourdi), Ulti shen (un allié retenu par un golem, ou qui
   frappe le Golbute : il le rejoint et frappe) */
function supportSpells(G, m){
  if(ready(G, m, 'hand_of_justice')){
    const S = SPELL.hand_of_justice;
    const o = liveGolems(G).filter(o => o.grab != null && !golemStunned(G, o) && manh(o, m) <= S.range).sort((a, c) => (a.grab === m.id) - (c.grab === m.id))[0];
    if(o){ cast(G, m, 'hand_of_justice'); o.stunUntil = G.t + S.stun; o.grab = null; log(G, `⚖ ${m.name} : Hand of Justice étourdit un golem`); }
  }
  if(ready(G, m, 'ulti_shen') && !golTackler(G, m)){
    const S = SPELL.ulti_shen;
    const ally = alive(G).find(a => a !== m && golTackler(G, a)), fighting = alive(G).find(a => a !== m && inContact(G, a) && G.boss.state === 'fight');
    const to = ally ?? fighting;
    if(to){
      cast(G, m, 'ulti_shen'); m.action = null; m.x = to.x; m.y = to.y; m.kx = 0; m.hop = G.ticks;
      if(ally){ const o = golTackler(G, ally); hitGolem(G, m, o, o.maxhp * S.hpPct); }
      else damageBoss(G, m, G.boss.maxhp * S.bossPct);
      log(G, `🌀 ${m.name} : Ulti shen auprès de ${to.name}`);
    }
  }
}
function dash(G, m, o){
  if(!ready(G, m, 'dash') || o.y !== m.y) return false;
  const S = SPELL.dash, dir = Math.sign(o.x - m.x), n = Math.abs(o.x - m.x) - 1;
  if(!dir || n < S.minCells || n > S.range) return false;
  for(let x = m.x + dir; x !== o.x; x += dir) if(!golOpen(G, x, m.y)) return false;
  cast(G, m, 'dash', G.t, S.hitCd);
  m.x = o.x - dir; m.kx = 0; m.face = dir;
  hitGolem(G, m, o, strikeDmg(G, m) * S.dmg);
  if(o.hp > 0){ o.stunUntil = G.t + S.stun; o.grab = null; }
  log(G, `💨 ${m.name} : Dash`);
  return true;
}
function dashBoss(G, m){
  if(!ready(G, m, 'dash') || !bossHere(G) || m.y !== G.floorY) return false;
  const tx = contactX(G, m), S = SPELL.dash, dir = Math.sign(tx - m.x), n = Math.abs(tx - m.x);
  if(!dir || n < S.minCells || n > S.range) return false;
  cast(G, m, 'dash', G.t, S.hitCd);
  m.x = tx; m.kx = 0; m.face = dir;
  log(G, `💨 ${m.name} : Dash sur le ${G.boss.name}`);
  damageBoss(G, m, strikeDmg(G, m) * S.dmg);
  return true;
}

/* ---------- boucle ---------- */
export function tickGolbute(G){
  if(G.over) return;
  G.ticks++; G.t = G.ticks * DT;
  stepGolems(G);
  for(const m of [...G.miners]) if(!G.over) stepMiner(G, m);
  stepBoss(G);
  if(!G.over && G.ticks >= GOLBUTE_TICKS) endGolbute(G, false);
}

/* gravité à part des actions : en l'air, il tombe d'une case toutes les 1/fallSpeed s ; à l'atterrissage d'une
   propulsion de CFG.stunFall cases ou plus, étourdi CFG.stunTime s */
function gravity(G, m){
  if(grounded(G, m)){
    if(m.knocked){
      if(m.fallN >= CFG.stunFall && !m.dead) stunFor(m, CFG.stunTime, 'fall');
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
  if(gravity(G, m) || m.dead) return;
  let budget = DT, guard = 0;
  while(budget > 1e-9 && guard++ < 30 && !G.over){
    if(!m.action){ m.now = G.t - budget; decide(G, m); m.now = null; if(!m.action) break; }
    const a = m.action, need = a.dur - a.t, used = Math.min(budget, need);
    if(a.type === 'drill'){ drainCrystal(G, m, golRate(G, m) * used); G.stats.mineT += used; }
    else if(a.type === 'attack') G.stats.fightT += used;
    if(budget >= need){ budget -= need; m.action = null; if(a.type === 'move'){ if(golOpen(G, a.data.x, a.data.y)) m.x = a.data.x; } }
    else { a.t += budget; budget = 0; }
    if(m.action?.type === 'drill' && G.boss.state !== 'crystal') m.action = null;
  }
}

/* Un joueur quitte : son mineur disparaît. Idempotent. */
export function leaveGolbute(G, who){
  if(G.over) return false;
  const m = typeof who === 'object' ? who : G.miners.find(x => x.account !== null && x.account === who);
  if(!m || m.left != null || !G.miners.includes(m)) return false;
  m.left = G.t; m.action = null; m.status = 'A quitté l\'instance';
  G.miners = G.miners.filter(x => x !== m);
  for(const o of G.golems){ if(o.grab === m.id) o.grab = null; if(o.taunt === m.id) o.taunt = null; }
  log(G, `${m.name} a quitté l'instance`);
  if(!alive(G).length) endGolbute(G, false);
  return true;
}

/* fin : réussite (Golbute vaincu) ou échec (temps écoulé, tous morts, tous partis). Idempotent. */
export function endGolbute(G, success){
  if(G.summary) return;
  G.over = true;
  const b = G.boss;
  if(!success && G.miners.length) log(G, alive(G).length ? `⌛ Temps écoulé : le ${b.name} tient toujours (${Math.ceil(b.hp)} PV).` : `💀 Tout le monde est mort.`);
  G.summary = {
    mode: 'instance', instance: G.instance, level: 1, id: G.id, seed: G.seed, success: !!success, t: G.t,
    bossHp: Math.ceil(b.hp), bossMax: b.maxhp, phase: b.phase, rage: b.rage, kills: G.stats.kills, deaths: G.stats.deaths,
    spawners: 0, spawnersMax: 0, loot: {},
    shares: G.roster.map(m => ({ miner: m.name, color: m.color, account: m.account, left: m.left != null, bag: {},
                                 stats: { dmg: Math.round(m.stats.dmg), bossDmg: Math.round(m.stats.bossDmg), kills: m.stats.kills,
                                          mined: Math.round(m.stats.mined), knocked: m.stats.knocked, dazed: m.stats.dazed, dead: m.dead } })),
  };
}

export function runGolbute(seed, opts = {}){
  const G = newGolbute(seed, opts);
  while(!G.over) tickGolbute(G);
  return G;
}
