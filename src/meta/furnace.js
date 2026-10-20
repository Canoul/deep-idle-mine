/* Fours (onglet Four) : logique pure, partagée par le jeu (affichage) et le serveur (qui fait foi).

   Un four = 3 cases : ore (minerai à fondre), fuel (combustible), out (lingots). Chaque case contient
   null ou { item, qty }. since = heure (ms) où le lingot en cours a commencé, null si le four est à l'arrêt.
   La fonte avance en temps réel : advance(f, now) calcule d'un coup tout ce qui a fondu depuis since,
   même page fermée. Un lingot ne consomme ses minerais et son combustible qu'une fois fini : retirer une case
   pendant la fonte rend donc tout (le lingot en cours est simplement annulé).

   État d'un joueur : { list:[four…], ops:[opId…] } ; ops = dernières demandes traitées (une demande
   renvoyée, double clic ou rechargement, ne s'applique qu'une fois). */
import { FURNACE, ITEMS } from '../config.js';
import { addItem, removeItem, countOf } from './inventory.js';

export const SLOTS = ['ore', 'fuel'];
const validQty = q => Number.isSafeInteger(q) && q > 0;

/* ce qu'on peut poser dans chaque case */
export const recipeOf = item => (ITEMS[item]?.cat === 'ore' && Object.hasOwn(FURNACE.recipes, item)) ? FURNACE.recipes[item] : null;
export const isFuel   = item => ITEMS[item]?.cat === 'combustible';
export const accepts  = (slot, item) => slot === 'ore' ? !!recipeOf(item) : slot === 'fuel' ? isFuel(item) : false;

export const newFurnace = () => ({ tier:0, ore:null, fuel:null, out:null, since:null });
export function createFurnaces(){
  return { list: Array.from({ length: FURNACE.startOwned }, newFurnace), ops: [] };
}

/* durée d'un lingot (ms) dans ce four, ou null si la case minerai ne fond pas */
export function ingotMs(f){
  const r = f.ore && recipeOf(f.ore.item);
  return r ? r.time * 1000 / (FURNACE.tiers[f.tier]?.speed || 1) : null;
}

/* le four peut-il fondre un lingot de plus ? (assez de minerai et de combustible, sortie compatible) */
export function canRun(f){
  const r = f.ore && recipeOf(f.ore.item);
  return !!r && f.ore.qty >= FURNACE.orePerIngot && !!f.fuel && f.fuel.qty >= FURNACE.fuelPerIngot
      && (!f.out || (f.out.item === r.out && Number.isSafeInteger(f.out.qty + 1)));
}

/* (re)met le four en marche s'il peut fondre, l'arrête sinon */
function kick(f, now){
  if(!canRun(f)) f.since = null;
  else if(f.since === null) f.since = now;
}

const take = (f, slot, n) => { f[slot].qty -= n; if(!f[slot].qty) f[slot] = null; };

/* avance la fonte jusqu'à now : ajoute les lingots finis, consomme leurs minerais et leur combustible */
export function advance(f, now){
  if(f.since === null) return f;
  const dur = ingotMs(f);
  if(!dur || !canRun(f)){ f.since = null; return f; }
  const n = Math.max(0, Math.min(Math.floor((now - f.since) / dur),
                                 Math.floor(f.ore.qty / FURNACE.orePerIngot), Math.floor(f.fuel.qty / FURNACE.fuelPerIngot)));
  if(n > 0){
    const out = recipeOf(f.ore.item).out;
    take(f, 'ore', n * FURNACE.orePerIngot);
    take(f, 'fuel', n * FURNACE.fuelPerIngot);
    f.out = { item: out, qty: (f.out?.qty || 0) + n };
    f.since += n * dur;
  }
  if(!canRun(f)) f.since = null;
  return f;
}

/* avancée du lingot en cours, de 0 à 1 (0 si le four est à l'arrêt) */
export function progress(f, now){
  const dur = ingotMs(f);
  return f.since === null || !dur ? 0 : Math.min(1, Math.max(0, (now - f.since) / dur));
}

/* ---------- actions du joueur ----------
   op = { action:'load'|'unload'|'collect', furnace, slot, item, qty, opId }.
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
  else r = { error:'bad_request' };
  if(r.error) return r;
  kick(f, now);
  state.ops.push(op.opId);
  if(state.ops.length > FURNACE.opMemory) state.ops.splice(0, state.ops.length - FURNACE.opMemory);
  return { ok:true, repeated:false };
}

/* poser qty exemplaires d'item dans une case : une seule sorte d'objet par case */
function load(f, inv, { slot, item, qty }){
  if(!SLOTS.includes(slot)) return { error:'bad_slot' };
  if(typeof item !== 'string' || !accepts(slot, item)) return { error:'bad_item' };
  if(!validQty(qty)) return { error:'bad_qty' };
  if(f[slot] && f[slot].item !== item) return { error:'slot_busy' };
  if(f[slot] && !Number.isSafeInteger(f[slot].qty + qty)) return { error:'bad_qty' };
  if(countOf(inv, item) < qty || !removeItem(inv, item, qty)) return { error:'not_enough' };
  f[slot] = { item, qty: (f[slot]?.qty || 0) + qty };
  return { ok:true };
}

/* vider une case dans l'inventaire (ore, fuel, ou out pour récupérer les lingots) ; case vide : rien à faire */
function unload(f, inv, slot){
  if(![...SLOTS, 'out'].includes(slot)) return { error:'bad_slot' };
  const c = f[slot];
  if(!c) return { ok:true };
  if(!addItem(inv, c.item, c.qty).length) return { error:'inventory_full' };   // pile qui dépasserait : rien ne bouge
  f[slot] = null;
  return { ok:true };
}

/* ---------- relecture du stockage ----------
   L'état vient du serveur, mais il est revérifié à chaque lecture : case invalide → vide, nombre de fours borné. */
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
    f.ore  = cleanSlot(r.ore,  i => accepts('ore', i));
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
