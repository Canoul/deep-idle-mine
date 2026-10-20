/* Inventaire global (hors session) : une grille de slots, logique pure (aucun accès au DOM ni au stockage).

   Règles (GAME_DESIGN §6) :
   - un slot = un objet : { item:'Charbon', qty:100 } ;
   - un objet empilable déjà présent s'ajoute à sa pile (pas de maximum) ;
   - un objet absent prend le premier slot libre (ordre d'arrivée : un objet garde sa place) ;
   - un objet non empilable (stuff) prend un slot par exemplaire : { item, qty:1, uid } ;
   - capacité illimitée pour l'instant.
   Un slot vidé (objet consommé) devient null : le trou est réutilisé par le prochain nouvel objet. */
import { ITEMS, INVENTORY } from '../config.js';

export const SAVE_VERSION = 1;

export const itemDef = item => ITEMS[item] || null;
export const isStackable = item => (ITEMS[item]?.stack ?? true);

/* credited : ids des dernières sessions déjà versées (anti-duplication : un coffre n'est crédité qu'une fois) */
export const CREDIT_MEMORY = 200;
/* opened : dernières ouvertures de Treasure TX { id, item, loot } (anti-duplication : une requête renvoyée
   retrouve son butin au lieu d'ouvrir un second treasure) */
export const OPEN_MEMORY = 50;
export function createInventory(){ return { slots:[], nextUid:1, credited:[], opened:[] }; }

/* une quantité acceptable : entier positif « sûr » (pas d'Infinity, NaN, décimale ni nombre trop grand) */
const validQty = q => Number.isSafeInteger(q) && q > 0;

function freeSlot(inv){
  const i = inv.slots.indexOf(null);
  return i >= 0 ? i : inv.slots.length;
}

/* ajoute qty exemplaires de item (quantité obligatoire : pas de valeur par défaut qui créerait un objet par erreur) ;
   renvoie les numéros de slots touchés (pour les mettre en évidence) */
export function addItem(inv, item, qty){
  if(typeof item !== 'string' || !item || !validQty(qty)) return [];
  if(isStackable(item)){
    let i = inv.slots.findIndex(s => s && s.item === item);
    if(i >= 0 && !Number.isSafeInteger(inv.slots[i].qty + qty)) return [];   // dépasserait la précision : refusé
    if(i >= 0) inv.slots[i].qty += qty;
    else { i = freeSlot(inv); inv.slots[i] = { item, qty }; }
    return [i];
  }
  if(qty > INVENTORY.maxUniqueAdd) return [];                              // quantité aberrante de stuff : refusée
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
  if(!validQty(qty) || countOf(inv, item) < qty) return false;
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

/* Verse le coffre d'une session (sa part pour ce joueur) une seule fois : un second versement de la même
   session est refusé (renvoie null). Sinon renvoie les slots touchés. */
export function creditSession(inv, sessionId, bag){
  if(!sessionId || inv.credited.includes(sessionId)) return null;
  inv.credited.push(sessionId);
  if(inv.credited.length > CREDIT_MEMORY) inv.credited.splice(0, inv.credited.length - CREDIT_MEMORY);
  return addAll(inv, bag);
}

/* ---- sauvegarde ---- */
export const serialize = inv => JSON.stringify({ v:SAVE_VERSION, slots:inv.slots, nextUid:inv.nextUid, credited:inv.credited, opened:inv.opened });

const validBag = b => b && typeof b === 'object' && !Array.isArray(b) && Object.values(b).every(validQty);

export function deserialize(json){
  const inv = createInventory();
  let d; try { d = JSON.parse(json); } catch(e){ return inv; }
  if(!d || !Array.isArray(d.slots)) return inv;
  /* slot invalide → vide ; pièce de stuff en double (même uid deux fois : duplication) → seul le premier exemplaire est gardé */
  const uids = new Set();
  inv.slots = d.slots.map(s => {
    if(!s || typeof s.item !== 'string' || !validQty(s.qty)) return null;
    if(isStackable(s.item)) return { item:s.item, qty:s.qty };
    if(!Number.isSafeInteger(s.uid) || uids.has(s.uid)) return null;
    uids.add(s.uid);
    return { ...s, qty:1 };
  });
  while(inv.slots.length && inv.slots[inv.slots.length-1] === null) inv.slots.pop();
  inv.nextUid = Math.max(Number.isSafeInteger(d.nextUid) ? d.nextUid : 1, 1, ...[...uids].map(u => u + 1));
  inv.credited = Array.isArray(d.credited) ? d.credited.filter(x => typeof x === 'string').slice(-CREDIT_MEMORY) : [];
  inv.opened = Array.isArray(d.opened)
    ? d.opened.filter(o => o && typeof o.id === 'string' && typeof o.item === 'string' && validBag(o.loot))
        .map(o => ({ id:o.id, item:o.item, loot:{ ...o.loot } })).slice(-OPEN_MEMORY)
    : [];
  return inv;
}

/* ancien format (avant la grille) : { nom: quantité } */
export function fromLegacy(obj){
  const inv = createInventory();
  addAll(inv, obj);
  return inv;
}
