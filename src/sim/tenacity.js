/* Ténacité effective (02/11/2026, Geoffrey ; TENACITY en config) : rendement décroissant, k × ln(1 + brute / k),
   plafonnée à TENACITY.max. Toutes les mécaniques de mob qui lisent la ténacité passent par ici (mine, tours, Bloc géant,
   instances). Logique pure, partagée avec l'affichage (onglet Stuff, wiki). */
import { tenacityBonus } from './skillfx.js';
import { TENACITY } from '../config.js';

export function effectiveTenacity(raw){
  const t = Number(raw) || 0;
  if(t <= 0) return 0;
  return Math.min(TENACITY.max, TENACITY.k * Math.log1p(t / TENACITY.k));
}
/* ténacité effective d'un mineur face à une mécanique src (clé de TENACITY.pen) : sa ténacité brute moins la
   pénétration de la source (02/11), puis la courbe */
export const penOf = src => (src && TENACITY.pen?.[src]) || 0;
/* extra : points de ténacité brute retirés en plus (malus de la Division du Golbute, 03/11) */
/* + Reposé et Solide sur les appuis (arbres v2, 04/11 : src/sim/skillfx.js tenacityBonus) */
export const tenacityOf = (m, src = null, extra = 0) => effectiveTenacity((Number(m?.carac?.tenacity) || 0) + tenacityBonus(m, src) - penOf(src) - extra);

/* Fatigue (03/11/2026, Geoffrey ; TENACITY.tired) : après une esquive (m.tenTired), la chance de la mécanique suivante est
   × (1 − tired × (1 − résilience)) ; résilience = m.carac.tenacityResilience (%, 0 de base) */
export function tenacityChance(m, src = null, extra = 0){
  const t = tenacityOf(m, src, extra);
  if(!m?.tenTired || t <= 0) return t;
  const res = Math.min(100, Math.max(0, Number(m.carac?.tenacityResilience) || 0)) / 100;
  return t * (1 - TENACITY.tired * (1 - res));
}
/* une mécanique : la ténacité l'esquive-t-elle ? draw() = tirage dans [0, 1[ (hasard de la partie), appelé seulement si
   la chance est au-dessus de 0 (sans ténacité, le hasard ne change pas) ; la fatigue retombe après cette mécanique et
   revient si elle est esquivée */
export function tenacityTry(m, src, draw, extra = 0){
  const t = tenacityChance(m, src, extra);
  m.tenTired = false;
  if(!(t > 0) || !(draw() * 100 < t)) return false;
  m.tenTired = true;
  return true;
}
