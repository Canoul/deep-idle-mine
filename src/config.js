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
/* compassRows = lignes vues par la boussole au-dessus ET en dessous de celle du mineur (0 de base : sa ligne seulement) */
export const STATS = { oxygenMax:300, speed:3, climbSpeed:2.25, mineSpeed:1, damage:5, attackSpeed:100, fortune:0, pods:200, light:6, compass:8,
  compassRows:0, torches:20, torchRadius:5, discoverMax:2, bridges:10 };

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
/* helpAllies : aide ses alliés pris en chasse par un mob (option « Aider allié ») ; helpIgnore : types de mob pour
   lesquels il ne va pas aider (liste de clés de MOBS.hpBase) */
export const PREFS = { priority:'minerais', fightMobs:true, helpAllies:false, helpIgnore:[] };
/* Aider allié : il ne part aider que si le mob est à helpRange cases ou moins (Manhattan). Au-delà, le combat est fini
   avant son arrivée et il traverse la mine pour rien (allers-retours mesurés en simulation). Provisoire. */
export const HELP = { range:20 };

/* Catégories de blocs : chaque bloc a un `type`.
   - terrain  : roche de remplissage (terre, pierre…)
   - ore      : minerai — compte pour le déblocage, visé par l'IA, signalé par la boussole
   - build    : construit par le mineur (passerelle ; échelles et torches, voir BUILDS)
   - treasure : treasure enfoui dans la mine (son butin : un objet Treasure TX)
   - special  : bloc de jeu sans rôle de ressource (barrière) */
export const BLOCK_TYPES = ['terrain', 'ore', 'build', 'treasure', 'special'];

export const BLOCKS = {
  /* family 'bloc' : dans l'inventaire, objets de type Bloc (ils se concassent : onglet Concasseur, CRUSHER) */
  1:{name:'Terre',   type:'terrain', tex:'dirt',    w:1, hard:0.6, color:'#7a5230', dot:'#8d6240', family:'bloc'},
  2:{name:'Pierre',  type:'terrain', tex:'stone',   w:2, hard:1.2, color:'#7d828c', dot:'#9298a3', family:'bloc'},
  3:{name:'Charbon', type:'ore',     tex:'coal',    w:2, hard:1.6, color:'#7d828c', dot:'#1b1b1f', val:1, family:'combustible'},
  4:{name:'Fer',     type:'ore',     tex:'iron',    w:3, hard:2.4, color:'#7d828c', dot:'#d9a67f', val:2},
  5:{name:'Or',      type:'ore',     tex:'gold',    w:4, hard:3.5, color:'#7d828c', dot:'#ffd23f', val:4},
  6:{name:'Diamant', type:'ore',     tex:'diamond', w:5, hard:5.0, color:'#7d828c', dot:'#4de8f0', val:8},
  /* délimite deux areas tant que la suivante est verrouillée ; infranchissable et incassable */
  7:{name:'Barrière', type:'special', tex:'barrier', w:0, hard:Infinity, color:'#34344a', dot:'#4a4a66', unbreakable:true},
  /* passerelle : posée par le mineur pour combler un trou ; cassable, ne rapporte rien */
  8:{name:'Passerelle', type:'build', tex:'bridge', w:0, hard:0.4, color:'#9a6b36', dot:'#5c3a1a', noDrop:true},
  /* pierre dure : roche des areas profondes, deux fois plus longue à miner que la pierre (provisoire) */
  9:{name:'Pierre dure', type:'terrain', tex:'hardstone', w:3, hard:2.4, color:'#575c66', dot:'#6c727d', family:'bloc'},
  /* treasure : entité enfouie dans la mine ; ouverte, elle donne un objet Treasure TX (TREASURE).
     val = attrait pour l'IA une fois découverte */
  10:{name:'Treasure', type:'treasure', tex:'treasure', w:0, hard:1.0, color:'#7d828c', dot:'#ffd23f', val:12, noDrop:true},
  /* mur de donjon (DUNGEON) : brique de pierre violet sombre, incassable */
  11:{name:'Brique de donjon', type:'special', tex:'dungeon_brick', w:0, hard:Infinity, color:'#3a2a4a', dot:'#55406b', unbreakable:true, noDrop:true},
};
export const BARRIER = 7, BRIDGE = 8, TREASURE_BLOCK = 10, DUNGEON_WALL = 11;
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

/* ---- Hors session : concasseur (onglet Concasseur, src/meta/crusher.js) ----
   8 cases d'entrée (2 rangées de 4) pour les objets de type Bloc, 8 cases de sortie pour le butin.
   Toutes les `time` secondes (temps réel, même page fermée), il concasse `batch` blocs d'une case d'entrée : la
   première qui en a au moins `batch`, de haut en bas puis de gauche à droite. Les blocs sont consommés, le butin
   est tiré par le serveur (même format que LOOT : un tirage par famille, au plus un objet chacune).
   loot : table par bloc (seuls ces blocs vont dans le concasseur). Valeurs provisoires. */
export const CRUSHER = {
  inSlots:8, outSlots:8, cols:4, batch:100, time:60,
  loot: {
    'Terre':       { always:[], oneOf:[ { family:'gem', items:gems(0.001) },
                                        { family:'treasure', items:[{ item:'Treasure T1', chance:0.0001 }] } ] },
    'Pierre':      { always:[], oneOf:[ { family:'gem', items:gems(0.0015) },
                                        { family:'treasure', items:[{ item:'Treasure T2', chance:0.00015 }] } ] },
    'Pierre dure': { always:[], oneOf:[ { family:'gem', items:gems(0.0012) },
                                        { family:'treasure', items:[{ item:'Treasure T2', chance:0.0002 }] } ] },
  },
  opMemory: 50,        // dernières demandes retenues (une demande renvoyée n'agit pas deux fois)
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
export const SHARE = { copyToAll:[...TREASURE.tiers.map(t => t.item), 'Cristal de pleine lune'] };   // Treasure TX et butin du donjon (DUNGEON.loot)

/* génération : minerais en filons et vide en poches, de 1 à N cases d'un seul tenant */
export const GEN = { veinMax:4, airPocketMax:4 };

/* mobs (GAME_DESIGN §4). k = numéro de l'area où le mob NAÎT (pas la dernière area débloquée).
   Valeurs provisoires. */
export const MOBS = {
  /* table d'apparition : à chaque apparition, le type est tiré selon l'area du mineur visé (la dernière ligne vaut
     pour les areas plus profondes). mimic = un minerai de la roche proche devient un mimic caché ; les autres naissent
     dans une galerie. */
  spawnTable: [
    { bestiole:0.8, mimic:0.2 },
    { bestiole:0.6, gobelin:0.2, mimic:0.2 },
    { bestiole:0.4, gobelin:0.4, mimic:0.2 },
    { bestiole:0.2, gobelin:0.6, mimic:0.2 },
    { gobelin:0.7, occultiste:0.1, mimic:0.2 },
    { gobelin:0.5, occultiste:0.3, mimic:0.2 },
  ],
  /* PV = hpBase × hpGrowth^(k − minArea) : minArea = première area où le mob peut apparaître */
  hpBase:  { bestiole:50, gobelin:100, mimic:50, occultiste:100 },
  minArea: { bestiole:0,  gobelin:1,   mimic:0,  occultiste:4 },
  hpGrowth: 1.15,
  /* rythme des apparitions (tous types confondus), selon k = dernière area débloquée (intensité de la partie) */
  spawnDelay: (rng, k) => (40 + rng()*30) / (1 + 0.15*k),
  firstSpawn: 25,
  walkerCap:  k => 2 + k,          // mobs qui marchent vivants en même temps (bestioles, gobelins, occultistes ; pas les mimics)
  spawnMin: 5, spawnMax: 10,       // distance d'apparition autour du mineur visé (Manhattan)
  mimicLoot:  3,                   // minerais rapportés par un mimic vaincu
  mimicRevealDist: 2.3,
  bugLoot: rng => 1 + Math.floor(rng()*2),   // chitine
  bugItem: 'Chitine',              // objet laissé par une bestiole
  /* gobelin : tant qu'il tacle un mineur, il lui vole un minerai (bloc de type ore) toutes les goblinStealEvery
     secondes : le minerai est perdu. */
  goblinStealEvery: 2,             // secondes de tacle entre deux vols
  goblinItem: 'Peau de gobelin',
  goblinLoot:  rng => 1 + Math.floor(rng()*2),   // peau de gobelin
  goblinChitin: 1,                               // chitine
  /* occultiste : sort prêt toutes les cooldown s (la première fois cooldown s après son apparition). Il se téléporte à
     tpDist cases (Manhattan) de sa cible, sur une case vide où l'on tient et qu'on rejoint sans miner, puis canalise :
     la cible est étourdie tant que dure la canalisation (channel s). Provoqué (skill Barbare), il ne lance plus son sort
     et sa canalisation en cours s'arrête. */
  occult: { cooldown:15, channel:5, tpDist:3, tpReach:12, item:'Tissu sombre', loot: rng => 1 + Math.floor(rng()*3) },
};
/* PV d'un mob de ce type né dans l'area k */
export const mobHp = (type, k) => Math.round(MOBS.hpBase[type] * MOBS.hpGrowth ** Math.max(0, k - MOBS.minArea[type]));

/* Niveau du mineur (GAME_DESIGN §3, « Niveau et XP »). L'XP de la session va dans un pot commun, partagé à parts égales
   entre les joueurs présents à la fin (comme le coffre) et versé par le serveur.
   ore : XP par bloc de minerai miné (clé de composition) ; mob : XP par mob vaincu (type du mob ; mimic = mob de base).
   curve : XP pour passer du niveau 1 au 2 = first, puis ×factor à chaque niveau (1000, 1500, 2250…).
   talentPerLevel : points de talent gagnés à chaque niveau (dépensés plus tard dans l'onglet Talents).
   maxLevel : garde-fou de calcul. Valeurs provisoires. */
export const XP = {
  ore: { coal:1, iron:2, gold:4, diamond:7 },
  mob: { bestiole:5, gobelin:10, mimic:5, occultiste:15, minotaure:100 },
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
      { id:'ore_oxygen',  row:2, max:1, per:1,    icon:'🫧', name:'Second souffle',  desc:'Miner un minerai rend 1 d\'oxygène' },
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
  'ingot_iron','ingot_gold','ingot_tainted','ingot_tainted_gold','furnace_iron','compass_gold','shiny_iron','shiny_gold','pickaxe_stone','helmet_chitin','chest_chitin','legs_chitin','boots_chitin',
  'pickaxe_iron','sword_stone','sword_iron','helmet_iron','chest_iron','legs_iron','boots_iron','belt_goblin',
  'gloves_tactical','gloves_worker','cape_naingui','dark_cloth','dungeon_brick','minotaur','moon_crystal','angel_feather','angel_feathers',
  'ladder','chest','miner','mimic','bug','goblin','occultist','torch','stun','winch_rope','winch_top','bucket'];

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
  tiers: [ { name:'Four en pierre', speed:1 }, { name:'Four en fer', speed:1.25 } ],
  /* objets qui débloquent un four : « Utiliser » dans l'inventaire consomme l'objet et ouvre le four n° slot (0 = le
     premier), du tier donné. Seulement s'il est le prochain four fermé (le 3e four reste fermé pour l'instant). */
  unlockItems: { 'Four en fer': { slot:1, tier:1, tex:'furnace_iron' } },
  recipes: {
    Fer:     { out:'Lingot de fer',     time:60,  tex:'ingot_iron' },
    Or:      { out:'Lingot d\'or',      time:120, tex:'ingot_gold' },
  },
  alloys: [
    { out:'Tainted iron', in:{ 'Lingot de fer':5, 'Chitine':20 }, fuel:50, time:180, tex:'ingot_tainted' },
    { out:'Tainted gold', in:{ 'Lingot d\'or':5,  'Chitine':20 }, fuel:50, time:180, tex:'ingot_tainted_gold' },
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
    'Four en fer':'inhabituel', 'Four en fer BP':'inhabituel',
    'Ceinture en peau de gobelin':'inhabituel', 'Ceinture en peau de gobelin BP':'inhabituel',
    'Gants tactique':'inhabituel', 'Gants tactique BP':'inhabituel', 'Gants d\'ouvrier':'inhabituel', 'Gants d\'ouvrier BP':'inhabituel',
    'Cape de Naingui':'rare', 'Cape de Naingui BP':'rare',
    'Cristal de pleine lune':'rare',
    'Plume d\'ange':'rare',
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
    'Boussole en or':      { slot:'boussole', tex:'compass_gold',  stats:{ compassRows:1 } },   // voit 1 ligne au-dessus et en dessous
    /* tier 2 (Treasure T2) : recettes débloquées par leur blueprint */
    'Gants tactique':      { slot:'gants',  tex:'gloves_tactical', stats:{ attackSpeed:20 } },
    'Gants d\'ouvrier':    { slot:'gants',  tex:'gloves_worker',   stats:{ fortune:5 } },
    'Cape de Naingui':     { slot:'cape',   tex:'cape_naingui',    stats:{ discoverMax:1 } },
  },
  statLabels: { oxygenMax:'Oxygène', pods:'Pods', climbSpeed:'Vitesse (échelle)', speed:'Vitesse (marche)',
                mineSpeed:'Vitesse de minage', damage:'Dégâts', light:'Vision', compass:'Portée boussole', compassRows:'Lignes boussole (dessus/dessous)',
                torches:'Torches', bridges:'Passerelles', discoverMax:'Découverte',
                attackSpeed:'Vitesse d\'attaque', fortune:'Fortune' },
  statUnits: { attackSpeed:' %', fortune:' %' },       // unité affichée après la valeur d'une stat
  /* stats du mineur affichées dans l'onglet Stuff (base STATS + bonus des pièces portées), dans cet ordre */
  shownStats: ['oxygenMax','pods','speed','climbSpeed','mineSpeed','damage','attackSpeed','fortune','discoverMax','light','compass','compassRows','torches','bridges'],
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
  ...Object.fromEntries(Object.entries(FURNACE.unlockItems).map(([n, d]) => [n, { cat:'furnace', tex:d.tex, stack:true }])),
  'Tissu sombre':    { cat:'material',  tex:'dark_cloth', stack:true },
  'Cristal de pleine lune': { cat:'material', tex:'moon_crystal', w:1, stack:true },   // butin du minotaure (DUNGEON.loot)   // matériau de la Cape de Naingui, laissé par l'occultiste (MOBS.occult)
  'Plume d\'ange':   { cat:'material',  tex:'angel_feather', stack:true },              // ramassée dans la mine instantanée (INSTANT_MINE)
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

/* ---- Mine instantanée (MI, GAME_DESIGN §6 « Mine instantanée ») *(décisions du créateur, 21/10/2026 ; valeurs
   provisoires)* ----
   Toutes les everyHours heures pile, heure de Paris (0 h, 2 h, 4 h…), une mine commune s'ouvre aux inscrits du lobby
   MI, chacun pour soi, pendant duration secondes de jeu (à la vitesse GAME.speed : 2 min 30 réelles à x2).
   Mine : w × h blocs, tous des minerais (comp, en %) sauf feather % de cases vides portant un tas de plumes d'ange
   (featherMin à featherMax plumes, ramassées par le premier mineur qui arrive sur la case). Entièrement éclairée,
   sans oxygène, pods, mobs, torches ni échelles : le mineur se déplace librement dans les galeries creusées.
   Les mineurs apparaissent sur la ligne de surface (au-dessus de la mine), espacés régulièrement.
   maxPerMine : au-delà, les inscrits sont répartis en plusieurs mines de tailles égales (21 → 11 + 10).
   IA (src/sim/instant/) : chaque bloc vaut pareil ; elle vise le bloc le plus proche en temps de trajet (le temps de
   minage n'entre pas en compte), plus :
     crowdRadius / crowdWeight : s de pénalité par autre mineur à moins de crowdRadius cases (Manhattan) du bloc,
                                 décroissante avec la distance ; vaut aussi pour la cible des autres ;
     takenPenalty : s de pénalité si un autre mineur mine déjà ce bloc ;
     interruptMax : blocs perdus d'affilée (un autre a fini le même bloc avant lui) avant de changer de zone ;
     fleeDist / fleeTime : il vise alors des blocs à au moins fleeDist cases de là pendant fleeTime s de jeu ;
     featherReach : un tas de plumes accessible à au plus featherReach pas (par les galeries) passe avant tout : il va
                    le chercher (ramassage opportuniste, décision du 21/10/2026 ; le premier arrivé le prend).
   notify : rappels (s avant l'ouverture) ; inviteAt : le dernier rappel propose Rejoindre / Décliner.
   Ni XP, ni partage : le butin de chacun va dans son inventaire à la fin ; Quitter = rien. */
export const INSTANT_MINE = {
  everyHours: 2, timeZone: 'Europe/Paris',
  duration: 300,                       // s de jeu
  w: 50, h: 50,
  comp: { coal:20, iron:40, gold:39 }, feather: 1,
  featherMin: 1, featherMax: 5,
  maxPerMine: 20,
  crowdRadius: 4, crowdWeight: 3, takenPenalty: 10,
  interruptMax: 3, fleeDist: 8, fleeTime: 20,
  featherReach: 3,
  notify: [30*60, 15*60, 5*60, 30], inviteAt: 30,
  featherItem: 'Plume d\'ange', featherTex: 'angel_feather', heapTex: 'angel_feathers',
};

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
  fightMobs: { label:'Face aux mobs',   options:[[true,'Combattre'], [false,'Ignorer'], ['flee','Fuir']] },   // Fuir = Ignorer + n'entre jamais dans un donjon
  helpAllies:{ label:'Aider allié',     options:[[false,'Non'], [true,'Oui']] },
};
/* ---- Donjon (src/sim/dungeon.js) — décisions du créateur, 21/10 ; valeurs provisoires ----
   Généré dans les areas `areas` avec la probabilité `chance` (tirage à part de la seed : le reste de l'area ne change
   pas). Carré de size × size : murs en briques incassables (DUNGEON_WALL), intérieur vide, UNE entrée dans le mur de
   gauche ou de droite, sur l'une des holeRows lignes du bas de l'intérieur (on y entre en marchant, chute de 2 au plus).
   Placement : à margin cases au moins des bords de la mine et des limites de l'area (l'entrée ne donne jamais sur un
   bord), et jamais sur la colonne du treuil ± winchGap.
   Dedans : un boss (minotaure, enfermé dans sa salle, il ne fait que tacler). Découvrir un bloc de la structure
   déclenche le donjon :
   - un barbare dans la partie : tous se rassemblent devant l'entrée ; le barbare entre le premier, puis les autres
     (sauf ceux réglés sur « Fuir », qui reprennent leur travail) ;
   - pas de barbare : personne n'y entre ; un mineur qui s'y retrouve quand même est effrayé scaredTime s : si le boss
     le tacle pendant ce temps, il s'enfuit d'un coup à la surface.
   Butin du boss : loot (chaque joueur présent à la fin en reçoit la quantité entière, comme les Treasure TX). */
export const DUNGEON = {
  areas: [5], chance: 0.2, size: 10, margin: 2, winchGap: 5, holeRows: 3,
  boss: { type:'minotaure', name:'Minotaure', tex:'minotaur', hp:1000 },
  loot: { item:'Cristal de pleine lune', min:1, max:3, tex:'moon_crystal' },
  scaredTime: 15,
  salt: 0x0d06e0,
};

/* mobs présentés dans le lobby (option « Aider allié » : ignoré oui / non) : nom et texture */
export const MOB_INFO = {
  bestiole:   { name:'Bestiole',   tex:'bug' },
  gobelin:    { name:'Gobelin',    tex:'goblin' },
  mimic:      { name:'Mimic',      tex:'mimic', under:'iron' },   // le mimic se dessine par-dessus un minerai
  occultiste: { name:'Occultiste', tex:'occultist' },
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
  ['STATS','discoverMax','Découverte max (blocs)',0,20], ['STATS','light','Vision mobs max',0,50], ['STATS','compass','Portée boussole',0,50], ['STATS','compassRows','Lignes boussole (±)',0,5],
  ['STATS','torches','Torches',0,1000], ['STATS','bridges','Passerelles',0,1000], ['CFG','ladderTime','Temps échelle (s)',0,60],
  ['CFG','unlockRatio','Seuil déblocage (0-1)',0,1],
];
