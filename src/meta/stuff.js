/* Stuff (onglet Stuff) : les pièces d'équipement portées par le mineur, une par case. Logique pure, partagée par
   le jeu et le serveur (qui fait foi).

   État d'un joueur : { worn: { case: { item, uid } | null }, ops:[opId…] }.
   Équiper sort la pièce de l'inventaire (et y remet celle qu'elle remplace) ; retirer l'y remet. Une pièce garde
   son uid : elle n'est jamais à deux endroits à la fois, et jamais recréée. */
import { STUFF, ITEMS } from '../config.js';
import { takePiece, putPiece } from './inventory.js';

export const SLOT_IDS = STUFF.slots.map(s => s.id);
/* case où va un objet (null si ce n'est pas une pièce d'équipement) */
export const slotOf = item => ITEMS[item]?.cat === 'stuff' ? ITEMS[item].slot ?? null : null;

export function createStuff(){ return { worn: Object.fromEntries(SLOT_IDS.map(s => [s, null])), ops: [] }; }

/* pièces de l'inventaire qui vont dans cette case */
export const piecesFor = (inv, slot) => inv.slots.filter(s => s && s.uid != null && slotOf(s.item) === slot);

/* op = { action:'equip'|'unequip', slot, uid, opId } ; modifie inv et st ensemble. Renvoie { ok, repeated } ou { error } */
export function stuffOp(inv, st, op){
  if(st.ops.includes(op.opId)) return { ok:true, repeated:true };
  if(!SLOT_IDS.includes(op.slot)) return { error:'bad_slot' };
  const cur = st.worn[op.slot];
  if(op.action === 'equip'){
    if(!Number.isSafeInteger(op.uid)) return { error:'bad_request' };
    const s = inv.slots.find(s => s && s.uid === op.uid);
    if(!s) return { error:'not_owned' };
    if(slotOf(s.item) !== op.slot) return { error:'wrong_slot' };
    st.worn[op.slot] = takePiece(inv, op.uid);
    if(cur) putPiece(inv, cur);                          // l'ancienne pièce revient dans l'inventaire
  } else if(op.action === 'unequip'){
    if(cur){ putPiece(inv, cur); st.worn[op.slot] = null; }
  } else return { error:'bad_request' };
  st.ops.push(op.opId);
  if(st.ops.length > STUFF.opMemory) st.ops.splice(0, st.ops.length - STUFF.opMemory);
  return { ok:true, repeated:false };
}

/* Relecture du stockage, revérifiée à chaque fois : une pièce invalide, dans la mauvaise case, en double, ou aussi
   présente dans l'inventaire (duplication) est retirée. Les uid de l'inventaire restent toujours plus grands. */
export function sanitizeStuff(raw, inv){
  const st = createStuff();
  const seen = new Set(inv.slots.filter(s => s && s.uid != null).map(s => s.uid));
  const worn = raw && typeof raw.worn === 'object' && raw.worn ? raw.worn : {};
  for(const slot of SLOT_IDS){
    const p = worn[slot];
    if(!p || typeof p.item !== 'string' || slotOf(p.item) !== slot || !Number.isSafeInteger(p.uid) || seen.has(p.uid)) continue;
    seen.add(p.uid);
    st.worn[slot] = { item:p.item, uid:p.uid };
    if(inv.nextUid <= p.uid) inv.nextUid = p.uid + 1;
  }
  st.ops = Array.isArray(raw?.ops) ? raw.ops.filter(o => typeof o === 'string').slice(-STUFF.opMemory) : [];
  return st;
}
