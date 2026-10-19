/* Inventaire global (hors session) : une grille de slots, logique pure (aucun accès au DOM ni au stockage).

   Règles (GAME_DESIGN §6) :
   - un slot = un objet : { item:'Charbon', qty:100 } ;
   - un objet empilable déjà présent s'ajoute à sa pile (pas de maximum) ;
   - un objet absent prend le premier slot libre (ordre d'arrivée : un objet garde sa place) ;
   - un objet non empilable (stuff) prend un slot par exemplaire : { item, qty:1, uid } ;
   - capacité illimitée pour l'instant.
   Un slot vidé (objet consommé) devient null : le trou est réutilisé par le prochain nouvel objet. */
import { ITEMS } from '../config.js';

export const SAVE_VERSION = 1;

export const itemDef = item => ITEMS[item] || null;
export const isStackable = item => (ITEMS[item]?.stack ?? true);

export function createInventory(){ return { slots:[], nextUid:1 }; }

function freeSlot(inv){
  const i = inv.slots.indexOf(null);
  return i >= 0 ? i : inv.slots.length;
}

/* ajoute qty exemplaires de item ; renvoie les numéros de slots touchés (pour les mettre en évidence) */
export function addItem(inv, item, qty=1){
  qty = Math.floor(qty);
  if(!item || !(qty > 0)) return [];
  if(isStackable(item)){
    let i = inv.slots.findIndex(s => s && s.item === item);
    if(i >= 0) inv.slots[i].qty += qty;
    else { i = freeSlot(inv); inv.slots[i] = { item, qty }; }
    return [i];
  }
  const touched = [];
  for(let n=0; n<qty; n++){
    const i = freeSlot(inv);
    inv.slots[i] = { item, qty:1, uid:inv.nextUid++ };
    touched.push(i);
  }
  return touched;
}

/* verse un sac { nom: quantité } (coffre de fin de session) ; renvoie les slots touchés */
export function addAll(inv, bag){
  const touched = new Set();
  for(const k in bag||{}) for(const i of addItem(inv, k, bag[k])) touched.add(i);
  return [...touched];
}

export function countOf(inv, item){
  return inv.slots.reduce((n, s) => n + (s && s.item === item ? s.qty : 0), 0);
}

/* retire qty exemplaires (tout ou rien) ; renvoie false s'il n'y en a pas assez. Servira au craft. */
export function removeItem(inv, item, qty=1){
  if(!(qty > 0) || countOf(inv, item) < qty) return false;
  for(let i=inv.slots.length-1; i>=0 && qty>0; i--){
    const s = inv.slots[i];
    if(!s || s.item !== item) continue;
    const take = Math.min(qty, s.qty);
    s.qty -= take; qty -= take;
    if(s.qty === 0) inv.slots[i] = null;
  }
  while(inv.slots.length && inv.slots[inv.slots.length-1] === null) inv.slots.pop();
  return true;
}

export const usedSlots = inv => inv.slots.filter(Boolean).length;

/* nombre de cases à afficher : lignes complètes, au moins minSlots, et toujours au moins une case libre */
export function gridSize(inv, cols, minSlots){
  return Math.max(minSlots, Math.ceil((inv.slots.length + 1) / cols) * cols);
}

/* ---- sauvegarde ---- */
export const serialize = inv => JSON.stringify({ v:SAVE_VERSION, slots:inv.slots, nextUid:inv.nextUid });

export function deserialize(json){
  const inv = createInventory();
  let d; try { d = JSON.parse(json); } catch(e){ return inv; }
  if(!d || !Array.isArray(d.slots)) return inv;
  inv.slots = d.slots.map(s => (s && typeof s.item === 'string' && s.qty > 0) ? s : null);
  inv.nextUid = Math.max(d.nextUid|0, 1, ...inv.slots.map(s => (s?.uid|0) + 1));
  return inv;
}

/* ancien format (avant la grille) : { nom: quantité } */
export function fromLegacy(obj){
  const inv = createInventory();
  addAll(inv, obj);
  return inv;
}
