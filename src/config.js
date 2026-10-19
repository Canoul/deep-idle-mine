/* Toutes les valeurs d'équilibrage et constantes du jeu, au même endroit (voir GAME_DESIGN.md).
   Aucun nombre magique dans la logique : on ajoute une clé ici et on la lit ailleurs. */

export const W = 50, AREA_H = 50, SESSION_LEN = 3600, DT = 0.1;
/* couche 1 (juste sous la surface) : toujours en terre, hors areas (ne fausse pas les pourcentages).
   L'area 0 occupe donc les couches 2 à 51, l'area 1 les couches 52 à 101, etc. */
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

/* Catégories de blocs : chaque bloc a un `type`.
   - terrain  : roche de remplissage (terre, pierre…)
   - ore      : minerai — compte pour le déblocage, visé par l'IA, signalé par la boussole
   - build    : construit par le mineur (passerelle ; échelles et torches, voir BUILDS)
   - treasure : trésor caché dans la mine (coffre au trésor)
   - special  : bloc de jeu sans rôle de ressource (barrière) */
export const BLOCK_TYPES = ['terrain', 'ore', 'build', 'treasure', 'special'];

export const BLOCKS = {
  1:{name:'Terre',   type:'terrain', tex:'dirt',    w:1, hard:0.6, color:'#7a5230', dot:'#8d6240'},
  2:{name:'Pierre',  type:'terrain', tex:'stone',   w:2, hard:1.2, color:'#7d828c', dot:'#9298a3'},
  3:{name:'Charbon', type:'ore',     tex:'coal',    w:2, hard:1.6, color:'#7d828c', dot:'#1b1b1f', val:1},
  4:{name:'Fer',     type:'ore',     tex:'iron',    w:3, hard:2.4, color:'#7d828c', dot:'#d9a67f', val:2},
  5:{name:'Or',      type:'ore',     tex:'gold',    w:4, hard:3.5, color:'#7d828c', dot:'#ffd23f', val:4},
  6:{name:'Diamant', type:'ore',     tex:'diamond', w:5, hard:5.0, color:'#7d828c', dot:'#4de8f0', val:8},
  /* délimite deux areas tant que la suivante est verrouillée ; infranchissable et incassable */
  7:{name:'Barrière', type:'special', tex:'barrier', w:0, hard:Infinity, color:'#34344a', dot:'#4a4a66', unbreakable:true},
  /* passerelle : posée par le mineur pour combler un trou ; cassable, ne rapporte rien */
  8:{name:'Passerelle', type:'build', tex:'bridge', w:0, hard:0.4, color:'#9a6b36', dot:'#5c3a1a', noDrop:true},
  /* pierre dure : roche des areas profondes, deux fois plus longue à miner que la pierre (provisoire) */
  9:{name:'Pierre dure', type:'terrain', tex:'hardstone', w:3, hard:2.4, color:'#575c66', dot:'#6c727d'},
  /* coffre au trésor enfoui : son butin (TREASURE) remplace le bloc ; val = attrait pour l'IA une fois découvert */
  10:{name:'Coffre au trésor', type:'treasure', tex:'treasure', w:0, hard:1.0, color:'#7d828c', dot:'#ffd23f', val:12, noDrop:true},
};
export const BARRIER = 7, BRIDGE = 8, TREASURE_BLOCK = 10;
/* clés utilisées dans les compositions d'areas ; « air » = case vide (id 0), générée en poches */
export const IDS = { air:0, dirt:1, stone:2, coal:3, iron:4, gold:5, diamond:6, hardstone:9 };

/* Constructions du mineur (catégorie build). La passerelle est une tuile de la grille ; l'échelle et la torche
   se posent PAR-DESSUS une case vide (G.ladder, G.torches) : ce ne sont pas des tuiles. */
export const BUILDS = {
  bridge: {name:'Passerelle', type:'build', tex:'bridge', block:BRIDGE},
  ladder: {name:'Échelle',    type:'build', tex:'ladder'},
  torch:  {name:'Torche',     type:'build', tex:'torch'},
};

/* composition en % par area (la dernière est répétée au-delà). Comptes exacts, pas probabilistes.
   air = cases déjà vides à la génération (poches naturelles), cachées tant qu'elles ne sont pas découvertes.
   chestChance = probabilité qu'un coffre au trésor soit enfoui dans l'area (0 à 1, tirée depuis la seed). */
export const AREAS = [
  { comp:{dirt:52, stone:33,                coal:10,                                 air:5}, chestChance:0.3 },
  { comp:{dirt:30, stone:49,                coal:15, iron:1,                         air:5}, chestChance:0.3 },
  { comp:{dirt:20, stone:55,                coal:10, iron:10,                        air:5}, chestChance:0.3 },
  { comp:{dirt:10, stone:60, hardstone:5,   coal:7,  iron:10, gold:3,                air:5}, chestChance:0.3 },
  { comp:{         stone:60, hardstone:15,  coal:5,  iron:10, gold:5,                air:5}, chestChance:0.3 },
  { comp:{         stone:55, hardstone:20,  coal:3,  iron:8,  gold:7,  diamond:2,    air:5}, chestChance:0.3 },
];

/* butin d'un coffre au trésor (provisoire) : des minerais tirés parmi ceux de l'area (au prorata de leur nombre)
   + un objet Trésor (usage défini plus tard avec le craft). Ce butin ne compte pas pour le déblocage. */
export const TREASURE = { oreLoot:6, item:'Trésor', itemWeight:2, itemCount:1 };

/* génération : minerais en filons et vide en poches, de 1 à N cases d'un seul tenant */
export const GEN = { veinMax:4, airPocketMax:4 };

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
  bugItem: 'Chitine',              // objet laissé par une bestiole
};

/* textures : fichiers de textures/ (générés par scripts/gen_textures.py) */
export const TEXTURES = ['dirt','grass','stone','hardstone','coal','iron','gold','diamond','tunnel','barrier','sky','bridge','treasure',
  'ladder','chest','miner','mimic','bug','torch'];

/* ---- Hors session : inventaire global ----
   Catalogue des objets qu'on peut posséder, indexé par leur nom (celui que la simulation met dans les coffres).
   cat   : catégorie d'objet (terrain, ore, treasure, mob, stuff)
   tex   : texture de l'icône (textures/)
   stack : true = les exemplaires s'empilent dans un seul slot, sans maximum ;
           false = chaque exemplaire prend son propre slot (stuff : chaque pièce aura ses propres stats)
   Les blocs qui se ramassent sont ajoutés automatiquement. Un objet absent du catalogue s'empile par défaut. */
export const ITEMS = {
  ...Object.fromEntries(Object.values(BLOCKS).filter(b => !b.noDrop && !b.unbreakable)
    .map(b => [b.name, { cat:b.type, tex:b.tex, w:b.w, stack:true }])),
  [TREASURE.item]:   { cat:'treasure', tex:'treasure', w:TREASURE.itemWeight, stack:true },
  [MOBS.bugItem]:    { cat:'mob',      tex:'bug',      w:1, stack:true },
};

/* grille d'inventaire : colonnes fixes (un objet garde sa place à l'écran), au moins minSlots affichés ;
   capacité illimitée pour l'instant (une ligne s'ajoute quand la grille est pleine) */
export const INVENTORY = { cols:8, minSlots:48 };

/* ---- Comptes joueur (règles partagées par le jeu et le serveur) ----
   Pas d'adresse e-mail : un pseudo + un mot de passe, ou un compte invité à sécuriser plus tard.
   Chaque compte a un ID public, court et lisible (ex. 7K3Q-9XHP) : c'est lui qu'on donnera à un ami.
   Les réglages purement serveur (durée des connexions, limites de tentatives…) sont dans server/config.js. */
export const ACCOUNT = {
  nameMin: 3, nameMax: 16,          // longueur du pseudo
  passMin: 8, passMax: 128,         // longueur du mot de passe
  idLength: 8,                      // caractères de l'ID de compte (affiché en 2 groupes de 4)
  recoveryLength: 16,               // caractères du code de secours (affiché en 4 groupes de 4)
  /* pseudos interdits (comparés sans majuscules ni accents) */
  reservedNames: ['admin', 'administrateur', 'moderateur', 'modo', 'support', 'staff', 'systeme', 'system',
                  'invite', 'guest', 'anonyme', 'deepidlemine', 'serveur', 'server', 'root'],
};
