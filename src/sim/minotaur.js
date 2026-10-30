/* Minotaure : Charge et Rage (MINOTAUR en config ; 30/10/2026, Jules). Logique pure, appelée par src/sim/mobs.js pour le
   boss du donjon et les minotaures de l'Arène du k hole. Variante : o.variant (MINOTAUR.variants ; absent = donjon).
   - o.charge : null, { phase:'windup', t, dir } (il gratte le sol) ou { phase:'run', dir, acc, ran } (il fonce) ;
   - o.chargeCd : secondes avant la prochaine charge (le compteur ne tourne que s'il a une proie) ;
   - o.rage : enragé (une fois sous rage.below de ses PV, il le reste) ;
   - o.exposedUntil : sonné contre un obstacle, il prend plus de dégâts jusque-là (exposedMul, src/sim/actions.js). */
import { DT, MINOTAUR, DUNGEON } from '../config.js';
import { isAir, supported } from './world.js';
import { inReach, push, recenter, stopAction } from './knock.js';
import { noEntry } from './dungeon.js';
import { log } from './log.js';

export const isMinotaur = o => o.type === DUNGEON.boss.type;
export const variantOf = o => MINOTAUR.variants[o.variant] ?? MINOTAUR.variants.donjon;
const rageOf = o => { const r = variantOf(o).rage; return r ? { ...MINOTAUR.rage, ...r } : null; };
const nameOf = o => variantOf(o).name.toLowerCase();

/* rage : sous rage.below de ses PV max */
export function enrage(G, o){
  const r = rageOf(o);
  if(!r || o.rage || o.hp > o.maxhp*r.below) return;
  o.rage = true;
  log(G, `🔥 Le ${nameOf(o)} enrage !`);
}

/* coup d'un minotaure enragé : { every, knock } (null : celui des autres mobs, MOBS.hitEvery et MOBS.knock) */
export function rageHit(o){
  const r = o.rage ? rageOf(o) : null;
  return r ? { every: r.hitEvery, knock: r.knock } : null;
}

/* dégâts reçus : × (1 + missVuln) tant qu'il est sonné après une charge ratée */
export const exposedMul = (G, o) => o.exposedUntil > G.t ? 1 + MINOTAUR.charge.missVuln : 1;

const nextCharge = o => { const r = o.rage ? rageOf(o) : null; return r ? r.chargeEvery : MINOTAUR.charge.every; };

/* étourdi (Dash, Main de la justice…) : la charge est coupée, le compteur repart */
export function breakCharge(o){
  if(!o.charge) return;
  o.charge = null; o.chargeCd = nextCharge(o);
}

/* charge : renvoie true tant qu'il charge (il gratte le sol, puis fonce) : il ne marche pas et ne frappe pas.
   prey : sa proie (null : le compteur attend) ; canEnter(x, y) : cases où il peut foncer (sa salle pour le boss du
   donjon) ; resists(G, m) : la ténacité du mineur ignore-t-elle l'étourdissement ? (src/sim/mobs.js) */
export function charge(G, o, prey, canEnter, resists){
  if(!variantOf(o).charge) return false;
  const C = MINOTAUR.charge, c = o.charge;
  if(c?.phase === 'windup'){
    c.t -= DT;
    if(c.t > 1e-9) return true;
    o.charge = { phase: 'run', dir: c.dir, acc: 0, ran: 0 };
    o.grab = null; o.face = c.dir; recenter(o);
    return true;
  }
  if(c?.phase === 'run'){ run(G, o, canEnter, resists); return true; }
  if(!prey) return false;
  o.chargeCd = (o.chargeCd ?? C.first) - DT;
  if(o.chargeCd > 1e-9) return false;
  const dir = Math.sign(prey.x - o.x);
  if(!dir) return false;   // proie juste au-dessus ou au-dessous : il attend qu'elle soit sur le côté
  o.charge = { phase: 'windup', t: C.windup, dir };
  log(G, `🐂 Le ${nameOf(o)} gratte le sol…`);
  return true;
}

/* course : speed cases/s, une case à la fois ; il s'arrête sur le premier mineur à sa portée devant lui (encorné),
   contre un obstacle (raté : sonné), au bout de maxRun cases, ou au bord d'un vide */
function run(G, o, canEnter, resists){
  const C = MINOTAUR.charge, c = o.charge;
  c.acc += DT*C.speed;
  while(c.acc >= 1-1e-9){
    c.acc -= 1;
    const m = G.miners.find(q => q.y > 0 && q.y === o.y && (q.x-o.x)*c.dir >= 0 && inReach(G, o, q));
    if(m){ gore(G, o, m, resists); return end(o); }
    if(c.ran >= C.maxRun || !supported(G, o.x, o.y)) return end(o);
    if(!canEnter(o.x+c.dir, o.y)){
      o.stunUntil = o.exposedUntil = G.t + C.missStun;
      G.stats.minoMiss = (G.stats.minoMiss || 0) + 1;
      log(G, `💥 Le ${nameOf(o)} percute le mur : sonné ${C.missStun} s, il prend +${Math.round(C.missVuln*100)} % de dégâts`);
      return end(o);
    }
    o.x += c.dir; c.ran++;
  }
}
function end(o){ o.charge = null; o.chargeCd = nextCharge(o); }

/* encorné : projeté de knock cases (sa résistance au recul compte), puis étourdi stun s (la ténacité l'ignore) */
function gore(G, o, m, resists){
  const C = MINOTAUR.charge;
  if(!m.fall){ stopAction(m); push(m, o, C.knock, (x, y) => isAir(G, x, y) && !noEntry(G, m, x, y)); }
  m.stats.gored = (m.stats.gored || 0) + 1; G.stats.gored = (G.stats.gored || 0) + 1;
  if(resists(G, m)){ log(G, `💪 ${m.name} encaisse la charge du ${nameOf(o)} sans être étourdi`); return; }
  m.goredUntil = G.t + C.stun;
  log(G, `🐂 Le ${nameOf(o)} encorne ${m.name} : projeté et étourdi ${C.stun} s`);
}
