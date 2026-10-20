/* Craft (onglet Craft) : logique pure, partagée par le jeu (affichage) et le serveur (qui fait foi).
   Une recette (src/recipes.js) consomme ses ingrédients et donne un objet. Tout ou rien : si un seul ingrédient
   manque, rien n'est retiré. opId rend la demande rejouable sans effet (double clic, requête renvoyée).

   Déblocage : une recette avec `unlock` (un blueprint) n'est disponible qu'une fois le blueprint « utilisé » depuis
   l'inventaire. Le blueprint est consommé et le nom de la recette rejoint inv.unlocked : débloquée pour toujours.
   Les deux changent ensemble (même inventaire, une seule écriture) : rien ne se perd, rien ne se duplique. */
import { RECIPES } from '../recipes.js';
import { countOf, removeItem, addItem, CRAFT_MEMORY } from './inventory.js';

export const recipeOf = item => (typeof item === 'string' && Object.hasOwn(RECIPES, item)) ? RECIPES[item] : null;
/* recette disponible pour ce joueur : de base (unlock null), ou débloquée par son blueprint */
export const isUnlocked = (item, inv) => { const r = recipeOf(item); return !!r && (r.unlock === null || !!inv?.unlocked?.includes(item)); };
/* recettes disponibles (onglet Craft). Celles à blueprint restent secrètes tant qu'il n'est pas utilisé : jamais listées. */
export const craftable = inv => Object.keys(RECIPES).filter(n => isUnlocked(n, inv));

/* recette débloquée par ce blueprint (null s'il ne débloque rien pour l'instant : Four en fer BP, Boussole en or BP…) */
export const recipeOfBlueprint = bp => typeof bp === 'string' ? Object.keys(RECIPES).find(n => RECIPES[n].unlock === bp) ?? null : null;
/* le joueur peut-il utiliser ce blueprint ? (il en a un, il débloque une recette qu'il n'a pas encore) */
export const canLearn = (inv, bp) => { const n = recipeOfBlueprint(bp); return !!n && !isUnlocked(n, inv) && countOf(inv, bp) >= 1; };

/* ingrédients de la recette avec ce que le joueur possède : [{ item, need, have }] */
export function needs(inv, item){
  const r = recipeOf(item);
  return r ? Object.entries(r.cost).map(([k, need]) => ({ item:k, need, have:countOf(inv, k) })) : [];
}
export const canCraft = (inv, item) => isUnlocked(item, inv) && needs(inv, item).every(n => n.have >= n.need);

const remember = (inv, opId) => {
  inv.crafted.push(opId);
  if(inv.crafted.length > CRAFT_MEMORY) inv.crafted.splice(0, inv.crafted.length - CRAFT_MEMORY);
};

/* fabrique item : renvoie { ok, repeated } ou { error } (unknown, locked, not_enough) */
export function craft(inv, item, opId){
  if(inv.crafted.includes(opId)) return { ok:true, repeated:true };
  const r = recipeOf(item);
  if(!r) return { error:'unknown' };
  if(!isUnlocked(item, inv)) return { error:'locked' };
  if(!canCraft(inv, item)) return { error:'not_enough' };
  for(const [k, n] of Object.entries(r.cost)) removeItem(inv, k, n);   // tout est là : vérifié juste avant
  addItem(inv, item, r.qty);
  remember(inv, opId);
  return { ok:true, repeated:false };
}

/* utilise un blueprint : il est consommé, sa recette est débloquée. Renvoie { ok, repeated, recipe } ou { error }
   (no_use : ne débloque rien pour l'instant ; known : recette déjà débloquée, le blueprint est gardé ; not_owned) */
export function learn(inv, bp, opId){
  if(inv.crafted.includes(opId)) return { ok:true, repeated:true, recipe:recipeOfBlueprint(bp) };
  const name = recipeOfBlueprint(bp);
  if(!name) return { error:'no_use' };
  if(isUnlocked(name, inv)) return { error:'known' };
  if(!removeItem(inv, bp, 1)) return { error:'not_owned' };
  inv.unlocked.push(name);
  remember(inv, opId);
  return { ok:true, repeated:false, recipe:name };
}
