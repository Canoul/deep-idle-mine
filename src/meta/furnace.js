/* Fours (onglet Four) : logique pure, partagée par le jeu (affichage) et le serveur (qui fait foi).

   Un four a un MODE, choisi par le joueur :
   - smelt (Fondre)  : cases ore (minerai), fuel (combustible), out (sortie). 10 minerais + 10 charbons = 1 lingot ;
   - alloy (Alliage) : cases a et b (les deux ingrédients d'un alliage), fuel, out. Recettes dans FURNACE.alloys
     (ex. Tainted iron = 5 lingots de fer + 20 chitine + 50 charbons, 3 min).
   Chaque case contient null ou { item, qty }. since = heure (ms) où le produit en cours a commencé, null à l'arrêt.
   La fonte avance en temps réel : advance(f, now) calcule d'un coup tout ce qui a été produit depuis since, même page
   fermée. Un produit ne consomme ses ingrédients et son combustible qu'une fois fini : retirer une case pendant la
   fonte rend donc tout (le produit en cours est simplement annulé). Changer de mode : les cases d'ingrédients
   doivent être vides (le combustible et la sortie restent).

   État d'un joueur : { list:[four…], ops:[opId…] } ; ops = dernières demandes traitées (une demande
   renvoyée, double clic ou rechargement, ne s'applique qu'une fois). */
import { FURNACE, ITEMS } from '../config.js';
import { addItem, removeItem, countOf } from './inventory.js';

export const MODES = ['smelt', 'alloy'];
/* cases d'ingrédients de chaque mode (le combustible et la sortie sont communs) */
export const INPUTS = { smelt:['ore'], alloy:['a', 'b'] };
export const SLOTS = ['ore', 'a', 'b', 'fuel'];          // cases où l'on peut poser quelque chose
const ALL = [...SLOTS, 'out'];
const validQty = q => Number.isSafeInteger(q) && q > 0;
const modeOf = f => MODES.includes(f.mode) ? f.mode : 'smelt';

/* ce qu'on peut poser dans chaque case */
export const recipeOf = item => (ITEMS[item]?.cat === 'ore' && Object.hasOwn(FURNACE.recipes, item)) ? FURNACE.recipes[item] : null;
export const isFuel   = item => ITEMS[item]?.cat === 'combustible';
/* ingrédient d'au moins un alliage */
export const isAlloyInput = item => FURNACE.alloys.some(r => Object.hasOwn(r.in, item));
export function accepts(slot, item, mode = 'smelt'){
  if(slot === 'fuel') return isFuel(item);
  if(slot === 'ore') return mode === 'smelt' && !!recipeOf(item);
  if(slot === 'a' || slot === 'b') return mode === 'alloy' && isAlloyInput(item);
  return false;
}
/* alliage qui utilise exactement ces deux ingrédients (dans n'importe quel ordre), ou null */
export const alloyOf = (i1, i2) => i1 && i2 && i1 !== i2
  ? FURNACE.alloys.find(r => Object.keys(r.in).length === 2 && Object.hasOwn(r.in, i1) && Object.hasOwn(r.in, i2)) ?? null : null;
/* alliages possibles avec cet ingrédient (pour savoir quoi poser dans l'autre case) */
export const alloysWith = item => FURNACE.alloys.filter(r => Object.hasOwn(r.in, item));

export const newFurnace = () => ({ tier:0, mode:'smelt', ore:null, a:null, b:null, fuel:null, out:null, since:null });
export function createFurnaces(){
  return { list: Array.from({ length: FURNACE.startOwned }, newFurnace), ops: [] };
}

/* ce que fabrique le four avec ce qu'il contient : { out, time (s), need:{ case: quantité par produit } } ou null */
export function activeRecipe(f){
  if(modeOf(f) === 'smelt'){
    const r = f.ore && recipeOf(f.ore.item);
    return r ? { out:r.out, time:r.time, need:{ ore:FURNACE.orePerIngot, fuel:FURNACE.fuelPerIngot } } : null;
  }
  const r = alloyOf(f.a?.item, f.b?.item);
  return r ? { out:r.out, time:r.time, need:{ a:r.in[f.a.item], b:r.in[f.b.item], fuel:r.fuel } } : null;
}

/* durée d'un produit (ms) dans ce four, ou null s'il n'a rien à fabriquer */
export function ingotMs(f){
  const r = activeRecipe(f);
  return r ? r.time * 1000 / (FURNACE.tiers[f.tier]?.speed || 1) : null;
}

/* produits possibles avec ce qu'il y a dans les cases (sans compter la sortie) */
export function batches(f){
  const r = activeRecipe(f);
  if(!r) return 0;
  return Math.min(...Object.entries(r.need).map(([slot, n]) => f[slot] ? Math.floor(f[slot].qty / n) : 0));
}

/* le four peut-il produire une unité de plus ? (assez d'ingrédients et de combustible, sortie compatible) */
export function canRun(f){
  const r = activeRecipe(f);
  return !!r && batches(f) >= 1 && (!f.out || (f.out.item === r.out && Number.isSafeInteger(f.out.qty + 1)));
}

/* (re)met le four en marche s'il peut produire, l'arrête sinon */
function kick(f, now){
  if(!canRun(f)) f.since = null;
  else if(f.since === null) f.since = now;
}

const take = (f, slot, n) => { f[slot].qty -= n; if(!f[slot].qty) f[slot] = null; };

/* avance la fonte jusqu'à now : ajoute les produits finis, consomme leurs ingrédients et leur combustible */
export function advance(f, now){
  if(f.since === null) return f;
  const dur = ingotMs(f);
  if(!dur || !canRun(f)){ f.since = null; return f; }
  const r = activeRecipe(f);
  const n = Math.max(0, Math.min(Math.floor((now - f.since) / dur), batches(f)));
  if(n > 0){
    for(const [slot, k] of Object.entries(r.need)) take(f, slot, n * k);
    f.out = { item: r.out, qty: (f.out?.qty || 0) + n };
    f.since += n * dur;
  }
  if(!canRun(f)) f.since = null;
  return f;
}

/* avancée du produit en cours, de 0 à 1 (0 si le four est à l'arrêt) */
export function progress(f, now){
  const dur = ingotMs(f);
  return f.since === null || !dur ? 0 : Math.min(1, Math.max(0, (now - f.since) / dur));
}

/* ---------- actions du joueur ----------
   op = { action:'load'|'unload'|'collect'|'mode', furnace, slot, item, qty, mode, opId }.
   Modifie inv et state ensemble (tout ou rien). Renvoie { ok:true, repeated } ou { error } (code d'erreur). */
export function furnaceOp(state, inv, op, now){
  if(state.ops.includes(op.opId)) return { ok:true, repeated:true };
  const f = Number.isSafeInteger(op.furnace) ? state.list[op.furnace] : null;
  if(!f) return { error:'bad_furnace' };
  advance(f, now);
  let r;
  if(op.action === 'load') r = load(f, inv, op);
  else if(op.action === 'unload') r = unload(f, inv, op.slot);
  else if(op.action === 'collect') r = unload(f, inv, 'out');
  else if(op.action === 'mode') r = setMode(f, op.mode);
  else r = { error:'bad_request' };
  if(r.error) return r;
  kick(f, now);
  state.ops.push(op.opId);
  if(state.ops.length > FURNACE.opMemory) state.ops.splice(0, state.ops.length - FURNACE.opMemory);
  return { ok:true, repeated:false };
}

/* poser qty exemplaires d'item dans une case : une seule sorte d'objet par case ; en alliage, les deux ingrédients
   doivent former une recette */
function load(f, inv, { slot, item, qty }){
  if(!SLOTS.includes(slot)) return { error:'bad_slot' };
  const mode = modeOf(f);
  if(slot !== 'fuel' && !INPUTS[mode].includes(slot)) return { error:'bad_slot' };
  if(typeof item !== 'string' || !accepts(slot, item, mode)) return { error:'bad_item' };
  if(!validQty(qty)) return { error:'bad_qty' };
  if(f[slot] && f[slot].item !== item) return { error:'slot_busy' };
  if(mode === 'alloy'){
    const other = f[slot === 'a' ? 'b' : 'a'];
    if(slot !== 'fuel' && other && !alloyOf(item, other.item)) return { error:'no_recipe' };
  }
  if(f[slot] && !Number.isSafeInteger(f[slot].qty + qty)) return { error:'bad_qty' };
  if(countOf(inv, item) < qty || !removeItem(inv, item, qty)) return { error:'not_enough' };
  f[slot] = { item, qty: (f[slot]?.qty || 0) + qty };
  return { ok:true };
}

/* vider une case dans l'inventaire (ore, a, b, fuel, ou out pour récupérer les produits) ; case vide : rien à faire */
function unload(f, inv, slot){
  if(!ALL.includes(slot)) return { error:'bad_slot' };
  const c = f[slot];
  if(!c) return { ok:true };
  if(!addItem(inv, c.item, c.qty).length) return { error:'inventory_full' };   // pile qui dépasserait : rien ne bouge
  f[slot] = null;
  return { ok:true };
}

/* changer de mode : seulement si les cases d'ingrédients sont vides (rien ne disparaît, rien ne change de rôle) */
function setMode(f, mode){
  if(!MODES.includes(mode)) return { error:'bad_mode' };
  if(modeOf(f) === mode) return { ok:true };
  if(INPUTS[modeOf(f)].some(s => f[s])) return { error:'not_empty' };
  f.mode = mode;
  return { ok:true };
}

/* ---------- relecture du stockage ----------
   L'état vient du serveur, mais il est revérifié à chaque lecture : case invalide → vide, nombre de fours borné.
   Un four enregistré avant les modes (sans mode) est un four « Fondre ». */
function cleanSlot(c, ok){
  return c && typeof c.item === 'string' && validQty(c.qty) && ok(c.item) ? { item:c.item, qty:c.qty } : null;
}
export function sanitizeFurnaces(raw){
  const st = createFurnaces();
  if(!raw || !Array.isArray(raw.list)) return st;
  const list = raw.list.slice(0, FURNACE.max).map(r => {
    const f = newFurnace();
    if(!r || typeof r !== 'object') return f;
    f.tier = Number.isSafeInteger(r.tier) && FURNACE.tiers[r.tier] ? r.tier : 0;
    f.mode = MODES.includes(r.mode) ? r.mode : 'smelt';
    for(const s of INPUTS[f.mode]) f[s] = cleanSlot(r[s], i => accepts(s, i, f.mode));
    f.fuel = cleanSlot(r.fuel, i => accepts('fuel', i));
    f.out  = cleanSlot(r.out,  i => ITEMS[i]?.cat === 'ingot');
    f.since = Number.isFinite(r.since) && canRun(f) ? r.since : null;
    return f;
  });
  while(list.length < FURNACE.startOwned) list.push(newFurnace());
  st.list = list;
  st.ops = Array.isArray(raw.ops) ? raw.ops.filter(o => typeof o === 'string').slice(-FURNACE.opMemory) : [];
  return st;
}
