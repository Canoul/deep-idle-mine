/* Données du wiki du joueur, tirées de la config du jeu (logique pure, sans DOM : testable dans Node).
   Le wiki affiche toujours les valeurs actuelles : rien n'est recopié à la main. */
import { STATS, CFG, BLOCKS, IDS, AREAS, AREA_H, W, TREASURE, LOOT, RESEARCH, MOBS, XP, SKILLS, FURNACE, CRUSHER, SHINY,
         STUFF, ITEMS, RARITY, DUCK, mobHp, MOB_INFO as MOB_LOOK, HELP, DUNGEON, TRAP, UPGRADE, INSTANT_MINE, JUDGMENT, TOWER, RUNE, RINGS, SPELLS, COMBAT, GLYPHS, MOB_DROPS, GOBLIN_KING , WIKI, GIANT } from '../config.js';
import { RECIPES } from '../recipes.js';
import { rarityOf } from '../meta/rarity.js';
import { xpForLevel } from '../meta/level.js';
import { dropOdds } from '../meta/crusher.js';
import { ringLines } from '../meta/stuff.js';
import { oreFor } from '../meta/furnace.js';

export const CELLS = W * AREA_H;
const blockByKey = key => BLOCKS[IDS[key]];
const isStuffItem = item => ITEMS[item]?.cat === 'stuff';
export const AREA_KEYS = ['dirt', 'stone', 'hardstone', 'coal', 'iron', 'gold', 'diamond', 'graphite', 'mithril', 'cobalt', 'thorium', 'air'];
const isOreKey = k => blockByKey(k)?.type === 'ore';

/* ---------- areas ---------- */
/* une ligne par area définie (la dernière vaut pour toutes les suivantes) */
export function areaRows(){
  return AREAS.map((a, k) => {
    const counts = Object.fromEntries(Object.entries(a.comp).map(([n, p]) => [n, Math.round(p * CELLS / 100)]));
    const ores = Object.keys(counts).filter(isOreKey).reduce((s, n) => s + counts[n], 0);
    return { k, last: k === AREAS.length - 1, comp: a.comp, counts, ores, unlock: Math.ceil(CFG.unlockRatio * ores),
             treasure: a.chestChance, tier: treasureTier(k) };
  });
}
export const treasureTier = k => (TREASURE.tiers.find(t => k <= t.maxArea) || TREASURE.tiers.at(-1)).item;

/* ---------- blocs ---------- */
const XP_BY_NAME = Object.fromEntries(Object.entries(XP.ore).map(([k, v]) => [blockByKey(k).name, v]));
export function blockRows(){
  return Object.values(BLOCKS).filter(b => b.type === 'terrain' || b.type === 'ore' || b.type === 'treasure')
    .map(b => ({ name: b.name, tex: b.tex, type: b.type, hard: b.hard, time: b.hard / STATS.mineSpeed,
                 w: b.noDrop ? null : b.w, xp: XP_BY_NAME[b.name] ?? 0,
                 areas: AREAS.map((a, k) => k).filter(k => {
                   if(b.family === 'residu') return k >= JUDGMENT.fromArea;
                   const key = Object.keys(IDS).find(n => BLOCKS[IDS[n]] === b);
                   return key ? (AREAS[k].comp[key] || 0) > 0 : b.type === 'treasure' && AREAS[k].chestChance > 0;
                 }) }));
}

/* ---------- mobs ---------- */
const range = (f, k) => { let lo = Infinity, hi = -Infinity; for(const v of [0, 0.999999]){ const x = f(() => v, k); lo = Math.min(lo, x); hi = Math.max(hi, x); } return [lo, hi]; };
/* les types de mobs, dans l'ordre de la config */
export const MOB_TYPES = Object.keys(MOBS.hpBase);
/* une ligne par area de la table d'apparition (la dernière vaut pour les suivantes) : chance de chaque type, ses PV */
export function mobRows(){
  return MOBS.spawnTable.map((t, k) => ({
    k, last: k === MOBS.spawnTable.length - 1, spawn: range(MOBS.spawnDelay, k), cap: MOBS.walkerCap(k),
    types: Object.fromEntries(MOB_TYPES.map(m => [m, { chance: t[m] || 0, hp: k >= MOBS.minArea[m] ? mobHp(m, k) : null }])),
  }));
}
/* fiche de chaque mob : nom, texture, butin [{ item, min, max }], XP, première area, vitesse (cases par seconde ; 0 :
   immobile, le mimic) */
export const MOB_INFO = Object.fromEntries(MOB_TYPES.map(m => [m, {
  name: MOB_LOOK[m]?.name ?? m, tex: MOB_LOOK[m]?.tex, xp: XP.mob[m] ?? 0, minArea: MOBS.minArea[m],
  speed: m === 'mimic' ? 0 : (MOBS.speed[m] ?? 1) / CFG.mobStep,
  hp0: mobHp(m, MOBS.minArea[m]),
  loot: {
    bestiole:   [{ item: MOBS.bugItem, ...mm(range(r => MOBS.bugLoot(r))) }],
    gobelin:    [{ item: MOBS.goblinItem, ...mm(range(r => MOBS.goblinLoot(r))) }, { item: MOBS.bugItem, min: MOBS.goblinChitin, max: MOBS.goblinChitin }],
    occultiste: [{ item: MOBS.occult.item, ...mm(range(r => MOBS.occult.loot(r))) }, { item: MOBS.bugItem, ...mm(range(r => MOBS.occult.chitin(r))) }],
    mephite:    [{ item: MOBS.mephite.item, ...mm(range(r => MOBS.mephite.loot(r))) }],
    golem:      [{ item: MOBS.golem.item, ...mm(range(r => MOBS.golem.loot(r))) }],
    mimic:      [],
  }[m] ?? [],
}]));
function mm([min, max]){ return { min, max }; }
export const MOB_RULES = { first: MOBS.firstSpawn, dist: [MOBS.spawnMin, MOBS.spawnMax], chase: CFG.mobChaseRange,
  steal: MOBS.goblinStealEvery, growth: MOBS.hpGrowth, mimicLoot: MOBS.mimicLoot, reveal: MOBS.mimicRevealDist, occult: MOBS.occult, mephite: MOBS.mephite, help: HELP.range,
  golem: { ...MOBS.golem, knock: MOBS.knock.golem, hitEvery: MOBS.hitEveryBy.golem }, duckSpeed: 1 / DUCK.step };
/* coups pour tuer un mob de pv points de vie, avec des dégâts d */
export const hitsToKill = (hp, d = STATS.damage) => Math.ceil(hp / d);

/* ---------- objets ---------- */
export const CAT_LABEL = { terrain:'Terrain', bloc:'Bloc', residu:'Résidu', rune:'Rune', ore:'Minerai', combustible:'Combustible', ingot:'Lingot', treasure:'Treasure',
  mob:'Butin de mob', blueprint:'Blueprint', gem:'Gemme', stuff:'Équipement', furnace:'Four', material:'Matériau', scroll:'Parchemin de sort', glyph:'Glyphe' };
export const CAT_ORDER = ['ore', 'combustible', 'bloc', 'residu', 'terrain', 'ingot', 'mob', 'material', 'gem', 'treasure', 'rune', 'blueprint', 'stuff', 'furnace', 'scroll'];
const pct = c => Math.round(c * 1000) / 10;
const SLOT_LABEL = Object.fromEntries(STUFF.slots.map(s => [s.id, s.label]));
const statName = k => STUFF.statLabels[k] ?? k;
const unit = k => STUFF.statUnits?.[k] ?? '';

/* bonus d'une pièce de stuff, en texte : « Pods +25 », « Dégâts 11 » */
/* objets secrets (WIKI.secret) pas encore trouvés par un joueur : effets cachés. Par défaut tous cachés ; le wiki
   demande au serveur ceux déjà trouvés (setDiscovered). */
let hidden = new Set(WIKI.secret);
export const setDiscovered = list => { hidden = new Set(WIKI.secret.filter(i => !(list || []).includes(i))); };
export const isHidden = item => hidden.has(item);
export const HIDDEN_TEXT = '❓ Effets inconnus : personne ne l\'a encore trouvé';

export function statsOf(item){
  const d = ITEMS[item];
  if(!d || d.cat !== 'stuff') return [];
  if(hidden.has(item)) return [HIDDEN_TEXT];
  if(Object.hasOwn(RINGS.items, item)) return ringLines(item);
  return [
    ...Object.entries(d.set || {}).map(([k, v]) => `${statName(k)} ${fmt(v)}${unit(k)}`),
    ...Object.entries(d.stats || {}).map(([k, v]) => `${statName(k)} +${fmt(v)}${unit(k)}`),
  ];
}

/* d'où vient un objet : liste de textes courts */
/* butin rare des mobs (MOB_DROPS) : nom du mob, et texte de la chance */
const mobDropName = d => d.mob === DUNGEON.boss.type ? DUNGEON.boss.name : MOB_LOOK[d.mob]?.name ?? d.mob;
const mobDropText = d => `${fmt(pct(d.chance))} % de chance sur un ${mobDropName(d).toLowerCase()}`+
  (d.kholeChance != null ? ` (${fmt(pct(d.kholeChance))} % dans un k hole)` : '');
/* lignes du tableau du wiki : objet, mob, chance (texte), recyclage { objet: quantité } */
export const mobDropRows = () => MOB_DROPS.items.map(d => ({ item: d.item, mob: mobDropName(d), chance: mobDropText(d),
  recycle: STUFF.items[d.item]?.recycle ?? {} }));

export function sourcesOf(item){
  const out = [];
  const block = Object.values(BLOCKS).find(b => b.name === item && !b.noDrop && !b.unbreakable);
  if(block){
    const key = Object.keys(IDS).find(n => BLOCKS[IDS[n]] === block);
    const areas = AREAS.map((a, k) => (a.comp[key] || 0) > 0 ? k : null).filter(k => k !== null);
    if(areas.length) out.push(`Miné dans ${areasText(areas)}`);
  }
  for(const [ore, s] of Object.entries(SHINY.items)) if(s.item === item) out.push(`${fmt(pct(SHINY.chance))} % de chance en minant ${/^[aeiouyh]/i.test(ore) ? 'de l\'' : 'du '}${ore.toLowerCase()} (déjà cuit !)`);
  for(const [m, info] of Object.entries(MOB_INFO)) for(const l of info.loot) if(l.item === item)
    out.push(`Butin ${m === 'bestiole' ? 'des bestioles' : m === 'gobelin' ? 'des gobelins' : m === 'occultiste' ? 'des occultistes' : m === 'mephite' ? 'des méphites' : m === 'golem' ? 'des golems' : 'de ' + info.name} (${l.min === l.max ? l.min : `${l.min} à ${l.max}`})`);
  for(const d of MOB_DROPS.items) if(d.item === item) out.push(mobDropText(d));
  for(const [r, d] of Object.entries(FURNACE.recipes)) if(d.out === item) out.push(`Four : fondre ${oreFor(d)} ${r.toLowerCase()} + ${FURNACE.fuelPerIngot} charbon${(d.qty ?? 1) > 1 ? ` → ${d.qty}` : ''}${d.unlock ? ` (recette débloquée par « ${d.unlock} »)` : ''}`);
  for(const a of FURNACE.alloys) if(a.out === item) out.push(`Four (alliage) : ${Object.entries(a.in).map(([i, n]) => `${n} ${i}`).join(' + ')} + ${a.fuel} charbon`);
  for(const t of TREASURE.tiers) if(t.item === item) out.push(`En cassant un treasure (areas ${tierAreas(t)})`);
  const res = Object.values(JUDGMENT.sides).find(s => s.item === item);
  if(res) out.push(`Miné à partir de l'area ${JUDGMENT.fromArea} (${fmt(JUDGMENT.pct)} % des blocs de chaque area pour les deux résidus ensemble, à la place de la pierre)`);
  const chest = ITEMS[item]?.chest;
  if(chest?.side === 'goblin') out.push(`Instance I : un coffre pour chaque joueur encore là quand le roi gobelin tombe (qualité R${chest.q} : ${fmt(pct(UPGRADE.qualities.find(q => q.q === chest.q)?.chance ?? 0))} % de chance)`);
  else if(chest) out.push(`${TOWER.sides[chest.side].tower} : un trésor pour chaque joueur présent quand le boss tombe (qualité R${chest.q} : ${fmt(pct(UPGRADE.qualities.find(q => q.q === chest.q)?.chance ?? 0))} % de chance)`);
  /* coffre du Roi Gobelin (GOBLIN_KING, 27/10) */
  { const l = GOBLIN_KING.loot, a = l.always.find(x => x.item === item);
    if(a) out.push(`Coffre du Roi Gobelin : ${a.min} à ${a.max}, toujours`);
    for(const f of l.oneOf){ const i = f.items.find(x => x.item === item);
      if(i) out.push(`Coffre du Roi Gobelin : ${fmt(pct(i.chance))} % de chance${i.learnOnce ? ' (seulement si la recette n\'est pas encore apprise)' : i.spellOnce ? ' (seulement si le sort n\'est pas encore appris)' : ''}${isStuffItem(item) ? ', déjà identifiée à la qualité du coffre' : ''}`); } }
  if(item === RUNE.item) out.push('En ouvrant un trésor angélique ou démoniaque (rune de la même qualité que le trésor)');
  for(const [side, list] of Object.entries(RINGS.drops)) for(const r of list) if(r.item === item)
    out.push(`En ouvrant un ${RUNE.treasures[side].name.toLowerCase()} : ${fmt(pct(r.chance))} % de chance (en plus de la rune, un anneau au plus)`);
  if(item === INSTANT_MINE.featherItem) out.push(`Mine instantanée : tas de plumes (${fmt(INSTANT_MINE.feather)} % de la mine), ${INSTANT_MINE.featherMin} à ${INSTANT_MINE.featherMax} par tas, au premier qui passe dessus`);
  if(item === DUCK.heart.item) out.push(`Butin du ${DUCK.name} (canard de la surface) : ${fmt(pct(DUCK.heart.chance))} % de chance, dans le coffre commun`);
  if(item === DUNGEON.leather?.item) out.push(`Butin du ${DUNGEON.boss.name.toLowerCase()} (donjon), en plus des cristaux : ${DUNGEON.leather.min} à ${DUNGEON.leather.max}, et chaque joueur en reçoit autant`);
  if(item === DUNGEON.loot.item) out.push(`Butin du ${DUNGEON.boss.name.toLowerCase()} (donjon) : ${DUNGEON.loot.min} à ${DUNGEON.loot.max}, et chaque joueur en reçoit autant`);
  if(item === GIANT.nugget?.item) out.push(`Récompense du Bloc géant, à minuit : 1 par tranche de ${GIANT.nugget.per} de tes points du jour (si tu es venu au moins ${GIANT.minVisits} fois)`);
  for(const [tr, l] of Object.entries(LOOT)){
    const a = l.always.find(x => x.item === item);
    if(a) out.push(`${tr} : ${a.min} à ${a.max}, toujours`);
    for(const f of l.oneOf){ const i = f.items.find(x => x.item === item); if(i) out.push(`${tr} : ${fmt(pct(i.chance))} % de chance`); }
  }
  for(const [b, l] of Object.entries(CRUSHER.loot)) for(const f of l.oneOf){ const i = f.items.find(x => x.item === item); if(i) out.push(`Concasseur : ${String(Math.round(i.chance * 1e6) / 1e4).replace(".", ",")} % par lot de ${CRUSHER.batch} ${b.toLowerCase()}`); }
  for(const t of RESEARCH.tiers) if(blueprintsOfTier(t.tier).includes(item)) out.push(`Table de recherche, tier ${t.tier}`);
  if(Object.hasOwn(RECIPES, item)) out.push(RECIPES[item].unlock ? `Craft (recette débloquée par « ${RECIPES[item].unlock} »)` : 'Craft (recette de base)');
  /* glyphes (drop, GLYPHS.drop) : trouvés par un mineur de la bonne spécialisation */
  if(ITEMS[item]?.cat === 'glyph'){
    const tree = skillNode(ITEMS[item].glyph)?.tree, d = tree && GLYPHS.drop[tree.id];
    const ev = { block:'bloc qu\'il casse', ladder:'échelle qu\'il pose', kill:'mob qu\'il tue' };
    const tiny = v => String(Number((v * 100).toPrecision(3))).replace('.', ',');   // petites chances : 3 chiffres significatifs
    if(d) out.push(`Mine : un mineur spécialisé ${tree.label} a ${tiny(d.chance)} % de chance par ${ev[d.event]} d'en trouver un de son arbre qu'il n'a pas encore (≈ ${String(GLYPHS.dropPerSession*100).replace('.', ',')} % par session dans un groupe de 3)`);
  }
  if(!out.length) out.push('Pas encore obtenable');
  return out;
}

/* à quoi sert un objet : liste de textes courts */
export function usesOf(item){
  const d = ITEMS[item], out = [];
  if(d?.cat === 'stuff' && Object.hasOwn(RINGS.items, item))
    out.push('S\'équipe dans une des 2 cases d\'anneau (jamais deux fois le même)', 'Son effet va à tout le groupe de la session, une seule fois même si plusieurs joueurs le portent ; en mine instantanée, à son porteur seulement',
             'Ne s\'identifie pas, ne s\'enchante pas', `S'améliore (+1 à +9) en sacrifiant un doublon du même anneau : +${fmt(RINGS.upgrade)} à chaque effet par niveau`);
  else if(d?.cat === 'stuff' && UPGRADE.plainSlots.includes(d.slot)) out.push(`S'équipe (case ${SLOT_LABEL[d.slot]?.toLowerCase() ?? d.slot})`, 'Ne s\'identifie pas, ne s\'améliore pas, ne s\'enchante pas');
  else if(d?.cat === 'stuff') out.push(`S'équipe (case ${SLOT_LABEL[d.slot]?.toLowerCase() ?? d.slot})`, 'S\'identifie et s\'améliore (onglet Amélioration)');
  if(UPGRADE.levels.some(l => Object.hasOwn(l.cost, item)))
    out.push(`Amélioration : ${UPGRADE.levels.map((l, i) => `${l.cost[item]} pour +${i + 1}`).join(', ')}`);
  if(d?.cat === 'treasure') out.push(d.chest?.side === 'goblin' ? `S'ouvre dans l'inventaire : graphite, peaux de gobelin, et une chance de couronne, masse, cape ou plan du four en or (une pièce de stuff arrive identifiée R${d.chest.q})`
    : d.chest ? `S'ouvre dans l'inventaire : donne une Rune R${d.chest.q}` : 'S\'ouvre dans l\'inventaire (bouton « Ouvrir »)');
  const side = Object.values(JUDGMENT.sides).find(s => s.item === item);
  if(side) out.push(`Rapporté au coffre : remplit la jauge ${side.label === 'Ange' ? 'de l\'Ange' : 'du Démon'} du Jugement, commune à tous (${JUDGMENT.cap} pour ouvrir la tour)`);
  if(item === RUNE.item) out.push('Enchantement (onglet Amélioration) : se pose sur une pièce de stuff, une rune par pièce, définitif');
  if(d?.cat === 'combustible') out.push('Combustible du four');
  if(Object.hasOwn(FURNACE.recipes, item)) out.push(`Se fond au four → ${FURNACE.recipes[item].qty ?? 1} ${FURNACE.recipes[item].out}${FURNACE.recipes[item].unlock ? ` (recette à débloquer : « ${FURNACE.recipes[item].unlock} »)` : ''}`);
  const fr = Object.entries(FURNACE.recipes).find(([, r]) => r.unlock === item);
  if(fr) out.push(`« Utiliser » : débloque au four (mode Fondre) ${oreFor(fr[1])} ${fr[0].toLowerCase()} + ${FURNACE.fuelPerIngot} charbon → ${fr[1].qty ?? 1} ${fr[1].out}`);
  if(Object.hasOwn(FURNACE.unlockItems, item)) out.push(`« Utiliser » : ouvre le four ${FURNACE.unlockItems[item].slot + 1} (${FURNACE.tiers[FURNACE.unlockItems[item].tier].name}, vitesse ×${fmt(FURNACE.tiers[FURNACE.unlockItems[item].tier].speed)})`);
  const bp = Object.entries(RECIPES).find(([, r]) => r.unlock === item);
  if(bp) out.push(`« Utiliser » : débloque la recette ${bp[0]}`);
  if(item === RESEARCH.parts) out.push('Table de recherche : obtenir un blueprint');
  if(d?.cat === 'blueprint' && item !== RESEARCH.parts) out.push('Peut se recycler en Blueprint parts');
  for(const a of FURNACE.alloys) if(Object.hasOwn(a.in, item)) out.push(`Alliage → ${a.out}`);
  const crafts = Object.entries(RECIPES).filter(([, r]) => Object.hasOwn(r.cost, item)).map(([n]) => n);
  if(crafts.length) out.push(`Ingrédient : ${crafts.join(', ')}`);
  if(d?.cat === 'scroll') out.push("S'apprend dans l'onglet Sorts : débloque un sort (le parchemin est consommé)");
  if(d?.cat === 'glyph') out.push(`Se pose sur le skill « ${skillName(d.glyph)} » (onglet Skills, skill au rang max) : ${GLYPHS.desc[d.glyph]}`);
  if(d?.cat === 'bloc') out.push(`Se concasse par ${CRUSHER.batch} (onglet Concasseur) : gemmes inférieures, treasure`);
  if(d?.cat === 'ore' && !Object.hasOwn(FURNACE.recipes, item) && !crafts.length) out.push('Aucun pour l\'instant');
  if(d?.cat === 'gem' && !crafts.length) out.push('Aucun pour l\'instant');
  if(!out.length) out.push('Aucun pour l\'instant');
  return out;
}

export const blueprintsOfTier = t => {
  const def = RESEARCH.tiers.find(x => x.tier === t);
  return def ? (LOOT[def.from]?.oneOf.find(f => f.family === 'blueprint')?.items.map(i => i.item) ?? []) : [];
};
const tierAreas = t => { const i = TREASURE.tiers.indexOf(t), lo = i ? TREASURE.tiers[i - 1].maxArea + 1 : 0;
  return i === TREASURE.tiers.length - 1 ? `${lo} et plus` : `${lo} à ${t.maxArea}`; };
const areasText = ks => {
  const last = AREAS.length - 1, list = ks.map(k => k === last ? `${k}+` : String(k));
  return list.length === 1 ? `l'area ${list[0]}` : `les areas ${list.slice(0, -1).join(', ')} et ${list.at(-1)}`;
};

/* tous les objets, par catégorie : [{ cat, label, items:[{ name, tex, rarity, w, stack, stats, uses, sources, recipe }] }] */
export function itemGroups(){
  const names = Object.keys(ITEMS);
  const cats = [...CAT_ORDER, ...new Set(names.map(n => ITEMS[n].cat).filter(c => !CAT_ORDER.includes(c)))];
  return cats.map(cat => ({ cat, label: CAT_LABEL[cat] ?? cat,
    items: names.filter(n => ITEMS[n].cat === cat && !(ITEMS[n].chest && !ITEMS[n].treasure))   // ancien coffre de tour : plus donné
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'fr'))
      .map(n => ({ name: n, tex: ITEMS[n].tex, rarity: rarityOf(n), w: ITEMS[n].w ?? null, stack: ITEMS[n].stack !== false,
                   stats: statsOf(n), uses: usesOf(n), sources: sourcesOf(n), recipe: RECIPES[n] ?? null })),
  })).filter(g => g.items.length);
}
const rank = n => RARITY.tiers.findIndex(t => t.id === rarityOf(n));

/* ---------- craft, four, recherche ---------- */
export const recipeRows = () => Object.entries(RECIPES).map(([name, r]) => ({ name, cost: r.cost, qty: r.qty, unlock: r.unlock, stats: statsOf(name), uses: ITEMS[name]?.cat === 'stuff' ? [] : usesOf(name).filter(u => u.startsWith('«')) }));
export const furnaceRows = () => [
  ...Object.entries(FURNACE.recipes).map(([ore, r]) => ({ mode:'Fondre', out: r.out, inputs: { [ore]: oreFor(r) }, fuel: FURNACE.fuelPerIngot, time: r.time })),
  ...FURNACE.alloys.map(a => ({ mode:'Alliage', out: a.out, inputs: a.in, fuel: a.fuel, time: a.time })),
];
/* concasseur : une ligne par bloc ; par famille (une gemme, un treasure) : la chance par lot de CRUSHER.batch blocs */
export const crusherRows = () => Object.keys(CRUSHER.loot).map(block => ({ block, families: dropOdds(block) }));
export const researchRows = () => RESEARCH.tiers.map(t => ({ tier: t.tier, cost: t.cost, recycle: t.recycle, from: t.from, blueprints: blueprintsOfTier(t.tier),
  rarer: Object.entries(t.weights ?? {}).filter(([, w]) => w > 0 && w < 1).map(([bp, w]) => ({ item: bp, times: Math.round(1 / w * 10) / 10 })) }));

/* ---------- stats ---------- */
const STAT_HELP = {
  oxygenMax:  'Combien de secondes il peut rester sous terre avant de remonter respirer.',
  pods:       'Ce que son sac peut porter (chaque bloc a un poids). Sac plein = retour au coffre.',
  speed:      'Vitesse de marche à l\'horizontale, en blocs par seconde.',
  climbSpeed: 'Vitesse sur les échelles, pour monter comme pour descendre.',
  mineSpeed:  'Vitesse de minage : temps pour casser un bloc = sa dureté ÷ cette valeur.',
  damage:     'Dégâts de chaque coup contre un mob. L\'épée remplace la valeur des mains nues.',
  attackSpeed:`Rythme des coups : à 100 %, un coup toutes les ${fmt(CFG.attackInterval)} s ; à 200 %, deux fois plus vite.`,
  fortune:    'Chance de doubler un minerai miné (tu en gagnes 2 au lieu de 1).',
  discoverMax:'Distance (en blocs) jusqu\'à laquelle il découvre les blocs autour de lui, s\'il y a de la lumière.',
  light:      'Distance jusqu\'à laquelle il repère les mobs.',
  compass:    'Portée de la boussole : elle repère les minerais à gauche et à droite, sur sa ligne.',
  compassRows:'Lignes en plus que voit la boussole, au-dessus ET en dessous de la sienne.',
  torches:    'Torches qu\'il emporte. À 0, il remonte en chercher.',
  torchRadius:"Distance éclairée par les torches qu'il pose (le long des galeries creusées). Chaque torche garde le rayon de celui qui l'a posée.",
  goblinThrall:"Couronne du Roi Gobelin : un gobelin qui apparaît à cette distance ou moins du porteur est asservi. Il ne se bat pas, mine les minerais autour de lui pendant 30 s (vitesse d'un mineur de base, même priorité que le porteur) et ce qu'il mine va directement au coffre commun, puis il disparaît.",
  torchTime:  "Temps qu'il met à poser une torche.",
  bridges:    'Passerelles pour traverser les trous (illimitées).',
  tenacity:   "Chance d'ignorer un sort de mob : le vol du gobelin, la canalisation de l'occultiste, l'asphyxie du méphite (un tirage à chaque sort).",
  reach:      "Portée de ses coups, en blocs, en plus de la portée de base (0,5) : il frappe un mob avant que celui-ci soit au contact, et il le touche encore après l'avoir repoussé. La Lance en fer en donne +0,25.",
  knockback:  "Recul qu'il inflige, en blocs, en plus du recul de base (0,25). Un coup qui repousse un mob au-delà de sa portée de tacle (0,5) lui fait lâcher le mineur ; repoussé une fois, il ne peut plus l'être avant d'être revenu à portée. La Lance en fer en donne +0,5.",
  doubleAttack: "Chance, en %, qu'un coup frappe deux fois au lieu d'une (le second coup a son propre critique ; le mob n'est repoussé qu'une fois). Vient des runes.",
  knockRes:   "Réduit le recul subi quand un mob le frappe (minotaure, mobs et boss des tours) : à 50 %, il recule deux fois moins ; à 100 %, plus du tout. Aucune pièce ne la donne pour l'instant.",
  mineSpeedPct:'Bonus de vitesse de minage en %, sur certaines pièces identifiées : vitesse = (base + bonus fixes) × (1 + ce %).',
  damagePct:  'Bonus de dégâts en %, sur certaines pièces identifiées : dégâts = (base + bonus fixes) × (1 + ce %).',
  crit:       'Chance qu\'un coup contre un mob fasse le double de dégâts.',
  oneTap:     'Chance de casser un bloc instantanément.',
  piercing:   'Chance de casser aussi le bloc juste derrière celui qu\'il mine.',
  looting:    "Chance, en %, d'un butin en plus à chaque mob tué (comme le skill Pillage).",
};
const STAT_UNIT = { torchTime:' s', oxygenMax:' s', speed:' blocs/s', climbSpeed:' blocs/s', attackSpeed:' %', fortune:' %', tenacity:' %', knockRes:' %', doubleAttack:' %', reach:' bloc', knockback:' bloc', discoverMax:' blocs',
  mineSpeedPct:' %', damagePct:' %', crit:' %', oneTap:' %', piercing:' %', looting:' %',
  light:' blocs', compass:' blocs', torchRadius:' blocs' };
export function statRows(){
  const skillBoost = {};
  for(const t of SKILLS.trees) for(const n of t.nodes){
    const keys = { mine_speed:['mineSpeed'], damage:['damage'], ore_rush:['speed'], travel_rush:['speed'], braum:['speed', 'climbSpeed'] }[n.id] ?? [];
    for(const key of keys) (skillBoost[key] ||= []).push(`${n.name} (${t.label})`);
    for(const k of Object.keys(n.adds || {})) (skillBoost[k] ||= []).push(`${n.name} (${t.label})`);
  }
  const keys = [...STUFF.shownStats, ...Object.keys(STATS).filter(k => !STUFF.shownStats.includes(k))];
  /* une stat qu'on ne trouve que sur des objets encore secrets (WIKI.secret) est cachée elle aussi */
  const givers = k => Object.keys(STUFF.items).filter(n => Object.hasOwn(STUFF.items[n].stats || {}, k) || Object.hasOwn(STUFF.items[n].set || {}, k));
  const secretOnly = k => { const g = givers(k); return g.length > 0 && g.every(n => hidden.has(n)) && !(skillBoost[k]?.length) && !STATS[k]; };
  return keys.filter(k => !secretOnly(k)).map(k => ({ key: k, label: STUFF.statLabels[k] ?? (k === 'torchRadius' ? 'Rayon des torches' : k), base: STATS[k],
    unit: STAT_UNIT[k] ?? '', help: STAT_HELP[k] ?? '',
    items: Object.keys(STUFF.items).filter(n => !hidden.has(n) && (Object.hasOwn(STUFF.items[n].stats || {}, k) || Object.hasOwn(STUFF.items[n].set || {}, k)))
      .map(n => ({ name: n, text: statsOf(n).find(s => s.startsWith(statName(k))) ?? '' })),
    skills: skillBoost[k] ?? [] }));
}

/* ---------- treasures ---------- */
export const treasureTierRows = () => TREASURE.tiers.map(t => ({ item: t.item, tex: t.tex, areas: tierAreas(t) }));
export const lootTables = () => Object.entries(LOOT).map(([name, l]) => ({ name, tex: ITEMS[name]?.tex,
  always: l.always, families: l.oneOf.map(f => ({ family: f.family, items: f.items, total: f.items.reduce((s, i) => s + i.chance, 0) })) }));

/* ---------- XP, niveaux, skills ---------- */
export const xpRows = () => [
  ...Object.entries(XP.ore).map(([k, v]) => ({ what: blockByKey(k).name, tex: blockByKey(k).tex, xp: v, kind:'Minerai miné' })),
  ...Object.entries(XP.mob).map(([k, v]) => ({ what: MOB_LOOK[k]?.name ?? k, tex: MOB_LOOK[k]?.tex, xp: v, kind:'Mob vaincu' })),
];
export const levelRows = (n = 10) => Array.from({ length: n - 1 }, (_, i) => ({ level: i + 2, need: xpForLevel(i + 2) - xpForLevel(i + 1), total: xpForLevel(i + 2) }));
export const skillTrees = () => SKILLS.trees.map(t => ({ ...t, nodes: t.nodes.map(n => ({ ...n,
  maxText: n.desc.replace('{v}', n.per === 1 ? '' : `${fmt(Math.round(n.per * n.max * 1000) / 10)} %`).replace(/\s+/g, ' ').trim(),
  perText: n.per === 1 ? null : `${fmt(Math.round(n.per * 1000) / 10)} % par rang` })) }));

/* ---------- format ---------- */
export function fmt(n){
  if(typeof n !== 'number' || !Number.isFinite(n)) return String(n);
  const [i, d] = String(Math.round(n * 100) / 100).split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (d ? ',' + d : '');
}

/* ---------- donjon ---------- */
export const dungeonInfo = () => ({ areas: DUNGEON.areas, chance: DUNGEON.chance, size: DUNGEON.size, boss: DUNGEON.boss,
  bossXp: XP.mob[DUNGEON.boss.type] ?? 0, loot: DUNGEON.loot, scared: DUNGEON.scaredTime,
  hits: Math.ceil(DUNGEON.boss.hp / STATS.damage), fightSec: Math.round(Math.ceil(DUNGEON.boss.hp / STATS.damage) * CFG.attackInterval) });

/* ---------- piège ---------- */
export const trapInfo = () => ({ from: TRAP.fromArea, chance: TRAP.chance, tries: TRAP.tries, w: TRAP.w, h: TRAP.h, mobs: TRAP.mobs,
  hpMul: TRAP.hpMul, speedMul: TRAP.speedMul, mean: TRAP.tries * TRAP.chance });

/* ---------- amélioration ---------- */
export const qualityRows = () => UPGRADE.qualities.map(q => ({ q: q.q, label: q.label, color: q.color, chance: q.chance }));
export const upgradeRows = () => UPGRADE.levels.map((l, i) => ({ level: i + 1, pct: l.pct, chance: l.chance, cost: l.cost }));
/* matériaux pour monter une pièce de +0 à +3 sans échec */
export const upgradeTotal = () => UPGRADE.levels.reduce((t, l) => { for(const [k, v] of Object.entries(l.cost)) t[k] = (t[k] || 0) + v; return t; }, {});

/* ---------- mine instantanée ---------- */
export const instantInfo = () => ({ every: INSTANT_MINE.everyHours, game: INSTANT_MINE.duration, real: INSTANT_MINE.duration / 2,
  w: INSTANT_MINE.w, h: INSTANT_MINE.h, comp: INSTANT_MINE.comp, feather: INSTANT_MINE.feather, fMin: INSTANT_MINE.featherMin,
  fMax: INSTANT_MINE.featherMax, item: INSTANT_MINE.featherItem, max: INSTANT_MINE.maxPerMine, reach: INSTANT_MINE.featherReach,
  lost: INSTANT_MINE.interruptMax, notify: INSTANT_MINE.notify });

/* ---------- Ange contre Démon : jauges, tours, runes ---------- */
export const judgmentInfo = () => ({ fromArea: JUDGMENT.fromArea, pct: JUDGMENT.pct, cap: JUDGMENT.cap, hours: JUDGMENT.openHours,
  sides: JUDGMENT.sides, tower: TOWER, residues: Math.round(JUDGMENT.pct * CELLS / 100),
  brick: BLOCKS[TOWER.sides.angel.brick].hard, reach: COMBAT.reach });
/* lignes d'une rune selon sa qualité : nombre, fourchette d'une ligne (% de la valeur du tier de la pièce enchantée) */
export const runeRows = () => UPGRADE.qualities.map(q => ({ q: q.q, label: q.label, color: q.color, chance: q.chance, lines: q.lines,
  min: q.min, max: q.max, total: q.lines * q.max, discover: UPGRADE.discover.qualities.includes(q.q) }));

/* ---------- sorts, XP de spécialisation, anneaux, aider allié (24/10) ---------- */
const TREE_OF = id => SKILLS.trees.find(t => t.id === id);
/* un sort : déblocage (« Mineur, niveau de spé 5 » ou le parchemin), spécialisation exigée, effet, recharge (s) */
export const spellRows = () => SPELLS.list.map(s => ({ id: s.id, name: s.name, icon: s.icon, desc: s.desc, cd: s.cd,
  unlock: s.unlock.scroll ? { scroll: s.unlock.scroll } : { tree: TREE_OF(s.unlock.tree), level: s.unlock.level },
  needTree: s.needTree ? TREE_OF(s.needTree) : null }));
export const spellInfo = () => ({ slots: SPELLS.slots, open: SPELLS.openSlots });
/* XP de spécialisation : % de sa part d'XP ; même courbe que le niveau du mineur ? */
export const specInfo = () => ({ pct: XP.specPct, sameCurve: XP.specCurve.first === XP.curve.first && XP.specCurve.factor === XP.curve.factor,
  first: XP.specCurve.first, factor: XP.specCurve.factor, trees: SKILLS.trees.map(t => ({ icon: t.icon, label: t.label })) });
/* chance d'avoir un anneau en ouvrant un trésor de tour, par camp */
export const ringDrop = () => Object.fromEntries(Object.entries(RINGS.drops).map(([side, l]) => [side, l.reduce((t, r) => t + r.chance, 0)]));
/* chance qu'une area cache un treasure : « 40 % », ou « 30 à 40 % » si elle change d'une area à l'autre */
export const treasureChanceText = () => { const c = [...new Set(AREAS.map(a => Math.round(a.chestChance * 100)))].sort((a, b) => a - b);
  return c.length === 1 ? `${c[0]} %` : `${c[0]} à ${c.at(-1)} %`; };
export const helpInfo = () => ({ range: HELP.range, keep: HELP.keep });

/* ---------- glyphes (25/10/2026, GLYPHS) ---------- */
const skillNode = id => SKILLS.trees.flatMap(t => t.nodes.map(n => ({ ...n, tree:t }))).find(n => n.id === id);
const skillName = id => skillNode(id)?.name ?? id;
/* une ligne par glyphe : objet, skill visé, son arbre, effet */
export const glyphRows = () => Object.entries(GLYPHS.items).map(([node, item]) => {
  const n = skillNode(node);
  return { node, item, skill:n.name, tree:`${n.tree.icon} ${n.tree.label}`, desc:GLYPHS.desc[node] };
});
