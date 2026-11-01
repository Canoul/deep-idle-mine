/* Coup unique sur les boss qui se minent (01/11/2026, Geoffrey ; ONE_TAP en config) : le temps de minage s'additionne, et
   chaque tranche de ONE_TAP.every secondes peut ajouter ce qu'elle a rapporté. used : secondes minées ce tick, rate : vitesse
   de minage effective, rng : tiré seulement si le mineur a la stat. Renvoie le bonus. */
import { ONE_TAP } from '../config.js';

export function oneTapBonus(m, used, rate, rng){
  const pct = m.carac.oneTap || 0;
  if(pct <= 0) return 0;
  m.tapAcc = (m.tapAcc || 0) + used;
  let bonus = 0;
  while(m.tapAcc >= ONE_TAP.every - 1e-9){
    m.tapAcc -= ONE_TAP.every;
    if(rng() * 100 < pct) bonus += rate * ONE_TAP.every;
  }
  return bonus;
}
