/* Craft (onglet Craft) : logique pure, partagée par le jeu (affichage) et le serveur (qui fait foi).
   Une recette (src/recipes.js) consomme ses ingrédients et donne un objet. Tout ou rien : si un seul ingrédient
   manque, rien n'est retiré. opId rend la demande rejouable sans effet (double clic, requête renvoyée).

   Déblocage : une recette avec `unlock` (un blueprint) n'est disponible qu'une fois le blueprint « utilisé » depuis
   l'inventaire. Le blueprint est consommé et le nom de la recette rejoint inv.unlocked : débloquée pour toujours.
   Les deux changent ensemble (même inventaire, une seule écriture) : rien ne se perd, rien ne se duplique. */
import { RECIPES } from '../recipes.js';
import { RECYCLE, STUFF, FURNACE } from '../config.js';
import { furnaceRecipeName } from './furnace.js';
import { countOf, removeItem, addItem, takePiece, CRAFT_MEMORY } from './inventory.js';
import { isStuff } from './piece.js';

export const recipeOf = item => (typeof item === 'string' && Object.hasOwn(RECIPES, item)) ? RECIPES[item] : null;
/* recette disponible pour ce joueur : de base (unlock null), ou débloquée par son blueprint */
/* recettes de fonte fermées (FURNACE.recipes[…].unlock, 27/10) : objet qui la débloque → nom gardé dans inv.unlocked */
const FURNACE_BY_ITEM = Object.fromEntries(Object.entries(FURNACE.recipes).filter(([, r]) => r.unlock).map(([i, r]) => [r.unlock, furnaceRecipeName(i)]));
const FURNACE_NAMES = new Set(Object.values(FURNACE_BY_ITEM));
export const isUnlocked = (item, inv) => {
  if(FURNACE_NAMES.has(item)) return !!inv?.unlocked?.includes(item);   // recette du four (« Four : Chitine »)
  const r = recipeOf(item); return !!r && (r.unlock === null || !!inv?.unlocked?.includes(item)); };
/* recettes disponibles (onglet Craft). Celles à blueprint restent secrètes tant qu'il n'est pas utilisé : jamais listées. */
export const craftable = inv => Object.keys(RECIPES).filter(n => isUnlocked(n, inv));

/* recette débloquée par ce blueprint (null s'il ne débloque rien pour l'instant : Four en fer BP, Boussole en or BP…) */
export const recipeOfBlueprint = bp => typeof bp === 'string'
  ? Object.keys(RECIPES).find(n => RECIPES[n].unlock === bp) ?? (Object.hasOwn(FURNACE_BY_ITEM, bp) ? FURNACE_BY_ITEM[bp] : null) : null;   // ou une recette du four (Recette : Chitine)
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

/* exemplaires d'une pièce de stuff dans l'inventaire, le plus simple d'abord (ni qualité, ni niveau, ni rune) : une recette
   qui consomme une pièce (Casque en thorium ← Casque en mithril, 27/10/2026) prend celle qui vaut le moins */
const worth = p => (p.q ? 1 : 0) + (p.plus | 0) + (p.rune ? 1 : 0) + (p.lines?.length ? 1 : 0);
export const plainestFirst = (inv, item) => inv.slots.filter(s => s && s.item === item && s.uid != null).sort((a, b) => worth(a) - worth(b) || a.uid - b.uid);

/* fabrique item : renvoie { ok, repeated } ou { error } (unknown, locked, not_enough) */
export function craft(inv, item, opId){
  if(inv.crafted.includes(opId)) return { ok:true, repeated:true };
  const r = recipeOf(item);
  if(!r) return { error:'unknown' };
  if(!isUnlocked(item, inv)) return { error:'locked' };
  if(!canCraft(inv, item)) return { error:'not_enough' };
  for(const [k, n] of Object.entries(r.cost)){                       // tout est là : vérifié juste avant
    if(isStuff(k)) for(const p of plainestFirst(inv, k).slice(0, n)) takePiece(inv, p.uid);
    else removeItem(inv, k, n);
  }
  addItem(inv, item, r.qty);
  remember(inv, opId);
  return { ok:true, repeated:false };
}

/* ---------- recycler (25/10/2026) ----------
   Une pièce de stuff fabriquée est détruite et rend RECYCLE.share de sa recette, arrondi vers le bas. Une pièce sans
   recette mais avec un `recycle` dans STUFF.items (butin des mobs, 26/10/2026) rend ces quantités fixes. */
const fixedRefund = item => Object.hasOwn(STUFF.items, item) ? STUFF.items[item].recycle ?? null : null;

/* l'objet se recycle-t-il ? du stuff qui a une recette de craft, ou des quantités fixes (pas un objet du four, ni un
   anneau, ni une rune) */
export const recyclable = item => isStuff(item) && (!!recipeOf(item) || !!fixedRefund(item));
/* ce que rend le recyclage de cet objet : { ingrédient: quantité } (les ingrédients qui rendraient 0 sont absents) */
export function recycleRefund(item){
  if(!recyclable(item)) return {};
  const r = recipeOf(item);
  if(!r) return { ...fixedRefund(item) };
  /* + 1e-9 : un produit juste à l'entier (ex. 90 × 0,7 = 62,999… en virgule flottante) ne perd pas une unité */
  return Object.fromEntries(Object.entries(r.cost).map(([k, n]) => [k, Math.floor(n * RECYCLE.share / r.qty + 1e-9)]).filter(([, n]) => n > 0));
}

/* recycle la pièce uid de l'inventaire. locked(uid) : vrai si elle est enregistrée dans un set (refusé). La pièce n'existe
   qu'une fois : une demande renvoyée la trouve déjà détruite (not_owned), rien n'est rendu deux fois.
   Renvoie { ok, item, refund } ou { error } (bad_request, not_owned, not_recyclable, in_set). */
export function recycleStuff(inv, uid, locked = () => false){
  if(!Number.isSafeInteger(uid)) return { error:'bad_request' };
  const s = inv.slots.find(x => x && x.uid === uid);
  if(!s) return { error:'not_owned' };
  if(!recyclable(s.item)) return { error:'not_recyclable' };
  if(locked(uid)) return { error:'in_set' };
  const refund = recycleRefund(s.item);
  takePiece(inv, uid);
  for(const [k, n] of Object.entries(refund)) addItem(inv, k, n);
  return { ok:true, item:s.item, refund };
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
