/* Bloc géant : la partie commune et sa boucle à pas fixe (DT). Ne touche ni au DOM ni au canvas. Réglages GIANT
   (src/config.js), spec docs/superpowers/specs/2026-10-26-bloc-geant-design.md.

   Carte GIANT.w × GIANT.h, tout en air, sol sous la dernière ligne. Le bloc géant (GIANT.block de côté, indestructible)
   est collé en bas à droite ; les mineurs marchent sur la ligne du bas et le frappent depuis la colonne juste à sa
   gauche (ils s'y superposent). Pas de gravité à gérer : personne ne quitte la ligne du bas (le recul est un saut en
   arc qui retombe sur cette ligne).

   La partie ne s'arrête jamais d'elle-même : des mineurs y entrent (joinGiant) et en sortent (au bout de leur visite ou
   leaveGiant). Chaque visite terminée est ajoutée à G.done ({ account, points, … }) : le serveur les relève.
   Les caractéristiques (stuff, skills, anneaux des présents) sont calculées en dehors (src/shared/giant-room.js), qui
   peut les remplacer quand le groupe présent change. */
import { GIANT, DT, STATS } from '../../config.js';
import { mulberry32 } from '../../core/rng.js';
import { SPELL } from '../../meta/spells.js';
import { log } from '../log.js';
import { knockOf } from '../knock.js';

export const VISIT_TICKS = Math.round(GIANT.visit / DT);

/* géométrie : colonnes du bloc, colonne de contact, ligne du sol (là où marchent les mineurs) */
export const giantLayout = (cfg = GIANT) => ({
  w: cfg.w, h: cfg.h, row: cfg.h - 1,
  bx: cfg.w - cfg.block, by: cfg.h - cfg.block, bw: cfg.block, bh: cfg.block,
  contact: cfg.w - cfg.block - 1, spawn: cfg.spawnX, fountain: cfg.fountainX,
});

export function newGiant(seed, opts = {}){
  seed = seed ?? ((Math.random() * 2**31) | 0);
  return {
    mode: 'giant', seed, id: opts.id ?? `giant-${seed}`, t: 0, ticks: 0, over: false, ...giantLayout(),
    rng: mulberry32(seed ^ 0x51ed270b),
    miners: [], nextId: 0, done: [], inspire: null, log: [],
    stats: { joined: 0, points: 0, hits: 0, knocks: 0, ignored: 0, dynamites: 0 },
  };
}

/* un mineur entre : spec = { account, name, color, look, auras, carac, skills, skillTree, spells } ;
   opts.ticks : ticks de visite (une visite reprise après un redémarrage du serveur en a moins), opts.points : points déjà faits */
export function joinGiant(G, spec, opts = {}){
  const ticks = Math.max(1, Math.min(VISIT_TICKS, Math.round(opts.ticks ?? VISIT_TICKS)));
  const m = {
    id: G.nextId++, account: spec.account ?? null, name: spec.name || 'Mineur', color: spec.color || null,
    look: spec.look || {}, auras: spec.auras || {},
    carac: { ...STATS, ...(spec.carac || {}) }, skill: { ...(spec.skills || {}) }, skillTree: spec.skillTree ?? null,
    spells: Array.isArray(spec.spells) ? [...spec.spells] : [], spellCd: {}, learned: 0,
    x: G.spawn, y: G.row, face: 1, fly: null, refill: false, status: 'Arrivée',
    ox: (spec.carac?.oxygenMax ?? STATS.oxygenMax), joinTick: G.ticks, endTick: G.ticks + ticks,
    points: Number.isFinite(opts.points) && opts.points > 0 ? opts.points : 0, hitAcc: 0,
    stats: { hits: 0, knocks: 0, ignored: 0, dynamites: 0, refills: 0, mining: 0 },
  };
  G.miners.push(m);
  G.stats.joined++;
  log(G, `${m.name} arrive devant le bloc géant.`);
  return m;
}

/* un mineur sort (fin de visite ou départ) : sa visite va dans G.done ; true s'il était là */
export function leaveGiant(G, account, why = 'left'){
  const i = G.miners.findIndex(m => m.account === account);
  if(i < 0) return false;
  const m = G.miners[i];
  G.miners.splice(i, 1);
  G.done.push({ account: m.account, name: m.name, points: m.points, why, tick: G.ticks, ...m.stats });
  log(G, `${m.name} quitte le bloc géant (${Math.floor(m.points)} points).`);
  return true;
}

/* ---------- vitesse de minage : coups par seconde = points par seconde ---------- */

const inspireOn = G => !!G.inspire && G.t < G.inspire.until;
export const giantRate = (G, m) => m.carac.mineSpeed * (1 + (m.carac.mineSpeedPct || 0) / 100)
  * (1 + (inspireOn(G) ? G.inspire.pct : 0)) * (1 + (m.learned || 0));

/* ---------- boucle ---------- */

export function tickGiant(G){
  G.t = Math.round((G.t + DT) * 1e6) / 1e6;
  G.ticks++;
  for(const m of [...G.miners]){
    if(G.ticks >= m.endTick){ leaveGiant(G, m.account, 'end'); continue; }
    stepMiner(G, m);
  }
}

const atFountain = (G, m) => Math.abs(m.x - G.fountain) <= GIANT.fountainRange + 1e-9;
const atContact = (G, m) => Math.abs(m.x - G.contact) < 1e-6;
const spellReady = (G, m, id) => m.spells.includes(id) && G.t >= (m.spellCd[id] || 0);

/* oxygène qu'il lui faut pour aller du bloc à la fontaine, avec la marge */
const oxToFountain = (G, m) => ((G.contact - G.fountain - GIANT.fountainRange) / m.carac.speed + GIANT.oxygenMargin) * GIANT.oxygenDrain;

function stepMiner(G, m){
  /* oxygène : la fontaine recharge le mineur qui s'y arrête (pas celui qui passe devant, ni celui qu'un recul y pose :
     sinon la résistance au recul ferait perdre des points) ; ailleurs il baisse */
  const oxMax = m.carac.oxygenMax;
  if(m.refill && atFountain(G, m) && !m.fly) m.ox = Math.min(oxMax, m.ox + GIANT.fountainRefill * DT);
  else m.ox = Math.max(0, m.ox - GIANT.oxygenDrain * DT);

  if(m.fly){ stepFly(G, m); return; }

  /* recharger : à court d'oxygène, ou plus assez pour rejoindre la fontaine ; il reste jusqu'au plein */
  if(m.refill && m.ox >= oxMax - 1e-9) m.refill = false;
  if(!m.refill && (m.ox <= 0 || m.ox <= oxToFountain(G, m))){ m.refill = true; m.stats.refills++; }
  if(m.refill){
    if(atFountain(G, m)){ m.status = 'Recharge en oxygène'; return; }
    walk(G, m, G.fountain + GIANT.fountainRange, 'Va à la fontaine');
    return;
  }
  if(!atContact(G, m)){ walk(G, m, G.contact, 'Va au bloc géant'); return; }
  mine(G, m);
}

function walk(G, m, x, status){
  const step = m.carac.speed * DT, d = x - m.x;
  m.face = d >= 0 ? 1 : -1;
  m.x = Math.abs(d) <= step ? x : m.x + Math.sign(d) * step;
  m.status = status;
}

function mine(G, m){
  m.face = 1; m.status = 'Frappe le bloc géant';
  castSpells(G, m);
  const rate = giantRate(G, m);
  m.points += rate * DT;
  m.stats.mining += DT;
  G.stats.points += rate * DT;
  /* coups : rate par seconde ; chacun peut le repousser */
  m.hitAcc += rate * DT;
  while(m.hitAcc >= 1 && !m.fly){
    m.hitAcc -= 1;
    m.stats.hits++; G.stats.hits++;
    if(G.rng() < GIANT.knock.chance) knock(G, m);
  }
}

/* recul : la ténacité l'ignore, la résistance au recul réduit la distance (arrondie, knock.min au moins) */
function knock(G, m){
  const K = GIANT.knock;
  const base = K.min + Math.floor(G.rng() * (K.max - K.min + 1));
  if(G.rng() < (m.carac.tenacity || 0) / 100){ m.stats.ignored++; G.stats.ignored++; return; }
  const n = Math.max(K.min, Math.round(knockOf(m, base)));
  const to = Math.max(0, m.x - n);
  m.fly = { from: m.x, to, t: 0, dur: K.flight, n };
  m.hitAcc = 0;
  m.stats.knocks++; G.stats.knocks++;
  m.status = 'Repoussé';
}

function stepFly(G, m){
  const f = m.fly;
  f.t += DT;
  const k = Math.min(1, f.t / f.dur);
  m.x = f.from + (f.to - f.from) * k;
  m.face = 1;
  if(k >= 1){ m.x = f.to; m.fly = null; }
}

/* sorts utiles ici : Inspiration (tous les présents), Fast learner (le bloc géant appris), Dynamite (+1 point) */
function castSpells(G, m){
  if(spellReady(G, m, 'inspiration') && !inspireOn(G)){
    const S = SPELL.inspiration;
    G.inspire = { until: G.t + S.duration, pct: S.mineSpeed };
    m.spellCd.inspiration = G.inspire.until + S.cd;
    log(G, `🎺 ${m.name} : Inspiration, tout le monde mine ${Math.round(S.mineSpeed * 100)} % plus vite`);
  }
  if(spellReady(G, m, 'fast_learner')){
    m.learned = Math.round((m.learned + SPELL.fast_learner.bonus) * 1e6) / 1e6;
    m.spellCd.fast_learner = G.t + SPELL.fast_learner.cd;
  }
  if(spellReady(G, m, 'dynamite')){
    m.points += GIANT.dynamitePoints;
    G.stats.points += GIANT.dynamitePoints;
    m.stats.dynamites++; G.stats.dynamites++;
    m.spellCd.dynamite = G.t + SPELL.dynamite.cd;
  }
}

/* partie sans serveur (tests, simulation) : visits = [{ spec, at (s) }] ; renvoie la partie une fois tout le monde sorti */
export function runGiant(seed, visits = [], maxSeconds = 3600){
  const G = newGiant(seed);
  const queue = [...visits].sort((a, b) => (a.at || 0) - (b.at || 0));
  const limit = Math.round(maxSeconds / DT);
  while(G.ticks < limit && (queue.length || G.miners.length)){
    while(queue.length && (queue[0].at || 0) <= G.t + 1e-9) joinGiant(G, queue.shift().spec);
    tickGiant(G);
  }
  return G;
}
