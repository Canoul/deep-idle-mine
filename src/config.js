/* Toutes les valeurs d'équilibrage et constantes du jeu, au même endroit (voir GAME_DESIGN.md).
   Aucun nombre magique dans la logique : on ajoute une clé ici et on la lit ailleurs. */

export const W = 50, AREA_H = 25, SESSION_LEN = 3600, DT = 0.1;
/* couche 1 (juste sous la surface) : toujours en terre, hors areas (ne fausse pas les pourcentages).
   L'area 0 occupe donc les couches 2 à 26, l'area 1 les couches 27 à 51, etc. */
export const TOP_DIRT_ROWS = 1, AREA_Y0 = 1 + TOP_DIRT_ROWS;
export const SPAWN_X = 25, CHEST_X = 22;

/* stats du mineur (de base, avant équipement) */
export const STATS = { oxygenMax:300, speed:3, mineSpeed:1, damage:5, pods:200, light:6, compass:8,
  torches:20, torchRadius:5, discoverMax:2, bridges:10 };

export const CFG = {
  ladderTime:2, refillRate:30, unlockRatio:0.4, climbFactor:0.75, oreReach:12, bridgeTime:1,
  futureTravelWeight:1, ladderPlanWeight:2, planMaxCost:30, foeLeash:10, foeGiveUp:15, mobStep:0.9,
  attackInterval:0.8, returnMargin:12, torchThreshold:0.33, darkLum:0.1, fallSpeed:8,
  darkSlow:0.65,          // multiplicateur de vitesse sans lumière
  oxygenOutSlow:0.5,      // multiplicateur de temps disponible à 0 d'oxygène
  mobChaseRange:14,       // distance (Manhattan) à partir de laquelle une bestiole poursuit le mineur
  shaftGap:3,             // écart minimal entre les puits de deux mineurs
  crowdRadius:4,          // en dessous de cette distance (Manhattan) d'un autre mineur, une zone est « occupée »
  crowdPenalty:2,         // un minerai proche d'un autre mineur (ou de sa cible) vaut 1/(1 + crowdPenalty × nb) de son prix
  sectorHalf:8,           // en équipe : demi-largeur du secteur de préférence de chaque mineur (autour de sa colonne home)
  sectorPenalty:1,        // un minerai hors secteur vaut 1/(1 + sectorPenalty × éloignement relatif) de son prix
  rowCrowdCost:0.5,       // surcoût (s) par case d'un chemin sur la ligne d'un autre mineur (ou juste au-dessus / en dessous)
  rowCrowdPenalty:1,      // une cible sur la ligne d'un autre mineur (±1) vaut 1/(1 + rowCrowdPenalty × nb) de son prix
  minWorkTime:30,         // ne repart pas de la surface s'il ne reste pas aller + retour + ce temps de travail
  endStayMin:45,          // en dessous de ce temps restant, il ne repart jamais
};

/* équipe : le jeu est prévu pour 3 joueurs sur la même carte (même seed, même monde, coffre commun) */
/* home : centre du secteur de préférence de chacun (un tiers de la largeur) ; il repart de cette colonne
   après chaque passage au coffre, ce qui évite que tous redescendent par le même trou et travaillent au même endroit */
export const TEAM = [
  { name:'Rouge', color:'#e63946', x:8,  home:8 },
  { name:'Bleu',  color:'#3a86ff', x:25, home:25 },
  { name:'Vert',  color:'#2ec4b6', x:42, home:42 },
];
export const DEFAULT_MINERS = 3;

/* préférences de l'IA par défaut (chaque mineur en reçoit une copie) */
export const PREFS = { priority:'minerais', fightMobs:true };

export const BLOCKS = {
  1:{name:'Terre',   tex:'dirt',    w:1, hard:0.6, color:'#7a5230', dot:'#8d6240'},
  2:{name:'Pierre',  tex:'stone',   w:2, hard:1.2, color:'#7d828c', dot:'#9298a3'},
  3:{name:'Charbon', tex:'coal',    w:2, hard:1.6, color:'#7d828c', dot:'#1b1b1f', ore:true, val:1},
  4:{name:'Fer',     tex:'iron',    w:3, hard:2.4, color:'#7d828c', dot:'#d9a67f', ore:true, val:2},
  5:{name:'Or',      tex:'gold',    w:4, hard:3.5, color:'#7d828c', dot:'#ffd23f', ore:true, val:4},
  6:{name:'Diamant', tex:'diamond', w:5, hard:5.0, color:'#7d828c', dot:'#4de8f0', ore:true, val:8},
  /* bloc spécial : délimite deux areas tant que la suivante est verrouillée ; infranchissable et incassable */
  7:{name:'Barrière', tex:'barrier', w:0, hard:Infinity, color:'#34344a', dot:'#4a4a66', unbreakable:true},
  /* passerelle : posée par le mineur pour combler un trou ; cassable, ne rapporte rien */
  8:{name:'Passerelle', tex:'bridge', w:0, hard:0.4, color:'#9a6b36', dot:'#5c3a1a', noDrop:true},
};
export const BARRIER = 7, BRIDGE = 8;
export const IDS = { dirt:1, stone:2, coal:3, iron:4, gold:5, diamond:6 };

/* composition en % par area (la dernière est répétée au-delà) */
export const AREAS = [
  {dirt:57, stone:33, coal:10},
  {dirt:30, stone:45, coal:15, iron:10},
  {dirt:10, stone:55, coal:12, iron:15, gold:8},
  {stone:60, coal:8, iron:15, gold:10, diamond:7},
];

/* mobs */
export const MOBS = {
  mimicCount: k => 2 + k,          // mimics par area
  mimicHp:    k => 25 + 10*k,
  mimicLoot:  3,                   // minerais rapportés par un mimic vaincu
  mimicRevealDist: 2.3,
  bugHp:      k => 8 + 4*k,
  bugCap:     k => 2 + k,          // bestioles vivantes max
  bugSpawnDelay: (rng, k) => (40 + rng()*30) / (1 + 0.15*k),
  bugFirstSpawn: 25,
  bugSpawnMin: 5, bugSpawnMax: 10, // distance d'apparition autour du mineur
  bugLoot: rng => 1 + Math.floor(rng()*2),   // chitine
};

/* textures : fichiers de textures/ (générés par scripts/gen_textures.py) */
export const TEXTURES = ['dirt','grass','stone','coal','iron','gold','diamond','tunnel','barrier','sky','bridge',
  'ladder','chest','miner','mimic','bug','torch'];
