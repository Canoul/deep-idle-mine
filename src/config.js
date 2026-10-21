/* Toutes les valeurs d'équilibrage et constantes du jeu, au même endroit (voir GAME_DESIGN.md).
   Aucun nombre magique dans la logique : on ajoute une clé ici et on la lit ailleurs. */

export const W = 50, AREA_H = 50, SESSION_LEN = 3600, DT = 0.1;
/* couche 1 (juste sous la surface) : toujours en terre, hors areas (ne fausse pas les pourcentages).
   L'area 0 occupe donc les couches 2 à 51, l'area 1 les couches 52 à 101, etc. */
export const TOP_DIRT_ROWS = 1, AREA_Y0 = 1 + TOP_DIRT_ROWS;
export const SPAWN_X = 25, CHEST_X = 22;

/* stats du mineur (de base, avant équipement) */
/* speed = marche (horizontal), climbSpeed = sur échelle, montée comme descente (blocs/s) ; deux stats indépendantes */
/* attackSpeed = vitesse d'attaque contre un mob, en % (100 = un coup toutes les CFG.attackInterval s ; 200 = deux fois plus vite) ;
   fortune = chance, en %, de DUPLIQUER le minerai obtenu en le minant (0 de base ; au-delà de 100 %, +1 sûr par tranche) */
export const STATS = { oxygenMax:300, speed:3, climbSpeed:2.25, mineSpeed:1, damage:5, attackSpeed:100, fortune:0, pods:200, light:6, compass:8,
  torches:20, torchRadius:5, discoverMax:2, bridges:10 };

export const CFG = {
  ladderTime:2, refillRate:30, unlockRatio:0.4,
  climbFactor:0.75,       // bestioles seulement : vitesse sur échelle = ×climbFactor (le mineur a sa stat climbSpeed)
  oreReach:12, bridgeTime:1,
  futureTravelWeight:1, ladderPlanWeight:2, planMaxCost:30, foeLeash:10, foeGiveUp:15, mobStep:0.9,
  torchTime:1,            // s pour poser une torche
  attackInterval:0.8,     // s entre deux coups à 100 % de vitesse d'attaque
  torchThreshold:0.33, darkLum:0.1, fallSpeed:8,
  maxFall:3,              // chute la plus haute (cases) que le mineur accepte de faire en connaissance de cause
  stunFall:3,             // chute IMPRÉVUE (cases non découvertes) à partir de laquelle il est étourdi…
  stunTime:5,             // … pendant ce temps (s) : il ne peut plus rien faire (ni bouger, ni miner, ni frapper)
  darkSlow:0.65,          // multiplicateur de vitesse sans lumière
  oxygenOutSlow:1,        // multiplicateur de temps disponible à 0 d'oxygène (1 = aucun ralentissement : il remonte sans oxygène)
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
/* En session, chaque mineur porte le pseudo de son joueur et le même skin (src/skins.js, selon son équipement) ;
   les noms ci-dessous ne servent qu'aux simulations sans joueurs (scripts/simulate.js, tests). */
export const TEAM = [
  { name:'Rouge', x:8,  home:8 },
  { name:'Bleu',  x:25, home:25 },
  { name:'Vert',  x:42, home:42 },
];
export const DEFAULT_MINERS = 3;

/* préférences de l'IA par défaut (chaque mineur en reçoit une copie) */
export const PREFS = { priority:'minerais', fightMobs:true };

/* Catégories de blocs : chaque bloc a un `type`.
   - terrain  : roche de remplissage (terre, pierre…)
   - ore      : minerai — compte pour le déblocage, visé par l'IA, signalé par la boussole
   - build    : construit par le mineur (passerelle ; échelles et torches, voir BUILDS)
   - treasure : treasure enfoui dans la mine (son butin : un objet Treasure TX)
   - special  : bloc de jeu sans rôle de ressource (barrière) */
export const BLOCK_TYPES = ['terrain', 'ore', 'build', 'treasure', 'special'];

export const BLOCKS = {
  1:{name:'Terre',   type:'terrain', tex:'dirt',    w:1, hard:0.6, color:'#7a5230', dot:'#8d6240'},
  2:{name:'Pierre',  type:'terrain', tex:'stone',   w:2, hard:1.2, color:'#7d828c', dot:'#9298a3'},
  3:{name:'Charbon', type:'ore',     tex:'coal',    w:2, hard:1.6, color:'#7d828c', dot:'#1b1b1f', val:1, family:'combustible'},
  4:{name:'Fer',     type:'ore',     tex:'iron',    w:3, hard:2.4, color:'#7d828c', dot:'#d9a67f', val:2},
  5:{name:'Or',      type:'ore',     tex:'gold',    w:4, hard:3.5, color:'#7d828c', dot:'#ffd23f', val:4},
  6:{name:'Diamant', type:'ore',     tex:'diamond', w:5, hard:5.0, color:'#7d828c', dot:'#4de8f0', val:8},
  /* délimite deux areas tant que la suivante est verrouillée ; infranchissable et incassable */
  7:{name:'Barrière', type:'special', tex:'barrier', w:0, hard:Infinity, color:'#34344a', dot:'#4a4a66', unbreakable:true},
  /* passerelle : posée par le mineur pour combler un trou ; cassable, ne rapporte rien */
  8:{name:'Passerelle', type:'build', tex:'bridge', w:0, hard:0.4, color:'#9a6b36', dot:'#5c3a1a', noDrop:true},
  /* pierre dure : roche des areas profondes, deux fois plus longue à miner que la pierre (provisoire) */
  9:{name:'Pierre dure', type:'terrain', tex:'hardstone', w:3, hard:2.4, color:'#575c66', dot:'#6c727d'},
  /* treasure : entité enfouie dans la mine ; ouverte, elle donne un objet Treasure TX (TREASURE).
     val = attrait pour l'IA une fois découverte */
  10:{name:'Treasure', type:'treasure', tex:'treasure', w:0, hard:1.0, color:'#7d828c', dot:'#ffd23f', val:12, noDrop:true},
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
   chestChance = probabilité qu'un treasure soit enfoui dans l'area (0 à 1, tirée depuis la seed). */
export const AREAS = [
  { comp:{dirt:52, stone:33,                coal:10,                                 air:5}, chestChance:0.3 },
  { comp:{dirt:30, stone:49,                coal:15, iron:1,                         air:5}, chestChance:0.3 },
  { comp:{dirt:20, stone:55,                coal:10, iron:10,                        air:5}, chestChance:0.3 },
  { comp:{dirt:10, stone:60, hardstone:5,   coal:7,  iron:10, gold:3,                air:5}, chestChance:0.3 },
  { comp:{         stone:60, hardstone:15,  coal:5,  iron:10, gold:5,                air:5}, chestChance:0.3 },
  { comp:{         stone:55, hardstone:20,  coal:3,  iron:8,  gold:7,  diamond:2,    air:5}, chestChance:0.3 },
];

/* butin d'un treasure : un objet « Treasure TX » dont le tier dépend de l'area où le treasure est enfoui
   (usage défini plus tard avec le craft). Plus aucun minerai. Le dernier tier vaut aussi pour les areas au-delà.
   tiers : chaque entrée couvre les areas jusqu'à maxArea (incluse), à partir de la fin de la précédente. */
export const TREASURE = {
  itemWeight:2, itemCount:1,
  tiers: [
    { item:'Treasure T1', maxArea:2, tex:'treasure_t1' },   // areas 0 à 2
    { item:'Treasure T2', maxArea:5, tex:'treasure_t2' },   // areas 3 à 5 (et au-delà)
  ],
};

/* contenu d'un objet Treasure TX, ouvert hors session depuis l'inventaire (src/meta/loot.js). Tirage fait par le serveur.
   always : toujours obtenu, quantité tirée entre min et max (inclus) ;
   oneOf  : un seul tirage par famille → au plus un objet de la famille, chaque objet avec sa chance (0 à 1).
   Un Treasure TX sans table ne s'ouvre pas encore. Valeurs provisoires. */
const gems = chance => [
  { item:'Rubis inférieur',  chance, tex:'gem_ruby' },
  { item:'Jade inférieur',   chance, tex:'gem_jade' },
  { item:'Saphir inférieur', chance, tex:'gem_sapphire' },
];
export const LOOT = {
  'Treasure T1': {
    always: [
      { item:'Blueprint parts', min:5,   max:15  },
      { item:'Charbon',         min:100, max:150 },
      { item:'Fer',             min:50,  max:80  },
    ],
    oneOf: [
      { family:'blueprint', tex:'blueprint', items:[
        { item:'Pioche en fer BP',             chance:0.01 },
        { item:'Épée en fer BP',               chance:0.01 },
        { item:'Casque en fer BP',             chance:0.01 },
        { item:'Plastron en fer BP',           chance:0.01 },
        { item:'Jambes en fer BP',             chance:0.01 },
        { item:'Bottes en fer BP',             chance:0.01 },
        { item:'Four en fer BP',               chance:0.01 },
        { item:'Boussole en or BP',            chance:0.01 },
        { item:'Ceinture en peau de gobelin BP', chance:0.01 },
      ]},
      { family:'gem', items:gems(0.01) },
    ],
  },
  /* Treasure T2 (areas 3 et au-delà) : mêmes principes que le T1 */
  'Treasure T2': {
    always: [
      { item:'Or',              min:20, max:40 },
      { item:'Peau de gobelin', min:3,  max:10 },
      { item:'Blueprint parts', min:8,  max:18 },
    ],
    oneOf: [
      { family:'blueprint', tex:'blueprint', items:[
        { item:'Gants tactique BP',     chance:0.02 },
        { item:'Gants d\'ouvrier BP',   chance:0.02 },
        { item:'Cape de Naingui BP',    chance:0.02 },
      ]},
      { family:'gem', items:gems(0.015) },
    ],
  },
};

/* ---- Hors session : table de recherche (onglet du même nom, src/meta/research.js) ----
   tiers : recherche d'un blueprint du tier : cost Blueprint parts (tout ou rien), un blueprint tiré parmi ceux de la
           table de butin `from` dont la recette n'est pas encore apprise. Un tier n'est ouvert que quand le joueur a
           appris TOUTES les recettes du tier d'avant (les blueprints qui ne débloquent encore rien ne comptent pas).
   recycle (par tier) : un blueprint de ce tier détruit rend entre min et max Blueprint parts. Valeurs provisoires. */
export const RESEARCH = {
  parts: 'Blueprint parts',
  tiers: [
    { tier:1, label:'Tier 1', from:'Treasure T1', cost:100, recycle:{ min:30, max:60 } },
    { tier:2, label:'Tier 2', from:'Treasure T2', cost:150, recycle:{ min:40, max:70 } },
  ],
  opMemory: 50,        // dernières demandes retenues (une demande renvoyée n'agit pas deux fois)
};

/* partage du coffre commun en fin de session (src/meta/share.js) : parts égales entre les joueurs,
   reste tiré au hasard depuis la seed ; les objets de copyToAll ne se partagent pas, chacun reçoit la quantité entière */
export const SHARE = { copyToAll:TREASURE.tiers.map(t => t.item) };   // tous les Treasure TX

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
  /* gobelin : une bestiole voleuse (même physique, même tacle). Il remplace une partie des apparitions de
     bestioles (même minuterie, même plafond) dans les areas >= goblinMinArea. Tant qu'il tacle un mineur,
     il lui vole un minerai (bloc de type ore) toutes les goblinStealEvery secondes : le minerai est perdu. */
  goblinMinArea: 3,
  goblinChance: 0.25,              // part des apparitions qui sont des gobelins (dans les areas concernées)
  goblinHp:   k => 12 + 6*k,       // 30 PV en area 3 (bestiole : 20)
  goblinStealEvery: 2,             // secondes de tacle entre deux vols
  goblinItem: 'Peau de gobelin',
  goblinLoot:  rng => 1 + Math.floor(rng()*2),   // peau de gobelin
  goblinChitin: 1,                               // chitine
};

/* Niveau du mineur (GAME_DESIGN §3, « Niveau et XP »). L'XP de la session va dans un pot commun, partagé à parts égales
   entre les joueurs présents à la fin (comme le coffre) et versé par le serveur.
   ore : XP par bloc de minerai miné (clé de composition) ; mob : XP par mob vaincu (type du mob ; mimic = mob de base).
   curve : XP pour passer du niveau 1 au 2 = first, puis ×factor à chaque niveau (1000, 1500, 2250…).
   talentPerLevel : points de talent gagnés à chaque niveau (dépensés plus tard dans l'onglet Talents).
   maxLevel : garde-fou de calcul. Valeurs provisoires. */
export const XP = {
  ore: { coal:1, iron:2, gold:4, diamond:7 },
  mob: { bestiole:5, gobelin:10, mimic:5 },
  curve: { first:1000, factor:1.5 },
  talentPerLevel: 1,
  maxLevel: 200,
};

/* caméra de la session (affichage) : top = ligne la plus haute affichée (le ciel), margin = lignes affichées sous le
   fond de la mine connue, ease = vitesse de glissade vers le mineur suivi (part du chemin par image),
   wheelRows / keyRows = lignes parcourues par cran de molette / par appui sur une flèche (PageUp/PageDown : ×3) */
/* Treuil (skill Logisticien, étape 2) : un puits au milieu de la mine (colonne x), de la surface jusqu'au haut de la
   dernière area débloquée. Un seau monte et descend à speedFactor × la vitesse de montée du mineur ; tout le monde
   l'utilise en même temps, et on peut s'arrêter à n'importe quelle ligne (comme une échelle rapide). */
export const WINCH = { x: Math.floor(W/2), speedFactor:0.85 };

export const CAMERA = { top:-3, margin:4, ease:0.15, wheelRows:3, keyRows:4 };

/* ---- Skills (onglet Skills, src/meta/skills.js) ----
   1 point par niveau gagné (XP.talentPerLevel). Trois arbres ; dépenser un point dans un arbre bloque les deux autres
   (jusqu'au reset, gratuit, hors session). Chaque étape exige l'étape précédente au rang max.
   Un nœud : id, max (rangs), per (valeur par rang ; 1 = interrupteur), desc (texte, {v} = valeur au rang actuel).
   Les effets sont figés au lancement de la session (comme le stuff). Valeurs provisoires. */
export const SKILLS = {
  /* Arbres en étages : chaque nœud a son étage (row, 1 = en haut). Plusieurs nœuds d'un même étage sont côte à côte.
     Un nœud de l'étage r > 1 exige qu'AU MOINS UN nœud de l'étage r−1 de son arbre soit au rang max (les lignes de
     l'arbre relient chaque nœud à ceux de l'étage d'avant). name/icon : affichage de l'onglet Skills. */
  trees: [
    { id:'mineur', label:'Mineur', icon:'⛏', nodes:[
      { id:'mine_speed',  row:1, max:3, per:0.02, icon:'⛏', name:'Pioche aiguisée', desc:'Vitesse de minage +{v}' },
      { id:'ore_oxygen',  row:2, max:1, per:0.01, icon:'🫧', name:'Second souffle',  desc:'Miner un minerai rend {v} de l\'oxygène max' },
      { id:'ore_rush',    row:3, max:5, per:0.03, icon:'💨', name:'Ruée',            desc:'Vitesse de marche +{v} pendant 3 s après avoir miné un minerai (ne se cumule pas)' },
    ]},
    { id:'logisticien', label:'Logisticien', icon:'🪜', nodes:[
      { id:'build_time',  row:1, max:3, per:0.05, icon:'🔨', name:'Bâtisseur',       desc:'Temps de construction (échelle, passerelle, torche) −{v}' },
      { id:'tall_ladder', row:2, max:1, per:1,    icon:'🪜', name:'Échelle de 2',    desc:'Pose des échelles de 2 de haut (si la case du dessus est vide)' },
      { id:'winch',       row:2, max:1, per:1,    icon:'🪣', name:'Treuil',          desc:'À chaque nouvelle area, il creuse le puits au milieu de la mine et pose un treuil de la surface jusqu\'à elle' },
      { id:'travel_rush', row:3, max:5, per:0.03, icon:'👟', name:'Navette',         desc:'Vitesse de marche +{v} quand il remonte à la surface ou redescend au front' },
    ]},
    { id:'barbare', label:'Barbare', icon:'🪓', nodes:[
      { id:'damage',      row:1, max:3, per:0.05, icon:'🪓', name:'Force brute',     desc:'Dégâts infligés +{v}' },
      { id:'taunt',       row:2, max:1, per:1,    icon:'😤', name:'Provocation',     desc:'Le mob qu\'il frappe lâche les autres mineurs et ne peut plus tacler que lui' },
      { id:'loot',        row:3, max:5, per:0.03, icon:'💰', name:'Pillage',         desc:'Butin des mobs +{v}' },
    ]},
  ],
  rushTime: 3,          // s : durée du bonus de vitesse après un minerai (ore_rush), remise à 3 s à chaque minerai
  /* au retour, un mineur qui doit poser une échelle laisse faire un logisticien qui remonte aussi, à moins de
     ladderYieldRadius cases (Manhattan), en dessous ou à sa hauteur ; au-delà de ladderYieldMax s d'attente, il la pose
     lui-même (le logisticien a pris un autre chemin : jamais bloqué) */
  ladderYieldRadius: 5,
  ladderYieldMax: 4,
  opMemory: 50,         // dernières demandes retenues (une demande renvoyée n'agit pas deux fois)
};

/* textures : fichiers de textures/ (générés par scripts/gen_textures.py) */
export const TEXTURES = ['dirt','grass','stone','hardstone','coal','iron','gold','diamond','tunnel','barrier','sky','bridge','treasure','treasure_t1','treasure_t2',
  'blueprint','bp_parts','gem_ruby','gem_jade','gem_sapphire',
  'ingot_iron','ingot_gold','ingot_tainted','shiny_iron','shiny_gold','pickaxe_stone','helmet_chitin','chest_chitin','legs_chitin','boots_chitin',
  'pickaxe_iron','sword_stone','sword_iron','helmet_iron','chest_iron','legs_iron','boots_iron','belt_goblin',
  'gloves_tactical','gloves_worker','cape_naingui','dark_cloth',
  'ladder','chest','miner','mimic','bug','goblin','torch','stun','winch_rope','winch_top','bucket'];

/* ---- Hors session : four (onglet Four) ----
   Un four : une case minerai (famille ore), une case combustible (famille combustible), une case sortie (lingots).
   Chaque lingot consomme orePerIngot minerais + fuelPerIngot combustibles, en time secondes (temps réel, même
   page fermée : le serveur calcule l'avancée depuis l'heure de départ). Un minerai (famille ore) sans recette ne va pas
   dans le four (le diamant, pour l'instant).
   max : nombre de fours au maximum ; startOwned : fours possédés au départ (les autres sont sous cadenas).
   tiers : fours plus puissants à venir (speed divise le temps de fonte).
   Deux modes par four (bouton Fondre / Alliage) : recipes = la fonte (mode Fondre), alloys = les alliages (mode
   Alliage : deux ingrédients en `in` + `fuel` combustibles par produit, en time secondes). */
export const FURNACE = {
  max:3, startOwned:1, orePerIngot:10, fuelPerIngot:10,
  tiers: [ { name:'Four en pierre', speed:1 } ],
  recipes: {
    Fer:     { out:'Lingot de fer',     time:60,  tex:'ingot_iron' },
    Or:      { out:'Lingot d\'or',      time:120, tex:'ingot_gold' },
  },
  alloys: [
    { out:'Tainted iron', in:{ 'Lingot de fer':5, 'Chitine':20 }, fuel:50, time:180, tex:'ingot_tainted' },
  ],
  opMemory: 50,        // dernières demandes retenues (une demande renvoyée n'agit pas deux fois)
};

/* ---- Shiny ----
   Quand le mineur mine un bloc de minerai qui a une recette de four (FURNACE.recipes : fer, or), il a `chance` d'obtenir
   à la place un « shiny » : l'objet déjà cuit (un lingot qui scintille), 1 pour 1. Le bloc compte toujours comme un
   minerai miné (déblocage, XP, skills). Pas pour le butin des mimics. Tirage avec un hasard « live » à part
   (G.shinyRng, tiré de la seed) : il ne décale ni les mobs ni le reste de la partie. Valeurs provisoires. */
export const SHINY = {
  chance: 0.01,
  items: {                                  // minerai (nom du bloc) → shiny
    Fer: { item:'Shiny iron', tex:'shiny_iron' },
    Or:  { item:'Shiny gold', tex:'shiny_gold' },
  },
  w: 1,                                     // poids dans les pods (comme un lingot)
  rarity: 'inhabituel',                     // rareté de tous les shiny (RARITY)
  salt: 0x5a1e7a11,                         // pour dériver G.shinyRng de la seed
};

/* ---- Rareté des objets (src/meta/rarity.js) ----
   tiers : du plus commun au plus rare ; color = contour de la case de l'objet et couleur de son nom, partout.
   items : rareté des objets qui ne sont pas « commun » (les autres le sont par défaut). Les shiny prennent
   SHINY.rarity. Un nom absent du catalogue (ex. une pièce pas encore créée) peut quand même avoir sa rareté ici. */
export const RARITY = {
  tiers: [
    { id:'commun',     label:'Commun',     color:'#9d9d9d' },
    { id:'inhabituel', label:'Inhabituel', color:'#3ddc5a' },
    { id:'rare',       label:'Rare',       color:'#3d8bff' },
    { id:'epique',     label:'Épique',     color:'#b06bff' },
    { id:'legendaire', label:'Légendaire', color:'#ff8c1a' },
  ],
  default: 'commun',
  items: {
    'Rubis inférieur':'inhabituel', 'Saphir inférieur':'inhabituel', 'Jade inférieur':'inhabituel',
    'Boussole en or':'inhabituel', 'Boussole en or BP':'inhabituel',
    'Ceinture en peau de gobelin':'inhabituel', 'Ceinture en peau de gobelin BP':'inhabituel',
    'Gants tactique':'inhabituel', 'Gants tactique BP':'inhabituel', 'Gants d\'ouvrier':'inhabituel', 'Gants d\'ouvrier BP':'inhabituel',
    'Cape de Naingui':'rare', 'Cape de Naingui BP':'rare',
  },
};

/* ---- Fortune ----
   Stat du mineur (STATS.fortune, en %) : à chaque minerai miné, chance de gagner un second exemplaire de l'objet obtenu
   (le minerai, ou son shiny). Le doublon ne compte pas pour le déblocage de l'area. Hasard « live » à part
   (G.fortuneRng, tiré de la seed) : il ne décale ni les mobs, ni le shiny, ni le reste de la partie. */
export const FORTUNE = { salt: 0x0f07c0de };

/* ---- Hors session : stuff (onglet Stuff) ----
   slots : les cases d'équipement du mineur, dans l'ordre d'affichage (id, libellé, icône d'une case vide).
   items : les pièces d'équipement (famille stuff, ne s'empilent pas) et la case où elles vont.
   Équiper une pièce la sort de l'inventaire ; la retirer l'y remet. Ses effets s'appliquent aux sessions lancées ensuite.
   Les recettes de fabrication sont dans src/recipes.js. */
export const STUFF = {
  slots: [
    { id:'casque',   label:'Casque',   icon:'⛑' },  { id:'torse',    label:'Torse',    icon:'🦺' },
    { id:'jambes',   label:'Jambes',   icon:'👖' }, { id:'pieds',    label:'Pieds',    icon:'🥾' },
    { id:'gants',    label:'Gants',    icon:'🧤' }, { id:'ceinture', label:'Ceinture', icon:'🎗' },
    { id:'pioche',   label:'Pioche',   icon:'⛏' },  { id:'epee',     label:'Épée',     icon:'🗡' },
    { id:'cape',     label:'Cape',     icon:'🧣' }, { id:'boussole', label:'Boussole', icon:'🧭' },
  ],
  /* stats : bonus ajoutés aux STATS du mineur (clé de STATS → valeur) ; set : valeur qui REMPLACE la base (ex. l'épée
     remplace les mains nues). Appliqués en session (stuff porté au lancement, src/meta/stuff.js statsOf). */
  items: {
    'Pioche en pierre':    { slot:'pioche', tex:'pickaxe_stone', stats:{ mineSpeed:0.1 } },
    'Casque en chitine':   { slot:'casque', tex:'helmet_chitin', stats:{ oxygenMax:30 } },
    'Plastron en chitine': { slot:'torse',  tex:'chest_chitin',  stats:{ pods:25 } },
    'Jambes en chitine':   { slot:'jambes', tex:'legs_chitin',   stats:{ climbSpeed:0.4 } },
    'Bottes en chitine':   { slot:'pieds',  tex:'boots_chitin',  stats:{ speed:0.5 } },
    /* pièces en fer et ceinture : recettes débloquées par leur blueprint (src/recipes.js) */
    'Pioche en fer':       { slot:'pioche', tex:'pickaxe_iron',  stats:{ mineSpeed:0.2 } },
    'Épée en pierre':      { slot:'epee',   tex:'sword_stone',   set:{ damage:8 } },      // remplace les mains nues (5) : +3, moitié de l'épée en fer
    'Épée en fer':         { slot:'epee',   tex:'sword_iron',    set:{ damage:11 } },     // remplace les mains nues (5)
    'Casque en fer':       { slot:'casque', tex:'helmet_iron',   stats:{ oxygenMax:38 } },
    'Plastron en fer':     { slot:'torse',  tex:'chest_iron',    stats:{ pods:33 } },
    'Jambes en fer':       { slot:'jambes', tex:'legs_iron',     stats:{ climbSpeed:0.6 } },
    'Bottes en fer':       { slot:'pieds',  tex:'boots_iron',    stats:{ speed:0.6 } },
    'Ceinture en peau de gobelin': { slot:'ceinture', tex:'belt_goblin', stats:{ discoverMax:1 } },
    /* tier 2 (Treasure T2) : recettes débloquées par leur blueprint */
    'Gants tactique':      { slot:'gants',  tex:'gloves_tactical', stats:{ attackSpeed:150 } },
    'Gants d\'ouvrier':    { slot:'gants',  tex:'gloves_worker',   stats:{ fortune:5 } },
    'Cape de Naingui':     { slot:'cape',   tex:'cape_naingui',    stats:{ discoverMax:1 } },
  },
  statLabels: { oxygenMax:'Oxygène', pods:'Pods', climbSpeed:'Vitesse (échelle)', speed:'Vitesse (marche)',
                mineSpeed:'Vitesse de minage', damage:'Dégâts', light:'Vision', compass:'Portée boussole',
                torches:'Torches', bridges:'Passerelles', discoverMax:'Découverte',
                attackSpeed:'Vitesse d\'attaque', fortune:'Fortune' },
  statUnits: { attackSpeed:' %', fortune:' %' },       // unité affichée après la valeur d'une stat
  /* stats du mineur affichées dans l'onglet Stuff (base STATS + bonus des pièces portées), dans cet ordre */
  shownStats: ['oxygenMax','pods','speed','climbSpeed','mineSpeed','damage','attackSpeed','fortune','discoverMax','light','compass','torches','bridges'],
  opMemory: 50,        // dernières demandes retenues (une demande renvoyée n'agit pas deux fois)
};

/* ---- Hors session : inventaire global ----
   Catalogue des objets qu'on peut posséder, indexé par leur nom (celui que la simulation met dans les coffres).
   cat   : famille d'objet (terrain, ore, combustible, ingot, treasure, mob, stuff…). Pour un bloc, c'est sa
           `family` si elle existe, sinon son type dans la mine (le charbon est un minerai dans la mine, mais un
           combustible dans l'inventaire).
   tex   : texture de l'icône (textures/)
   stack : true = les exemplaires s'empilent dans un seul slot, sans maximum ;
           false = chaque exemplaire prend son propre slot (stuff : chaque pièce aura ses propres stats)
   Les blocs qui se ramassent sont ajoutés automatiquement. Un objet absent du catalogue s'empile par défaut. */
export const ITEMS = {
  ...Object.fromEntries(Object.values(BLOCKS).filter(b => !b.noDrop && !b.unbreakable)
    .map(b => [b.name, { cat:b.family ?? b.type, tex:b.tex, w:b.w, stack:true }])),
  ...Object.fromEntries([...Object.values(FURNACE.recipes), ...FURNACE.alloys].map(r => [r.out, { cat:'ingot', tex:r.tex, w:1, stack:true }])),
  ...Object.fromEntries(Object.values(SHINY.items).map(s => [s.item, { cat:'ingot', tex:s.tex, w:SHINY.w, stack:true, shiny:true, rarity:SHINY.rarity }])),
  ...Object.fromEntries(TREASURE.tiers.map(t => [t.item, { cat:'treasure', tex:t.tex, w:TREASURE.itemWeight, stack:true }])),
  [MOBS.bugItem]:    { cat:'mob',      tex:'bug',      w:1, stack:true },
  [MOBS.goblinItem]: { cat:'mob',      tex:'goblin',   w:1, stack:true },
  'Blueprint parts': { cat:'blueprint', tex:'bp_parts', stack:true },
  'Tissu sombre':    { cat:'material',  tex:'dark_cloth', stack:true },   // matériau de la Cape de Naingui (d'où il vient : à définir)
  ...Object.fromEntries(Object.values(LOOT).flatMap(t => t.oneOf.flatMap(f =>
    f.items.map(i => [i.item, { cat:f.family, tex:i.tex || f.tex, stack:true }])))),
  ...Object.fromEntries(Object.entries(STUFF.items).map(([n, d]) => [n, { cat:'stuff', slot:d.slot, tex:d.tex, stats:d.stats ?? {}, set:d.set ?? {}, w:0, stack:false }])),
};

/* grille d'inventaire : colonnes fixes (un objet garde sa place à l'écran), au moins minSlots affichés ;
   capacité illimitée pour l'instant (une ligne s'ajoute quand la grille est pleine) */
/* maxUniqueAdd : nombre max de pièces non empilables ajoutées en une fois (chacune prend un slot) : protège d'une
   quantité aberrante (bug ou triche) qui créerait des millions de slots */
export const INVENTORY = { cols:8, minSlots:48, maxUniqueAdd:1000 };

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

/* ---- Sessions de jeu (décidées et vérifiées par le serveur) ----
   speed : vitesse du jeu normal (multiplicateur de ticks) ; une session dure SESSION_LEN / speed en temps réel
           (x2 : 30 min). Le serveur refuse une fin de session avant ce temps.
   devSpeeds : vitesses proposées en mode développeur (serveur lancé avec npm run dev), où la fin est libre.
   maxPlayers : places dans le lobby (jeu prévu à 3).
   La partie tourne sur le serveur (une seule copie) : un départ ou un focus s'applique tout de suite. */
export const GAME = { speed:2, devSpeeds:[1,2,5,20,60,300], maxPlayers:3 };

/* adresse officielle du jeu : les liens d'invitation y renvoient toujours (même si la page a été ouverte par une
   autre adresse, ex. l'ancienne adresse Render). Sauf en local (localhost, réseau de la maison) : l'adresse de la page,
   pour tester. */
export const SITE = { url:'https://deepmineidle.fr/' };

/* ---- Groupes (lobby à plusieurs) ----
   codeLength : caractères du code de groupe (alphabet des ID de compte, ex. K7Q4P2), aussi dans le lien d'invitation.
   poll : intervalle de rafraîchissement du lobby et de la session dans le navigateur (ms). */
export const PARTY = { codeLength:6, poll:2500 };

/* Préférences de l'IA réglables dans le lobby (« Critères / préférences »), avec leurs valeurs permises.
   Ajouter une préférence = une entrée ici + sa lecture dans l'IA (principe d'architecture n°3). */
export const PREF_OPTIONS = {
  priority:  { label:'Priorité',        options:[['minerais','Minerais'], ['descendre','Descendre']] },
  fightMobs: { label:'Face aux mobs',   options:[[true,'Combattre'], [false,'Ignorer']] },
};

/* Focus minerai : réglé PENDANT la session (panneau de l'onglet Mine), minerai par minerai. Le serveur enregistre
   chaque changement avec son tick et le rejoue (comme un départ).
   modes : none (rien), target (poids augmenté), only (seuls les minerais « only » comptent ; écrase les « target »).
   Ne concerne que les blocs de type ore (les treasures restent visés).
   minLeft  : sous cette part du nombre initial d'un minerai dans une area, l'area est « épuisée » pour ce minerai :
              le mineur part vers l'area débloquée la plus proche qui en a encore ; s'il n'y en a plus, le focus saute.
   valFactor: poids d'un minerai visé = valFactor × le plus gros poids de minerai (provisoire).
   maxChanges : changements max par joueur et par session (protège l'enregistrement).
   Focus d'area (même enregistrement, clé « area ») : le mineur travaille dans cette area, sans descendre plus bas ni
   viser ailleurs ; absente = toujours plus profond (de base). maxArea : plus grand numéro accepté par le serveur. */
export const FOCUS = { modes:['none','target','only'], minLeft:0.2, valFactor:2, maxChanges:500, maxArea:99 };

/* Réglages modifiables en mode développeur seulement (panneau dev du lobby), appliqués à la session lancée.
   Le serveur les ignore en mode normal. [objet, clé, libellé, min, max] */
export const DEV_TUNABLES = [
  ['STATS','oxygenMax','Oxygène max',1,1e5], ['STATS','speed','Vitesse (blocs/s)',0.1,100], ['STATS','mineSpeed','Vitesse de minage',0.1,100],
  ['STATS','damage','Dégâts',0,1e4], ['STATS','attackSpeed','Vitesse d\'attaque (%)',10,10000], ['STATS','fortune','Fortune (%)',0,1000], ['STATS','pods','Pods',1,1e5], ['STATS','torchRadius','Rayon torche (blocs creusés)',0,50],
  ['STATS','discoverMax','Découverte max (blocs)',0,20], ['STATS','light','Vision mobs max',0,50], ['STATS','compass','Portée boussole',0,50],
  ['STATS','torches','Torches',0,1000], ['STATS','bridges','Passerelles',0,1000], ['CFG','ladderTime','Temps échelle (s)',0,60],
  ['CFG','unlockRatio','Seuil déblocage (0-1)',0,1],
];
