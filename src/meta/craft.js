/* Craft (onglet Craft) : logique pure, partagée par le jeu (affichage) et le serveur (qui fait foi).
   Une recette (src/recipes.js) consomme ses ingrédients et donne un objet. Tout ou rien : si un seul ingrédient
   manque, rien n'est retiré. opId rend la demande rejouable sans effet (double clic, requête renvoyée). */
import { RECIPES } from '../recipes.js';
import { countOf, removeItem, addItem, CRAFT_MEMORY } from './inventory.js';

export const recipeOf = item => (typeof item === 'string' && Object.hasOwn(RECIPES, item)) ? RECIPES[item] : null;
/* débloquée de base (unlock null) ; les recettes à blueprint viendront plus tard */
export const isUnlocked = r => !!r && r.unlock === null;
export const craftable = () => Object.keys(RECIPES).filter(n => isUnlocked(RECIPES[n]));

/* ingrédients de la recette avec ce que le joueur possède : [{ item, need, have }] */
export function needs(inv, item){
  const r = recipeOf(item);
  return r ? Object.entries(r.cost).map(([k, need]) => ({ item:k, need, have:countOf(inv, k) })) : [];
}
export const canCraft = (inv, item) => isUnlocked(recipeOf(item)) && needs(inv, item).every(n => n.have >= n.need);

/* fabrique item : renvoie { ok, repeated } ou { error } (unknown, locked, not_enough) */
export function craft(inv, item, opId){
  if(inv.crafted.includes(opId)) return { ok:true, repeated:true };
  const r = recipeOf(item);
  if(!r) return { error:'unknown' };
  if(!isUnlocked(r)) return { error:'locked' };
  if(!canCraft(inv, item)) return { error:'not_enough' };
  for(const [k, n] of Object.entries(r.cost)) removeItem(inv, k, n);   // tout est là : vérifié juste avant
  addItem(inv, item, r.qty);
  inv.crafted.push(opId);
  if(inv.crafted.length > CRAFT_MEMORY) inv.crafted.splice(0, inv.crafted.length - CRAFT_MEMORY);
  return { ok:true, repeated:false };
}
