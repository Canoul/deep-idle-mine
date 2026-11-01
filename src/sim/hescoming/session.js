/* He's coming (01/11/2026, Geoffrey) : le Bloc géant version combat, sur la même salle et les mêmes visites (src/sim/giant/session.js).
   Ne touche ni au DOM ni au canvas. Réglages HES_COMING (src/config.js), spec docs/superpowers/specs/2026-11-01-hes-coming-design.md.

   Lucifer est à la place du bloc, il ne meurt pas et ne bouge pas. Le mineur frappe depuis standX, d'autant plus loin qu'il a de la
   portée. 1 dégât infligé = 1 point. Lucifer rugit (Fear) et frappe (recul) à son rythme, sur l'horloge de la salle. */
import { HES_COMING as HC, COMBAT, CFG, DT } from '../../config.js';
import { mulberry32 } from '../../core/rng.js';
import { SPELL } from '../../meta/spells.js';
import { hitDamage } from '../actions.js';
import { warcryOf } from '../mineur.js';
import { knockOf, reachOf } from '../knock.js';
import { resists } from '../mobs.js';
import { log } from '../log.js';
import { newGiant, joinGiant, leaveGiant, walk, stepFly } from '../giant/session.js';

export function newLucifer(seed, opts = {}){
  seed = seed ?? ((Math.random() * 2**31) | 0);
  const G = newGiant(seed, { id:`hescoming-${seed}`, ...opts });
  return Object.assign(G, { mode:'hescoming', place:HC.bossName, gearRng:mulberry32(seed ^ 0x2f6e2b1), nextRoar:HC.roar.every, nextSwing:HC.swing.every, roarAt:null, swingAt:null });
}
export const joinLucifer = joinGiant;

/* écart entre le mineur et le bord de Lucifer ; colonne d'où il frappe : le contact, moins la portée en plus de la portée de base */
const gapOf = (G, m) => G.contact - m.x;
export const standX = (G, m) => Math.max(0, G.contact - Math.max(0, reachOf(m) - COMBAT.reach));

const inspireOn = G => !!G.inspire && G.t < G.inspire.until;
const speedOf = (G, m) => m.carac.attackSpeed * (1 + (warcryOf(G, m)?.speed || 0)) * (1 + (inspireOn(G) ? G.inspire.pct : 0));
const interval = (G, m) => CFG.attackInterval * 100 / speedOf(G, m);
/* dégâts par seconde affichés, critiques et double attaque en moyenne */
export const luciferDps = (G, m) => m.carac.damage * (1 + (m.carac.damagePct || 0) / 100) * (1 + (warcryOf(G, m)?.dmg || 0))
  * (1 + (m.carac.crit || 0) / 100) * (1 + (m.carac.doubleAttack || 0) / 100) / interval(G, m);

export function tickLucifer(G){
  G.t = Math.round((G.t + DT) * 1e6) / 1e6;
  G.ticks++;
  if(G.t + 1e-9 >= G.nextRoar){ G.nextRoar += HC.roar.every; roar(G); }
  if(G.t + 1e-9 >= G.nextSwing){ G.nextSwing += HC.swing.every; swing(G); }
  for(const m of [...G.miners]){
    if(G.ticks >= m.endTick){ leaveGiant(G, m.account, 'end'); continue; }
    stepMiner(G, m);
  }
}

const feared = (G, m) => m.fearUntil > G.t;

/* rugissement : Fear pour ceux à roar.radius cases ou moins ; un Fear en cours n'est pas prolongé ; la ténacité l'ignore */
function roar(G){
  G.roarAt = G.t;
  log(G, `😈 ${HC.bossName} rugit !`);
  for(const m of G.miners){
    if(gapOf(G, m) > HC.roar.radius + 1e-9 || feared(G, m)) continue;
    if(resists(G, m)){ m.stats.ignored++; continue; }
    m.fearUntil = G.t + HC.roar.fear;
    m.wanderUntil = 0;
  }
}

/* autoattaque : tous ceux au contact (portée de base), projetés en arc. La ténacité l'ignore, la résistance au recul réduit la distance */
function swing(G){
  G.swingAt = G.t;
  const K = HC.swing;
  for(const m of G.miners){
    if(m.fly || gapOf(G, m) > COMBAT.reach + 1e-9) continue;
    if(resists(G, m)){ m.stats.ignored++; continue; }
    const n = Math.max(1, Math.round(knockOf(m, K.knock)));
    m.fly = { from:m.x, to:Math.max(0, m.x - n), t:0, dur:K.flight, n, high:K.high };
    m.stats.knocks++; G.stats.knocks++;
    m.status = 'Projeté';
  }
}

const atFountain = (G, m) => Math.abs(m.x - G.fountain) <= HC.fountainRange + 1e-9;
const oxToFountain = (G, m) => ((standX(G, m) - G.fountain - HC.fountainRange) / m.carac.speed + HC.oxygenMargin) * HC.oxygenDrain;

function stepMiner(G, m){
  const oxMax = m.carac.oxygenMax;
  if(m.refill && atFountain(G, m) && !m.fly && !feared(G, m)) m.ox = Math.min(oxMax, m.ox + HC.fountainRefill * DT);
  else m.ox = Math.max(0, m.ox - HC.oxygenDrain * DT);

  if(m.fly){ stepFly(G, m); return; }
  if(feared(G, m)){ wander(G, m); return; }

  if(m.refill && m.ox >= oxMax - 1e-9) m.refill = false;
  if(!m.refill && (m.ox <= 0 || m.ox <= oxToFountain(G, m))){ m.refill = true; m.stats.refills++; }
  if(m.refill){
    if(atFountain(G, m)){ m.status = 'Recharge en oxygène'; return; }
    walk(G, m, G.fountain + HC.fountainRange, 'Va à la fontaine');
    return;
  }
  const x = standX(G, m);
  if(Math.abs(m.x - x) > 1e-6){
    if(!dash(G, m, x) && !ulti(G, m, x)) walk(G, m, x, `Va vers ${HC.bossName}`);
    return;
  }
  strike(G, m);
}

/* Fear : il marche au hasard dans la salle, sans jamais frapper */
function wander(G, m){
  if(G.t >= (m.wanderUntil || 0) || !m.wanderDir){ m.wanderDir = G.rng() < 0.5 ? -1 : 1; m.wanderUntil = G.t + HC.roar.wander; }
  const next = m.x + m.wanderDir * m.carac.speed * DT;
  if(next < 0 || next > G.contact) m.wanderDir = -m.wanderDir;
  m.x = Math.max(0, Math.min(G.contact, m.x + m.wanderDir * m.carac.speed * DT));
  m.face = m.wanderDir;
  m.status = 'Fear';
}

function strike(G, m){
  m.face = 1; m.status = `Frappe ${HC.bossName}`;
  castSpells(G, m);
  m.stats.mining += DT;
  m.hitAcc += DT / interval(G, m);
  while(m.hitAcc >= 1 - 1e-9){
    m.hitAcc -= 1;
    let dmg = hitDamage(G, m);
    if(G.gearRng() * 100 < (m.carac.doubleAttack || 0)) dmg += hitDamage(G, m);
    score(G, m, dmg);
    m.stats.hits++; G.stats.hits++;
    m.ox = Math.max(0, m.ox - HC.oxygenPerHit);
  }
}

const score = (G, m, dmg) => { m.points += dmg; G.stats.points += dmg; };
const ready = (m, id, G) => m.spells.includes(id) && G.t >= (m.spellCd[id] || 0);
/* distance du mineur à Lucifer, en cases (au contact : 1) */
const bossDist = (G, m) => gapOf(G, m) + 1;

/* Dash : comme sur le boss d'une tour, il fonce à sa place de frappe s'il en est à portée, et frappe (dmg × ses dégâts,
   recharge × hitCd). Lucifer n'est pas étourdi. */
function dash(G, m, x){
  const S = SPELL.dash, n = Math.abs(x - m.x);
  if(!ready(m, 'dash', G) || n < S.minCells || n > S.range) return false;
  m.x = x; m.face = 1; m.status = 'Dash';
  m.spellCd.dash = G.t + S.cd * S.hitCd;
  score(G, m, hitDamage(G, m) * S.dmg);
  log(G, `💨 ${m.name} : Dash sur ${HC.bossName}`);
  return true;
}
/* Ulti shen : il rejoint d'un coup un allié qui frappe Lucifer, plus près que lui. Pas de dégâts : Lucifer n'a pas de PV max. */
function ulti(G, m, x){
  if(!ready(m, 'ulti_shen', G)) return false;
  const o = G.miners.find(o => o !== m && o.status === `Frappe ${HC.bossName}` && Math.abs(o.x - x) + SPELL.dash.minCells <= Math.abs(m.x - x));
  if(!o) return false;
  m.x = o.x; m.status = 'Ulti shen';
  m.spellCd.ulti_shen = G.t + SPELL.ulti_shen.cd;
  log(G, `🌀 ${m.name} : Ulti shen, rejoint ${o.name}`);
  return true;
}

/* sorts lancés en frappant : Inspiration et Cri de guerre (tous les présents), Cleave et Dynamite (dmg × ses dégâts si Lucifer
   est à leur portée), Bonbonne de zipette (l'allié proche à qui il manque le plus d'oxygène). Sans effet ici : Illumination et
   Fast learner (pas de bloc), Hand of Justice (Lucifer n'est pas étourdi et ne tacle pas). */
function castSpells(G, m){
  if(ready(m, 'cleave', G) && bossDist(G, m) <= SPELL.cleave.radius){
    m.spellCd.cleave = G.t + SPELL.cleave.cd;
    score(G, m, hitDamage(G, m) * SPELL.cleave.dmg);
  }
  if(ready(m, 'dynamite', G) && bossDist(G, m) <= SPELL.dynamite.reach + SPELL.dynamite.radius){
    m.spellCd.dynamite = G.t + SPELL.dynamite.cd;
    score(G, m, hitDamage(G, m) * SPELL.dynamite.dmg);
    log(G, `🧨 ${m.name} : dynamite sur ${HC.bossName}`);
  }
  if(ready(m, 'zipette', G)){
    const S = SPELL.zipette, ratio = o => o.ox / o.carac.oxygenMax;
    const o = G.miners.filter(o => o !== m && o.ox < o.carac.oxygenMax && Math.abs(o.x - m.x) <= S.radius).sort((a, b) => ratio(a) - ratio(b))[0];
    if(o){
      o.ox = Math.min(o.carac.oxygenMax, o.ox + m.carac.pods * S.podsPct);
      m.spellCd.zipette = G.t + S.cd;
      log(G, `🫧 ${m.name} : Bonbonne de zipette pour ${o.name}`);
    }
  }
  if(ready(m, 'inspiration', G) && !inspireOn(G)){
    const S = SPELL.inspiration;
    G.inspire = { until:G.t + S.duration, pct:S.mineSpeed };
    m.spellCd.inspiration = G.inspire.until + S.cd;
  }
  if(ready(m, 'war_cry', G)){
    const S = SPELL.war_cry, until = G.t + S.duration;
    for(const o of G.miners) o.warcry = { until:Math.max(until, o.warcry?.until ?? 0), dmg:S.dmgPct, speed:S.atkSpeed };
    m.spellCd.war_cry = until + S.cd;
  }
}
