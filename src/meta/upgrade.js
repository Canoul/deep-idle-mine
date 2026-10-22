/* Onglet Amélioration : identifier et améliorer une pièce de stuff de l'inventaire. Logique pure, partagée par le jeu
   et le serveur (qui fait foi : c'est lui qui tire le hasard, rnd dans [0, 1[).

   - identify : la pièce (pas encore identifiée) + un autre exemplaire du même objet, sacrifié (peu importe sa qualité ou
     son niveau) → qualité et lignes tirées (src/meta/piece.js). Définitif.
   - upgrade : +1 niveau (jusqu'à UPGRADE.levels.length), coûte les matériaux du palier ; un échec ne coûte que ça.
   - enchant : une pièce + une Rune (RUNE) → la rune est consommée, la pièce reçoit rune:{ q, lines, s }. Une seule par
     pièce, définitif.
   Seulement des pièces de l'inventaire (une pièce portée se retire d'abord dans l'onglet Stuff).
   opId : une demande renvoyée (double clic, requête rejouée) retrouve son résultat, sans tirer ni consommer deux fois. */
import { UPGRADE } from '../config.js';
import { countOf, removeItem } from './inventory.js';
import { rollIdentity, isIdentified, isStuff, isRune, MAX_PLUS } from './piece.js';

const slotOfUid = (inv, uid) => Number.isSafeInteger(uid) ? inv.slots.findIndex(s => s && s.uid === uid) : -1;
const remember = (inv, entry) => {
  inv.upgrades.push(entry);
  if(inv.upgrades.length > UPGRADE.opMemory) inv.upgrades.splice(0, inv.upgrades.length - UPGRADE.opMemory);
};
const repeated = (inv, opId, kind) => inv.upgrades.find(e => e.id === opId && e.kind === kind) ?? null;
const pieceAt = (inv, uid) => inv.slots.find(s => s && s.uid === uid) ?? null;

/* coût du prochain palier de cette pièce (null au maximum) : { level, pct, chance, cost } */
export function nextLevel(piece){
  const plus = piece?.plus | 0;
  return plus >= MAX_PLUS ? null : { level: plus + 1, ...UPGRADE.levels[plus] };
}
/* ce qu'il manque pour améliorer : [{ item, have, need }] */
export const upgradeNeeds = (inv, piece) => Object.entries(nextLevel(piece)?.cost ?? {})
  .map(([item, need]) => ({ item, need, have: countOf(inv, item) }));

/* pièces de l'inventaire qu'on peut sacrifier pour identifier celle-ci : même objet, autre exemplaire */
export const sacrificesFor = (inv, piece) => piece ? inv.slots.filter(s => s && s.uid != null && s.uid !== piece.uid && s.item === piece.item && isStuff(s.item)) : [];

/* pourquoi on ne peut pas identifier (code d'erreur) ou null */
export function identifyError(inv, uid, sacrifice){
  const i = slotOfUid(inv, uid), j = slotOfUid(inv, sacrifice);
  if(i < 0 || j < 0) return 'not_owned';
  if(uid === sacrifice) return 'same_piece';
  const p = inv.slots[i];
  if(!isStuff(p.item)) return 'not_stuff';
  if(isIdentified(p)) return 'already_identified';
  if(inv.slots[j].item !== p.item) return 'not_same_item';
  return null;
}

/* op = { uid, sacrifice, opId } ; renvoie { ok, repeated, piece } ou { error } */
export function identify(inv, op, rnd){
  const prev = repeated(inv, op.opId, 'identify');
  if(prev) return { ok:true, repeated:true, piece: pieceAt(inv, prev.uid) };
  const e = identifyError(inv, op.uid, op.sacrifice);
  if(e) return { error: e };
  const j = slotOfUid(inv, op.sacrifice);
  inv.slots[j] = null;                                   // le sacrifice disparaît
  const p = pieceAt(inv, op.uid);
  Object.assign(p, rollIdentity(p.item, rnd));
  while(inv.slots.length && inv.slots[inv.slots.length-1] === null) inv.slots.pop();
  remember(inv, { id: op.opId, kind: 'identify', uid: op.uid });
  return { ok:true, repeated:false, piece: p };
}

/* pourquoi on ne peut pas améliorer (code d'erreur) ou null */
export function upgradeError(inv, uid){
  const p = slotOfUid(inv, uid) >= 0 ? pieceAt(inv, uid) : null;
  if(!p) return 'not_owned';
  if(!isStuff(p.item)) return 'not_stuff';
  if(!nextLevel(p)) return 'maxed';
  if(upgradeNeeds(inv, p).some(n => n.have < n.need)) return 'not_enough';
  return null;
}

/* op = { uid, opId } ; renvoie { ok, repeated, success, piece } ou { error } */
export function upgrade(inv, op, rnd){
  const prev = repeated(inv, op.opId, 'upgrade');
  if(prev) return { ok:true, repeated:true, success: prev.success, piece: pieceAt(inv, prev.uid) };
  const e = upgradeError(inv, op.uid);
  if(e) return { error: e };
  const p = pieceAt(inv, op.uid), lv = nextLevel(p);
  for(const [item, qty] of Object.entries(lv.cost)) removeItem(inv, item, qty);   // vérifié juste avant : tout ou rien
  const success = rnd() < lv.chance;
  if(success) p.plus = lv.level;
  remember(inv, { id: op.opId, kind: 'upgrade', uid: op.uid, success });
  return { ok:true, repeated:false, success, piece: p };
}

/* pourquoi on ne peut pas enchanter (code d'erreur) ou null */
export function enchantError(inv, uid, rune){
  const i = slotOfUid(inv, uid), j = slotOfUid(inv, rune);
  if(i < 0 || j < 0) return 'not_owned';
  const p = inv.slots[i], r = inv.slots[j];
  if(!isStuff(p.item)) return 'not_stuff';
  if(!isRune(r.item)) return 'not_rune';
  if(p.rune) return 'already_enchanted';
  /* rareté (22/10/2026) : une pièce n'accepte qu'une rune de qualité égale ou inférieure à la sienne (R6 → rune R1 à R6).
     Une pièce non identifiée n'a pas de qualité : elle doit d'abord être identifiée. */
  if(!isIdentified(p)) return 'not_identified';
  if(r.q > p.q) return 'rune_too_rare';
  return null;
}

/* op = { uid, rune, opId } ; renvoie { ok, repeated, piece } ou { error } */
export function enchant(inv, op){
  const prev = repeated(inv, op.opId, 'enchant');
  if(prev) return { ok:true, repeated:true, piece: pieceAt(inv, prev.uid) };
  const e = enchantError(inv, op.uid, op.rune);
  if(e) return { error: e };
  const j = slotOfUid(inv, op.rune), r = inv.slots[j];
  inv.slots[j] = null;                                   // la rune est consommée
  const p = pieceAt(inv, op.uid);
  p.rune = { q: r.q, lines: r.lines.map(l => ({ ...l })), s: r.s };
  while(inv.slots.length && inv.slots[inv.slots.length-1] === null) inv.slots.pop();
  remember(inv, { id: op.opId, kind: 'enchant', uid: op.uid });
  return { ok:true, repeated:false, piece: p };
}
