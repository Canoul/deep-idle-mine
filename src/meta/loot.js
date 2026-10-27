/* Ouverture d'un objet Treasure TX ou d'un coffre de tour (Coffre angélique R4 → une Rune R4) hors session : logique
   pure (le hasard est passé en paramètre). Un trésor de tour (RUNE.treasures) peut aussi donner un anneau (RINGS.drops).
   Le serveur fournit un hasard imprévisible : la seed ne doit pas permettre de prévoir le butin. */
import { LOOT, ITEMS, RUNE, RINGS, TREASURE, GOBLIN_KING } from '../config.js';
import { removeItem, addAll, addItem, countOf, OPEN_MEMORY } from './inventory.js';
import { rollRune, isStuff } from './piece.js';
import { recipeOfBlueprint, isUnlocked } from './craft.js';
import { spellOfScroll } from './spells.js';

/* coffre de tour (RUNE) : { side, q } ou null */
const chestOf = item => ITEMS[item]?.chest ?? null;
export const canOpen = item => Object.hasOwn(LOOT, item) || !!chestOf(item);

const between = (min, max, rng) => min + Math.floor(rng() * (max - min + 1));

/* butin { nom: quantité } d'une table : tous les « always », puis un tirage par famille (au plus un objet chacune).
   skip(item) : objet qui ne peut pas sortir (learnOnce, recette déjà apprise) : s'il est tiré, ce tirage ne donne rien */
export function rollLoot(table, rng, skip = () => false){
  const loot = {};
  for(const a of table.always) loot[a.item] = (loot[a.item] || 0) + between(a.min, a.max, rng);
  for(const f of table.oneOf){
    const r = rng();
    let acc = 0;
    for(const i of f.items){
      acc += i.chance;
      if(r < acc){ if(!skip(i)) loot[i.item] = (loot[i.item] || 0) + 1; break; }
    }
  }
  return loot;
}

/* Ouvre un exemplaire de item : le retire de l'inventaire et y verse son butin, en une fois.
   opId : identifiant de la demande ; une demande déjà traitée renvoie le même butin sans rien rouvrir.
   Renvoie { loot, repeated } ou null (objet qui ne s'ouvre pas, ou pas d'exemplaire). */
export function openTreasure(inv, item, opId, rng, ctx = {}){
  const prev = inv.opened.find(o => o.id === opId);
  if(prev) return prev.item === item ? { loot:{ ...prev.loot }, repeated:true } : null;
  const loot = openOne(inv, item, rng, ctx);
  if(!loot) return null;
  remember(inv, { id:opId, item, loot });
  return { loot, repeated:false };
}

/* « Ouvrir tout » (25/10/2026) : ouvre tous les exemplaires de item (au plus TREASURE.openAllMax), chacun avec son propre
   tirage, en une seule demande. Butin additionné. Même opId : même butin, rien n'est rouvert.
   Renvoie { loot, count, repeated } ou null (objet qui ne s'ouvre pas, ou aucun exemplaire). */
export function openAll(inv, item, opId, rng, ctx = {}){
  const prev = inv.opened.find(o => o.id === opId);
  if(prev) return prev.item === item ? { loot:{ ...prev.loot }, count:prev.count ?? 1, repeated:true } : null;
  if(!canOpen(item)) return null;
  const n = Math.min(countOf(inv, item), TREASURE.openAllMax), loot = {};
  let count = 0;
  for(let k = 0; k < n; k++){
    const l = openOne(inv, item, rng, ctx); if(!l) break;
    for(const [name, q] of Object.entries(l)) loot[name] = (loot[name] || 0) + q;
    count++;
  }
  if(!count) return null;
  remember(inv, { id:opId, item, loot, count });
  return { loot, count, repeated:false };
}

const remember = (inv, rec) => {
  inv.opened.push({ ...rec, loot:{ ...rec.loot } });
  if(inv.opened.length > OPEN_MEMORY) inv.opened.splice(0, inv.opened.length - OPEN_MEMORY);
};

/* ouvre UN exemplaire (retiré de l'inventaire, butin versé) ; renvoie son butin ou null */
function openOne(inv, item, rng, ctx = {}){
  if(!canOpen(item) || !removeItem(inv, item, 1)) return null;
  let loot;
  const chest = chestOf(item);
  if(chest?.side === 'goblin') return openGoblinChest(inv, chest.q, rng, ctx);
  if(chest){                                 // coffre de tour : une rune de sa qualité, lignes tirées maintenant
    const [i] = addItem(inv, RUNE.item, 1);
    Object.assign(inv.slots[i], rollRune(chest.q, rng));
    loot = { [RUNE.item]: 1 };
    if(ITEMS[item].treasure){                // trésor de tour : au plus un anneau, tirage unique (RINGS.drops)
      const ring = rollLoot({ always:[], oneOf:[{ items: RINGS.drops[chest.side] ?? [] }] }, rng);
      addAll(inv, ring);
      Object.assign(loot, ring);
    }
  } else {
    /* learnOnce (Treasure T4, 27/10) : un BP dont la recette est déjà apprise ne sort pas */
    loot = rollLoot(LOOT[item], rng, i => i.learnOnce && isUnlocked(recipeOfBlueprint(i.item), inv));
    addAll(inv, loot);
  }
  return loot;
}

/* coffre du Roi Gobelin (GOBLIN_KING, 27/10/2026) : sa table de butin ; une pièce de stuff qui en sort arrive déjà
   identifiée, à la qualité q du coffre ; « Recette : Chitine » (learnOnce) ne sort que si elle n'est pas encore apprise ;
   un parchemin (spellOnce) seulement si son sort n'est pas appris (ctx.spells : sorts appris du joueur, fournis par le
   serveur ; un parchemin ouvert pendant que le parchemin est seulement dans l'inventaire, pas appris, peut ressortir) */
function openGoblinChest(inv, q, rng, ctx = {}){
  const spells = Array.isArray(ctx.spells) ? ctx.spells : [];
  const learned = i => (i.learnOnce && isUnlocked(recipeOfBlueprint(i.item), inv))
    || (i.spellOnce && spells.includes(spellOfScroll(i.item)?.id));
  const loot = rollLoot(GOBLIN_KING.loot, rng, learned);
  for(const [name, n] of Object.entries(loot)){
    if(!isStuff(name)){ addItem(inv, name, n); continue; }
    for(const i of addItem(inv, name, n)) inv.slots[i].q = q;
  }
  return loot;
}
