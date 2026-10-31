/* Table de recherche (onglet du même nom) : logique pure, partagée par le jeu (affichage) et le serveur (qui fait foi,
   et fournit le hasard : imprévisible, pas la seed).
   - Recherche : on dépense RESEARCH.tiers[t].cost Blueprint parts (tout ou rien) et on obtient un blueprint du tier,
     tiré au hasard parmi ceux du Treasure du tier dont la recette n'est pas encore apprise (un BP déjà en stock peut
     ressortir ; un BP qui ne débloque encore rien reste toujours dans le tirage). Tirage pondéré par
     RESEARCH.tiers[t].weights (1 par défaut ; ex. tier 3 : le plan épique pèse 0,25). Tier à étapes (stages, tier 4) :
     seulement les plans de la première étape pas finie (researchStage).
   - Un tier n'est ouvert que si le joueur a appris TOUTES les recettes de tous les tiers inférieurs (tierUnlocked). Les blueprints
     qui ne débloquent encore aucune recette (Four en fer, Boussole en or) ne comptent pas.
   - Recycle : un blueprint (n'importe lequel) est détruit et rend entre min et max Blueprint parts, selon le tier du
     blueprint (RESEARCH.tiers[].recycle).
   Chaque demande a un opId : une demande renvoyée (double clic, rechargement) rend le même résultat sans rien refaire
   (inv.research garde les dernières). */
import { RESEARCH, LOOT, ITEMS } from '../config.js';
import { countOf, removeItem, addItem } from './inventory.js';
import { recipeOfBlueprint, isUnlocked } from './craft.js';

export const PARTS = RESEARCH.parts;
const between = (min, max, rng) => min + Math.floor(rng() * (max - min + 1));

export const tierOf = t => RESEARCH.tiers.find(x => x.tier === t) ?? null;
/* blueprints d'un tier : la famille « blueprint » de la table de butin de son Treasure */
export const tierBlueprints = t => {
  const def = tierOf(t);
  return def ? (LOOT[def.from]?.oneOf.find(f => f.family === 'blueprint')?.items.map(i => i.item) ?? []) : [];
};
const notLearned = inv => bp => { const r = recipeOfBlueprint(bp); return !r || !isUnlocked(r, inv); };
/* étape en cours d'un tier à étapes (RESEARCH.tiers[].stages, tier 4 depuis le 28/10) : la première dont une recette reste
   à apprendre → { index (0 = 1re), count, pool } ; null pour un tier sans étapes ou entièrement appris */
export function researchStage(inv, t){
  const stages = tierOf(t)?.stages;
  if(!stages) return null;
  for(let i = 0; i < stages.length; i++){
    const pool = stages[i].filter(notLearned(inv));
    if(pool.length) return { index:i, count:stages.length, pool };
  }
  return null;
}
/* blueprints que la recherche peut donner à ce joueur : ceux du tier dont il n'a pas appris la recette (tier à étapes :
   seulement ceux de l'étape en cours) */
export const researchPool = (inv, t) => tierOf(t)?.stages ? (researchStage(inv, t)?.pool ?? []) : tierBlueprints(t).filter(notLearned(inv));
/* poids d'un blueprint dans le tirage de son tier (1 par défaut) */
export const weightOf = (t, bp) => { const w = tierOf(t)?.weights?.[bp]; return Number.isFinite(w) && w > 0 ? w : 1; };
/* chance de chaque blueprint du tirage actuel de ce joueur : [{ item, chance }] (somme = 1) */
export const researchOdds = (inv, t) => {
  const pool = researchPool(inv, t), total = pool.reduce((s, bp) => s + weightOf(t, bp), 0);
  return pool.map(item => ({ item, chance: weightOf(t, item) / total }));
};
/* tirage pondéré, un seul nombre aléatoire */
function pick(pool, t, rng){
  const total = pool.reduce((s, bp) => s + weightOf(t, bp), 0);
  let x = rng() * total;
  for(const bp of pool){ x -= weightOf(t, bp); if(x < 0) return bp; }
  return pool.at(-1);
}
/* tier d'un blueprint : celui dont la table de butin le contient (null s'il n'est dans aucune) */
export const tierOfBlueprint = bp => RESEARCH.tiers.find(d => tierBlueprints(d.tier).includes(bp)) ?? null;
/* recettes du tier que le joueur n'a pas encore apprises (les blueprints sans recette ne comptent pas) */
export const recipesLeft = (inv, t) => tierBlueprints(t).map(recipeOfBlueprint).filter(r => r && !isUnlocked(r, inv));
/* Treasure du tier t, dont le joueur a appris toutes les recettes des tiers t et t + 1 : plus aucun blueprint n'en sort
   (31/10/2026, Geoffrey). Le dernier tier n'a pas de tier suivant : il n'est pas concerné. */
export const treasureBlueprintsDone = (inv, item) => {
  const t = RESEARCH.tiers.find(d => d.from === item)?.tier;
  return !!tierOf(t + 1) && recipesLeft(inv, t).length === 0 && recipesLeft(inv, t + 1).length === 0;
};
/* tier ouvert : le premier toujours ; les suivants quand toutes les recettes de TOUS les tiers inférieurs sont apprises
   (25/10, Geoffrey : avant, seulement le tier juste d'avant ; des BP du T2 trouvés dans des Treasures ouvraient le T3
   avec un T1 incomplet) */
export const tierUnlocked = (inv, t) => RESEARCH.tiers.every(d => d.tier >= t || recipesLeft(inv, d.tier).length === 0);
/* tiers inférieurs à t dont il reste des recettes à apprendre : [{ tier, label, left }] (ce qui bloque le tier t) */
export const tiersBlocking = (inv, t) => RESEARCH.tiers.filter(d => d.tier < t)
  .map(d => ({ tier: d.tier, label: d.label, left: recipesLeft(inv, d.tier).length })).filter(d => d.left > 0);
/* un blueprint (pas les parts) */
export const isBlueprint = item => typeof item === 'string' && ITEMS[item]?.cat === 'blueprint' && item !== PARTS;
export const canResearch = (inv, t) => !!tierOf(t) && tierUnlocked(inv, t) && researchPool(inv, t).length > 0 && countOf(inv, PARTS) >= tierOf(t).cost;

function remember(inv, entry){
  inv.research.push(entry);
  if(inv.research.length > RESEARCH.opMemory) inv.research.splice(0, inv.research.length - RESEARCH.opMemory);
}
const replay = (inv, opId, kind) => { const p = inv.research.find(e => e.id === opId); return p ? (p.kind === kind ? { ...p.result, repeated:true } : { error:'bad_request' }) : null; };

/* Recherche au tier t : renvoie { ok, item, repeated } ou { error } (bad_tier, tier_locked, nothing_left, not_enough) */
export function research(inv, t, opId, rng){
  const prev = replay(inv, opId, 'research'); if(prev) return prev;
  const def = tierOf(t);
  if(!def) return { error:'bad_tier' };
  if(!tierUnlocked(inv, t)) return { error:'tier_locked' };
  const pool = researchPool(inv, t);
  if(!pool.length) return { error:'nothing_left' };
  if(!removeItem(inv, PARTS, def.cost)) return { error:'not_enough' };
  const item = pick(pool, t, rng);
  addItem(inv, item, 1);
  const result = { ok:true, item };
  remember(inv, { id:opId, kind:'research', result });
  return { ...result, repeated:false };
}

/* Recycle un blueprint : renvoie { ok, item, parts, repeated } ou { error } (bad_item, not_owned) */
export function recycle(inv, item, opId, rng){
  const prev = replay(inv, opId, 'recycle'); if(prev) return prev;
  if(!isBlueprint(item)) return { error:'bad_item' };
  if(!removeItem(inv, item, 1)) return { error:'not_owned' };
  const { min, max } = (tierOfBlueprint(item) ?? RESEARCH.tiers[0]).recycle;
  const parts = between(min, max, rng);
  addItem(inv, PARTS, parts);
  const result = { ok:true, item, parts };
  remember(inv, { id:opId, kind:'recycle', result });
  return { ...result, repeated:false };
}
