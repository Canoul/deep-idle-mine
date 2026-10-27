/* Presets de personnage du mode développeur (DEV_PRESETS), un par spécialisation. Logique pure, partagée par
   scripts/dev-presets.js (comptes locaux) et par les sessions dev (mineurs de test, src/shared/game.js minerSpecs). */
import { SKILLS, SPELLS, XP, GAME, GLYPHS, DEV_PRESETS } from '../config.js';
import { createInventory, addItem, serialize } from '../meta/inventory.js';
import { createStuff, stuffOp, equipSlotFor, gearOf, lookOf } from '../meta/stuff.js';
import { createSkills, sanitizeSkills } from '../meta/skills.js';
import { createSpells } from '../meta/spells.js';
import { createSets } from '../meta/sets.js';
import { xpForLevel, levelOf, specLevelOf, createProgress } from '../meta/level.js';

export const isPresetTree = id => typeof id === 'string' && SKILLS.trees.some(t => t.id === id);
export const presetName = tree => DEV_PRESETS.names[tree] ?? ('Test_' + tree).slice(0, 16);

/* plus haut niveau dont l'XP totale reste un entier « sûr » (sinon le serveur la remet à 0) */
export function maxStorableLevel(){
  let n = 1;
  while(n < XP.maxLevel && Number.isSafeInteger(xpForLevel(n + 1))) n++;
  return n;
}

/* tout ce qu'un preset possède, prêt à enregistrer : { level, progress, inventory, stuff, skills (glyphes posés), spells, sets } */
export function buildPreset(tree, { keys = DEV_PRESETS.keys } = {}){
  const t = SKILLS.trees.find(x => x.id === tree);
  if(!t) throw new Error(`Spécialisation inconnue : ${tree}`);
  if(!Number.isSafeInteger(keys) || keys < 0) throw new Error('--keys : un entier positif.');
  const level = maxStorableLevel(), xp = xpForLevel(level);
  const progress = { ...createProgress(), xp, spec: { [tree]: xp } };   // specCurve = curve (XP)
  /* arbre au maximum, et tous les glyphes de l'arbre posés (actifs : leur skill est au rang max) */
  const glyphs = Object.fromEntries(t.nodes.filter(n => Object.hasOwn(GLYPHS.items, n.id)).map(n => [n.id, GLYPHS.items[n.id]]));
  const skills = { ...createSkills(), ...sanitizeSkills({ tree, ranks: Object.fromEntries(t.nodes.map(n => [n.id, n.max])), glyphs }, levelOf(xp).talentPoints) };
  const inv = createInventory(), stuff = createStuff();
  for(const item of DEV_PRESETS.gear){
    const [i] = addItem(inv, item, 1);
    const r = stuffOp(inv, stuff, { action:'equip', slot: equipSlotFor(item, stuff.worn), uid: inv.slots[i].uid, opId: 'preset-' + item });
    if(r.error) throw new Error(`${item} : ${r.error}`);
  }
  stuff.ops = [];
  if(keys) addItem(inv, DEV_PRESETS.key, keys);
  const spells = createSpells();
  SPELLS.list.filter(s => s.unlock.tree === tree && specLevelOf(xp).level >= s.unlock.level)
    .slice(0, SPELLS.openSlots).forEach((s, i) => { spells.slots[i] = s.id; });
  return { level, progress, inventory: JSON.parse(serialize(inv)), stuff, skills, spells, sets: createSets() };
}

/* ce qu'un mineur de test reçoit en session avec ce preset : { name, look, gear, skills:{tree, ranks, glyphs}, owned, spells:[id] }
   (owned : glyphes possédés, pour le drop, comme un joueur) */
export function presetMiner(tree){
  const p = buildPreset(tree, { keys: 0 });
  return { name: presetName(tree), look: lookOf(p.stuff), gear: gearOf(p.stuff),
           skills: { tree: p.skills.tree, ranks: p.skills.ranks, glyphs: p.skills.glyphs }, owned: Object.values(p.skills.glyphs),
           spells: p.spells.slots.filter(Boolean) };
}

/* presets des mineurs de test (mode dev) : une entrée par mineur de test, un arbre connu ou null ; null si aucun */
export function sanitizeBotPresets(input){
  if(!Array.isArray(input)) return null;
  const out = input.slice(0, GAME.maxPlayers).map(t => isPresetTree(t) ? t : null);
  return out.some(Boolean) ? out : null;
}
