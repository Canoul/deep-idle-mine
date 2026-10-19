/* Sauvegarde de l'inventaire global dans le navigateur (localStorage).
   La logique de l'inventaire est dans src/meta/inventory.js ; ici on ne fait que lire et écrire. */
import { createInventory, serialize, deserialize, fromLegacy } from '../meta/inventory.js';

const KEY = 'deepIdleMine.inventory';
const LEGACY_KEY = 'deepIdleMine.global';   // ancien format { nom: quantité }, repris une seule fois

export function loadInventory(){
  try {
    const raw = localStorage.getItem(KEY);
    if(raw) return deserialize(raw);
    const old = localStorage.getItem(LEGACY_KEY);
    if(old){ const inv = fromLegacy(JSON.parse(old)); saveInventory(inv); return inv; }
  } catch(e){}
  return createInventory();
}

export function saveInventory(inv){
  try { localStorage.setItem(KEY, serialize(inv)); } catch(e){}
}
