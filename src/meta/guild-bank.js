/* Banque de guilde (05/11/2026, Geoffrey ; GUILD.bank) : logique pure, partagée par le serveur (server/guild/service.js) et le
   jeu (affichage). Un inventaire par guilde : { slots:[{ item, qty }], ops:[opId…] }, rangé à chaque changement (même tri que
   l'inventaire d'un joueur). Seulement des objets empilables du catalogue, ni stuff ni rune (rien qui ait des stats propres).
   Craft de guilde : toutes les recettes empilables sauf le stuff (inBatch : ni rune, ni pièce tirée, ni pièce consommée),
   sans plan à apprendre ; le résultat reste dans la banque. */
import { ITEMS, GUILD, CRAFT } from '../config.js';
import { RECIPES } from '../recipes.js';
import { addItem, removeItem, countOf, isStackable, sortInventory } from './inventory.js';
import { isStuff } from './piece.js';
import { inBatch } from './craft.js';

export const createBank = () => ({ slots:[], ops:[] });
/* un objet qu'on peut mettre dans la banque */
export const bankable = item => typeof item === 'string' && Object.hasOwn(ITEMS, item) && isStackable(item) && !isStuff(item) && ITEMS[item].cat !== 'rune';
const validQty = n => Number.isSafeInteger(n) && n > 0;

/* relit une banque enregistrée : objets valides, piles fusionnées, rangée */
export function sanitizeBank(raw){
  const b = createBank(), totals = new Map();
  for(const s of Array.isArray(raw?.slots) ? raw.slots : []) if(s && bankable(s.item) && validQty(s.qty))
    totals.set(s.item, Math.min(Number.MAX_SAFE_INTEGER, (totals.get(s.item) ?? 0) + s.qty));
  for(const [item, qty] of totals) addItem(b, item, qty);
  sortInventory(b);
  b.ops = (Array.isArray(raw?.ops) ? raw.ops : []).filter(o => typeof o === 'string').slice(-GUILD.bank.opMemory);
  return b;
}
export const bankCount = (b, item) => countOf(b, item);
/* une demande déjà traitée (opId) ; remember la note */
export const seen = (b, opId) => b.ops.includes(opId);
export function remember(b, opId){ b.ops.push(opId); if(b.ops.length > GUILD.bank.opMemory) b.ops.splice(0, b.ops.length - GUILD.bank.opMemory); }

/* dépôt (les objets ont déjà quitté l'inventaire du joueur) ; false si l'objet ou la quantité est invalide */
export function deposit(b, item, qty){
  if(!bankable(item) || !validQty(qty) || !Number.isSafeInteger(countOf(b, item) + qty)) return false;
  addItem(b, item, qty); sortInventory(b);
  return true;
}
/* retrait pour un bâtiment (tout ou rien) */
export function take(b, item, qty){
  if(!validQty(qty) || !removeItem(b, item, qty)) return false;
  sortInventory(b);
  return true;
}

/* recettes de la banque, dans l'ordre de src/recipes.js */
export const bankRecipes = () => Object.keys(RECIPES).filter(n => !isStuff(n) && inBatch(n) && Object.keys(RECIPES[n].cost).every(bankable));
const isBankRecipe = item => typeof item === 'string' && Object.hasOwn(RECIPES, item) && bankRecipes().includes(item);
/* nombre de fois que la recette peut être faite avec la banque */
export const bankMaxCrafts = (b, item) => isBankRecipe(item)
  ? Math.min(...Object.entries(RECIPES[item].cost).map(([k, n]) => Math.floor(countOf(b, k) / n))) : 0;
/* craft de guilde : count fois la recette ; { ok } ou { error } (unknown, bad_count, not_enough) */
export function bankCraft(b, item, count = 1){
  if(!isBankRecipe(item)) return { error:'unknown' };
  if(!Number.isSafeInteger(count) || count < 1 || count > CRAFT.maxCount) return { error:'bad_count' };
  if(bankMaxCrafts(b, item) < count) return { error:'not_enough' };
  const r = RECIPES[item];
  for(const [k, n] of Object.entries(r.cost)) removeItem(b, k, n * count);
  addItem(b, item, r.qty * count); sortInventory(b);
  return { ok:true, made:r.qty * count };
}
