/* Boutique (05/11/2026, Geoffrey ; config SHOP, onglet src/ui/shop.js, route POST /api/game/shop) : logique pure, partagée
   par le jeu (affichage) et le serveur (qui fait foi). Un achat retire count × price de SHOP.currency et ajoute count
   exemplaires de l'objet, tout ou rien, une seule fois par opId (inv.crafted, la même mémoire que le craft). */
import { SHOP, ITEMS } from '../config.js';
import { countOf, removeItem, addItem, CRAFT_MEMORY } from './inventory.js';

export const shopItem = id => typeof id === 'string' ? SHOP.items.find(o => o.id === id) ?? null : null;
/* combien d'exemplaires de cet article les émeraudes de inv permettent d'acheter */
export const affordable = (inv, o) => o && o.price > 0 ? Math.floor(countOf(inv, SHOP.currency) / o.price) : 0;

/* achète count exemplaires de l'article id. Renvoie { ok, repeated, item, count, spent } ou { error } :
   unknown (article inconnu), bad_count (pas un entier de 1 à SHOP.maxCount), not_enough (pas assez d'émeraudes) */
export function buy(inv, { id, count = 1, opId }){
  if(inv.crafted.includes(opId)) return { ok:true, repeated:true };
  const o = shopItem(id);
  if(!o || !Object.hasOwn(ITEMS, o.item) || !Number.isSafeInteger(o.price) || o.price <= 0) return { error:'unknown' };
  if(!Number.isSafeInteger(count) || count < 1 || count > SHOP.maxCount) return { error:'bad_count' };
  const spent = o.price * count;
  if(countOf(inv, SHOP.currency) < spent || !removeItem(inv, SHOP.currency, spent)) return { error:'not_enough' };
  addItem(inv, o.item, count);
  inv.crafted.push(opId);
  if(inv.crafted.length > CRAFT_MEMORY) inv.crafted.splice(0, inv.crafted.length - CRAFT_MEMORY);
  return { ok:true, repeated:false, item:o.item, count, spent };
}
