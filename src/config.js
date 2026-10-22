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
/* tenacity = chance, en %, d'ignorer un sort de mob qui le vise (vol du gobelin, canalisation de l'occultiste) : un tirage
   par sort (décision du 21/10, Geoffrey) ; 0 de base */
/* stats d'amélioration (onglet Amélioration, lignes tirées à l'identification ; 0 de base, en %) :
   mineSpeedPct / damagePct = bonus en % : vitesse de minage = mineSpeed × (1 + mineSpeedPct/100), pareil pour les dégâts ;
   crit = chance qu'un coup fasse le double de dégâts ; oneTap = chance de casser un bloc instantanément ;
   piercing = chance de casser aussi le bloc juste derrière celui miné ; looting = butin des mobs en plus (comme Pillage) */
export const STATS = { oxygenMax:300, speed:3, climbSpeed:2.25, mineSpeed:1, damage:5, attackSpeed:100, fortune:0, pods:200, light:6, compass:8,
  compassRows:0, torches:20, torchRadius:5, discoverMax:2, tenacity:0,
  bridges:Infinity,   // passerelles illimitées (21/10, Geoffrey) : la stat reste pour un futur coût éventuel
  mineSpeedPct:0, damagePct:0, crit:0, oneTap:0, piercing:0, looting:0 };

export const CFG = {
  ladderTime:2, refillRate:30, unlockRatio:0.6,
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
  endStayMin:45,          // en dessous de ce temps restant, il ne repart jamais
  /* fin de session (22/10, Geoffrey) : il ne descend pas plus bas que la profondeur où l'aller et le retour depuis la
     surface laissent cette part du temps restant à miner (il mine plus haut au lieu d'aller au front pour remonter
     aussitôt). Vitesse estimée d'après sa dernière remontée (secondes par couche, échelles et détours compris). */
  endWorkShare:0.5,
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

/* attrait d'un treasure découvert pour l'IA (val), repris tel quel pour les résidus */
const TREASURE_VAL = 12;
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
  10:{name:'Treasure', type:'treasure', tex:'treasure', w:0, hard:1.0, color:'#7d828c', dot:'#ffd23f', val:TREASURE_VAL, noDrop:true},
  /* mur de donjon (DUNGEON) : brique de pierre violet sombre, incassable */
  11:{name:'Brique de donjon', type:'special', tex:'dungeon_brick', w:0, hard:Infinity, color:'#3a2a4a', dot:'#55406b', unbreakable:true, noDrop:true},
  /* résidus (concept Ange vs Démon, JUDGMENT) : pierre sombre aux fissures lumineuses, dès l'area 4. Bloc ordinaire
     (terrain) : pas de Fortune, pas de shiny, ne compte pas pour le déblocage. Visé par l'IA une fois découvert, au
     même poids qu'un treasure (val, 22/10/2026 ; avant : jamais visé). Rapportés au coffre, ils remplissent les
     jauges de l'onglet Jugement. */
  12:{name:'Résidu angélique',  type:'terrain', tex:'residue_angel', w:6, hard:2.4, color:'#2c2f3a', dot:'#8fd8ff', family:'residu', val:TREASURE_VAL},
  13:{name:'Résidu démoniaque', type:'terrain', tex:'residue_demon', w:6, hard:2.4, color:'#2c2f3a', dot:'#ff3b3b', family:'residu', val:TREASURE_VAL},
  /* tours de l'Ange et du Démon (TOWER) : stonebrick qui remplit la tour (6 s, ne rapporte rien) et sa version
     indestructible (5 % de l'intérieur, murs). Jamais dans la mine normale. */
  14:{name:'Stonebrick angélique', type:'special', tex:'brick_angel', w:0, hard:6, color:'#bfe3ff', dot:'#e8f4ff', noDrop:true},
  15:{name:'Stonebrick angélique indestructible', type:'special', tex:'brick_angel_hard', w:0, hard:Infinity, color:'#7fa6c9', dot:'#ffd23f', unbreakable:true, noDrop:true},
  16:{name:'Stonebrick démoniaque', type:'special', tex:'brick_demon', w:0, hard:6, color:'#4a1f3a', dot:'#7a2f5a', noDrop:true},
  17:{name:'Stonebrick démoniaque indestructible', type:'special', tex:'brick_demon_hard', w:0, hard:Infinity, color:'#2a0f22', dot:'#ff3b3b', unbreakable:true, noDrop:true},
};
export const BARRIER = 7, BRIDGE = 8, TREASURE_BLOCK = 10, DUNGEON_WALL = 11;
/* clés utilisées dans les compositions d'areas ; « air » = case vide (id 0), générée en poches */
export const IDS = { air:0, dirt:1, stone:2, coal:3, iron:4, gold:5, diamond:6, hardstone:9, residueAngel:12, residueDemon:13 };

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
    /* chances par lot de 100 blocs (décision du créateur, 22/10/2026) : « Une gemme » = chance d'avoir une gemme (les 3
       gemmes se partagent ce total à parts égales : 0,6 % = 3 × 0,2 %), « Treasure » = chance d'avoir le treasure.
       Terre 0,6 % / 0,5 % ; Pierre 0,9 % / 0,3 % ; Pierre dure 1,2 % / 0,5 % (avant : gemme 0,3 / 0,45 / 0,36 %,
       treasure 0,01 / 0,015 / 0,02 %) */
    'Terre':       { always:[], oneOf:[ { family:'gem', items:gems(0.002) },
                                        { family:'treasure', items:[{ item:'Treasure T1', chance:0.005 }] } ] },
    'Pierre':      { always:[], oneOf:[ { family:'gem', items:gems(0.003) },
                                        { family:'treasure', items:[{ item:'Treasure T2', chance:0.003 }] } ] },
    'Pierre dure': { always:[], oneOf:[ { family:'gem', items:gems(0.004) },
                                        { family:'treasure', items:[{ item:'Treasure T2', chance:0.005 }] } ] },
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
     la cible est étourdie tant que dure la canalisation (channel s). Un coup d'un barbare qui a la Provocation interrompt
     sa canalisation en cours, mais ne l'empêche pas d'en relancer une (21/10). La ténacité de la cible peut l'ignorer. */
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
   l'utilise en même temps, et on peut s'arrêter à n'importe quelle ligne. Plus lent qu'une échelle : l'IA peut sortir
   du seau pour une colonne d'échelles ou un trou à côté (×2 essayé le 22/10/2026, refusé : la vitesse ne change pas). */
export const WINCH = { x: Math.floor(W/2), speedFactor:0.85 };

export const CAMERA = { top:-3, margin:4, ease:0.15, wheelRows:3, keyRows:4,
  minRows:20, maxRows:48 };   // lignes visibles : la mine remplit la largeur, et montre autant de lignes que la hauteur en permet

/* ---- Skills (onglet Skills, src/meta/skills.js) ----
   1 point par niveau gagné (XP.talentPerLevel). Trois arbres ; dépenser un point dans un arbre bloque les deux autres
   (jusqu'au reset, gratuit, hors session). Chaque étape exige l'étape précédente au rang max.
   Un nœud : id, max (rangs), per (valeur par rang ; 1 = interrupteur), desc (texte, {v} = valeur au rang actuel).
   adds (facultatif) : { stat: points par rang } ajoutés aux STATS du mineur (ex. ténacité en %) ; {stat} dans desc.
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
      { id:'damage',      row:1, max:3, per:0.05, icon:'🪓', name:'Force brute',     desc:'Dégâts infligés +{v}, ténacité +{tenacity}', adds:{ tenacity:5 } },
      { id:'taunt',       row:2, max:1, per:1,    icon:'😤', name:'Provocation',     desc:'Le mob qu\'il frappe lâche les autres mineurs et ne peut plus tacler que lui ; ses coups interrompent la canalisation d\'un occultiste' },
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
  'residue_angel','residue_demon','rune','chest_angel','chest_demon',
  'brick_angel','brick_angel_hard','brick_demon','brick_demon_hard','boss_angel','boss_demon',
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

/* ---- Coffres de tour et runes (concept Ange vs Démon, étape 3 ; spec docs/superpowers/specs/2026-10-22-ange-demon-design.md) ----
   Le boss d'une tour donne à chaque joueur un coffre de sa tour, de qualité R1 à R7 (chances UPGRADE.qualities), un
   objet par qualité : « Coffre angélique R4 ». Ouvert depuis l'inventaire (comme un Treasure), il donne une Rune de la
   même qualité, dont les lignes (stat et %) sont tirées à l'ouverture comme une identification. Rune ange = rune
   démon. Enchantement (onglet Amélioration) : la rune est consommée, ses lignes s'ajoutent à une pièce de stuff, une
   seule rune par pièce, définitif.
   Depuis le 22/10/2026 (Geoffrey) : le boss donne un « Trésor » (treasures) au lieu d'un « Coffre » : non empilable,
   rareté `treasureRarity` (contour de case) quelle que soit sa qualité, nom affiché « <qualité> Trésor démoniaque »
   (« Antique Trésor démoniaque ») dans la couleur de sa qualité (UPGRADE.qualities). Nom interne : « Trésor
   démoniaque R5 ». Les anciens « Coffre démoniaque R5 » (chests) restent dans le catalogue, empilables et ouvrables
   (décision : pas de conversion), mais ne sont plus donnés. */
export const RUNE = {
  item: 'Rune', tex: 'rune', chestWeight: 2,
  treasures: { angel: { name:'Trésor angélique', tex:'chest_angel' }, demon: { name:'Trésor démoniaque', tex:'chest_demon' } },
  treasureRarity: 'unique',
  /* ancien : coffres empilables, plus donnés depuis le 22/10 ; rareté (contour de case) selon la qualité */
  chests: { angel: { name:'Coffre angélique', tex:'chest_angel' }, demon: { name:'Coffre démoniaque', tex:'chest_demon' } },
  rarity: { 1:'commun', 2:'inhabituel', 3:'rare', 4:'epique', 5:'legendaire', 6:'legendaire', 7:'legendaire' },
};
const QUALITY_NUMS = [1,2,3,4,5,6,7];
/* nom interne du trésor d'une tour (side : 'angel' | 'demon') et d'une qualité (1 à 7) : « Trésor démoniaque R5 » */
export const treasureItem = (side, q) => `${RUNE.treasures[side].name} R${q}`;
const TREASURE_ITEMS = Object.fromEntries(Object.entries(RUNE.treasures).flatMap(([side, c]) =>
  QUALITY_NUMS.map(q => [treasureItem(side, q), { cat:'treasure', tex:c.tex, w:RUNE.chestWeight, stack:false, chest:{ side, q }, treasure:true }])));
/* ancien : nom de l'objet coffre d'une tour et d'une qualité (« Coffre angélique R4 ») */
export const chestItem = (side, q) => `${RUNE.chests[side].name} R${q}`;
const CHEST_ITEMS = Object.fromEntries(Object.entries(RUNE.chests).flatMap(([side, c]) =>
  QUALITY_NUMS.map(q => [chestItem(side, q), { cat:'treasure', tex:c.tex, w:RUNE.chestWeight, stack:true, chest:{ side, q } }])));

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
    { id:'unique',     label:'Unique',     color:'#c0480f' },     // trésors des tours (RUNE.treasureRarity)
  ],
  default: 'commun',
  items: {
    'Résidu angélique':'rare', 'Résidu démoniaque':'rare', [RUNE.item]:'epique',
    ...Object.fromEntries(Object.entries(CHEST_ITEMS).map(([n, d]) => [n, RUNE.rarity[d.chest.q]])),
    ...Object.fromEntries(Object.keys(TREASURE_ITEMS).map(n => [n, RUNE.treasureRarity])),
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
/* hasard « live » des stats d'amélioration (critique, coup unique, perçage) : G.gearRng, tiré de la seed, à part.
   Il n'est tiré que si la stat est au-dessus de 0 : sans ces stats, une partie est identique à avant. */
export const GEAR_RNG = { salt: 0x6ea7c0de };

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
    'Pioche en pierre':    { slot:'pioche', tex:'pickaxe_stone', stats:{ mineSpeed:0.2 } },
    'Casque en chitine':   { slot:'casque', tex:'helmet_chitin', stats:{ oxygenMax:30 } },
    'Plastron en chitine': { slot:'torse',  tex:'chest_chitin',  stats:{ pods:25 } },
    'Jambes en chitine':   { slot:'jambes', tex:'legs_chitin',   stats:{ climbSpeed:0.4 } },
    'Bottes en chitine':   { slot:'pieds',  tex:'boots_chitin',  stats:{ speed:0.5 } },
    /* pièces en fer et ceinture : recettes débloquées par leur blueprint (src/recipes.js) */
    'Pioche en fer':       { slot:'pioche', tex:'pickaxe_iron',  stats:{ mineSpeed:0.4 } },
    'Épée en pierre':      { slot:'epee',   tex:'sword_stone',   set:{ damage:8 } },      // remplace les mains nues (5) : +3, moitié de l'épée en fer
    'Épée en fer':         { slot:'epee',   tex:'sword_iron',    set:{ damage:11 } },     // remplace les mains nues (5)
    'Casque en fer':       { slot:'casque', tex:'helmet_iron',   stats:{ oxygenMax:38 } },
    'Plastron en fer':     { slot:'torse',  tex:'chest_iron',    stats:{ pods:33 } },
    'Jambes en fer':       { slot:'jambes', tex:'legs_iron',     stats:{ climbSpeed:0.6 } },
    'Bottes en fer':       { slot:'pieds',  tex:'boots_iron',    stats:{ speed:0.6 } },
    'Ceinture en peau de gobelin': { slot:'ceinture', tex:'belt_goblin', stats:{ torches:10 } },
    'Boussole en or':      { slot:'boussole', tex:'compass_gold',  stats:{ compassRows:1 } },   // voit 1 ligne au-dessus et en dessous
    /* tier 2 (Treasure T2) : recettes débloquées par leur blueprint */
    'Gants tactique':      { slot:'gants',  tex:'gloves_tactical', stats:{ attackSpeed:20 } },
    'Gants d\'ouvrier':    { slot:'gants',  tex:'gloves_worker',   stats:{ fortune:5 } },
    'Cape de Naingui':     { slot:'cape',   tex:'cape_naingui',    stats:{ discoverMax:1 } },
  },
  statLabels: { oxygenMax:'Oxygène', pods:'Pods', climbSpeed:'Vitesse (échelle)', speed:'Vitesse (marche)',
                mineSpeed:'Vitesse de minage', damage:'Dégâts', light:'Vision', compass:'Portée boussole', compassRows:'Lignes boussole (dessus/dessous)',
                torches:'Torches', bridges:'Passerelles', discoverMax:'Découverte',
                attackSpeed:'Vitesse d\'attaque', fortune:'Fortune', tenacity:'Ténacité',
                mineSpeedPct:'Vitesse de minage', damagePct:'Dégâts', crit:'Critique', oneTap:'Coup unique',
                piercing:'Perçage', looting:'Butin des mobs' },
  statUnits: { attackSpeed:' %', fortune:' %', tenacity:' %', mineSpeedPct:' %', damagePct:' %', crit:' %', oneTap:' %', piercing:' %', looting:' %' },   // unité affichée après la valeur d'une stat
  /* stats du mineur affichées dans l'onglet Stuff (base STATS + bonus des pièces portées), dans cet ordre */
  shownStats: ['oxygenMax','pods','speed','climbSpeed','mineSpeed','mineSpeedPct','damage','damagePct','attackSpeed','crit','fortune','tenacity','oneTap','piercing','looting',
               'discoverMax','light','compass','compassRows','torches'],
  opMemory: 50,        // dernières demandes retenues (une demande renvoyée n'agit pas deux fois)
};

/* ---- Hors session : amélioration (onglet Amélioration, src/meta/upgrade.js) ----
   Identification : une pièce de stuff pas encore identifiée + un autre exemplaire du même objet (sacrifié, peu importe
   sa qualité) → le serveur tire une qualité (chance) puis `lines` lignes de stats. Définitive.
   Une ligne : une stat tirée dans `pool` (deux lignes peuvent tomber sur la même), et un % tiré entre min et max ;
   sa valeur en x = valeur de l'objet en x (somme de ses stats × prices) × % ; en points = valeur en x ÷ prix de la stat,
   arrondie au pas de la stat (steps), au moins un pas. Ex. R4 sur pioche en pierre (0,1 × 1300 = 130 x), ligne à 32 % :
   41,6 x → +0,032 de vitesse de minage, ou +1,2 % de fortune, ou +7 pods. La pièce garde le % (32), pas la valeur :
   un rééquilibrage des prix s'applique aux pièces déjà tirées.
   discover : en R6 et R7, chaque ligne a `chance` d'être « +1 Découverte » (une au plus par objet).
   Amélioration (+1 à +levels.length) : `pct` = bonus TOTAL du palier sur toutes les stats de l'objet (base et lignes) ;
   réussite = chance ; un échec ne coûte que les matériaux. Matériaux : Plume d'ange (mine instantanée) et Cristal de
   pleine lune (minotaure du donjon, DUNGEON.loot). Toutes les valeurs sont provisoires (équilibrage). */
export const UPGRADE = {
  /* fourchette d'UNE ligne (% de la valeur de l'objet) ; total max = lines × max : 25, 30, 35, 40, 50, 75, 100 %
     (nerf du 22/10/2026, avant 30 à 220 %) ; min = même rapport min/max qu'avant */
  qualities: [
    { q:1, label:'Utile',          color:'#FFFFFF', chance:0.30, min:8,    max:25, lines:1 },
    { q:2, label:'Bon',            color:'#00FF00', chance:0.24, min:15,   max:30, lines:1 },
    { q:3, label:'Haute qualité',  color:'#0080FF', chance:0.24, min:17.5, max:35, lines:1 },
    { q:4, label:'Excellent',      color:'#FF00FF', chance:0.14, min:12.5, max:20, lines:2 },
    { q:5, label:'Antique',        color:'#FFA500', chance:0.04, min:17.5, max:25, lines:2 },
    { q:6, label:'Mystérieux',     color:'#FF0000', chance:0.03, min:15,   max:25, lines:3 },
    { q:7, label:'Légendaire',     color:'#FFFF00', chance:0.01, min:16,   max:25, lines:4 },
  ],
  /* barème des fourchettes : une pièce identifiée garde le numéro du barème (champ s, absent = 1). À la relecture, une
     ligne d'un ancien barème est ramenée dans la fourchette actuelle À LA MÊME PLACE (le haut de l'ancienne fourchette
     donne le haut de la nouvelle) : les pièces déjà tirées suivent le rééquilibrage (src/meta/piece.js, sanitizePiece). */
  scale: 2,
  oldScales: {
    1: { 1:[10,30], 2:[20,40], 3:[30,60], 4:[25,40], 5:[35,50], 6:[30,50], 7:[35,55] },   // jusqu'au 22/10/2026
  },
  discover: { qualities:[6, 7], chance:0.25, value:1 },
  /* stats qui peuvent tomber sur une ligne (toutes celles qui ont une valeur en x ; pas la Découverte, à part) */
  pool: ['mineSpeed','mineSpeedPct','damage','damagePct','attackSpeed','crit','fortune','oneTap','piercing','looting',
         'speed','climbSpeed','pods','oxygenMax'],
  /* VALEUR d'un objet en x = somme de ses stats × worth (catalogue mesuré de GAME_DESIGN §3, mineur de base) :
     pioche en pierre 0,1 × 1300 = 130 x, épée en fer (11 − 5) × 40 = 240 x. */
  worth: { mineSpeed:1300, speed:240, climbSpeed:250, pods:6, oxygenMax:4, damage:40, attackSpeed:1.96, fortune:36,
           discoverMax:190, compassRows:300, mineSpeedPct:13, damagePct:2, crit:13, oneTap:13, piercing:7, looting:10 },
  /* CONVERSION d'une ligne (identification, rune) : x par point de stat. Tableau du créateur du 22/10/2026, donné
     « pour 100 x » : vitesse de minage +0,05, minage % +5, dégâts +2,5, dégâts % +20, vitesse d'attaque +20, critique +7,
     fortune +2, coup unique +7, perçage +10, butin des mobs +10, marche +0,4, montée +0,3, pods +20, oxygène +25.
     prix = 100 ÷ valeur pour 100 x. Les pièces gardent leur %, elles suivent donc ce tableau sans migration. */
  prices: { mineSpeed:2000, mineSpeedPct:20, damage:40, damagePct:5, attackSpeed:5, crit:100/7, fortune:50, oneTap:100/7,
            piercing:10, looting:10, speed:250, climbSpeed:1000/3, pods:5, oxygenMax:4, discoverMax:190, compassRows:300 },
  /* pas d'arrondi de chaque stat (valeur d'une ligne, et stats d'une pièce améliorée) */
  steps: { mineSpeed:0.001, speed:0.01, climbSpeed:0.01, pods:1, oxygenMax:1, damage:0.1, attackSpeed:0.1, fortune:0.1,
           discoverMax:1, compassRows:1, mineSpeedPct:0.1, damagePct:0.1, crit:0.1, oneTap:0.1, piercing:0.1, looting:0.1 },
  levels: [
    { pct:3, chance:1.00, cost:{ 'Plume d\'ange':20, 'Cristal de pleine lune':3 } },   // plumes : 20 / 30 / 50 (22/10, Geoffrey)
    { pct:5, chance:0.95, cost:{ 'Plume d\'ange':30, 'Cristal de pleine lune':5 } },
    { pct:7, chance:0.90, cost:{ 'Plume d\'ange':50, 'Cristal de pleine lune':7 } },
  ],
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
  ...TREASURE_ITEMS,                                                                    // trésors des tours (RUNE)
  ...CHEST_ITEMS,                                                                       // ancien : coffres des tours (RUNE)
  [RUNE.item]:       { cat:'rune', tex:RUNE.tex, w:1, stack:false },                   // une rune = une pièce (qualité, lignes)
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
                  'invite', 'guest', 'anonyme', 'deepidlemine', 'deepmineidle', 'serveur', 'server', 'root'],
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
  featherMin: 1, featherMax: 2,                       // 22/10 (Geoffrey) : 1-2 par tas (avant 1-5)
  maxPerMine: 20,
  crowdRadius: 4, crowdWeight: 3, takenPenalty: 10,
  interruptMax: 3, fleeDist: 8, fleeTime: 20,
  /* tas de plumes (22/10, Geoffrey) : un tas DÉCOUVERT passe avant tout, même enfermé dans la roche : le mineur creuse
     droit vers lui. Il le chasse s'il est à au plus featherReach cases (à vol d'oiseau, en Manhattan) et qu'aucun autre
     mineur n'en est plus proche (le plus proche y va, égalité : le plus petit numéro). Avant : seulement les tas
     accessibles à 3 pas par les galeries déjà creusées. */
  featherReach: 8,
  /* cap (22/10, Geoffrey) : avant, tous les mineurs creusaient droit vers le bas jusqu'au fond. Chacun a un cap (une des
     headings : [dx, dy, poids]) qu'il garde turnBlocks[0] à turnBlocks[1] blocs minés, puis il en tire un autre. Un bloc
     miné dans le sens du cap ne coûte rien de plus ; dans le sens opposé, headingWeight s de pénalité (au travers :
     la moitié). Plus headingWeight est grand, plus les galeries sont droites. */
  headings: [[-1,0,2], [1,0,2], [0,1,1.5], [0,-1,0.6], [-1,1,1.5], [1,1,1.5], [-1,-1,0.5], [1,-1,0.5]],
  headingWeight: 1.5, turnBlocks: [6, 14],
  /* inscriptions (22/10, Geoffrey) : ouvertes seulement signupBefore s avant l'ouverture (11 h 30 pour 12 h), même en
     session ; encore en session à l'heure = mine ratée, la session continue */
  signupBefore: 30*60,
  /* découverte (22/10, Geoffrey) : la mine est cachée au départ (sauf la surface) ; chaque mineur découvre autour de lui
     dans un rayon de sa stat discoverMax (tout est éclairé : le rayon entier, comme une case en pleine lumière) */
  /* caméra (22/10, Geoffrey) : elle suit ton mineur ; camCols colonnes à l'écran (zoom), autant de lignes que la
     hauteur le permet (au moins camMinRows) */
  camCols: 24, camMinRows: 14, camEase: 0.2,
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
export const PARTY = { codeLength:6, poll:2500, pollInSession:5000 };   // ms : rafraîchissement du lobby (plus lent pendant une session)

/* Types de mine qu'on choisit dans le lobby (ready:false = annoncé, pas encore jouable ; scheduled = ne se lance pas
   avec « Lancer » : s'ouvre à heure fixe pour les inscrits, voir INSTANT_MINE). */
export const MINE_MODES = [
  { id:'mine', label:'Mine',              icon:'⛏', ready:true  },
  { id:'mi',   label:'Mine instantanée',  icon:'🌀', ready:true, scheduled:true },   // MI : inscription dans le lobby
  /* tours du Jugement : proposées seulement quand elles sont ouvertes (JUDGMENT, TOWER) */
  { id:'tower_angel', label:'Tour de l\'Ange', icon:'😇', ready:true, tower:'angel' },
  { id:'tower_demon', label:'Tour du Démon',   icon:'😈', ready:true, tower:'demon' },
];
/* onglet Social : le navigateur redemande la liste d'amis et les notifications toutes les `poll` ms (onglet visible),
   `hiddenPoll` ms quand l'onglet est caché (ça reste un signe de vie : l'ami apparaît en ligne) */
export const SOCIAL = { poll:4000, hiddenPoll:20000 };

/* Chat de session (22/10/2026) : les joueurs d'une session (encore là) s'écrivent pendant la partie, dans l'onglet
   Session. Gardé en mémoire du serveur seulement (rien en base), effacé à la fin de la session.
   maxLen : caractères par message · keep : derniers messages gardés par session · gapMs : délai minimal entre deux
   messages d'un joueur · poll : rafraîchissement dans le navigateur (ms) · ttlMs : un salon sans message depuis ce
   temps est oublié (filet de sécurité, la session dure 1 h) */
export const CHAT = { maxLen:200, keep:50, gapMs:1000, poll:3000, ttlMs:3*3600e3 };

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
  areas: [4, 5], chance: 0.33, size: 10, margin: 2, winchGap: 5, holeRows: 3,   // 33 % par area, tirages indépendants (22/10, Geoffrey ; avant : 100 %)
  boss: { type:'minotaure', name:'Minotaure', tex:'minotaur', hp:1000 },
  loot: { item:'Cristal de pleine lune', min:1, max:3, tex:'moon_crystal' },
  scaredTime: 15,
  salt: 0x0d06e0,
};

/* ---- Jugement : concept Ange vs Démon (22/10/2026, décisions du créateur ; spec docs/superpowers/specs/2026-10-22-ange-demon-design.md) ----
   Résidus : dans chaque area à partir de fromArea, pct % des cases de chaque sorte (tirage à part de la seed, à la place
   de terrain : le reste de l'area ne change pas). Jauges (serveur, ns judgment) : les résidus versés aux joueurs en fin
   de session s'ajoutent à la jauge de leur sorte ; à cap, le donjon associé ouvre pendant openHours h (la jauge
   repart de 0, le surplus est perdu ; elle continue de se remplir pendant l'ouverture). */
export const JUDGMENT = {
  fromArea: 4, pct: 0.5, cap: 250, openHours: 6, salt: 0x5e51d0e,
  sides: {
    angel: { block: 12, item:'Résidu angélique',  label:'Ange',  tower:'Tour de l\'Ange',  color:'#f4f7ff' },
    demon: { block: 13, item:'Résidu démoniaque', label:'Démon', tower:'Tour du Démon',  color:'#8b3fd9' },
  },
  poll: 15000,          // ms : rafraîchissement de l'onglet Jugement
};

/* ---- Tours de l'Ange et du Démon (concept Ange vs Démon, étape 4 ; src/sim/tower/) ----
   Ouvertes par le Jugement (JUDGMENT) ; lancées depuis le Lobby (« Où miner »), groupe de 1 à maxPlayers. Une tour
   pleine de stonebrick (6 s) en labyrinthe : les mineurs partent du rez-de-chaussée et creusent vers le toit, où le
   boss attend. L'intérieur n'est pas découvert au départ : chaque mineur découvre autour de lui (discoverMax, comme
   dans la mine, sans lumière). Gravité, échelles et passerelles (dans la tour seulement) ; ni oxygène, ni pods, ni
   butin des blocs, ni mobs. Boss mort = fin : chaque joueur présent reçoit un coffre (RUNE).
   Carte : marge de `margin` colonnes de chaque côté ; tour de `width` colonnes (murs compris) et `height` lignes
   (toit compris) ; `sky` lignes de ciel au-dessus du toit ; sol plein en dessous. Portes : les doorH lignes du bas des
   deux murs. Boss : bossW × bossH au milieu du toit, immobile, pas provocable ; il frappe sa cible (premier arrivé sur
   le toit, encore dessus) toutes les hitEvery s (rageEvery sous rageBelow de ses PV) ; chaque coup a knockChance
   (knockBarb pour un barbare) de la projeter de knock cases vers l'extérieur (elle tombe de la tour). */
export const TOWER = {
  duration: 600,                                  // s de jeu (10 min, 22/10 : labyrinthe + brouillard ; avant 15 min)
  width: 15, height: 30, sky: 7, margin: 8, doorH: 2,
  /* labyrinthe (22/10, Geoffrey ; avant : 5 % de blocs indestructibles au hasard) : une ligne sur mazeEvery est une
     ligne de mur, mazeHard blocs indestructibles sur `width` (murs extérieurs compris), soit un seul passage de
     width − mazeHard cases, placé au hasard sans chevaucher celui de la ligne de mur précédente : on zigzague */
  mazeEvery: 2, mazeHard: 11,
  /* vue (navigateur) : cases montrées autour du mineur suivi (avant : toute la tour à l'écran) */
  view: { cols: 19, rows: 15 },
  boss: { hp: 1000, w: 3, h: 5, hitEvery: 1, rageBelow: 0.33, rageEvery: 0.5, knockChance: 0.10, knockBarb: 0.05, knock: 6 },
  sides: {
    angel: { tower:'Tour de l\'Ange',  boss:'Ange',  brick:14, hard:15, bossTex:'boss_angel', icon:'😇' },
    demon: { tower:'Tour du Démon', boss:'Démon', brick:16, hard:17, bossTex:'boss_demon', icon:'😈' },
  },
  salt: 0x70e7e5,
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
  ['STATS','torches','Torches',0,1000], ['CFG','ladderTime','Temps échelle (s)',0,60],
  ['CFG','unlockRatio','Seuil déblocage (0-1)',0,1],
];
