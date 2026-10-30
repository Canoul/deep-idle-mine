/* Presets de personnage du mode développeur (DEV_PRESETS), un par spécialisation. Logique pure, partagée par
   scripts/dev-presets.js (comptes locaux) et par les sessions dev (mineurs de test, src/shared/game.js minerSpecs). */
import { SKILLS, SPELLS, XP, GAME, GLYPHS, DEV_PRESETS } from '../config.js';
import { createInventory, addItem, serialize } from '../meta/inventory.js';
import { createStuff, stuffOp, equipSlotFor, gearOf, lookOf, sanitizeStuff } from '../meta/stuff.js';
import { createSkills, sanitizeSkills } from '../meta/skills.js';
import { createSpells, sanitizeSpells } from '../meta/spells.js';
import { createSets } from '../meta/sets.js';
import { xpForLevel, levelOf, specLevelOf, createProgress, sanitizeProgress } from '../meta/level.js';

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

/* sorts de la spé tree débloqués à cette XP de spé, dans les emplacements ouverts */
const treeSpells = (tree, specXp) => SPELLS.list.filter(s => s.unlock.tree === tree && specLevelOf(specXp).level >= s.unlock.level)
  .slice(0, SPELLS.openSlots).map(s => s.id);

/* Copie d'un vrai personnage (29/10/2026, Geoffrey) : snap = ce que le jeu en ligne renvoie au joueur (/api/game/state)
   ou sur la fiche d'un ami (/api/social/profile) : { stuff (pièces portées), skills { tree, ranks, glyphs? },
   spells? { slots }, progress { xp, spec { arbre: { xp } } } }. Tout repasse par les vérifications du jeu (qualité,
   lignes, rune, niveau, rangs, points). Sans sorts (fiche d'ami), ceux de sa spé débloqués à son niveau. */
export function presetFromSnapshot(snap, { keys = DEV_PRESETS.keys } = {}){
  if(!snap || typeof snap !== 'object' || !snap.stuff || !snap.skills) throw new Error('Copie invalide : il faut stuff et skills.');
  if(!Number.isSafeInteger(keys) || keys < 0) throw new Error('--keys : un entier positif.');
  const spec = Object.fromEntries(Object.entries(snap.progress?.spec ?? {}).map(([t, v]) => [t, typeof v === 'object' ? v?.xp : v]));
  const progress = sanitizeProgress({ xp: snap.progress?.xp, spec });
  const inv = createInventory(), stuff = sanitizeStuff({ worn: snap.stuff }, inv);
  const lost = Object.entries(snap.stuff).filter(([slot, p]) => p && stuff.worn[slot]?.uid !== p.uid).map(([slot, p]) => `${slot} : ${p.item}`);
  if(lost.length) throw new Error(`Pièces refusées par le jeu : ${lost.join(', ')}`);
  const { tree, ranks, glyphs } = snap.skills;
  const skills = { ...createSkills(), ...sanitizeSkills({ tree, ranks, glyphs: glyphs ?? {} }, levelOf(progress.xp).talentPoints) };
  const spells = sanitizeSpells({ slots: snap.spells?.slots ?? treeSpells(tree, progress.spec[tree] ?? 0) });
  if(keys) addItem(inv, DEV_PRESETS.key, keys);
  return { level: levelOf(progress.xp).level, progress, inventory: JSON.parse(serialize(inv)), stuff, skills, spells, sets: createSets() };
}

/* ce qu'un mineur de test reçoit en session avec ce preset : { name, look, gear, skills:{tree, ranks, glyphs}, owned, spells:[id] }
   (owned : glyphes possédés, pour le drop, comme un joueur) */
const minerOf = (p, name) => ({ name, look: lookOf(p.stuff), gear: gearOf(p.stuff),
  skills: { tree: p.skills.tree, ranks: p.skills.ranks, glyphs: p.skills.glyphs }, owned: Object.values(p.skills.glyphs),
  spells: p.spells.slots.filter(Boolean) });
export const presetMiner = tree => minerOf(buildPreset(tree, { keys: 0 }), presetName(tree));

/* copie d'un vrai joueur comme mineur de test (29/10/2026) : « copy:<pseudo> » dans botPresets ; le serveur range la copie
   dans la session (record.botCopies[j]) au lancement : la partie se rejoue sans le fichier. null si la copie est refusée */
export const COPY_PREFIX = 'copy:';
export const copyPresetId = who => COPY_PREFIX + who;
export const isCopyPresetId = id => typeof id === 'string' && id.startsWith(COPY_PREFIX) && /^[\w-]{1,24}$/.test(id.slice(COPY_PREFIX.length));
export const copyName = who => ('Test_' + who[0].toUpperCase() + who.slice(1).toLowerCase()).slice(0, 16);
export function copyMiner(who, snap){
  try { return minerOf(presetFromSnapshot(snap, { keys: 0 }), copyName(who)); }
  catch { return null; }
}

/* presets des mineurs de test (mode dev) : une entrée par mineur de test, un arbre connu, une copie (copy:<pseudo>) ou
   null ; null si aucun */
export function sanitizeBotPresets(input){
  if(!Array.isArray(input)) return null;
  const out = input.slice(0, GAME.maxPlayers).map(t => isPresetTree(t) || isCopyPresetId(t) ? t : null);
  return out.some(Boolean) ? out : null;
}
