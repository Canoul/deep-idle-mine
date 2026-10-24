/* Sorts (onglet Sorts) : logique pure, partagée par le jeu (affichage), le serveur (qui fait foi) et la partie.
   Règles dans SPELLS (src/config.js) et GAME_DESIGN §3 « Sorts ».

   État d'un joueur : { learned:[id de sort appris par parchemin], slots:[id | null] (SPELLS.openSlots cases), ops:[opId…] }.
   - un sort est débloqué par un niveau de spécialisation (unlock.tree / unlock.level) ou par son parchemin appris ;
   - il s'équipe s'il est débloqué et, s'il a un needTree, si l'arbre de skills choisi est le bon ;
   - un sort n'est qu'une fois dans les slots ; l'équiper dans un autre slot l'y déplace (échange avec ce qui y était) ;
   - au lancement d'une session, seuls les sorts encore valides sont figés (equippedSpells). */
import { SPELLS } from '../config.js';
import { removeItem, countOf } from './inventory.js';

export const SPELL = Object.fromEntries(SPELLS.list.map(s => [s.id, s]));
/* sort par son id (null si inconnu : jamais un nom hérité comme « __proto__ ») */
export const spellOf = id => typeof id === 'string' && Object.hasOwn(SPELL, id) ? SPELL[id] : null;
/* sort appris par ce parchemin (null si l'objet n'est pas un parchemin de sort) */
export const spellOfScroll = item => SPELLS.list.find(s => s.unlock.scroll && s.unlock.scroll === item) ?? null;

export const createSpells = () => ({ learned:[], slots:Array(SPELLS.openSlots).fill(null), ops:[] });

/* ctx = { tree : arbre de skills choisi (ou null), spec : { arbre: niveau de spécialisation } } */
export function isUnlocked(st, id, ctx){
  const s = spellOf(id);
  if(!s) return false;
  if(s.unlock.scroll) return st.learned.includes(id);
  return (ctx?.spec?.[s.unlock.tree] ?? 1) >= s.unlock.level;
}
/* pourquoi on ne peut pas équiper ce sort (null = possible) */
export function equipBlocked(st, id, ctx){
  const s = spellOf(id);
  if(!s) return 'unknown';
  if(!isUnlocked(st, id, ctx)) return 'locked';
  if(s.needTree && ctx?.tree !== s.needTree) return 'wrong_tree';
  return null;
}

/* op = { action:'equip', spell, slot, opId } | { action:'unequip', slot, opId }. Renvoie { ok, repeated } ou { error }.
   (Apprendre un parchemin touche l'inventaire : voir learnScroll.) */
export function spellOp(st, op, ctx){
  if(st.ops.includes(op.opId)) return { ok:true, repeated:true };
  const slot = op.slot;
  if(!Number.isSafeInteger(slot) || slot < 0 || slot >= SPELLS.slots) return { error:'bad_request' };
  if(slot >= SPELLS.openSlots) return { error:'slot_locked' };
  if(op.action === 'equip'){
    const why = equipBlocked(st, op.spell, ctx);
    if(why) return { error:why };
    const was = st.slots.indexOf(op.spell);
    if(was >= 0) st.slots[was] = st.slots[slot];   // déjà équipé ailleurs : les deux slots s'échangent
    st.slots[slot] = op.spell;
  } else if(op.action === 'unequip'){
    st.slots[slot] = null;
  } else return { error:'bad_request' };
  remember(st, op.opId);
  return { ok:true, repeated:false };
}

/* apprendre un parchemin : retire UN parchemin de l'inventaire et ajoute son sort aux sorts appris. Refusé (rien ne
   bouge) si l'objet n'est pas un parchemin de sort, s'il n'est pas dans l'inventaire ou si le sort est déjà appris.
   Idempotent par opId. Renvoie { ok, repeated, spell } ou { error }. */
export function learnScroll(st, inv, item, opId){
  if(st.ops.includes(opId)) return { ok:true, repeated:true };
  const s = spellOfScroll(item);
  if(!s) return { error:'not_scroll' };
  if(st.learned.includes(s.id)) return { error:'already_learned' };
  if(countOf(inv, item) < 1 || !removeItem(inv, item, 1)) return { error:'not_owned' };
  st.learned.push(s.id);
  remember(st, opId);
  return { ok:true, repeated:false, spell:s.id };
}

function remember(st, opId){
  st.ops.push(opId);
  if(st.ops.length > SPELLS.opMemory) st.ops.splice(0, st.ops.length - SPELLS.opMemory);
}

/* Relecture (stockage) : sorts connus seulement, sans doublon ; slots ouverts seulement (un sort une seule fois). */
export function sanitizeSpells(raw){
  const st = createSpells();
  if(Array.isArray(raw?.learned))
    st.learned = [...new Set(raw.learned.filter(id => spellOf(id)?.unlock.scroll))];
  if(Array.isArray(raw?.slots))
    for(let i = 0; i < SPELLS.openSlots; i++){
      const id = raw.slots[i];
      if(spellOf(id) && !st.slots.includes(id)) st.slots[i] = id;
    }
  st.ops = Array.isArray(raw?.ops) ? raw.ops.filter(o => typeof o === 'string').slice(-SPELLS.opMemory) : [];
  return st;
}

/* sorts figés au lancement d'une session : ceux des slots encore équipables (spécialisation et niveau d'aujourd'hui) */
export const equippedSpells = (st, ctx) => st.slots.filter(id => id && !equipBlocked(st, id, ctx));

/* Relecture d'une liste de sorts figée dans une session (record.spells) pour la partie : ids connus, sans doublon,
   au plus SPELLS.openSlots, et seulement ceux de la bonne spécialisation (tree : arbre figé au lancement). Le
   déblocage (niveau, parchemin) a été vérifié par le serveur au lancement. */
export function sessionSpells(list, tree){
  if(!Array.isArray(list)) return [];
  const out = [];
  for(const id of list){
    const s = spellOf(id);
    if(!s || out.includes(id) || (s.needTree && s.needTree !== tree)) continue;
    out.push(id);
    if(out.length >= SPELLS.openSlots) break;
  }
  return out;
}

/* ce que le navigateur voit : l'état + pour chaque sort, débloqué ou pas et pourquoi on ne peut pas l'équiper */
export function publicSpells(st, ctx){
  return { learned:[...st.learned], slots:[...st.slots], openSlots:SPELLS.openSlots, slotCount:SPELLS.slots,
           list: SPELLS.list.map(s => ({ id:s.id, unlocked:isUnlocked(st, s.id, ctx), blocked:equipBlocked(st, s.id, ctx) })) };
}

/* condition de déblocage, en texte (bulle de l'onglet Sorts) */
export function unlockText(id){
  const s = spellOf(id);
  if(!s) return '';
  if(s.unlock.scroll) return `Apprendre le ${s.unlock.scroll}`;
  const tree = s.unlock.tree;
  return `${tree.charAt(0).toUpperCase() + tree.slice(1)} : niveau de spécialisation ${s.unlock.level}`;
}
