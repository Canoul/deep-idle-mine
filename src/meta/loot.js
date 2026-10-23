/* Ouverture d'un objet Treasure TX ou d'un coffre de tour (Coffre angélique R4 → une Rune R4) hors session : logique
   pure (le hasard est passé en paramètre). Un trésor de tour (RUNE.treasures) peut aussi donner un anneau (RINGS.drops).
   Le serveur fournit un hasard imprévisible : la seed ne doit pas permettre de prévoir le butin. */
import { LOOT, ITEMS, RUNE, RINGS } from '../config.js';
import { removeItem, addAll, addItem, OPEN_MEMORY } from './inventory.js';
import { rollRune } from './piece.js';

/* coffre de tour (RUNE) : { side, q } ou null */
const chestOf = item => ITEMS[item]?.chest ?? null;
export const canOpen = item => Object.hasOwn(LOOT, item) || !!chestOf(item);

const between = (min, max, rng) => min + Math.floor(rng() * (max - min + 1));

/* butin { nom: quantité } d'une table : tous les « always », puis un tirage par famille (au plus un objet chacune) */
export function rollLoot(table, rng){
  const loot = {};
  for(const a of table.always) loot[a.item] = (loot[a.item] || 0) + between(a.min, a.max, rng);
  for(const f of table.oneOf){
    const r = rng();
    let acc = 0;
    for(const i of f.items){
      acc += i.chance;
      if(r < acc){ loot[i.item] = (loot[i.item] || 0) + 1; break; }
    }
  }
  return loot;
}

/* Ouvre un exemplaire de item : le retire de l'inventaire et y verse son butin, en une fois.
   opId : identifiant de la demande ; une demande déjà traitée renvoie le même butin sans rien rouvrir.
   Renvoie { loot, repeated } ou null (objet qui ne s'ouvre pas, ou pas d'exemplaire). */
export function openTreasure(inv, item, opId, rng){
  const prev = inv.opened.find(o => o.id === opId);
  if(prev) return prev.item === item ? { loot:{ ...prev.loot }, repeated:true } : null;
  if(!canOpen(item) || !removeItem(inv, item, 1)) return null;
  let loot;
  const chest = chestOf(item);
  if(chest){                                 // coffre de tour : une rune de sa qualité, lignes tirées maintenant
    const [i] = addItem(inv, RUNE.item, 1);
    Object.assign(inv.slots[i], rollRune(chest.q, rng));
    loot = { [RUNE.item]: 1 };
    if(ITEMS[item].treasure){                // trésor de tour : au plus un anneau, tirage unique (RINGS.drops)
      const ring = rollLoot({ always:[], oneOf:[{ items: RINGS.drops[chest.side] ?? [] }] }, rng);
      addAll(inv, ring);
      Object.assign(loot, ring);
    }
  } else {
    loot = rollLoot(LOOT[item], rng);
    addAll(inv, loot);
  }
  inv.opened.push({ id:opId, item, loot:{ ...loot } });
  if(inv.opened.length > OPEN_MEMORY) inv.opened.splice(0, inv.opened.length - OPEN_MEMORY);
  return { loot, repeated:false };
}
