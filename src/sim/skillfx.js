/* Effets des skills des arbres v2 (04/11/2026, Geoffrey) qui dépendent de la partie, partagés par toutes les simulations
   (mine, prison, instances, tours, He's coming). Les skills de stats fixes (Pioche ensorcelée, Filou, Organisé,
   Dématérialisation, Cloué au sol, Mineur tout terrain, auras) sont déjà dans m.carac (src/meta/skills.js withSkillStats).
   m.skill = effets des skills (rang × per). Logique pure. */
import { SKILLS } from '../config.js';
import { NODES } from '../meta/skills.js';

const rank = (m, id) => Math.round((m?.skill?.[id] || 0) / NODES[id].per);

/* Crushing : un coup critique fait × 2 × (1 + rang × 10 %) au lieu de × 2 */
export const critMul = m => 2 * (1 + (m?.skill?.crushing || 0));

/* Dans le dos : dégâts × (1 + rang × 5 %) quand aucun ennemi ne le vise (targeted : un mob le tacle ou un boss l'a pour
   cible, à dire par chaque simulation) */
export const backstabMul = (m, targeted) => targeted ? 1 : 1 + (m?.skill?.backstab || 0);

/* Reposé : après une remontée à la surface, une fois redescendu au front (fin de la descente depuis la surface, mode
   'departure'), bonus pendant SKILLS.rested.time s (prisonTime en prison). Appelé à chaque pas du mineur (src/sim/session.js) ;
   m.restedNow dit si le bonus est actif (lu sans G : ténacité, minage, marche, dégâts) */
export function trackRested(G, m){
  if(!m.skill?.rested) return;
  if(m.restedMode === 'departure' && m.mode !== 'departure' && (m.stats?.trips || 0) > 0)
    m.restedUntil = G.t + (G.prison ? SKILLS.rested.prisonTime : SKILLS.rested.time);
  m.restedMode = m.mode;
  m.restedNow = G.t < (m.restedUntil ?? -Infinity);
}
/* multiplicateur de Reposé (minage, marche, montée, dégâts) : 1 hors bonus */
export const restedMul = m => m?.restedNow ? 1 + (m.skill.rested || 0) : 1;

/* points de ténacité brute ajoutés pendant la partie : Reposé (bonus actif) et Solide sur les appuis (contre les mécaniques
   de boss, SKILLS.steady.sources ; src = clé de TENACITY.pen) */
export function tenacityBonus(m, src = null){
  let t = 0;
  if(m?.restedNow && m.skill?.rested) t += rank(m, 'rested') * SKILLS.rested.tenacity;
  if(m?.skill?.steady && src && SKILLS.steady.sources.includes(src)) t += SKILLS.steady.tenacity;
  return t;
}
