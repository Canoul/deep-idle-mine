/* Sauvegarde de l'inventaire global dans le navigateur (localStorage), une par compte.
   La logique de l'inventaire est dans src/meta/inventory.js ; ici on ne fait que lire et écrire.

   Clés : deepIdleMine.inventory.<ID de compte>   inventaire d'un compte
          deepIdleMine.inventory                   inventaire sans compte (avant les comptes, ou jeu hors ligne)
          deepIdleMine.global                      très ancien format { nom: quantité }
   L'inventaire sans compte de ce navigateur est repris une seule fois, par le premier compte qui s'y connecte :
   personne ne perd ce qu'il avait miné avant l'arrivée des comptes. */
import { createInventory, serialize, deserialize, fromLegacy } from '../meta/inventory.js';

const BASE = 'deepIdleMine.inventory';
const LEGACY_KEY = 'deepIdleMine.global';

export const inventoryKey = accountId => accountId ? `${BASE}.${accountId}` : BASE;

const local = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function loadInventory(accountId = null, storage = local()){
  if(!storage) return createInventory();
  try {
    const raw = storage.getItem(inventoryKey(accountId));
    if(raw) return deserialize(raw);

    /* rien pour ce compte : reprise de l'inventaire sans compte de ce navigateur, s'il y en a un */
    const unowned = accountId ? storage.getItem(BASE) : null;
    const legacy = storage.getItem(LEGACY_KEY);
    let inv = null;
    if(unowned){ inv = deserialize(unowned); storage.removeItem(BASE); }
    else if(legacy){ inv = fromLegacy(JSON.parse(legacy)); if(accountId) storage.removeItem(LEGACY_KEY); }
    if(inv){ saveInventory(inv, accountId, storage); return inv; }
  } catch(e){}
  return createInventory();
}

export function saveInventory(inv, accountId = null, storage = local()){
  try { storage?.setItem(inventoryKey(accountId), serialize(inv)); } catch(e){}
}
