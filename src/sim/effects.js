/* États visibles d'un mineur et d'un mob (28/10/2026, Geoffrey ; EFFECTS en config, spec
   docs/superpowers/specs/2026-10-28-buffs-debuffs-design.md). Logique pure : on LIT les champs que la simulation tient
   déjà (étourdissement, tacle, stacks, sorts, skills, anneaux…), on n'écrit rien. Sert à la mine, aux tours, à
   l'instance et à la mine instantanée : ce qui dépend du mode arrive par ctx.

   minerEffects(G, m, ctx) → [{ id, left?, stacks?, value?, src? }] dans l'ordre d'affichage (contrôles, debuffs, buffs) :
     left : secondes restantes (absent = tant que la cause dure) ; stacks : nombre affiché (×n) ; value : effet chiffré ;
     src : d'où ça vient (cause d'un étourdissement, type du mob qui tacle…).
   ctx : { foes : mobs qui peuvent tacler (G.mobs, G.goblins), dark : il est dans le noir, warcry : Cri de guerre qui
           s'applique à lui ({ until, dmg, speed }) ou null }
   sessionBonuses(G, m) → [{ id, src, value? }] : bonus permanents de la session (une seule icône à l'écran).
   Couronne du Roi Gobelin : buff du porteur seul (crownOf, 29/10).
   mobEffects(G, o) → ['stun', 'channel', 'taunt'] : états d'un mob. */
import { EFFECTS, INSTANCE, RINGS } from '../config.js';
import { SPELL } from '../meta/spells.js';

const r1 = v => Math.round(v * 10) / 10;
const left = (G, until) => Math.max(0, r1(until - G.t));
const KIND = id => EFFECTS.list[id]?.kind;

/* cause d'un étourdissement : data.cause (posé par l'IA et la tour), sinon l'ancien drapeau de l'occultiste */
const stunCause = a => a.data?.cause ?? (a.data?.hex ? 'hex' : null);

export function minerEffects(G, m, ctx = {}){
  const out = [], push = e => out.push(e), a = m.action;
  /* contrôles */
  if(a?.type === 'stun') push({ id:'stun', left:Math.max(0, r1((a.dur ?? 0) - (a.t ?? 0))), src:stunCause(a) });
  const foe = (ctx.foes || []).find(o => o.hp > 0 && o.grab === m.id) ?? null;
  if(foe) push({ id:'tackled', src:foe.type ?? null });
  const cage = G.cages?.some(c => c.id === m.id) && G.boss?.state === 'wait';
  if(cage) push({ id:'caged', left:Math.max(0, r1(INSTANCE.boss.cageMaxWait - (G.boss.t || 0))) });
  /* debuffs */
  if(m.scaredUntil > G.t) push({ id:'scared', left:left(G, m.scaredUntil) });
  if(foe?.type === 'mephite') push({ id:'choke' });
  if(foe?.type === 'gobelin' && ctx.robbable) push({ id:'robbed' });
  if(m.fleshStacks > 0 && !(G.t > m.fleshUntil)) push({ id:'flesh', stacks:m.fleshStacks, left:left(G, m.fleshUntil) });
  if(G.boss && G.boss.hp > 0 && G.boss.focus != null && G.boss.focus === m.id && G.boss.engaged !== false) push({ id:'boss_focus' });
  if(ctx.dark) push({ id:'dark' });
  /* Instance II, le Golbute (30/10/2026) : Sonné (stacks de l'avalanche) et Mort */
  if(m.dead) push({ id:'dead' });
  else if(m.dazed > 0 && G.t <= (m.dazedUntil ?? 0) + 1e-9) push({ id:'dazed', stacks:m.dazed, left:left(G, m.dazedUntil) });
  /* buffs */
  if(ctx.warcry && G.t < ctx.warcry.until) push({ id:'war_cry', left:left(G, ctx.warcry.until) });
  if(G.inspire && G.t < G.inspire.until) push({ id:'inspiration', left:left(G, G.inspire.until) });
  if(m.skill?.ore_rush && G.t < (m.rushUntil ?? -1)) push({ id:'ore_rush', left:left(G, m.rushUntil), value:m.skill.ore_rush });
  if(m.skill?.travel_rush && ctx.travelling) push({ id:'travel_rush', value:m.skill.travel_rush });
  if(m.skill?.braum && m.helping) push({ id:'braum', value:m.skill.braum });
  if(m.pillage > 0) push({ id:'pillage', stacks:Math.round(m.pillage), value:m.pillage });
  const learned = learnedOf(m);
  if(learned.total > 0) push({ id:'fast_learner', stacks:learned.count, value:r1(learned.total * 100) / 100 });
  const crown = crownOf(G, m);
  if(crown) push(crown);
  const rank = { control:0, debuff:1, buff:2 };
  return out.sort((x, y) => rank[KIND(x.id)] - rank[KIND(y.id)]);
}

/* Couronne du Roi Gobelin (29/10, Geoffrey) : buff INDIVIDUEL de son porteur. Un gobelin qui naît à goblinThrall cases
   ou moins de lui devient son asservi (src/sim/thrall.js thrallOwner : porteur dans la mine, pas à la surface). Les
   autres mineurs n'ont rien, sauf qu'ils ne frappent jamais un asservi (rangé à part dans G.thralls, pas dans G.mobs).
   Seulement là où les asservis existent (G.thralls : la mine). stacks : ses asservis au travail. */
function crownOf(G, m){
  const r = m.carac?.goblinThrall || 0;
  if(r <= 0 || m.y <= 0 || !Array.isArray(G.thralls)) return null;
  return { id:'crown', value:r, stacks:G.thralls.filter(o => o.owner === m.id).length };
}

/* Fast learner : dans la mine, un bonus par type de bloc (m.learned = { bloc: bonus }) ; dans les tours et
   l'instance, un seul nombre (m.learned) */
function learnedOf(m){
  const l = m.learned;
  if(typeof l === 'number') return { total:l, count:l > 0 ? Math.round(l / (SPELL.fast_learner?.bonus || 0.1)) : 0 };
  const v = Object.values(l || {}).filter(x => x > 0);
  return { total:v.reduce((s, x) => s + x, 0), count:v.length };
}

/* bonus permanents de la session : anneaux du groupe (m.rings, figés au lancement), shrines du chef (G.shrines),
   Escalateur (G.winchBoost). Ancien (28/10) : la Couronne du Roi Gobelin y était ; c'est un buff du porteur depuis le
   29/10 (crownOf) */
export function sessionBonuses(G, m){
  const out = [];
  for(const r of m.rings || []) out.push({ id:'ring', src:r.item, value:r.plus || 0 });
  for(const id of G.shrines || []) out.push({ id:'shrine', src:id });
  if(G.winchBoost > 0) out.push({ id:'escalator', value:G.winchBoost });
  return out;
}

/* anneaux d'un mineur pour l'affichage (spec venue du lancement, revérifiée) : [{ item, plus }] */
export const cleanRings = raw => (Array.isArray(raw) ? raw : [])
  .filter(r => r && typeof r.item === 'string' && RINGS.items[r.item])
  .map(r => ({ item:r.item, plus:Number.isInteger(r.plus) && r.plus > 0 ? Math.min(r.plus, 9) : 0 }));

/* états d'un mob (au-dessus de sa barre de PV) */
export function mobEffects(G, o){
  const out = [];
  if(o.stunUntil != null && G.t < o.stunUntil) out.push('stun');
  if(o.channel) out.push('channel');
  if(o.taunt != null) out.push('taunt');
  return out;
}
