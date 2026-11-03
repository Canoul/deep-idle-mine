/* Tableaux de butin montrés au joueur (01/11/2026, Jules) : ce que donne un treasure, un coffre de tour ou d'instance,
   une instance, une tour, un mob. Logique pure, lue dans la config : une valeur changée en config change la bulle.
   Une table = { title, sub?, groups: [{ label, rows: [{ item, min?, max?, chance?, note? }] }], notes: [] } :
   min / max = quantité sûre ; chance = probabilité (0 à 1) ; un groupe « un objet au plus » est un seul tirage.
   Les mobs ont leur propre forme (mobLootTable). Affichage : src/ui/loot-tip.js. */
import { itemName } from './piece.js';   // nom affiché (« Excellent Trésor angélique », 03/11)
import { LOOT, ITEMS, RUNE, RINGS, GOLBUTE, INSTANCE, UPGRADE, MOBS, MOB_INFO, MOB_DROPS, DUNGEON, TOWER, treasureItem,
         goblinChestItem, golbuteChestItem } from '../config.js';
import { goblinChestTable } from './loot.js';

const FAMILY = { blueprint:'Blueprint', gem:'Gemme', key:'Clé', boss:'Objet du boss', recipe:'Recette', scroll:'Parchemin de sort' };
const sum = items => items.reduce((s, i) => s + i.chance, 0);
const note = i => i.learnOnce ? 'si pas encore apprise' : i.spellOnce ? 'si le sort n\'est pas appris' : undefined;

/* une table au format de la config (LOOT, GOBLIN_KING.loot…) : « Toujours », puis un groupe par tirage */
function fromConfig(t){
  const groups = [];
  if(t.always.length) groups.push({ label:'Toujours', rows: t.always.map(a => ({ item:a.item, min:a.min, max:a.max })) });
  for(const f of t.oneOf){
    const rows = f.items.map(i => ({ item:i.item, chance:i.chance, note:note(i) }));
    groups.push({ label: f.items.length > 1 ? `${FAMILY[f.family] ?? 'Objet'} : un au plus (${pctText(sum(f.items))})`
                                            : `${FAMILY[f.family] ?? 'Objet'} : tirage à part`, rows });
  }
  return groups;
}

/* « 12,5 % » */
export const pctText = c => `${String(Math.round(c * 10000) / 100).replace('.', ',')} %`;

/* chances des qualités R1 à R7 d'un coffre ou d'un trésor (UPGRADE.qualities) */
const qualityGroup = what => ({ label:`Qualité ${what}`, quality:true,
  rows: UPGRADE.qualities.map(q => ({ q:q.q, label:`R${q.q} ${q.label}`, color:q.color, chance:q.chance })) });

/* trésor de tour d'un camp : une rune de sa qualité, au plus un anneau (chances × RUNE.luck[luck].rings si béni) */
function towerGroups(side, luck = null){
  const k = RUNE.luck[luck]?.rings ?? 1, rings = (RINGS.drops[side] ?? []).map(r => ({ item:r.item, chance:r.chance * k }));
  return [{ label:'Toujours', rows:[ { item:RUNE.item, min:1, max:1, note:'de la qualité du trésor' } ] },
          ...(rings.length ? [{ label:`Anneau : un au plus (${pctText(sum(rings))})`, rows:rings }] : [])];
}

/* table d'un objet qui s'ouvre (inventaire) ; null si l'objet ne s'ouvre pas */
export function lootTableOf(item){
  if(Object.hasOwn(LOOT, item)) return { title:itemName(item), groups:fromConfig(LOOT[item]),
    notes: LOOT[item].oneOf.some(f => f.family === 'blueprint') ? ['Un blueprint dont tu connais déjà la recette ne sort pas.'] : [] };
  const chest = ITEMS[item]?.chest;
  if(!chest) return null;
  if(chest.side === 'goblin') return { title:itemName(item), groups:fromConfig(goblinChestTable(chest.level ?? 1)),
    notes:['Une pièce de stuff arrive identifiée à la qualité du coffre.'] };
  if(chest.side === 'golbute') return { title:itemName(item), groups:fromConfig(GOLBUTE.loot),
    notes:['Une pièce de stuff arrive identifiée à la qualité du coffre.'] };
  if(ITEMS[item].treasure) return { title:itemName(item), groups:towerGroups(chest.side, chest.luck),
    notes: chest.luck ? [`Trésor ${RUNE.luck[chest.luck].label} : chances des anneaux × ${RUNE.luck[chest.luck].rings}.`] : [] };
  return { title:itemName(item), groups:[{ label:'Toujours', rows:[ { item:RUNE.item, min:1, max:1, note:'de la qualité du coffre' } ] }], notes:[] };
}

/* butin d'une instance (carte du Lobby) : le coffre que chaque joueur reçoit à la victoire, et ses qualités */
export function instanceLootTable(id, level = 1){
  const inst = INSTANCE.list.find(i => i.id === id);
  if(!inst?.chest) return null;
  const lv = inst.chest === 'goblin' && INSTANCE.levels[level] ? level : 1;
  const chest = inst.chest === 'goblin' ? goblinChestItem(1, lv).replace(/ R1$/, '') : golbuteChestItem(1).replace(/ R1$/, '');
  const t = lootTableOf(inst.chest === 'goblin' ? goblinChestItem(1, lv) : golbuteChestItem(1));
  return { title:`${inst.label} : ${chest}`, sub:'Un coffre pour chaque joueur encore là à la victoire.',
           groups:[qualityGroup('du coffre'), ...t.groups], notes:t.notes };
}

/* butin d'une tour (side : 'angel' | 'demon') : un trésor par joueur présent ; luck : bénédiction des stèles */
export function towerLootTable(side, luck = null){
  if(!RUNE.treasures[side]) return null;
  const name = treasureItem(side, 1, luck).replace(/ R1\b/, '');
  return { title:`${TOWER.sides[side]?.tower ?? name} : ${name}`, sub:'Un trésor pour chaque joueur présent quand le boss tombe.',
           groups:[qualityGroup('du trésor'), ...towerGroups(side, luck)],
           notes: luck ? [`Stèle active : chances des anneaux × ${RUNE.luck[luck].rings}.`]
                       : Object.values(RUNE.luck).map(l => `Trésor ${l.label} (stèle) : chances des anneaux × ${l.rings}.`) };
}

/* bornes d'un tirage rng => n */
const span = f => { const a = f(() => 0), b = f(() => 0.999999); return { min:Math.min(a, b), max:Math.max(a, b) }; };

/* butin normal d'un type de mob : [{ item, min, max }] ou [{ text }] (mimic) */
export function mobLoot(m){
  switch(m){
    case 'bestiole':   return [{ item:MOBS.bugItem, ...span(MOBS.bugLoot) }];
    case 'gobelin':    return [{ item:MOBS.goblinItem, ...span(MOBS.goblinLoot) }, { item:MOBS.bugItem, min:MOBS.goblinChitin, max:MOBS.goblinChitin }];
    case 'occultiste': return [{ item:MOBS.occult.item, ...span(MOBS.occult.loot) }, { item:MOBS.bugItem, ...span(MOBS.occult.chitin) }];
    case 'mephite':    return [{ item:MOBS.mephite.item, ...span(MOBS.mephite.loot) }];
    case 'golem':      return [{ item:MOBS.golem.item, ...span(MOBS.golem.loot) }];
    case 'chair':      return [{ item:MOBS.chair.flesh.item, min:MOBS.chair.flesh.min, max:MOBS.chair.flesh.max },
                               { item:MOBS.bugItem, min:MOBS.chair.chitin.min, max:MOBS.chair.chitin.max }];
    case 'chien':      return [{ item:MOBS.chien.item, ...span(MOBS.chien.loot) }];
    case 'ver':        return [{ item:MOBS.ver.item, ...span(MOBS.ver.loot) }];
    case 'mimic':      return [{ text:`${MOBS.mimicLoot} du minerai qu'il imitait` }];
    default:           return [];
  }
}

/* butin rare d'un type de mob (MOB_DROPS) : [{ item, chance, khole? }] */
export const mobRare = m => MOB_DROPS.items.filter(d => d.mob === m).map(d => ({ item:d.item, chance:d.chance, khole:d.kholeChance }));

/* tous les mobs de la mine (ordre de MOBS.hpBase), puis le minotaure des donjons */
export function mobLootTable(){
  const mobs = Object.keys(MOBS.hpBase).map(m => ({ id:m, name:MOB_INFO[m]?.name ?? m, tex:MOB_INFO[m]?.tex, under:MOB_INFO[m]?.under,
    from:MOBS.minArea[m], loot:mobLoot(m), rare:mobRare(m) }));
  const b = DUNGEON.boss;
  mobs.push({ id:b.type, name:`${b.name} (donjon)`, tex:b.tex, from:null,
    loot:[{ item:DUNGEON.loot.item, min:DUNGEON.loot.min, max:DUNGEON.loot.max }, { item:DUNGEON.leather.item, min:DUNGEON.leather.min, max:DUNGEON.leather.max }],
    rare:mobRare(b.type), note:'chaque joueur reçoit autant' });
  return { title:'Butin des mobs', mobs,
    notes:['Butin des mobs (stat) et Pillage : une chance d\'en avoir 1 de plus.',
           'Objets rares : chance × (1 + ton butin des mobs), un seul joueur la reçoit.'] };
}
