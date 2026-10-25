/* Inventaire global (hors session) : une grille de slots, logique pure (aucun accès au DOM ni au stockage).

   Règles (GAME_DESIGN §6) :
   - un slot = un objet : { item:'Charbon', qty:100 } ;
   - un objet empilable déjà présent s'ajoute à sa pile (pas de maximum) ;
   - un objet absent prend le premier slot libre (ordre d'arrivée : un objet garde sa place) ;
   - un objet non empilable (stuff) prend un slot par exemplaire : { item, qty:1, uid } ; une pièce identifiée ou
     améliorée porte aussi q, lines, plus (src/meta/piece.js) ;
   - capacité illimitée pour l'instant.
   Un slot vidé (objet consommé) devient null : le trou est réutilisé par le prochain nouvel objet. */
import { ITEMS, INVENTORY, RESEARCH, UPGRADE } from '../config.js';
import { RECIPES } from '../recipes.js';
import { sanitizePiece } from './piece.js';
import { rarityDef } from './rarity.js';

export const SAVE_VERSION = 1;

export const itemDef = item => ITEMS[item] || null;
export const isStackable = item => (ITEMS[item]?.stack ?? true);

/* credited : ids des dernières sessions déjà versées (anti-duplication : un coffre n'est crédité qu'une fois) */
export const CREDIT_MEMORY = 200;
/* opened : dernières ouvertures de Treasure TX { id, item, loot } (anti-duplication : une requête renvoyée
   retrouve son butin au lieu d'ouvrir un second treasure) */
export const OPEN_MEMORY = 50;
/* crafted : ids des dernières demandes de craft et de blueprints utilisés (une demande renvoyée ne fabrique pas un
   second objet, ne consomme pas un second blueprint) */
export const CRAFT_MEMORY = 50;
/* unlocked : recettes débloquées par un blueprint (src/meta/craft.js), pour toujours */
/* research : dernières recherches / recyclages de la table de recherche (src/meta/research.js) */
/* upgrades : dernières identifications / améliorations { id, kind, uid, success? } (src/meta/upgrade.js) : une demande
   renvoyée retrouve son résultat au lieu de tirer une seconde fois */
export function createInventory(){ return { slots:[], nextUid:1, credited:[], opened:[], crafted:[], unlocked:[], research:[], upgrades:[] }; }

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

/* une pièce sans sa quantité : { item, uid, q?, lines?, plus? } */
const pieceOf = ({ qty, ...p }) => p;

/* sort une pièce de stuff (par son uid) de l'inventaire ; renvoie { item, uid, q?, lines?, plus? } ou null */
export function takePiece(inv, uid){
  const i = inv.slots.findIndex(s => s && !isStackable(s.item) && s.uid === uid);
  if(i < 0) return null;
  const piece = pieceOf(inv.slots[i]);
  inv.slots[i] = null;
  while(inv.slots.length && inv.slots[inv.slots.length-1] === null) inv.slots.pop();
  return piece;
}

/* remet une pièce de stuff existante (elle garde son uid, sa qualité, ses lignes et son niveau : ce n'est pas un
   nouvel objet) ; renvoie son slot */
export function putPiece(inv, piece){
  const i = freeSlot(inv);
  inv.slots[i] = { ...pieceOf(piece), qty:1 };
  if(inv.nextUid <= piece.uid) inv.nextUid = piece.uid + 1;
  return i;
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

/* ---------- ranger (bouton « Trier », glisser un objet ; 25/10/2026) ----------
   Ni l'un ni l'autre ne crée ni ne retire rien : les slots sont seulement remis dans un autre ordre. */

const CATALOG = new Map(Object.keys(ITEMS).map((n, i) => [n, i]));
const GROUP = new Map(INVENTORY.sortGroups.flatMap((g, i) => g.cats.map(c => [c, i])));
/* clé de tri : type (INVENTORY.sortGroups, les autres après), rareté du catalogue (la plus rare d'abord), ordre du catalogue */
const sortKey = s => [GROUP.get(ITEMS[s.item]?.cat) ?? INVENTORY.sortGroups.length, -rarityDef(s.item).rank, CATALOG.get(s.item) ?? Infinity];

/* trie l'inventaire et le tasse au début (plus de trous) ; à égalité (deux pièces du même objet), l'ordre actuel est
   gardé. Rejouer le tri ne change rien. */
export function sortInventory(inv){
  const keyed = inv.slots.filter(Boolean).map((s, i) => ({ s, k:[...sortKey(s), i] }));
  keyed.sort((a, b) => { for(let j=0; j<a.k.length; j++) if(a.k[j] !== b.k[j]) return a.k[j] - b.k[j]; return 0; });
  inv.slots = keyed.map(x => x.s);
}

/* déplace l'objet du slot from vers le slot to (une case de la grille affichée) ; un objet déjà en to prend la place
   de from (échange). item (et uid pour une pièce) : ce que le joueur croit déplacer ; si ce n'est plus ce qui est en
   from (requête renvoyée après coup, inventaire changé entre-temps), rien ne bouge : un double envoi ne ré-échange pas.
   Renvoie { ok, slots:[from, to] } ou { error } (bad_request, not_owned). */
export function moveSlot(inv, { from, to, item, uid } = {}){
  const max = gridSize(inv, INVENTORY.cols, INVENTORY.minSlots);
  if(!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to < 0 || from >= max || to >= max || typeof item !== 'string')
    return { error:'bad_request' };
  const s = inv.slots[from];
  if(!s || s.item !== item || (s.uid ?? null) !== (uid ?? null)) return { error:'not_owned' };
  if(from === to) return { ok:true, slots:[from, to] };
  while(inv.slots.length <= to) inv.slots.push(null);
  inv.slots[from] = inv.slots[to] ?? null;
  inv.slots[to] = s;
  while(inv.slots.length && inv.slots[inv.slots.length-1] === null) inv.slots.pop();
  return { ok:true, slots:[from, to] };
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
export const serialize = inv => JSON.stringify({ v:SAVE_VERSION, slots:inv.slots, nextUid:inv.nextUid, credited:inv.credited, opened:inv.opened, crafted:inv.crafted, unlocked:inv.unlocked, research:inv.research, upgrades:inv.upgrades });

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
    const p = sanitizePiece(s);              // qualité, lignes et niveau revérifiés (src/meta/piece.js)
    if(!p || uids.has(p.uid)) return null;
    uids.add(p.uid);
    return { ...p, qty:1 };
  });
  while(inv.slots.length && inv.slots[inv.slots.length-1] === null) inv.slots.pop();
  inv.nextUid = Math.max(Number.isSafeInteger(d.nextUid) ? d.nextUid : 1, 1, ...[...uids].map(u => u + 1));
  inv.credited = Array.isArray(d.credited) ? d.credited.filter(x => typeof x === 'string').slice(-CREDIT_MEMORY) : [];
  inv.opened = Array.isArray(d.opened)
    ? d.opened.filter(o => o && typeof o.id === 'string' && typeof o.item === 'string' && validBag(o.loot))
        .map(o => ({ id:o.id, item:o.item, loot:{ ...o.loot }, ...(Number.isSafeInteger(o.count) && o.count > 0 ? { count:o.count } : {}) })).slice(-OPEN_MEMORY)
    : [];
  inv.crafted = Array.isArray(d.crafted) ? d.crafted.filter(x => typeof x === 'string').slice(-CRAFT_MEMORY) : [];
  /* recettes débloquées : seulement des recettes à blueprint existantes, chacune une fois */
  inv.unlocked = Array.isArray(d.unlocked)
    ? [...new Set(d.unlocked.filter(n => typeof n === 'string' && Object.hasOwn(RECIPES, n) && RECIPES[n].unlock))] : [];
  inv.research = Array.isArray(d.research) ? d.research.filter(e => e && typeof e.id === 'string' && typeof e.kind === 'string'
      && e.result && typeof e.result.item === 'string' && (e.result.parts === undefined || Number.isSafeInteger(e.result.parts)))
    .map(e => ({ id:e.id, kind:e.kind, result:{ ...e.result, ok:true } })).slice(-RESEARCH.opMemory) : [];
  inv.upgrades = Array.isArray(d.upgrades) ? d.upgrades.filter(e => e && typeof e.id === 'string' && typeof e.kind === 'string' && Number.isSafeInteger(e.uid))
    .map(e => ({ id:e.id, kind:e.kind, uid:e.uid, ...(typeof e.success === 'boolean' ? { success:e.success } : {}),
                 ...(Number.isSafeInteger(e.fragment) ? { fragment:e.fragment } : {}) })).slice(-UPGRADE.opMemory) : [];
  return inv;
}

/* ancien format (avant la grille) : { nom: quantité } */
export function fromLegacy(obj){
  const inv = createInventory();
  addAll(inv, obj);
  return inv;
}
