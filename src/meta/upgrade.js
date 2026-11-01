/* Onglet Amélioration : identifier et améliorer une pièce de stuff de l'inventaire. Logique pure, partagée par le jeu
   et le serveur (qui fait foi : c'est lui qui tire le hasard, rnd dans [0, 1[).

   - identify : la pièce (pas encore identifiée) + un autre exemplaire du même objet, sacrifié (peu importe sa qualité ou
     son niveau) → qualité et lignes tirées (src/meta/piece.js). Définitif.
   - upgrade : +1 niveau (jusqu'à UPGRADE.levels.length), coûte les matériaux du palier ; un échec ne coûte que ça.
   - enchant : une pièce + une Rune (RUNE) ou un Fragment de rune → la rune est consommée, la pièce reçoit
     rune:{ q, lines, s } (frag:true pour un fragment). Une seule par pièce.
   - unenchant (23/10/2026) : retire la rune d'une pièce, gratuitement ; elle revient dans l'inventaire en Fragment de
     rune (même qualité, mêmes lignes, % ÷ 2 : RUNE.fragment). Un fragment posé ne se retire plus (définitif).
   Les anneaux (RINGS) ne s'identifient ni ne s'enchantent (erreur 'ring') ; ils s'améliorent (27/10/2026) avec les mêmes
   chances, mais le coût est un doublon du même anneau (celui de plus bas niveau est sacrifié), pas des matériaux.
   Boussole, torche (UPGRADE.plainSlots, 27/10/2026) : aucune de ces étapes (erreur 'plain').
   Pièces de l'inventaire ou portées (28/10/2026, Geoffrey) : worn = { case: pièce } du stuff (src/meta/stuff.js), modifié
   sur place ; une pièce portée sacrifiée à l'identification quitte sa case, qui se vide. La rune et le doublon d'un
   anneau viennent toujours de l'inventaire (jamais un anneau porté détruit sans l'avoir choisi).
   opId : une demande renvoyée (double clic, requête rejouée) retrouve son résultat, sans tirer ni consommer deux fois. */
import { UPGRADE, RUNE } from '../config.js';
import { countOf, removeItem, putPiece } from './inventory.js';
import { rollIdentity, isIdentified, isStuff, isRune, isRing, isPlain, isFragment, MAX_PLUS } from './piece.js';

const slotOfUid = (inv, uid) => Number.isSafeInteger(uid) ? inv.slots.findIndex(s => s && s.uid === uid) : -1;
const remember = (inv, entry) => {
  inv.upgrades.push(entry);
  if(inv.upgrades.length > UPGRADE.opMemory) inv.upgrades.splice(0, inv.upgrades.length - UPGRADE.opMemory);
};
const repeated = (inv, opId, kind) => inv.upgrades.find(e => e.id === opId && e.kind === kind) ?? null;
const pieceAt = (inv, uid) => inv.slots.find(s => s && s.uid === uid) ?? null;
/* la pièce uid, dans l'inventaire ou portée ; null sinon */
const wornCase = (worn, uid) => Object.keys(worn ?? {}).find(k => worn[k] && worn[k].uid === uid) ?? null;
const findPiece = (inv, worn, uid) => Number.isSafeInteger(uid) ? pieceAt(inv, uid) ?? worn?.[wornCase(worn, uid)] ?? null : null;
/* retire la pièce uid (vérifiée avant) : de l'inventaire, ou de sa case, qui se vide */
function dropPiece(inv, worn, uid){
  const i = slotOfUid(inv, uid);
  if(i >= 0){ inv.slots[i] = null; while(inv.slots.length && inv.slots[inv.slots.length-1] === null) inv.slots.pop(); }
  else worn[wornCase(worn, uid)] = null;
}

/* coût du prochain palier de cette pièce (null au maximum) : { level, pct, chance, cost } ; un anneau : un doublon de
   lui-même (cost = { anneau: 1 }, dupe:true), même chance */
export function nextLevel(piece){
  const plus = piece?.plus | 0;
  if(plus >= MAX_PLUS) return null;
  const lv = { level: plus + 1, ...UPGRADE.levels[plus] };
  return isRing(piece?.item) ? { ...lv, cost: { [piece.item]: 1 }, dupe: true } : lv;
}
/* doublons d'un anneau dans l'inventaire (autres exemplaires), du plus bas niveau au plus haut : le premier est sacrifié */
export const ringDupes = (inv, piece) => piece ? inv.slots.filter(s => s && s.uid != null && s.uid !== piece.uid && s.item === piece.item)
  .sort((a, b) => (a.plus | 0) - (b.plus | 0) || a.uid - b.uid) : [];
/* ce qu'il manque pour améliorer : [{ item, have, need }] */
export const upgradeNeeds = (inv, piece) => Object.entries(nextLevel(piece)?.cost ?? {})
  .map(([item, need]) => ({ item, need, have: isRing(piece.item) ? ringDupes(inv, piece).length : countOf(inv, item) }));

/* pièces de l'inventaire qu'on peut sacrifier pour identifier celle-ci : même objet, autre exemplaire */
export const sacrificesFor = (inv, piece) => piece ? inv.slots.filter(s => s && s.uid != null && s.uid !== piece.uid && s.item === piece.item && isStuff(s.item)) : [];

/* pourquoi on ne peut pas identifier (code d'erreur) ou null */
export function identifyError(inv, uid, sacrifice, worn){
  const p = findPiece(inv, worn, uid), s = findPiece(inv, worn, sacrifice);
  if(!p || !s) return 'not_owned';
  if(uid === sacrifice) return 'same_piece';
  if(!isStuff(p.item)) return 'not_stuff';
  if(isRing(p.item)) return 'ring';
  if(isPlain(p.item)) return 'plain';
  if(isIdentified(p)) return 'already_identified';
  if(s.item !== p.item) return 'not_same_item';
  return null;
}

/* op = { uid, sacrifice, opId } ; renvoie { ok, repeated, piece } ou { error } */
export function identify(inv, op, rnd, worn){
  const prev = repeated(inv, op.opId, 'identify');
  if(prev) return { ok:true, repeated:true, piece: findPiece(inv, worn, prev.uid) };
  const e = identifyError(inv, op.uid, op.sacrifice, worn);
  if(e) return { error: e };
  dropPiece(inv, worn, op.sacrifice);                    // le sacrifice disparaît (porté : sa case se vide)
  const p = findPiece(inv, worn, op.uid);
  Object.assign(p, rollIdentity(p.item, rnd));
  remember(inv, { id: op.opId, kind: 'identify', uid: op.uid });
  return { ok:true, repeated:false, piece: p };
}

/* pourquoi on ne peut pas améliorer (code d'erreur) ou null */
export function upgradeError(inv, uid, worn){
  const p = findPiece(inv, worn, uid);
  if(!p) return 'not_owned';
  if(!isStuff(p.item)) return 'not_stuff';
  if(isPlain(p.item)) return 'plain';
  if(!nextLevel(p)) return 'maxed';
  if(upgradeNeeds(inv, p).some(n => n.have < n.need)) return 'not_enough';
  return null;
}

/* op = { uid, opId } ; renvoie { ok, repeated, success, piece } ou { error } */
export function upgrade(inv, op, rnd, worn){
  const prev = repeated(inv, op.opId, 'upgrade');
  if(prev) return { ok:true, repeated:true, success: prev.success, piece: findPiece(inv, worn, prev.uid) };
  const e = upgradeError(inv, op.uid, worn);
  if(e) return { error: e };
  const p = findPiece(inv, worn, op.uid), lv = nextLevel(p);
  let sacrificed = null;
  if(lv.dupe){                                           // anneau : son doublon de plus bas niveau (inventaire) disparaît
    sacrificed = ringDupes(inv, p)[0].uid;
    dropPiece(inv, worn, sacrificed);
  }
  else for(const [item, qty] of Object.entries(lv.cost)) removeItem(inv, item, qty);   // vérifié juste avant : tout ou rien
  const success = rnd() < lv.chance;
  if(success) p.plus = lv.level;
  remember(inv, { id: op.opId, kind: 'upgrade', uid: op.uid, success, ...(sacrificed != null ? { sacrificed } : {}) });
  return { ok:true, repeated:false, success, piece: p, ...(sacrificed != null ? { sacrificed } : {}) };
}

/* pourquoi on ne peut pas enchanter (code d'erreur) ou null */
export function enchantError(inv, uid, rune, worn){
  const p = findPiece(inv, worn, uid), j = slotOfUid(inv, rune);
  if(!p || j < 0) return 'not_owned';
  const r = inv.slots[j];
  if(!isStuff(p.item)) return 'not_stuff';
  if(!isRune(r.item)) return 'not_rune';
  if(isRing(p.item)) return 'ring';
  if(isPlain(p.item)) return 'plain';
  if(p.rune) return 'already_enchanted';
  /* rareté (22/10/2026) : une pièce n'accepte qu'une rune de qualité égale ou inférieure à la sienne (R6 → rune R1 à R6).
     Une pièce non identifiée n'a pas de qualité : elle doit d'abord être identifiée. */
  if(!isIdentified(p)) return 'not_identified';
  if(r.q > p.q) return 'rune_too_rare';
  return null;
}

/* op = { uid, rune, opId } ; renvoie { ok, repeated, piece } ou { error } */
export function enchant(inv, op, worn){
  const prev = repeated(inv, op.opId, 'enchant');
  if(prev) return { ok:true, repeated:true, piece: findPiece(inv, worn, prev.uid) };
  const e = enchantError(inv, op.uid, op.rune, worn);
  if(e) return { error: e };
  const r = pieceAt(inv, op.rune);
  dropPiece(inv, worn, op.rune);                         // la rune est consommée
  const p = findPiece(inv, worn, op.uid);
  p.rune = { q: r.q, lines: r.lines.map(l => ({ ...l })), s: r.s, ...(isFragment(r.item) ? { frag: true } : {}) };
  remember(inv, { id: op.opId, kind: 'enchant', uid: op.uid });
  return { ok:true, repeated:false, piece: p };
}

/* pourquoi on ne peut pas retirer la rune de cette pièce (code d'erreur) ou null */
export function unenchantError(inv, uid, worn){
  const p = findPiece(inv, worn, uid);
  if(!p) return 'not_owned';
  if(!isStuff(p.item)) return 'not_stuff';
  if(!p.rune) return 'no_rune';
  if(p.rune.frag) return 'fragment_locked';
  return null;
}

/* op = { uid, opId } ; renvoie { ok, repeated, piece, fragment } ou { error }. La rune sort de la pièce et devient un
   Fragment de rune (nouvel objet, nouvel uid) : rien n'est créé deux fois (opId). */
export function unenchant(inv, op, worn){
  const prev = repeated(inv, op.opId, 'unenchant');
  if(prev) return { ok:true, repeated:true, piece: findPiece(inv, worn, prev.uid), fragment: pieceAt(inv, prev.fragment) };
  const e = unenchantError(inv, op.uid, worn);
  if(e) return { error: e };
  const p = findPiece(inv, worn, op.uid), r = p.rune;
  delete p.rune;
  const fragment = { item: RUNE.fragment.item, uid: inv.nextUid, q: r.q, lines: r.lines.map(l => ({ ...l })), s: r.s };
  putPiece(inv, fragment);
  remember(inv, { id: op.opId, kind: 'unenchant', uid: op.uid, fragment: fragment.uid });
  return { ok:true, repeated:false, piece: p, fragment: pieceAt(inv, fragment.uid) };
}
