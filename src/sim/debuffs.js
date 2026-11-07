/* Debuffs posés sur un mob par les sorts de spé niveau 15 (07/11/2026, Geoffrey ; spec
   docs/superpowers/specs/2026-11-07-sorts-sp15-design.md). Module à part, sans dépendance de la simulation, pour être lu
   par actions.js, mobs.js, minotaur.js et les boss sans import circulaire.
   - Fracassé (sort Fracasse Armure) : o.shatterUntil ; le mob prend × (1 + dmgTaken) de dégâts de toutes les sources.
   - Désarmé (sort Désarmement) : o.disarmUntil ; ses recharges (coups, sorts) tournent 1 + slow fois moins vite, donc
     durent (1 + slow) fois plus longtemps. */
import { DT, SPELLS } from '../config.js';

const S = id => SPELLS.list.find(s => s.id === id);
export const shattered = (G, o) => !!o && o.shatterUntil > G.t + 1e-9;
export const disarmed  = (G, o) => !!o && o.disarmUntil > G.t + 1e-9;

/* multiplicateur des dégâts reçus par le mob o */
export const takenMul = (G, o) => shattered(G, o) ? 1 + S('shatter').dmgTaken : 1;

/* pas de temps d'une recharge du mob o (à la place de DT) */
export const mobDt = (G, o) => disarmed(G, o) ? DT / (1 + S('disarm').slow) : DT;

/* retire d (avant Fracassé) des PV du mob o ; renvoie les dégâts vraiment infligés */
export function hurt(G, o, d){
  const v = d * takenMul(G, o);
  o.hp -= v;
  return v;
}
