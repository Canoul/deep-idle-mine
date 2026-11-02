/* Ténacité effective (02/11/2026, Geoffrey ; TENACITY en config) : rendement décroissant, k × ln(1 + brute / k),
   plafonnée à TENACITY.max. Toutes les mécaniques de mob qui lisent la ténacité passent par ici (mine, tours, Bloc géant,
   instances). Logique pure, partagée avec l'affichage (onglet Stuff, wiki). */
import { TENACITY } from '../config.js';

export function effectiveTenacity(raw){
  const t = Number(raw) || 0;
  if(t <= 0) return 0;
  return Math.min(TENACITY.max, TENACITY.k * Math.log1p(t / TENACITY.k));
}
/* ténacité effective d'un mineur (sa caractéristique brute m.carac.tenacity) */
export const tenacityOf = m => effectiveTenacity(m?.carac?.tenacity);
