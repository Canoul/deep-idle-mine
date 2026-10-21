/* Rareté des objets : logique pure (RARITY en config). Commun par défaut ; RARITY.items, puis la rareté portée par
   l'objet dans le catalogue (ex. les shiny), décident des autres. */
import { RARITY, ITEMS } from '../config.js';

const BY_ID = new Map(RARITY.tiers.map((t, i) => [t.id, { ...t, rank:i }]));

/* id de la rareté de cet objet (toujours une rareté connue) */
export function rarityOf(item){
  if(typeof item !== 'string') return RARITY.default;
  const r = Object.hasOwn(RARITY.items, item) ? RARITY.items[item] : ITEMS[item]?.rarity;
  return BY_ID.has(r) ? r : RARITY.default;
}

/* { id, label, color, rank } de la rareté de cet objet (rank : 0 = commun, plus grand = plus rare) */
export const rarityDef = item => BY_ID.get(rarityOf(item));
