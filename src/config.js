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
/* torchRadius = rayon de la lumière d'une torche (cases), torchTime = temps pour en poser une (s) : stats du MINEUR depuis
   le 25/10/2026 (Geoffrey, Lampe à incandescence) ; chaque torche garde le rayon de celui qui l'a posée. Avant :
   STATS.torchRadius pour toutes les torches de la partie et CFG.torchTime. */
/* knockRes = résistance au recul, en % : un coup qui le pousse de k blocs ne le pousse que de k × (1 − knockRes/100)
   (25/10/2026, Geoffrey) ; 0 de base, aucune pièce ne la donne pour l'instant (voir COMBAT) */
/* reach / knockback = portée d'attaque et recul du mineur, en blocs, AJOUTÉS à COMBAT.reach (0,5) et COMBAT.knock (0,25)
   (25/10/2026, Geoffrey : Lance en fer) ; 0 de base. Les mobs gardent COMBAT.reach pour tacler. */
/* stats d'amélioration (onglet Amélioration, lignes tirées à l'identification ; 0 de base, en %) :
   mineSpeedPct / damagePct = bonus en % : vitesse de minage = mineSpeed × (1 + mineSpeedPct/100), pareil pour les dégâts ;
   crit = chance qu'un coup fasse le double de dégâts ; oneTap = chance de casser un bloc instantanément ;
   piercing = chance de casser aussi le bloc juste derrière celui miné ; looting = butin des mobs en plus (comme Pillage) */
export const STATS = { oxygenMax:300, speed:3, climbSpeed:2.25, mineSpeed:1, damage:5, attackSpeed:100, fortune:0, pods:200, light:6, compass:8,
  compassRows:0, torches:20, torchRadius:5, torchTime:1, discoverMax:2, tenacity:0, knockRes:0, reach:0, knockback:0,
  bridges:Infinity,   // passerelles illimitées (21/10, Geoffrey) : la stat reste pour un futur coût éventuel
  mineSpeedPct:0, damagePct:0, crit:0, oneTap:0, piercing:0, looting:0,
  blockMinePct:0,   // Némésis du Golbute (30/10/2026, Geoffrey) : % de vitesse de minage en plus sur les blocs de terrain (terre, pierre, pierre dure, résidus), pas les minerais
  golemOxygen:0,    // Âme du Golbute (30/10/2026, Geoffrey) : oxygène rendu au porteur quand un golem meurt à GOLBUTE.golemOxygenRadius cases ou moins
  goblinThrall:0,   // Couronne du Roi Gobelin (27/10/2026, Geoffrey) : rayon (cases) où les gobelins qui naissent sont asservis (GOBLIN_KING.thrall)
  doubleAttack:0 };   // double attaque (25/10/2026, Geoffrey) : chance, en %, qu'un coup du mineur frappe deux fois

export const CFG = {
  ladderTime:2, refillRate:30, unlockRatio:0.6,
  climbFactor:0.75,       // bestioles seulement : vitesse sur échelle = ×climbFactor (le mineur a sa stat climbSpeed)
  oreReach:12, bridgeTime:1,
  futureTravelWeight:1, ladderPlanWeight:2, planMaxCost:30, foeLeash:10, foeGiveUp:15, mobStep:0.9,
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
/* combat dynamique (25/10/2026, Geoffrey) : portée et recul (src/sim/knock.js).
   - reach : écart (bord à bord, en blocs) en dessous duquel une entité frappe, ou tacle, une autre ; jamais en diagonale ni
     à travers un bloc. Au contact, l'écart vaut 0.
   - knock : recul infligé par un coup du mineur (blocs, sur l'axe du coup) ; la cible garde un décalage dans sa case et
     passe sur la case voisine quand il dépasse une demi-case ; contre un bloc, elle reste sur place.
   - tackleGiveUp / tackleLeash : soupape du tacle (qui dure jusqu'à la mort du mob ou une provocation) : il saute si le
     mineur taclé n'a pas frappé ce mob depuis tackleGiveUp s, ou si le mob est à plus de tackleLeash cases (Manhattan).
   Valeurs provisoires. Les mobs poussent avec MOBS.knock (0 de base). */
export const COMBAT = { reach:0.5, knock:0.25, tackleGiveUp:5, tackleLeash:6 };

export const PREFS = { priority:'minerais', fightMobs:true, helpAllies:false, helpIgnore:[] };
/* Aider allié : il ne part aider que si le mob est à helpRange cases ou moins (Manhattan). Au-delà, le combat est fini
   avant son arrivée et il traverse la mine pour rien (allers-retours mesurés en simulation). Provisoire.
   keep : une fois parti aider, il garde ce mob jusqu'à keep cases (marge) : pile à range, un pas de contournement le
   sortait de portée, il retournait travailler, revenait à range… (seed 1928461225, 24/10/2026). Au-delà de keep, il
   abandonne ce mob pour de bon (sinon même va-et-vient à keep). */
export const HELP = { range:20, keep:30 };

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
  5:{name:'Or',      type:'ore',     tex:'gold',    w:3, hard:3.5, color:'#7d828c', dot:'#ffd23f', val:4},   // poids 3 depuis le 25/10/2026 (Geoffrey ; avant 4)
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
  /* tours de l'Ange et du Démon (TOWER) : stonebrick qui remplit la tour (4 s depuis le 25/10, avant 6) et sa version
     indestructible (5 % de l'intérieur, murs). Jamais dans la mine normale. 26/10/2026 (Geoffrey) : une stonebrick minée va
     dans le sac du mineur (poids w, pods) ; partagée entre les joueurs en cas de victoire (avant : ne rapportait rien). */
  14:{name:'Stonebrick angélique', type:'special', tex:'brick_angel', w:10, hard:4, color:'#bfe3ff', dot:'#e8f4ff', family:'material'},
  15:{name:'Stonebrick angélique indestructible', type:'special', tex:'brick_angel_hard', w:0, hard:Infinity, color:'#7fa6c9', dot:'#ffd23f', unbreakable:true, noDrop:true},
  16:{name:'Stonebrick démoniaque', type:'special', tex:'brick_demon', w:10, hard:4, color:'#4a1f3a', dot:'#7a2f5a', family:'material'},
  17:{name:'Stonebrick démoniaque indestructible', type:'special', tex:'brick_demon_hard', w:0, hard:Infinity, color:'#2a0f22', dot:'#ff3b3b', unbreakable:true, noDrop:true},
  /* socle du coffre (23/10, Geoffrey) : la case sous le coffre de la surface, incassable (le pathfinder ne creuse plus
     sous le coffre) */
  18:{name:'Socle du coffre', type:'special', tex:'chest_base', w:0, hard:Infinity, color:'#5a5a62', dot:'#b0b0b8', unbreakable:true, noDrop:true},
  /* graphite (23/10, Geoffrey) : minerai des areas 5 et 6 ; fondu en Graphite ingot, qui sert au Steel ingot */
  19:{name:'Graphite ore', type:'ore', tex:'graphite', w:3, hard:4.0, color:'#7d828c', dot:'#2f3b4d', val:4},
  /* k hole (25/10, Geoffrey, KHOLE) : portail en trou noir, incassable ; dès qu'un mineur le découvre, il aspire tout le
     groupe dans une autre dimension, puis disparaît */
  20:{name:'K hole', type:'special', tex:'khole', w:0, hard:Infinity, color:'#12001f', dot:'#9b4dff', unbreakable:true, noDrop:true},
  /* minerais des areas 6 à 8 (27/10/2026, Geoffrey) : mithril (commun) dès l'area 6, cobalt et thorium (inhabituels,
     RARITY) dès l'area 7. Pas encore de recette de four. Dureté, poids, attrait et XP : provisoires (Claude) */
  21:{name:'Mithril ore', type:'ore', tex:'mithril', w:3, hard:4.5, color:'#7d828c', dot:'#b8d4f0', val:5},
  22:{name:'Cobalt ore',  type:'ore', tex:'cobalt',  w:4, hard:5.5, color:'#7d828c', dot:'#2f5fe0', val:7},
  23:{name:'Thorium ore', type:'ore', tex:'thorium', w:4, hard:5.5, color:'#7d828c', dot:'#7ee04a', val:7},
  /* barreaux de prison (29/10/2026, PRISON) : bordent la carte de la prison de chaque côté ; incassables, non minables */
  24:{name:'Barreaux de prison', type:'special', tex:'prison_bars', w:0, hard:Infinity, color:'#2a2a33', dot:'#5a5a66', unbreakable:true, noDrop:true},
};
export const BARRIER = 7, BRIDGE = 8, TREASURE_BLOCK = 10, DUNGEON_WALL = 11, CHEST_BASE = 18, KHOLE_BLOCK = 20;
/* clés utilisées dans les compositions d'areas ; « air » = case vide (id 0), générée en poches */
export const IDS = { air:0, dirt:1, stone:2, coal:3, iron:4, gold:5, diamond:6, hardstone:9, residueAngel:12, residueDemon:13, graphite:19,
                     mithril:21, cobalt:22, thorium:23 };

/* Constructions du mineur (catégorie build). La passerelle est une tuile de la grille ; l'échelle et la torche
   se posent PAR-DESSUS une case vide (G.ladder, G.torches) : ce ne sont pas des tuiles. */
export const BUILDS = {
  bridge: {name:'Passerelle', type:'build', tex:'bridge', block:BRIDGE},
  ladder: {name:'Échelle',    type:'build', tex:'ladder'},
  torch:  {name:'Torche',     type:'build', tex:'torch'},
};

/* composition en % par area (la dernière est répétée au-delà). Comptes exacts, pas probabilistes.
   air = cases déjà vides à la génération (poches naturelles), cachées tant qu'elles ne sont pas découvertes.
   chestChance = probabilité qu'un treasure soit enfoui dans l'area (0 à 1, tirée depuis la seed) : 0,5 dans les
   areas 0 à 2 (celles du Treasure T1, 25/10/2026 au soir, Geoffrey ; avant 0,6, encore avant 0,4), 0,4 au-delà
   (24/10/2026 ; avant 0,3). */
export const AREAS = [
  { comp:{dirt:52, stone:33,                coal:10,                                 air:5}, chestChance:0.5 },
  { comp:{dirt:30, stone:49,                coal:15, iron:1,                         air:5}, chestChance:0.5 },
  { comp:{dirt:20, stone:55,                coal:10, iron:10,                        air:5}, chestChance:0.5 },
  { comp:{dirt:10, stone:60, hardstone:5,   coal:7,  iron:10, gold:3,                air:5}, chestChance:0.4 },
  { comp:{         stone:60, hardstone:15,  coal:5,  iron:10, gold:5,                air:5}, chestChance:0.4 },
  /* areas 5 et 6 : décision du 23/10 (Geoffrey), graphite et plus de charbon ; ancien area 5 :
     stone 55, hardstone 20, coal 3, iron 8, gold 7, diamond 2, air 5 */
  { comp:{         stone:55, hardstone:20,           iron:9.5, gold:5, diamond:0.5, graphite:5, air:5}, chestChance:0.4 },
  /* areas 6 à 8 : décision du 27/10/2026 (Geoffrey) ; ancienne area 6 (répétée au-delà) : stone 35, hardstone 40,
     iron 7, gold 6, diamond 1, graphite 6, air 5. Les résidus (0,5 %) sont pris sur la pierre à la génération : la
     pierre affichée en jeu vaut 0,5 de moins (34,5 / 20 / 15) */
  { comp:{         stone:35,   hardstone:40,         iron:5,   gold:6, diamond:1,   graphite:6, mithril:2,                       air:5}, chestChance:0.4 },
  { comp:{         stone:20.5, hardstone:54.5,       iron:2,   gold:1, diamond:1,   graphite:7, mithril:5, cobalt:2, thorium:2,  air:5}, chestChance:0.4 },
  { comp:{         stone:15.5, hardstone:59.5,                                      graphite:5, mithril:7, cobalt:4, thorium:4,  air:5}, chestChance:0.4 },
];

/* butin d'un treasure : un objet « Treasure TX » dont le tier dépend de l'area où le treasure est enfoui
   (usage défini plus tard avec le craft). Plus aucun minerai. Le dernier tier vaut aussi pour les areas au-delà.
   tiers : chaque entrée couvre les areas jusqu'à maxArea (incluse), à partir de la fin de la précédente. */
/* openAllMax : « Ouvrir tout » (inventaire, 25/10/2026, Geoffrey) ouvre au plus ce nombre d'exemplaires par demande */
export const TREASURE = {
  itemWeight:2, itemCount:1, openAllMax:100,
  tiers: [
    { item:'Treasure T1', maxArea:2, tex:'treasure_t1' },   // areas 0 à 2
    { item:'Treasure T2', maxArea:4, tex:'treasure_t2' },   // areas 3 et 4 (avant le 23/10 : 3 à 5 et au-delà)
    { item:'Treasure T3', maxArea:6, tex:'treasure_t3' },   // areas 5 et 6, 23/10 Geoffrey
    { item:'Treasure T4', maxArea:8, tex:'treasure_t4' },   // areas 7 et 8 (et au-delà), 27/10 Geoffrey
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
      { item:'Blueprint parts', min:5,   max:10  },   // 25/10/2026 (Geoffrey) ; avant 5 à 15
      { item:'Charbon',         min:100, max:150 },
      { item:'Fer',             min:50,  max:80  },
    ],
    /* BP des 6 pièces en fer à 2 % (25/10/2026, Geoffrey ; avant 1 %) ; four, boussole et ceinture restent à 1 % */
    oneOf: [
      { family:'blueprint', tex:'blueprint', items:[
        { item:'Pioche en fer BP',             chance:0.02 },
        { item:'Épée en fer BP',               chance:0.02 },
        { item:'Lance en fer BP',              chance:0.02 },   // 25/10/2026 (Geoffrey)
        { item:'Casque en fer BP',             chance:0.02 },
        { item:'Plastron en fer BP',           chance:0.02 },
        { item:'Jambes en fer BP',             chance:0.02 },
        { item:'Bottes en fer BP',             chance:0.02 },
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
        { item:'Lampe à incandescence BP', chance:0.02 },   // 26/10/2026 (Geoffrey) : la lampe n'est plus craftable de base
      ]},
      { family:'gem', items:gems(0.015) },
    ],
  },
  /* Treasure T3 (areas 5 et au-delà, 23/10/2026, Geoffrey) : pièces en acier et Plastron de l'équilibre */
  'Treasure T3': {
    always: [
      { item:'Graphite ore',    min:20, max:40 },
      { item:'Tissu sombre',    min:3,  max:10 },
      { item:'Blueprint parts', min:10, max:20 },
    ],
    oneOf: [
      { family:'blueprint', tex:'blueprint', items:[
        { item:'Casque en acier BP',          chance:0.01 },
        { item:'Plastron en acier BP',        chance:0.01 },
        { item:'Jambes en acier BP',          chance:0.01 },
        { item:'Bottes en acier BP',          chance:0.01 },
        { item:'Pioche en acier BP',          chance:0.01 },
        { item:'Épée en acier BP',            chance:0.01 },
        { item:'Plastron de l\'équilibre BP', chance:0.005 },
      ]},
      { family:'gem', items:gems(0.02) },
      { family:'material', tex:'moon_crystal', items:[ { item:'Cristal de pleine lune', chance:0.10, tex:'moon_crystal' } ] },
      /* Clé d'instance I (27/10/2026, Geoffrey) : son propre tirage, en plus du reste (INSTANCE) */
      { family:'key', tex:'key_instance_1', items:[ { item:'Clé d\'instance I', chance:0.20, tex:'key_instance_1' } ] },   // 20 % (27/10, Geoffrey ; avant 5 %)
    ],
  },
  /* Treasure T4 (areas 7 et 8, 27/10/2026, Geoffrey) : stuff en mithril, thorium, cobalt et pièces spéciales.
     learnOnce : ne sort que si la recette n'est pas encore apprise (src/meta/loot.js) */
  'Treasure T4': {
    always: [
      { item:'Mithril ore',     min:20, max:40 },
      { item:'Cobalt ore',      min:5,  max:10 },
      { item:'Thorium ore',     min:5,  max:10 },
      { item:'Blueprint parts', min:12, max:14 },
    ],
    oneOf: [
      /* 1er jet : un BP au plus (12,5 % en tout) */
      { family:'blueprint', tex:'blueprint', items:[
        { item:'Lunettes Gucci BP',         chance:0.01 },
        { item:'Doc Martins BP',            chance:0.01 },
        { item:'Ceinture golémique BP',     chance:0.01 },
        { item:'Gants de boucher BP',       chance:0.01 },
        { item:'Jambières titanesques BP',  chance:0.005 },
        ...['Casque', 'Plastron', 'Jambes', 'Bottes'].map(p => ({ item:`${p} en mithril BP`, chance:0.01 })),
        ...['thorium', 'cobalt'].flatMap(m => ['Casque', 'Plastron', 'Jambes', 'Bottes'].map(p => ({ item:`${p} en ${m} BP`, chance:0.005 }))),
      ]},
      /* 2e jet : chacun son tirage, seulement si la recette n'est pas apprise (28/10, Geoffrey : plus la Clé d'instance I
         BP, la clé se crafte de base) */
      ...['Saphir BP', 'Rubis BP', 'Jade BP'].map(item =>
        ({ family:'blueprint', tex:'blueprint', items:[ { item, chance:0.05, learnOnce:true } ] })),
      /* Clé d'instance II (30/10/2026, Geoffrey) : son propre tirage, 10 % */
      { family:'key', tex:'key_instance_2', items:[ { item:'Clé d\'instance II', chance:0.10, tex:'key_instance_2' } ] },
      /* 3e jet : une gemme au plus */
      { family:'gem', items:[
        { item:'Topaze', chance:0.01, tex:'gem_topaz' },        { item:'Saphir', chance:0.01, tex:'gem_sapphire_fine' },
        { item:'Rubis',  chance:0.01, tex:'gem_ruby_fine' },    { item:'Jade',   chance:0.01, tex:'gem_jade_fine' },
      ]},
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
    /* minerai de fer (28/10/2026, Geoffrey) : un lot de 100 donne toujours charbon 1-50, or 1-20, 1 diamant et graphite
       1-10 ; une gemme inférieure (1 % chacune, une au plus) ; un treasure (T1 2 %, T2 1 %, T3 0,5 %, un au plus) */
    'Fer':         { always:[ { item:'Charbon', min:1, max:50 }, { item:'Or', min:1, max:20 }, { item:'Diamant', min:1, max:1 },
                              { item:'Graphite ore', min:1, max:10 } ],
                     oneOf:[ { family:'gem', items:gems(0.01) },
                             { family:'treasure', items:[{ item:'Treasure T1', chance:0.02 }, { item:'Treasure T2', chance:0.01 },
                                                         { item:'Treasure T3', chance:0.005 }] } ] },
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
    { tier:1, label:'Tier 1', from:'Treasure T1', cost:100, recycle:{ min:10, max:20 } },   // 30/10 (Geoffrey) : avant 15 à 30 (25/10 au soir : avant 30 à 60)
    { tier:2, label:'Tier 2', from:'Treasure T2', cost:150, recycle:{ min:15, max:30 } },   // 30/10 (Geoffrey) : avant 30 à 45 (28/10 : avant 40 à 70)
    /* tier 3 (23/10/2026, Geoffrey) : recherche à 200 parts (26/10 ; avant 150). weights : poids d'un blueprint dans le
       tirage (1 par défaut) ; le plan épique sort 4 fois moins souvent que chaque autre */
    { tier:3, label:'Tier 3', from:'Treasure T3', cost:200, recycle:{ min:20, max:35 }, weights:{ 'Plastron de l\'équilibre BP':0.25 } },   // recyclage 30/10 (Geoffrey) : avant 45 à 60 (28/10 : avant 40 à 70)
    /* tier 4 (28/10/2026, Geoffrey) : plans du 1er jet du Treasure T4, ouvert quand toutes les recettes des tiers 1 à 3
       sont apprises (règle commune, tierUnlocked). stages : le tirage se fait dans la première étape dont une recette
       reste à apprendre (chances égales) ; l'étape suivante s'ouvre quand toutes ses recettes sont apprises. */
    { tier:4, label:'Tier 4', from:'Treasure T4', cost:250, recycle:{ min:25, max:40 }, stages:[
      [...['Casque', 'Plastron', 'Jambes', 'Bottes'].map(p => `${p} en mithril BP`),
       'Lunettes Gucci BP', 'Doc Martins BP', 'Ceinture golémique BP', 'Gants de boucher BP'],
      ['thorium', 'cobalt'].flatMap(m => ['Casque', 'Plastron', 'Jambes', 'Bottes'].map(p => `${p} en ${m} BP`)),
      ['Jambières titanesques BP'],
    ] },
  ],
  opMemory: 50,        // dernières demandes retenues (une demande renvoyée n'agit pas deux fois)
};

/* partage du coffre commun en fin de session (src/meta/share.js) : parts égales entre les joueurs,
   reste tiré au hasard depuis la seed ; les objets de copyToAll ne se partagent pas, chacun reçoit la quantité entière */
export const SHARE = { copyToAll:[...TREASURE.tiers.map(t => t.item), 'Cristal de pleine lune', 'Cuir de minotaure'] };   // cuir : 27/10   // Treasure TX et butin du donjon (DUNGEON.loot)

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
    { bestiole:0.2, gobelin:0.55, mephite:0.05, mimic:0.2 },   // méphite : 24/10 (Geoffrey), pris sur le gobelin (avant 0,6)
    { gobelin:0.55, occultiste:0.1, mephite:0.15, mimic:0.2 },  // avant gobelin 0,7
    { gobelin:0.2, occultiste:0.3, mephite:0.2, mimic:0.2, golem:0.1 },   // golem : 26/10 (Geoffrey), pris sur le gobelin (avant 0,3 ; et 0,5 encore avant)
    /* mur de chair (28/10/2026, Geoffrey) : 2 / 5 / 8 % en areas 6 / 7 / 8+, pris sur le gobelin (avant : la ligne de l'area 5) */
    { gobelin:0.18, occultiste:0.3, mephite:0.2, mimic:0.2, golem:0.1, chair:0.02 },
    { gobelin:0.15, occultiste:0.3, mephite:0.2, mimic:0.2, golem:0.1, chair:0.05 },
    { gobelin:0.12, occultiste:0.3, mephite:0.2, mimic:0.2, golem:0.1, chair:0.08 },
  ],
  /* PV = hpBase × hpGrowth^(k − minArea) : minArea = première area où le mob peut apparaître */
  hpBase:  { bestiole:50, gobelin:100, mimic:50, occultiste:150, mephite:70, golem:300, chair:200 },   // occultiste : 150 le 23/10 (avant 100)
  minArea: { bestiole:0,  gobelin:1,   mimic:0,  occultiste:4,   mephite:3,  golem:5, chair:6 },
  hpGrowth: 1.15,
  /* rythme des apparitions (tous types confondus), selon k = dernière area débloquée (intensité de la partie) */
  spawnDelay: (rng, k) => (40 + rng()*30) / (1 + 0.15*k),
  firstSpawn: 25,
  walkerCap:  k => 2 + k,          // mobs qui se déplacent vivants en même temps (bestioles, gobelins, occultistes, méphites, golems ; pas les mimics)
  /* vitesse de déplacement par type (× la vitesse de base, CFG.mobStep) ; absent = 1 */
  speed: { golem:0.5, chair:0.5 },
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
  occult: { cooldown:15, channel:5, tpDist:3, tpReach:12, item:'Tissu sombre', loot: rng => 1 + Math.floor(rng()*3),
            chitin: rng => 1 + Math.floor(rng()*2) },   // chitine en plus (24/10, Geoffrey)
  /* méphite (24/10/2026, Geoffrey) : il VOLE (pas de gravité, il traverse les cases vides sans échelle, flyReach = cases
     explorées au plus pour trouver son chemin). Asphyxie : tant qu'au moins un méphite tacle un mineur, il perd oxygen
     d'oxygène toutes les every secondes (non cumulable entre méphites ; chaque pulse est ignorable par la ténacité). */
  /* coups des mobs (25/10/2026, Geoffrey) : un mob qui tacle frappe sa cible toutes les hitEvery s, s'il est à portée
     (COMBAT.reach), et la repousse de knock[type] blocs (0 pour les autres). Les effets du gobelin (vol), du méphite
     (asphyxie) et de l'occultiste (sort) gardent leur propre cadence (goblinStealEvery, mephite.every, occult.cooldown). */
  hitEvery: 1,
  hitEveryBy: { golem:1.5 },        // cadence propre à un type (sinon hitEvery)
  knock: { minotaure:0.25, golem:0.5 },
  mephite: { every:2, oxygen:5, flyReach:400, item:'Vésicule de gaz', loot: rng => 1 + Math.floor(rng()*2) },
  /* golem (26/10/2026, Geoffrey ; src/sim/golem.js) : 2 × 2 cases (o.x, o.y = case du bas à gauche). À sa naissance il
     casse les blocs qui le gênent ; pour rejoindre sa proie, il casse un bloc toutes les dig s (cadence à part de ses
     coups) : ni les blocs incassables, ni les treasures, ni les passerelles, ni les murs de donjon, ni un mimic ; les
     échelles restent (ce sont des cases vides). Les blocs cassés sont perdus. Il descend en creusant sous lui et monte
     en escalier (une marche à la fois, seulement si la marche le porte) ; il ne prend pas les échelles.
     Coups : MOBS.knock.golem toutes les MOBS.hitEveryBy.golem s. Ébranlement : à chaque tranche de stunStep des PV max
     perdue (stuns fois au plus), les mineurs à stunRadius cases au plus (distance à sa case la plus proche) sont
     étourdis stunTime s ; Ténacité par mineur. knockRes : un golem de pierre ne se fait pas repousser (choix de Claude). */
  golem: { size:2, dig:2, stunStep:0.33, stuns:3, stunRadius:3, stunTime:3, knockRes:100,
           item:'Pierre glissante', loot: rng => 1 + Math.floor(rng()*3) },
  /* mur de chair (28/10/2026, Geoffrey ; src/sim/flesh.js) : 1 × h cases, une colonne ((o.x, o.y) = sa case du bas).
     Il naît DANS la roche, à spawnDist cases à côté du mineur visé, sa ligne vers le milieu du mur ; il recouvre les
     blocs sans les casser et ne se déplace qu'à l'horizontale (ni gravité, ni montée), vers le mineur le plus proche,
     jusqu'à l'avoir à portée (ou juste au-dessus / au-dessous de lui). Ses cases sont un MUR : on ne peut ni y entrer ni les miner
     (même au-dessus d'une galerie) ; il faut le tuer. Il ne repousse pas et ne se fait pas repousser (knockRes).
     Passif : toutes les every s, chaque mineur à radius cases au plus de sa case la plus proche prend un stack de
     −slow % de vitesse d'attaque (maxStacks au plus : −90 %, il tape encore) ; les stacks durent last s après le
     dernier reçu, et tombent tous dès qu'il sort du rayon ; la Ténacité peut ignorer chaque stack. */
  chair: { h:6, spawnDist:{ min:8, max:12 }, knockRes:100, every:2, radius:1.5, slow:10, maxStacks:9, last:10,
           flesh:{ item:'Rotten flesh', min:1, max:3 }, chitin:{ min:1, max:5 } },
  noTrap: ['golem', 'chair'],      // jamais dans un piège ni dans la dimension du k hole (choix de Claude : 2 × 2, 1 × 6)
};
/* Gallianix (23/10/2026, Geoffrey) : un canard jaune qui se promène à la surface, autour du coffre. Il naît à chaque
   nouvelle area débloquée pendant la session (pas au lancement). Il ne tacle pas et ne chasse personne ; il ne tombe
   jamais dans la mine : il saute par-dessus les trous (jump cases au plus), sinon il fait demi-tour. Il a un pseudo,
   pris dans names dans l'ordre (1er canard de la session = 1er nom), en boucle. Les mineurs le combattent comme les
   autres mobs (réglage « combat »). Vaincu : heart.chance de laisser heart.item, rapporté au coffre commun.
   Hors de MOBS.hpBase : pas dans les tirages d'apparition, ni dans le maximum de mobs. Hasard à part (salt).
   À chaque passage au coffre, sac vidé, un mineur va le chasser (src/sim/ai.js, huntDuck ; 24/10, avant :
   seulement en fin de session). */
export const DUCK = {
  type: 'gallianix', name: 'Gallianix', tex: 'duck', hp: 50,
  names: ['Cuiseuse de sperme', 'Roxanne', 'La brésilienne', 'La thaïlandaise'],
  range: 8,               // il reste à range cases au plus du coffre (colonne CHEST_X)
  step: 1.2,              // secondes entre deux pas (il marche lentement)
  pause: 0.35,            // chance de rester sur place à chaque pas
  jump: 3,                // trou le plus large qu'il saute (en cases)
  heart: { item: 'Fragment de cœur', chance: 0.25, tex: 'heart_fragment' },
  huntMargin: 20,         // fin de session : il ne va le chasser que s'il lui reste ce temps (s) en plus de l'aller-retour
  salt: 0x6a11a41,
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
  ore: { coal:1, iron:2, gold:4, diamond:7, graphite:4, mithril:5, cobalt:8, thorium:8 },   // mithril, cobalt, thorium : 27/10
  mob: { bestiole:5, gobelin:10, mimic:5, occultiste:15, mephite:12, golem:30, chair:40, minotaure:100, gallianix:5 },
  curve: { first:1000, factor:1.5 },
  talentPerLevel: 1,
  maxLevel: 200,
  /* XP de spécialisation (24/10/2026, Geoffrey) : pct % de la part d'XP du joueur (après partage et bonus personnel,
     arrondi vers le bas) va à l'arbre de skills figé au lancement (rien sans arbre). Une XP par arbre, gardée quand
     on change d'arbre. specCurve : la même courbe que le niveau du mineur (1000, 1500, 2250…) ; seul le gain change
     (specPct). Seulement affichée pour l'instant ; elle débloque des sorts (SPELLS). Valeurs provisoires. */
  specPct: 50,          // 24/10/2026 (Geoffrey) : ancien 10
  specCurve: { first:1000, factor:1.5 },   // 24/10/2026 (Geoffrey) : = curve ; ancien first:100
};

/* caméra de la session (affichage) : top = ligne la plus haute affichée (le ciel), margin = lignes affichées sous le
   fond de la mine connue, ease = vitesse de glissade vers le mineur suivi (part du chemin par image),
   wheelRows / keyRows = lignes parcourues par cran de molette / par appui sur une flèche (PageUp/PageDown : ×3) */
/* Treuil (skill Logisticien, étape 2) : un puits au milieu de la mine (colonne x), de la surface jusqu'au haut de la
   dernière area débloquée. Un seau monte et descend à speedFactor × la vitesse de montée du mineur ; tout le monde
   l'utilise en même temps, et on peut s'arrêter à n'importe quelle ligne. Plus lent qu'une échelle : l'IA peut sortir
   du seau pour une colonne d'échelles ou un trou à côté (×2 essayé le 22/10/2026, refusé : la vitesse ne change pas). */
export const WINCH = { x: Math.floor(W/2), speedFactor:0.85 };

/* Mule (skill Logisticien, étage 4, 23/10/2026, Geoffrey ; spec docs/superpowers/specs/2026-10-23-mule-design.md) :
   le logisticien qui pose le treuil pose un sac à côté du bas du treuil (à droite, sinon à gauche). Les mineurs aux
   pods pleins y déposent si le sac est plus près que la surface. Capacité = capacityPct × la somme des pods des
   logisticiens présents qui ont Mule. Vidé dans le coffre seulement à la prolongation du treuil et en fin de session
   (le logisticien le ramasse en remontant), ou si le logisticien quitte la session. Valeurs provisoires.
   depositTime / pickTime : durée (s) d'un dépôt dans le sac et du ramassage / de la pose.
   pickBelow : à la prolongation, il passe reprendre son sac s'il n'est pas plus de pickBelow couches sous lui (sinon il
   le reprendra en redescendant par le puits du treuil, sans le vider). */
export const MULE = { capacityPct:2, depositTime:1, pickTime:1, pickBelow:10 };

/* Chiffre des dégâts de zone (Force brute) au-dessus du mob touché (src/render/splash.js, 24/10/2026, Geoffrey) :
   splashMs = durée de l'animation (ms, heure du navigateur) ; splashRise = pixels de montée ; splashGame = âge max du
   coup (s de partie) pour l'afficher (évite de rejouer de vieux coups à la reconnexion). Affichage seulement. */
export const FX = { splashMs:1200, splashRise:10, splashGame:3 };

export const CAMERA = { top:-3, margin:4, ease:0.15, wheelRows:3, keyRows:4,
  minRows:20, maxRows:48,
  maxZoom:4, wheelZoom:0.0025 };   // zoom (30/10, Geoffrey) : pincer à deux doigts ou Ctrl + molette, ×1 (toute la largeur) à ×maxZoom   // lignes visibles : la mine remplit la largeur, et montre autant de lignes que la hauteur en permet

/* ---- Skills (onglet Skills, src/meta/skills.js) ----
   1 point par niveau gagné (XP.talentPerLevel). Trois arbres ; dépenser un point dans un arbre bloque les deux autres
   (jusqu'au reset, gratuit, hors session). Chaque étape exige l'étape précédente au rang max.
   Un nœud : id, max (rangs), per (valeur par rang ; 1 = interrupteur), desc (texte, {v} = valeur au rang actuel).
   adds (facultatif) : { stat: points par rang } ajoutés aux STATS du mineur (ex. ténacité en %) ; {stat} dans desc.
   Les effets sont figés au lancement de la session (comme le stuff). Valeurs provisoires. */
/* ---- Glyphes (src/meta/glyphs.js ; spec docs/superpowers/specs/2026-10-25-glyphes-design.md) ----
   25/10/2026 (Geoffrey) : un glyphe est un parchemin lié à un skill (items : nœud → nom de l'objet). Posé à côté de ce skill
   dans l'onglet Skills (skill au rang max), il ajoute un effet. Retirable hors session (il revient dans l'inventaire) ; un
   reset ou un set ne le retire pas (il reste posé, inactif tant que le skill n'est pas au max). Pas encore de source en jeu
   (outil d'admin). Valeurs provisoires :
   attackToMine : Pioche aiguisée, minage % += attackToMine × (vitesse d'attaque − 100) ; torchChance : Second souffle,
   chance qu'un minerai rende une torche (jamais au-delà du max) ; rushTime : Ruée, durée du bonus (s) ; Navette : pas
   d'oxygène consommé en redescendant au front ; ladderMult : Échelle de 2, temps de pose × ; oxygenToSpeed : Mule, marche
   et montée × (1 + oxygenToSpeed × oxygène max) ; damageToPods : Force brute, pods += × dégâts (totaux) ;
   killDamagePct / killDamageMax : Pillage, dégâts % par mob tué, plafond ; braumOxygen : Braum, part de l'oxygène max
   regagnée à chaque entrée dans un piège ou un donjon. */
export const GLYPHS = {
  items: { mine_speed:'Glyphe Pioche aiguisée', ore_oxygen:'Glyphe Second souffle', ore_rush:'Glyphe Ruée',
           travel_rush:'Glyphe Navette', tall_ladder:'Glyphe Échelle de 2', mule:'Glyphe Mule', damage:'Glyphe Force brute',
           loot:'Glyphe Pillage', braum:'Glyphe Braum', winch:'Glyphe Treuil' },
  attackToMine:0.1, torchChance:0.05, rushTime:5, ladderMult:0.5, oxygenToSpeed:0.0003, damageToPods:3,
  killDamagePct:1, killDamageMax:25, braumOxygen:0.3, rarity:'epique', tex:'glyph',
  /* Glyphe Treuil (étape 2) : un ascenseur liftSpeed × plus rapide que le treuil (Escalateur compris), posé / prolongé
     un déblocage d'area sur liftEvery (1er, 3e, 5e…) ; dans les tours, un ascenseur au lieu du treuil */
  liftSpeed:1.5, liftEvery:2,   // 26/10/2026, Geoffrey : 1,5 (avant 3)
  /* drop (25/10/2026, Geoffrey) : un mineur avec une spécialisation (arbre figé au lancement) peut trouver un glyphe de SON
     arbre qu'il ne possède pas au lancement (inventaire + posés), à chaque événement de sa spé : bloc cassé (mineur),
     échelle posée (logisticien), mob tué (barbare). Mine classique ; pour lui seul, versé à la fin (perdu s'il quitte).
     Hasard à part (dropSalt). chance = par événement, pour UN glyphe (n'importe lequel de ceux qui manquent) : 27/10/2026,
     Geoffrey : ≈ 1 % de trouver un glyphe par session dans un groupe de 3. Calcul : 1 − 0,99^(1/E), E = événements par
     mineur et par session à 3 (simulation, arbre complet) : ≈ 795 blocs, 91 échelles, 30 mobs. (Ancien, 26/10 : ≈ 3 %,
     0,0000383 / 0,000335 / 0,00101 ; 25/10 : 0,0001 / 0,0007 / 0,001 ; quelques minutes le 26/10 : la même chance, mais
     par glyphe manquant.) */
  drop: { mineur:{ event:'block', chance:0.0000126 }, logisticien:{ event:'ladder', chance:0.000110 }, barbare:{ event:'kill', chance:0.000335 } },
  dropPerSession: 0.01,   // ≈ chance d'en trouver un par session à 3, d'où viennent les chances ci-dessus (texte du wiki)
  dropSalt: 0x61f7d3,
  desc: {
    mine_speed:  '10 % de son bonus de vitesse d\'attaque (au-dessus de 100 %) s\'ajoute à sa vitesse de minage (+20 % d\'attaque = +2 % de minage)',
    ore_oxygen:  'Miner un minerai a 5 % de chance de lui rendre une torche (jamais au-delà de son maximum)',
    ore_rush:    'Le bonus de marche de Ruée dure 5 s au lieu de 3',
    travel_rush: 'Il ne consomme pas d\'oxygène quand il redescend au front après être remonté',
    tall_ladder: 'Poser une échelle lui prend 2 fois moins de temps',
    mule:        '3 % de son oxygène max s\'ajoute en % à sa vitesse de marche et de montée (300 d\'oxygène = +9 %)',
    damage:      'Ses dégâts (stuff et skills compris) s\'ajoutent 3 fois à ses pods (14 dégâts = +42 pods)',
    loot:        'Chaque mob tué ajoute 1 % à ses dégâts pour la session (au plus +25 %)',
    braum:       'À chaque entrée dans un piège ou un donjon, il regagne 30 % de son oxygène max',
    winch:       'Il pose un ascenseur au lieu d\'un treuil : 1,5 fois plus rapide, posé ou prolongé une nouvelle area sur deux (1re, 3e, 5e…) ; dans les tours aussi',
  },
};
const GLYPH_ITEMS = Object.fromEntries(Object.entries(GLYPHS.items).map(([node, name]) =>
  [name, { cat:'glyph', tex:GLYPHS.tex, w:1, stack:true, glyph:node }]));

export const SKILLS = {
  /* Arbres en étages : chaque nœud a son étage (row, 1 = en haut). Plusieurs nœuds d'un même étage sont côte à côte.
     Un nœud de l'étage r > 1 exige qu'AU MOINS UN nœud de l'étage r−1 de son arbre soit au rang max (les lignes de
     l'arbre relient chaque nœud à ceux de l'étage d'avant). needsAll : il faut TOUS les nœuds de l'étage d'avant au
     rang max (Escalateur, 23/10/2026, Geoffrey : Échelle de 2 ET Treuil, pour qu'un logisticien avec Mule ait toujours le
     Treuil). name/icon : affichage de l'onglet Skills.
     Logisticien refait le 23/10/2026 au soir (Geoffrey) : Bâtisseur supprimé, Navette passe à l'étage 1 (max 3, avant
     max 5 à l'étage 3), Escalateur à l'étage 3. Même coût total jusqu'à Mule (11 points) ; les points qui ne tiennent
     plus dans le nouvel arbre sont rendus à la relecture (sanitizeSkills). */
  trees: [
    { id:'mineur', label:'Mineur', icon:'⛏', nodes:[
      { id:'mine_speed',  row:1, max:3, per:0.02, icon:'⛏', name:'Pioche aiguisée', desc:'Vitesse de minage +{v}' },
      { id:'ore_oxygen',  row:2, max:1, per:1,    icon:'🫧', name:'Second souffle',  desc:'Miner un minerai rend 1 d\'oxygène' },
      { id:'ore_rush',    row:3, max:5, per:0.03, icon:'💨', name:'Ruée',            desc:'Vitesse de marche +{v} pendant 3 s après avoir miné un minerai (ne se cumule pas)' },
      /* 23/10 (Geoffrey) : un tirage par remontée, au moment où il part (après un tacle ou un étourdissement), mine classique seulement */
      { id:'lazy_legend', row:4, max:1, per:0.05, icon:'💤', name:'Légende de la flemme', desc:'5 % de chance de se téléporter au-dessus du coffre commun quand il doit remonter à la surface (sauf en fin de session)' },
      /* maîtrises (28/10/2026, Geoffrey) : slot = case du stuff dont la pièce portée voit ses stats × (1 + rang × per),
         comme l'amélioration (bonus positifs, et ce qu'une valeur `set` ajoute à la base) ; pas dans le GS */
      { id:'pick_mastery', row:5, max:3, per:0.05, slot:'pioche', icon:'⚒', name:'Maîtrise de la pioche', desc:'Les stats données par la pioche +{v}' },
    ]},
    { id:'logisticien', label:'Logisticien', icon:'🪜', nodes:[
      { id:'travel_rush', row:1, max:3, per:0.03, icon:'👟', name:'Navette',         desc:'Vitesse de marche +{v} quand il remonte à la surface ou redescend au front' },
      { id:'tall_ladder', row:2, max:1, per:1,    icon:'🪜', name:'Échelle de 2',    desc:'Pose des échelles de 2 de haut (si la case du dessus est vide)' },
      { id:'winch',       row:2, max:1, per:1,    icon:'🪣', name:'Treuil',          desc:'À chaque nouvelle area, il creuse le puits au milieu de la mine et pose un treuil de la surface jusqu\'à elle. Dans les tours, la première fois qu\'il tombe au pied de la tour, il installe un treuil jusqu\'au toit (10 s)' },
      /* 23/10 soir (Geoffrey) : pour tout le groupe ; plusieurs logisticiens : le plus haut rang compte (pas de cumul) */
      { id:'winch_speed', row:3, max:5, per:0.05, needsAll:true, icon:'🛗', name:'Escalateur', desc:'Vitesse du seau du treuil +{v} pour tout le groupe (plusieurs logisticiens : le meilleur rang compte)' },
      { id:'mule',        row:4, max:1, per:1,    icon:'🎒', name:'Mule',            desc:'Pose un sac en bas du treuil où tout le monde dépose (capacité : 2 × ses pods). Il le vide au coffre quand il prolonge le treuil et en fin de session' },
      { id:'bench_mastery', row:5, max:3, per:0.03, slot:'torse', icon:'🏋', name:'Maîtrise du bench', desc:'Les stats données par le torse +{v}' },
    ]},
    { id:'barbare', label:'Barbare', icon:'🪓', nodes:[
      { id:'damage',      row:1, max:3, per:0.05, icon:'🪓', name:'Force brute',     desc:'Dégâts infligés +{v}, ténacité +{tenacity}, dégâts de zone {aoe} (mobs à 1 case de sa cible)', adds:{ tenacity:5 }, aoe:0.02 },   // zone : 23/10 (Geoffrey)
      { id:'taunt',       row:2, max:1, per:1,    icon:'😤', name:'Provocation',     desc:'Le mob qu\'il frappe lâche les autres mineurs et ne peut plus tacler que lui ; ses coups interrompent la canalisation d\'un occultiste' },
      { id:'loot',        row:3, max:5, per:0.03, icon:'💰', name:'Pillage',         desc:'Butin des mobs +{v}' },
      { id:'braum',       row:4, max:3, per:0.1,  icon:'🛡', name:'Braum',           desc:'Vitesse de marche et de montée (échelle, seau) +{v} quand il va aider un allié (tacle, donjon, piège) et pendant ce combat' },
      { id:'sword_mastery', row:5, max:3, per:0.05, slot:'epee', icon:'⚔', name:'Maîtrise de l\'épée', desc:'Les stats données par l\'épée +{v}' },
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

/* Sorts (onglet Sorts, 24/10/2026, Geoffrey). 4 emplacements (slots), dont openSlots ouverts ; les autres restent
   verrouillés pour l'instant. Un sort se débloque par un niveau de spécialisation (unlock.tree + unlock.level, XP.specCurve)
   ou en apprenant son parchemin (unlock.scroll : l'objet est consommé, le sort reste acquis pour le compte). needTree :
   il faut cette spécialisation (arbre de skills figé au lancement) pour l'équiper et qu'il agisse en session.
   En session, chaque sort part tout seul dès que son temps de recharge (cd, en s) est fini ET qu'il peut servir
   (src/sim/spells.js) ; sinon il reste prêt. Les sorts équipés sont figés au lancement (comme les skills).
   Valeurs provisoires. */
/* Sets (onglets Stuff, Skills et Sorts, 24/10/2026, Geoffrey) : un set enregistre le stuff porté, les skills et les
   sorts ; « Équiper » remet tout d'un coup (hors session). Pas de limite voulue pour le joueur : max est un garde-fou
   (taille de la sauvegarde). nameMax : longueur d'un nom. Valeurs provisoires. */
export const SETS = { max:20, nameMax:24, opMemory:50 };

export const SPELLS = {
  /* par sort : icon (emoji, wiki), px (icône pixel de src/ui/pxicons.js : onglet Sorts et barre en session), short (une
     ligne sous le nom, fiche de l'onglet Sorts), desc (le détail) */
  slots: 4, openSlots: 2,
  opMemory: 50,
  list: [
    /* course de range cases au plus, à speed × sa vitesse de marche, qui suit le terrain (marche, descend, saute un bloc) ;
       vers un mob qu'il va combattre (un mob qui tacle un allié d'abord), seulement s'il est à portée : sinon il le
       garde. Mob heurté : dmg × ses dégâts, recharge × hitCd, sa canalisation coupée, étourdi stun s (25/10/2026,
       Geoffrey ; avant : ligne droite seulement, sans étourdissement) */
    { id:'dash', name:'Dash', icon:'💨', px:'arrow', short:'Fonce sur un mob et l\'étourdit', unlock:{ tree:'barbare', level:5 }, needTree:'barbare', cd:30,
      range:6, speed:6, dmg:5, hitCd:0.5, minCells:2, stun:2,
      desc:'Fonce de 6 cases au plus (600 % de vitesse) en suivant le terrain : il descend et saute un bloc. Vise d\'abord un mob qui tacle un allié ; en route vers un mob, il attend d\'être à portée. Mob heurté : 500 % de ses dégâts, recharge réduite de moitié, son sort est coupé et il est étourdi 2 s' },
    /* révèle les blocs à radius cases (cercle) ; part s'il en reste au moins un inconnu */
    { id:'illumination', name:'Illumination', icon:'💡', px:'sun', short:'Révèle les blocs autour de lui', unlock:{ tree:'mineur', level:5 }, needTree:'mineur', cd:90,
      radius:5,
      desc:'Révèle tous les blocs dans un rayon de 5 autour du mineur' },
    /* vitesse de minage +mineSpeed pour tous les mineurs pendant duration s ; la recharge commence à la fin de l'effet.
       Plusieurs logisticiens : pas de cumul, le suivant attend la fin de l'effet (ils s'enchaînent) */
    { id:'inspiration', name:'Inspiration', icon:'🎺', px:'note', short:'Tout le groupe mine plus vite', unlock:{ tree:'logisticien', level:5 }, needTree:'logisticien', cd:180,
      duration:60, mineSpeed:0.10,
      desc:'Tous les mineurs minent 10 % plus vite pendant 60 s (la recharge commence à la fin de l\'effet)' },
    /* quand un autre mineur du groupe se bat (frappe ou est taclé) : téléporté sur sa case, inflige hpPct des PV max du
       mob (bossPct sur un boss : minotaure, Gallianix) */
    { id:'ulti_shen', name:'Ulti shen', icon:'🌀', px:'shield', short:'Rejoint d\'un coup un allié en combat', unlock:{ scroll:'Parchemin « Ulti shen »' }, cd:180,
      hpPct:0.20, bossPct:0.05,
      desc:'Quand un allié se bat : se téléporte à lui et inflige 20 % des PV max du mob (5 % sur un boss)' },
    /* le prochain bloc miné (pas de la terre ni un trésor) est « appris » : ce type de bloc se mine bonus plus vite
       jusqu'à la fin de la session (cumulable) ; la recharge commence une fois le bloc appris */
    { id:'fast_learner', name:'Fast learner', icon:'📖', px:'book', short:'Apprend à miner un type de bloc', unlock:{ scroll:'Parchemin « Fast learner »' }, cd:300,
      bonus:0.10,
      desc:'Le prochain bloc miné (sauf terre et trésor) est appris : ce type de bloc se mine 10 % plus vite jusqu\'à la fin de la session (cumulable)' },
    /* lancée dans le sens du minage, jusqu'à reach cases ou au premier bloc ; explose dans un rayon radius (cercle) :
       casse ce que le mineur peut miner (pas les constructions ni l'incassable), comme s'il l'avait miné (butin, XP,
       fortune). Le lancer dure throwTime s.
       Rework du 28/10/2026 (Geoffrey) : elle ne casse que les blocs de dureté < hardMul × sa vitesse de minage (stat
       mineSpeed × (1 + minage %)), et inflige dmg × ses dégâts (critique possible, comme le Cleave) à chaque mob dans son
       rayon (un boss de donjon seulement s'il le combat déjà ; dans une tour, le boss aussi) */
    { id:'dynamite', name:'Dynamite', icon:'🧨', px:'fire', short:'Fait sauter les blocs tendres devant lui', unlock:{ tree:'mineur', level:10 }, needTree:'mineur', cd:150,
      reach:2, radius:2, throwTime:0.5, hardMul:3, dmg:0.5,
      fightFoes:2,   // tours et instance (29/10/2026, Geoffrey) : en combat, elle part sur le boss, ou s'il y a au moins fightFoes mobs dans son rayon (valeur provisoire)
      desc:'Lance une dynamite devant lui (2 cases au plus) : dans un rayon de 2, elle casse les blocs moins durs que 3 × sa vitesse de minage, comme s\'il les minait, et inflige 50 % de ses dégâts aux mobs' },
    /* 27/10/2026 (Geoffrey) : le prochain allié à radius cases ou moins (cercle), qui travaille dans la mine (pas en
       remontée ni en descente depuis la surface) et à qui il manque de l'oxygène, regagne podsPct des pods max DU
       LOGISTICIEN en oxygène (sans dépasser son max). Jamais sur lui-même. La recharge commence une fois l'oxygène
       donné. Plusieurs alliés à portée : celui qui a le moins d'oxygène (en % de son max ; choix de Claude) */
    { id:'zipette', name:'Bonbonne de zipette', icon:'🫧', px:'bubbles', short:'Redonne de l\'oxygène à un allié', unlock:{ tree:'logisticien', level:10 }, needTree:'logisticien', cd:180,
      radius:3, podsPct:0.20,
      desc:'Le prochain allié croisé à 3 cases ou moins, qui travaille dans la mine et à qui il manque de l\'oxygène, regagne 20 % des pods max du logisticien en oxygène (pas sur lui-même ; la recharge commence une fois l\'oxygène donné)' },
    /* 27/10/2026 (Geoffrey) : dès que le barbare entre en combat (il frappe un mob ou un mob le tacle), lui et les
       mineurs à radius cases ou moins (cercle, au moment du cri) ont dégâts × (1 + dmgPct) et vitesse d'attaque ×
       (1 + atkSpeed) pendant duration s ; la recharge commence à la fin de l'effet. Pas de cumul (un 2e cri prolonge) */
    { id:'war_cry', name:'Cri de guerre', icon:'📯', px:'horn', short:'Le groupe frappe plus fort et plus vite', unlock:{ tree:'barbare', level:10 }, needTree:'barbare', cd:180,
      radius:10, duration:30, dmgPct:0.10, atkSpeed:0.05,
      desc:'Quand il entre en combat : lui et les mineurs à 10 cases ou moins font 10 % de dégâts en plus et attaquent 5 % plus vite pendant 30 s (la recharge commence à la fin de l\'effet)' },
    /* 27/10/2026 (Geoffrey) : en combat, inflige dmg × ses dégâts (critique possible, tiré pour chaque mob) à chaque mob
       à radius cases ou moins (cercle) ; ni recul, ni dégâts de zone de Force brute. Un boss de donjon seulement s'il le
       combat déjà */
    { id:'cleave', name:'Cleave', icon:'🪓', px:'sword', short:'Frappe tous les mobs autour de lui', unlock:{ scroll:'Parchemin « Cleave »' }, cd:10,
      radius:2, dmg:0.5,
      desc:'En combat : inflige 50 % de ses dégâts à tous les mobs à 2 cases ou moins (coup critique possible)' },
    /* 27/10/2026 (Geoffrey) : étourdit stun s un mob à range cases ou moins (cercle) qui se bat : d'abord un mob qui
       tacle un allié, puis celui qui le tacle, puis celui qu'il frappe. Comme le Dash : il lâche son tacle et sa
       canalisation (occultiste) est coupée (choix de Claude). Jamais un mob déjà étourdi */
    { id:'hand_of_justice', name:'Hand of Justice', icon:'⚖️', px:'daze', short:'Étourdit un mob qui se bat', unlock:{ scroll:'Parchemin « Hand of Justice »' }, cd:30,
      range:3, stun:3,
      desc:'Étourdit 3 s un mob qui se bat, jusqu\'à 3 cases de distance (d\'abord un mob qui tacle un allié) : il lâche son tacle et son sort est coupé' },
  ],
};

/* ---- États visibles d'un mineur ou d'un mob (28/10/2026, Geoffrey ; spec docs/superpowers/specs/2026-10-28-buffs-debuffs-design.md) ----
   Calculés par src/sim/effects.js depuis les champs de la simulation (rien n'est écrit), envoyés au navigateur avec le
   mineur, affichés en haut à droite de la mine (src/ui/effects.js) et sur le perso (src/render/miner-sprite.js).
   kind : control (il ne peut plus agir), debuff, buff, session (bonus permanent de la session, regroupés dans une
   seule icône) ; icon : icône pixel (src/ui/pxicons.js) ; color : couleur de l'icône. Textes d'aide : src/ui/effects.js. */
export const EFFECTS = {
  order: ['control', 'debuff', 'buff'],
  list: {
    stun:         { kind:'control', name:'Étourdi',             icon:'daze',      color:'#ffd23f' },
    tackled:      { kind:'control', name:'Taclé',               icon:'grab',      color:'#e5534b' },
    caged:        { kind:'control', name:'Enfermé',             icon:'lock',      color:'#c9a227' },
    scared:       { kind:'debuff',  name:'Effroi',              icon:'alert',     color:'#ff8c1a' },
    choke:        { kind:'debuff',  name:'Asphyxie',            icon:'bubbles',   color:'#8fd14f' },
    robbed:       { kind:'debuff',  name:'Volé',                icon:'coin',      color:'#e0b03a' },
    flesh:        { kind:'debuff',  name:'Chair putride',       icon:'heartbreak',color:'#ff6b6b' },
    boss_focus:   { kind:'debuff',  name:'Ciblé par le boss',   icon:'target',    color:'#e5534b' },
    dark:         { kind:'debuff',  name:'Dans le noir',        icon:'moon',      color:'#8a8fb0' },
    war_cry:      { kind:'buff',    name:'Cri de guerre',       icon:'horn',      color:'#ff8c1a' },
    inspiration:  { kind:'buff',    name:'Inspiration',         icon:'note',      color:'#6fc2ff' },
    ore_rush:     { kind:'buff',    name:'Ruée',                icon:'rocket',    color:'#6fc24a' },
    travel_rush:  { kind:'buff',    name:'Navette',             icon:'updown',    color:'#6fc24a' },
    braum:        { kind:'buff',    name:'Braum',               icon:'shield',    color:'#6fc2ff' },
    pillage:      { kind:'buff',    name:'Pillage (glyphe)',    icon:'sword',     color:'#e5534b' },
    fast_learner: { kind:'buff',    name:'Fast learner',        icon:'book',      color:'#b06bff' },
    /* bonus de session (une seule icône, le détail dans sa bulle) */
    ring:         { kind:'session', name:'Anneau',              icon:'ring',      color:'#ffd23f' },
    shrine:       { kind:'session', name:'Shrine',              icon:'shrine',    color:'#c9a227' },
    /* Couronne du Roi Gobelin : buff de son porteur seul (29/10 ; avant : bonus de session) */
    crown:        { kind:'buff',    name:'Couronne du Roi Gobelin', icon:'crown', color:'#ffd23f' },
    /* Instance II, le Golbute (30/10/2026) : stacks de l'avalanche ; à INSTANCE.golbute.avalanche.deathStacks, mort */
    dazed:        { kind:'debuff',  name:'Sonné',               icon:'rock',      color:'#c9a27a' },
    dead:         { kind:'control', name:'Mort',                icon:'skull',     color:'#9a9a9a' },
    escalator:    { kind:'session', name:'Escalateur',          icon:'ladder',    color:'#6fc2ff' },
  },
  session: { name:'Bonus de session', icon:'ring', color:'#ffd23f' },
  /* états des mobs et des boss, au-dessus de leur barre de PV */
  mob: {
    stun:    { name:'Étourdi',   icon:'daze',     color:'#ffd23f' },
    channel: { name:'Canalise',  icon:'radiance', color:'#b06bff' },
    taunt:   { name:'Provoqué',  icon:'shout',    color:'#ff8c1a' },
    rage:    { name:'Rage',      icon:'fire',     color:'#e5534b' },
    air:     { name:'En l\'air', icon:'feather',  color:'#d8f0ff' },
    charge:  { name:'Charge',    icon:'alert',    color:'#ff8c1a' },   // minotaure qui gratte le sol (30/10/2026)
    exposed: { name:'Vulnérable', icon:'target',  color:'#ffd23f' },   // minotaure sonné après une charge ratée
  },
  /* durée (ms, temps de la page) de l'animation d'un sort sur le perso, et sa couleur (onde qui s'élargit + icône du sort) */
  castAnim: 900,
  castColor: { dash:'#d8f0ff', illumination:'#fff3a0', inspiration:'#6fc2ff', ulti_shen:'#b06bff', fast_learner:'#c9a2ff',
               dynamite:'#ff8c1a', zipette:'#8fd14f', war_cry:'#ff6a3b', cleave:'#e5534b', hand_of_justice:'#ffd23f' },
};


/* textures : fichiers de textures/ (générés par scripts/gen_textures.py) */
export const TEXTURES = ['dirt','grass','stone','hardstone','coal','iron','gold','diamond','graphite','mithril','cobalt','thorium','tunnel','barrier','prison_bars','chest_base','khole','sky','bridge','treasure','treasure_t1','treasure_t2','treasure_t3',
  'blueprint','bp_parts','gem_ruby','gem_jade','gem_sapphire',
  'ingot_iron','ingot_gold','ingot_tainted','ingot_tainted_gold','ingot_graphite','ingot_steel','furnace_iron','compass_gold','shiny_iron','shiny_gold','pickaxe_stone','helmet_chitin','chest_chitin','legs_chitin','boots_chitin',
  'pickaxe_iron','sword_stone','sword_iron','spear_iron','helmet_iron','chest_iron','legs_iron','boots_iron','belt_goblin',
  'lamp_incandescent','pickaxe_steel','sword_steel','helmet_steel','chest_steel','legs_steel','boots_steel','chest_balance',
  'gloves_tactical','gloves_worker','cape_naingui','straps_goblin','hood_dark','cloud_magic','belt_giant','dark_cloth','gas_vesicle','slippery_stone','dungeon_brick','minotaur','minotaur_black','moon_crystal','orb','key_instance_1','key_instance_2','angel_feather','angel_feathers',
  'residue_angel','residue_demon','rune','rune_fragment','chest_angel','chest_demon','giant_block','giant_fountain','giant_torch','instance_spawner','instance_cage','goblin_king','golbute','golbute_crystal','golbute_rock','chest_golbute',
  'brick_angel','brick_angel_hard','brick_demon','brick_demon_hard','boss_angel','boss_demon','seraph','imp',
  'crown_goblin_king','mace_goblin_king','cape_goblin_royal','furnace_gold','recipe_chitin','chest_goblin_king','nugget_silver','ingot_silver','shrine_abundance',
  'ingot_mithril','refined_cobalt','refined_thorium','ingot_cobalt','ingot_thorium','minotaur_leather','rotten_flesh','treasure_t4',
  'gem_topaz','gem_ruby_fine','gem_jade_fine','gem_sapphire_fine','glasses_gucci','boots_docs','belt_golem','gloves_butcher','legs_titan',
  'helmet_mithril','chest_mithril','legs_mithril','boots_mithril','helmet_thorium','chest_thorium','legs_thorium','boots_thorium',
  'helmet_cobalt','chest_cobalt','legs_cobalt','boots_cobalt',
  'ring_tiger','ring_lion','ring_rat','ring_whale','ring_cuck','ring_nerd','ring_midas','ring_jester','ring_stone','pickaxe_nemesis','chest_gollex','legs_golbute','soul_golbute',
  'ladder','chest','miner','mimic','bug','goblin','occultist','mephite','golem','flesh_wall','flesh_icon','duck','heart_fragment','torch','stun','winch_rope','winch_top','bucket','lift_rail','lift_top','lift_cabin','backpack','scroll','glyph',
  // le Carreau, ville du spawn (29/10/2026, src/render/town.js)
  'town_cobble','town_campfire','town_lamppost','town_headframe','town_cloud',
  'town_banner_angel','town_banner_demon','town_pedestal','town_tavern','town_archives','town_library','town_training','town_mage_tower',
  'town_armory','town_warehouse','town_foundry','town_crusher','town_workshop','town_jeweler','town_cliff','town_slagheap'];

/* ---- Hors session : four (onglet Four) ----
   Un four : une case minerai (famille ore), une case combustible (famille combustible), une case sortie (lingots).
   Chaque lingot consomme orePerIngot minerais + fuelPerIngot combustibles, en time secondes (temps réel, même
   page fermée : le serveur calcule l'avancée depuis l'heure de départ). Un minerai (famille ore) sans recette ne va pas
   dans le four (le diamant, pour l'instant).
   max : nombre de fours au maximum ; startOwned : fours possédés au départ (les autres sont sous cadenas).
   tiers : fours plus puissants à venir (speed divise le temps de fonte).
   Deux modes par four (bouton Fondre / Alliage) : recipes = la fonte (mode Fondre ; une entrée peut aussi être un
   matériau, ex. Peau de gobelin → Chitine, et être fermée par `unlock`), alloys = les alliages (mode
   Alliage : deux ingrédients en `in` + `fuel` combustibles par produit, en time secondes). */
export const FURNACE = {
  max:3, startOwned:1, orePerIngot:10, fuelPerIngot:10,
  tiers: [ { name:'Four en pierre', speed:1 }, { name:'Four en fer', speed:1.25 }, { name:'Four en or', speed:1.5 } ],   // four en or : 27/10 (Geoffrey)
  /* objets qui débloquent un four : « Utiliser » dans l'inventaire consomme l'objet et ouvre le four n° slot (0 = le
     premier), du tier donné. Seulement s'il est le prochain four fermé (le 3e four : Four en or, 27/10). */
  unlockItems: { 'Four en fer': { slot:1, tier:1, tex:'furnace_iron' }, 'Four en or': { slot:2, tier:2, tex:'furnace_gold' } },
  recipes: {
    Fer:     { out:'Lingot de fer',     time:60,  tex:'ingot_iron' },
    Or:      { out:'Lingot d\'or',      time:120, tex:'ingot_gold' },
    'Graphite ore': { out:'Graphite ingot', time:60, tex:'ingot_graphite' },        // 23/10, Geoffrey
    /* 27/10/2026 (Geoffrey) : 10 peaux + 10 charbons = 5 chitine ; qty : produits par fournée (1 par défaut) ; unlock :
       recette fermée tant que l'objet n'a pas été « utilisé » (inv.unlocked, src/meta/craft.js learn) */
    'Peau de gobelin': { out:'Chitine', qty:5, time:60, tex:'bug', unlock:'Recette : Chitine' },
    /* 27/10/2026 (Geoffrey) : 10 pépites (récompense du bloc géant, GIANT.nugget) + 10 charbons = 1 barre ; ouverte de base.
       Durée provisoire (comme le fer) ; la barre n'a pas encore d'usage */
    'Pépite d\'argent': { out:'Barre d\'argent', time:60, tex:'ingot_silver' },
    /* 27/10/2026 (Geoffrey) : minerais des areas 6 à 8 ; ore = minerais par fournée (FURNACE.orePerIngot sinon).
       Durées provisoires (choix de Claude) */
    'Mithril ore':  { out:'Mithril ingot',   time:60, tex:'ingot_mithril' },
    'Cobalt ore':   { out:'Refined cobalt',  ore:5, time:60, tex:'refined_cobalt' },
    'Thorium ore':  { out:'Refined thorium', ore:5, time:60, tex:'refined_thorium' },
  },
  alloys: [
    { out:'Tainted iron', in:{ 'Lingot de fer':5, 'Chitine':15 }, fuel:50, time:180, tex:'ingot_tainted' },   // chitine 15 depuis le 25/10/2026 (Geoffrey ; avant 20)
    { out:'Tainted gold', in:{ 'Lingot d\'or':5,  'Peau de gobelin':20 }, fuel:50, time:180, tex:'ingot_tainted_gold' },
    { out:'Steel ingot',  in:{ 'Tainted iron':3,  'Graphite ingot':5 },   fuel:50, time:180, tex:'ingot_steel' },   // 23/10, Geoffrey ; graphite 10 → 5 (26/10)
    /* 27/10/2026 (Geoffrey) ; combustible et durée provisoires (comme les autres alliages, choix de Claude) ; 3 Tainted gold
       en plus depuis le 30/10/2026 (Geoffrey, 3e case du four) */
    { out:'Cobalt ingot',  in:{ 'Mithril ingot':5, 'Refined cobalt':5, 'Tainted gold':3 },  fuel:50, time:180, tex:'ingot_cobalt' },
    { out:'Thorium ingot', in:{ 'Mithril ingot':5, 'Refined thorium':5, 'Tainted gold':3 }, fuel:50, time:180, tex:'ingot_thorium' },
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
/* ---- Annonces Discord (server/social/discord.js) ----
   25/10/2026 (Geoffrey) : un message dans le salon #général quand un joueur loot un trésor de tour (RUNE.treasures)
   ou identifie une pièce de qualité minQuality ou plus. timeoutMs : délai max d'un envoi (il part en tâche de fond). */
/* minQuality : 6 depuis le 28/10/2026 (Geoffrey ; avant 7) : trésors de tour, coffres du Roi Gobelin, identifications */
export const ANNOUNCE = { minQuality: 6, emoji: '🚨', timeoutMs: 5000 };

export const RUNE = {
  item: 'Rune', tex: 'rune', chestWeight: 2,
  /* Fragment de rune (23/10/2026, Geoffrey) : une rune retirée d'une pièce (gratuit) devient un fragment, de la même
     qualité et avec les mêmes lignes, dont les % ne comptent que pour `factor` (÷ 2 ; la ligne « +1 Découverte » n'est pas
     un % : inchangée). Un fragment se repose comme une rune (mêmes règles) ; un fragment posé ne se retire plus. */
  fragment: { item: 'Fragment de rune', tex: 'rune_fragment', factor: 0.5 },
  treasures: { angel: { name:'Trésor angélique', tex:'chest_angel' }, demon: { name:'Trésor démoniaque', tex:'chest_demon' } },
  /* coefficients de chance d'un trésor (30/10/2026, Geoffrey) : même trésor, même table, chances multipliées (rings :
     anneaux, RINGS.drops). Chaque entrée crée toute seule ses variantes R1 à R7 (« Trésor démoniaque R5 béni »), sans liste
     à écrire. Donné par les stèles des tours (SHRINES, effect.luck). Ajouter un bonus = une entrée ici. */
  luck: { beni: { label:'béni', rings:2 } },
  treasureRarity: 'unique',
  /* ancien : coffres empilables, plus donnés depuis le 22/10 ; rareté (contour de case) selon la qualité */
  chests: { angel: { name:'Coffre angélique', tex:'chest_angel' }, demon: { name:'Coffre démoniaque', tex:'chest_demon' } },
  rarity: { 1:'commun', 2:'inhabituel', 3:'rare', 4:'epique', 5:'legendaire', 6:'legendaire', 7:'legendaire' },
  /* Poudre de rêve (29/10/2026, Geoffrey) : recycler une rune (inventaire) la détruit et rend min à max Poudre de rêve
     (tirées par le serveur), quelle que soit sa qualité ; un fragment de rune rend fragment.min à fragment.max. */
  dust: { item:'Poudre de rêve', tex:'dream_powder', rarity:'rare',
          recycle: { rune:{ min:8, max:12 }, fragment:{ min:1, max:6 } } },
  /* Rune fabriquée (craft, recette « Rune » de src/recipes.js, 29/10/2026, Geoffrey) : sa qualité est tirée avec ces
     chances (pas celles de l'identification, UPGRADE.qualities), puis ses lignes comme une rune de tour. */
  craftChances: { 1:0.15, 2:0.25, 3:0.30, 4:0.18, 5:0.06, 6:0.045, 7:0.015 },
};

/* ---- Aura du stuff (src/meta/aura.js, dessin : src/render/aura.js) ----
   25/10/2026 (Geoffrey) : une pièce dessinée sur le mineur (calques du corps de src/skins.js ; la pioche et l'épée
   quand il les a en main, ajoutées le même jour), identifiée R`minQ`+ ET portant une
   vraie rune R`minQ`+ (un fragment ne compte pas), émet une aura : un halo de la couleur de la police de la qualité la
   plus basse des deux (UPGRADE.qualities), qui pulse. Visuel seulement. Ex. plastron R6 + rune R5 : halo orange faible.
   looks : radius = largeur du halo en pixels de texture (16×16) ; alpha = opacité au plus fort ; pulse = part de
   l'opacité qui respire ; period = durée d'une respiration (s). */
export const AURA = {
  minQ: 4,
  tiers: { 4:'faible', 5:'faible', 6:'moyenne', 7:'forte' },
  looks: {
    faible:  { radius:1, alpha:0.45, pulse:0.45, period:2.6 },
    moyenne: { radius:2, alpha:0.65, pulse:0.40, period:2.0 },
    forte:   { radius:2, alpha:0.95, pulse:0.35, period:1.4 },
  },
};
const QUALITY_NUMS = [1,2,3,4,5,6,7];
/* nom interne du trésor d'une tour (side : 'angel' | 'demon') et d'une qualité (1 à 7) : « Trésor démoniaque R5 » */
/* luck : un coefficient de RUNE.luck (30/10/2026) ou rien ; « Trésor démoniaque R5 béni » */
export const treasureItem = (side, q, luck = null) => `${RUNE.treasures[side].name} R${q}` + (luck && RUNE.luck[luck] ? ` ${RUNE.luck[luck].label}` : '');
const TREASURE_ITEMS = Object.fromEntries(Object.entries(RUNE.treasures).flatMap(([side, c]) =>
  [null, ...Object.keys(RUNE.luck)].flatMap(luck => QUALITY_NUMS.map(q => [treasureItem(side, q, luck),
    { cat:'treasure', tex:c.tex, w:RUNE.chestWeight, stack:false, chest:{ side, q, ...(luck ? { luck } : {}) }, treasure:true }]))));
/* ---- Roi Gobelin (27/10/2026, Geoffrey) ----
   Le boss n'existe pas encore (à définir) : à sa mort, CHAQUE joueur recevra un « Coffre du Roi Gobelin » de qualité R1
   à R7 (chances UPGRADE.qualities, comme les trésors des tours). En attendant, il ne s'obtient que par l'admin
   (scripts/give-item.js « Coffre du Roi Gobelin R4 »). Ouvert depuis l'inventaire (src/meta/loot.js) : la table `loot`
   (même format que LOOT : tous les always, puis un tirage par famille, au plus un objet chacune) ; une pièce de stuff qui
   en sort est déjà identifiée, à la qualité du coffre. learnOnce : l'objet ne sort que si sa recette n'est pas encore
   apprise ; spellOnce : un parchemin ne sort que si son sort n'est pas encore appris (sinon, rien pour ce tirage).
   thrall : passif de la Couronne du Roi Gobelin (STATS.goblinThrall = rayon) : un gobelin qui naît à radius cases ou
   moins (cercle) d'un porteur est asservi : il ne se bat pas, mine pendant life s à la vitesse d'un mineur de base
   (minerais à reach cases ou moins, même priorité que le porteur), puis disparaît ; ce qu'il mine va au coffre commun. */
export const GOBLIN_KING = {
  chest: { name:'Coffre du Roi Gobelin', tex:'chest_goblin_king',
           levels: { 1:'', 2:' II' } },   // niveaux de l'Instance I (29/10/2026) : suffixe du nom ; butin × INSTANCE.levels[n].chest
  loot: {
    always: [
      /* 29/10/2026 (Geoffrey) : lingots de graphite et fer souillé à la place du minerai de graphite (avant : Graphite ore 20-40) */
      { item:'Graphite ingot',  min:5,  max:15  },
      { item:'Tainted iron',    min:10, max:20  },
      { item:'Peau de gobelin', min:50, max:100 },
    ],
    oneOf: [
      { family:'boss', items:[
        { item:'Couronne du Roi Gobelin', chance:0.01 },
        { item:'Four en or BP',           chance:0.02 },
        { item:'Masse du Roi Gobelin',    chance:0.02 },
        { item:'Cape royale du Gobelin',  chance:0.02 },
      ]},
      { family:'recipe', items:[ { item:'Recette : Chitine', chance:0.05, learnOnce:true } ] },
      /* 27/10/2026 (Geoffrey) : parchemins de sort, au plus un ; spellOnce : un sort déjà appris ne sort pas */
      { family:'scroll', items:[
        { item:'Parchemin « Ulti shen »',       chance:0.01,  spellOnce:true },
        { item:'Parchemin « Fast learner »',    chance:0.005, spellOnce:true },
        { item:'Parchemin « Cleave »',          chance:0.01,  spellOnce:true },
        { item:'Parchemin « Hand of Justice »', chance:0.01,  spellOnce:true },
      ]},
      { family:'gem', items:gems(0.01) },
    ],
  },
  thrall: { radius:10, life:30, reach:6 },
};
/* « Coffre du Roi Gobelin R4 » : un par qualité, non empilable, comme les trésors des tours (side 'goblin') ; niveau 2 de
   l'instance (29/10/2026) : « Coffre du Roi Gobelin II R4 » (chest.level 2) */
export const goblinChestItem = (q, level = 1) => `${GOBLIN_KING.chest.name}${GOBLIN_KING.chest.levels[level] ?? ''} R${q}`;
const GOBLIN_CHEST_ITEMS = Object.fromEntries(Object.keys(GOBLIN_KING.chest.levels).map(Number).flatMap(level => QUALITY_NUMS.map(q =>
  [goblinChestItem(q, level), { cat:'treasure', tex:GOBLIN_KING.chest.tex, w:RUNE.chestWeight, stack:false, chest:{ side:'goblin', q, level }, treasure:true }])));

/* ---- Golbute (Instance II, 30/10/2026, Geoffrey) : à sa mort, chaque joueur encore là reçoit un « Coffre du Golbute »
   R1 à R7 (même principe que le Coffre du Roi Gobelin). Son butin est à définir (loot vide) : tant qu'il l'est, le coffre
   ne s'ouvre pas, il attend dans l'inventaire (src/meta/loot.js canOpen). */
export const GOLBUTE = {
  chest: { name:'Coffre du Golbute', tex:'chest_golbute' },
  /* butin (30/10/2026, Geoffrey) : même format que le Coffre du Roi Gobelin ; pièce de stuff identifiée à la qualité
     du coffre ; learnOnce / spellOnce : rien pour ce tirage si la recette / le sort est déjà appris */
  loot: {
    always: [
      { item:'Mithril ingot',    min:2, max:4 },
      { item:'Refined thorium',  min:1, max:2 },
      { item:'Refined cobalt',   min:1, max:2 },
      { item:'Pierre glissante', min:5, max:10 },
    ],
    oneOf: [
      { family:'boss', items:[
        { item:'Némésis du Golbute',    chance:0.01 },
        { item:'Torse de Gollex',       chance:0.03 },
        { item:'Anneau en pierre',      chance:0.02 },
        { item:'Jambières du Golbute',  chance:0.03 },
        { item:'Âme du Golbute',        chance:0.02 },
      ]},
      { family:'scroll', items:[
        { item:'Parchemin « Ulti shen »',       chance:0.01,  spellOnce:true },
        { item:'Parchemin « Fast learner »',    chance:0.005, spellOnce:true },
        { item:'Parchemin « Cleave »',          chance:0.01,  spellOnce:true },
        { item:'Parchemin « Hand of Justice »', chance:0.01,  spellOnce:true },
      ]},
      { family:'recipe', items:[ { item:'Recette : Chitine', chance:0.05, learnOnce:true } ] },
      /* gemmes inférieures : 2 % chacune, au plus une (comme le Coffre du Roi Gobelin) */
      { family:'gem', items:[ { item:'Rubis inférieur', chance:0.02 }, { item:'Jade inférieur', chance:0.02 }, { item:'Saphir inférieur', chance:0.02 } ] },
    ],
  },
  golemOxygenRadius: 8,   // Âme du Golbute : rayon (cercle, cases) autour du porteur
};
export const golbuteChestItem = q => `${GOLBUTE.chest.name} R${q}`;
const GOLBUTE_CHEST_ITEMS = Object.fromEntries(QUALITY_NUMS.map(q =>
  [golbuteChestItem(q), { cat:'treasure', tex:GOLBUTE.chest.tex, w:RUNE.chestWeight, stack:false, chest:{ side:'golbute', q }, treasure:true }]));

/* ancien : nom de l'objet coffre d'une tour et d'une qualité (« Coffre angélique R4 ») */
export const chestItem = (side, q) => `${RUNE.chests[side].name} R${q}`;
const CHEST_ITEMS = Object.fromEntries(Object.entries(RUNE.chests).flatMap(([side, c]) =>
  QUALITY_NUMS.map(q => [chestItem(side, q), { cat:'treasure', tex:c.tex, w:RUNE.chestWeight, stack:true, chest:{ side, q } }])));

/* ---- Anneaux (23/10/2026, Geoffrey) ----
   Deux cases de stuff (STUFF.slots, `fits: slot`). Un anneau n'a aucune stat pour son porteur seul : son effet va à
   TOUT le groupe de la session (porteur compris), une seule fois même si plusieurs joueurs portent le même anneau
   (src/meta/stuff.js withRings). Un joueur ne peut pas porter deux fois le même anneau. En mine instantanée (chacun
   pour soi), seulement sur son porteur.
   Ni craft, ni identification, ni enchantement : un anneau ne vient que des trésors des tours.
   Amélioration (27/10/2026, Geoffrey ; avant : aucune) : +1 à +9 comme les autres pièces, mêmes chances de réussite
   (UPGRADE.levels), mais le coût est UN DOUBLON du même anneau (pas de plumes ni de cristaux) ; chaque rang ajoute
   `upgrade` point(s) à chaque effet (+3 % → +3,5 % au +1, +7,5 % au +9). Deux joueurs du groupe avec le même anneau :
   le plus haut niveau compte.
   Effets : mult = % ajouté au TOTAL de la stat (stuff et skills compris : ×1,03) ; add = points ajoutés à une stat
   déjà en % (dégâts %, minage %, fortune, butin des mobs) ; xp = % d'XP en plus pour son PORTEUR SEUL, sur sa part,
   après le partage du pot (24/10/2026, Geoffrey ; ancien : +% sur le pot, pour tout le groupe).
   drops : à l'ouverture d'un trésor de tour (RUNE.treasures), en plus de la rune, un seul tirage : au plus un anneau,
   chance de chacun. Valeurs provisoires (équilibrage). */
export const RINGS = {
  slot: 'anneau',
  upgrade: 0.5,        // points ajoutés à chaque effet par rang d'amélioration (27/10/2026, Geoffrey ; provisoire)
  items: {
    'Anneau du tigre':      { tex:'ring_tiger',  rarity:'rare',   mult:{ speed:3, climbSpeed:3 } },
    'Anneau du lion':       { tex:'ring_lion',   rarity:'rare',   add:{ damagePct:3 } },
    'Anneau du rat':        { tex:'ring_rat',    rarity:'rare',   add:{ mineSpeedPct:3 } },
    'Anneau de la baleine': { tex:'ring_whale',  rarity:'rare',   mult:{ oxygenMax:3 } },
    'Anneau du cuck':       { tex:'ring_cuck',   rarity:'rare',   mult:{ pods:3 } },
    'Anneau du nerd':       { tex:'ring_nerd',   rarity:'rare',   xp:3 },
    'Anneau de Midas':      { tex:'ring_midas',  rarity:'epique', add:{ fortune:2 } },
    'Anneau du Bouffon':    { tex:'ring_jester', rarity:'epique', add:{ looting:2 } },
    'Anneau en pierre':     { tex:'ring_stone',  rarity:'rare',   add:{ tenacity:3 } },   // Coffre du Golbute (30/10/2026, Geoffrey)
  },
  drops: {
    angel: [ { item:'Anneau du tigre', chance:0.01 }, { item:'Anneau du lion', chance:0.01 }, { item:'Anneau du rat', chance:0.01 },
             { item:'Anneau de la baleine', chance:0.01 }, { item:'Anneau du cuck', chance:0.01 }, { item:'Anneau du nerd', chance:0.01 },
             { item:'Anneau de Midas', chance:0.005 } ],
    demon: [ { item:'Anneau du tigre', chance:0.01 }, { item:'Anneau du lion', chance:0.01 }, { item:'Anneau du rat', chance:0.01 },
             { item:'Anneau de la baleine', chance:0.01 }, { item:'Anneau du cuck', chance:0.01 }, { item:'Anneau du nerd', chance:0.01 },
             { item:'Anneau du Bouffon', chance:0.005 } ],
  },
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
    { id:'unique',     label:'Unique',     color:'#c0480f' },     // trésors des tours (RUNE.treasureRarity)
  ],
  default: 'commun',
  items: {
    ...Object.fromEntries(Object.values(GLYPHS.items).map(n => [n, GLYPHS.rarity])),   // glyphes (25/10)
    [RUNE.item]:'epique', [RUNE.fragment.item]:'rare', [RUNE.dust.item]:RUNE.dust.rarity,   // résidus angélique et démoniaque : communs (gris), décision du 22/10 (Geoffrey)
    ...Object.fromEntries(Object.entries(CHEST_ITEMS).map(([n, d]) => [n, RUNE.rarity[d.chest.q]])),
    ...Object.fromEntries(Object.keys(TREASURE_ITEMS).map(n => [n, RUNE.treasureRarity])),
    'Cobalt ore':'inhabituel', 'Thorium ore':'inhabituel',   // Mithril ore : commun (27/10/2026, Geoffrey)
    'Rubis inférieur':'inhabituel', 'Saphir inférieur':'inhabituel', 'Jade inférieur':'inhabituel',
    'Boussole en or':'inhabituel', 'Boussole en or BP':'inhabituel',
    'Four en fer':'inhabituel', 'Four en fer BP':'inhabituel',
    'Ceinture en peau de gobelin':'inhabituel', 'Ceinture en peau de gobelin BP':'inhabituel',
    'Gants tactique':'inhabituel', 'Gants tactique BP':'inhabituel', 'Gants d\'ouvrier':'inhabituel', 'Gants d\'ouvrier BP':'inhabituel',
    'Cape de Naingui':'rare', 'Cape de Naingui BP':'rare',
    'Lampe à incandescence':'rare', 'Lampe à incandescence BP':'rare',   // 25/10 (Geoffrey) ; BP le 26/10
    ...Object.fromEntries(['Casque', 'Plastron', 'Jambes', 'Bottes', 'Pioche', 'Épée'].flatMap(p =>
      [[`${p} en acier`, 'inhabituel'], [`${p} en acier BP`, 'inhabituel']])),                  // 23/10, Geoffrey
    'Plastron de l\'équilibre':'epique', 'Plastron de l\'équilibre BP':'epique',
    'Lanières en cuir du gobelin':'inhabituel', 'Capuche sombre':'rare', 'Nuage magique':'rare', 'Ceinture du Géant':'epique',   // butin des mobs (MOB_DROPS)
    'Cristal de pleine lune':'rare',
    'Clé d\'instance I':'inhabituel', 'Clé d\'instance II':'inhabituel',
    'Plume d\'ange':'rare',
    /* Roi Gobelin (27/10/2026, Geoffrey) ; ses coffres : comme les trésors des tours */
    'Némésis du Golbute':'legendaire', 'Âme du Golbute':'epique', 'Torse de Gollex':'rare', 'Jambières du Golbute':'rare',   // Coffre du Golbute (30/10)
    'Couronne du Roi Gobelin':'legendaire', 'Masse du Roi Gobelin':'rare', 'Cape royale du Gobelin':'rare',
    'Recette : Chitine':'inhabituel', 'Four en or':'rare', 'Four en or BP':'rare',
    /* Treasure T4 (27/10/2026, Geoffrey) */
    'Mithril ingot':'inhabituel', 'Refined cobalt':'inhabituel', 'Refined thorium':'inhabituel', 'Cobalt ingot':'rare', 'Thorium ingot':'rare',
    'Topaze':'rare', 'Saphir':'rare', 'Rubis':'rare', 'Jade':'rare', 'Saphir BP':'rare', 'Rubis BP':'rare', 'Jade BP':'rare',
    'Clé d\'instance I BP':'inhabituel', 'Cuir de minotaure':'rare',
    ...Object.fromEntries(['Casque', 'Plastron', 'Jambes', 'Bottes'].flatMap(p => [[`${p} en mithril`, 'inhabituel'], [`${p} en mithril BP`, 'inhabituel'],
      [`${p} en thorium`, 'rare'], [`${p} en thorium BP`, 'rare'], [`${p} en cobalt`, 'rare'], [`${p} en cobalt BP`, 'rare']])),
    ...Object.fromEntries(['Lunettes Gucci', 'Doc Martins', 'Ceinture golémique', 'Gants de boucher'].flatMap(n => [[n, 'rare'], [`${n} BP`, 'rare']])),
    'Jambières titanesques':'epique', 'Jambières titanesques BP':'epique',
    ...Object.fromEntries(Object.keys(GOBLIN_CHEST_ITEMS).map(n => [n, RUNE.treasureRarity])),
    ...Object.fromEntries(Object.keys(GOLBUTE_CHEST_ITEMS).map(n => [n, RUNE.treasureRarity])),
    ...Object.fromEntries(Object.entries(RINGS.items).map(([n, d]) => [n, d.rarity])),
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
    /* deux cases pour le même genre de pièce : `fits` = la case des objets qu'elles acceptent (RINGS) */
    { id:'anneau1',  label:'Anneau',   icon:'💍', fits:'anneau' }, { id:'anneau2',  label:'Anneau',   icon:'💍', fits:'anneau' },
    { id:'torche',   label:'Torche',   icon:'🔦' },   // 25/10/2026 (Geoffrey) : change l'effet des torches (Lampe à incandescence)
  ],
  /* stats : bonus ajoutés aux STATS du mineur (clé de STATS → valeur) ; set : valeur qui REMPLACE la base (ex. l'épée
     remplace les mains nues). Appliqués en session (stuff porté au lancement, src/meta/stuff.js statsOf). */
  items: {
    'Pioche en pierre':    { slot:'pioche', tex:'pickaxe_stone', stats:{ mineSpeed:0.2 } },
    'Casque en chitine':   { slot:'casque', tex:'helmet_chitin', stats:{ oxygenMax:25 } },   // 27/10 (Geoffrey) : valeur du tier, 100 x (avant 30)
    'Plastron en chitine': { slot:'torse',  tex:'chest_chitin',  stats:{ pods:30 } },   // 23/10 (Geoffrey) : avant 25. Torse hors règle du tier (27/10 : volontairement plus fort)
    'Jambes en chitine':   { slot:'jambes', tex:'legs_chitin',   stats:{ climbSpeed:0.4 } },   // 100 x (valeur du tier)
    'Bottes en chitine':   { slot:'pieds',  tex:'boots_chitin',  stats:{ speed:0.42 } },   // 27/10 (Geoffrey) : valeur du tier, ≈ 100 x (avant 0,5)
    /* pièces en fer et ceinture : recettes débloquées par leur blueprint (src/recipes.js) */
    'Pioche en fer':       { slot:'pioche', tex:'pickaxe_iron',  stats:{ mineSpeed:0.4 } },   // 25/10 (Geoffrey) : nerf, avant 0,5 (24/10 : 0,4 × 1,25 ; le × 1,75 du fer, 0,7, était trop fort)
    'Épée en pierre':      { slot:'epee',   tex:'sword_stone',   set:{ damage:8 } },      // remplace les mains nues (5) : +3, moitié de l'épée en fer
    'Épée en fer':         { slot:'epee',   tex:'sword_iron',    set:{ damage:14 } },     // remplace les mains nues (5) ; 24/10 : × 1,25 (avant 11)
    /* variante de l'épée (25/10/2026, Geoffrey) : elle tue moins vite, mais repousse assez (0,25 + 0,5 = 0,75 bloc, plus
       que la portée de tacle d'un mob, 0,5) pour lui faire lâcher son tacle. Équilibrage (duels contre 4 mobs, vs épée) :
       temps pour tuer +16 %, temps taclé −36 %, plus de vol du gobelin (3 → 0). Avant (+10 dégâts, recul +0,25) : égale à
       l'épée, aucun tacle évité. Dégâts +8 sur les mains nues (13), vitesse d'attaque −10 % (idée de Geoffrey ; le verrou
       du recul suffit déjà contre la boucle, src/sim/actions.js landHit). Valeurs provisoires. */
    'Lance en fer':        { slot:'epee',   tex:'spear_iron',    stats:{ damage:8, attackSpeed:-10, knockback:0.5, reach:0.25 } },
    'Casque en fer':       { slot:'casque', tex:'helmet_iron',   stats:{ oxygenMax:63 } },   // 27/10 (Geoffrey) : valeur du tier, ≈ 250 x (avant 67 ; 24/10 : 38)
    'Plastron en fer':     { slot:'torse',  tex:'chest_iron',    stats:{ pods:88 } },   // 24/10 : avant 50 (23/10 : avant 33). Torse hors règle du tier (27/10)
    'Jambes en fer':       { slot:'jambes', tex:'legs_iron',     stats:{ climbSpeed:1 } },   // 27/10 (Geoffrey) : valeur du tier, 250 x (avant 1,05 ; 24/10 : 0,6)
    'Bottes en fer':       { slot:'pieds',  tex:'boots_iron',    stats:{ speed:1.04 } },   // 27/10 (Geoffrey) : valeur du tier, ≈ 250 x (avant 1,05 ; 24/10 : 0,6)
    'Ceinture en peau de gobelin': { slot:'ceinture', tex:'belt_goblin', stats:{ torches:10 } },
    'Boussole en or':      { slot:'boussole', tex:'compass_gold',  stats:{ compassRows:1 } },   // voit 1 ligne au-dessus et en dessous
    /* 25/10/2026 (Geoffrey) : +10 torches, rayon 8 (au lieu de 5), pose deux fois plus rapide (0,5 s au lieu de 1) */
    'Lampe à incandescence': { slot:'torche', tex:'lamp_incandescent', stats:{ torches:10 }, set:{ torchRadius:8, torchTime:0.5 } },
    /* tier 2 (Treasure T2) : recettes débloquées par leur blueprint */
    'Gants tactique':      { slot:'gants',  tex:'gloves_tactical', stats:{ attackSpeed:10 } },   // 29/10 (Geoffrey) : ≈ +10 % de DPS (avant 20)
    'Gants d\'ouvrier':    { slot:'gants',  tex:'gloves_worker',   stats:{ fortune:5 } },
    'Cape de Naingui':     { slot:'cape',   tex:'cape_naingui',    stats:{ discoverMax:1 } },
    /* tier 3 (Treasure T3, 23/10/2026, Geoffrey) : au départ, acier = pièce en fer × 1,2 (plastron : pods 80).
       24/10 (Geoffrey) : acier × 1,5, épée × 1,25, arrondi à l'entier pour les stats entières (oxygène, pods, dégâts) */
    'Casque en acier':     { slot:'casque', tex:'helmet_steel',  stats:{ oxygenMax:125 } },   // 27/10 (Geoffrey) : buff +100 x, 500 x (avant 100 ; 25/10 : 69)
    'Plastron en acier':   { slot:'torse',  tex:'chest_steel',   stats:{ pods:137 } },   // 27/10 (Geoffrey) : buff +100 x (avant 120 ; 24/10 : 80). Torse hors règle du tier (27/10)
    'Jambes en acier':     { slot:'jambes', tex:'legs_steel',    stats:{ climbSpeed:2 } },   // 27/10 (Geoffrey) : buff +100 x, 500 x (avant 1,6 ; 25/10 : 1,08)
    'Bottes en acier':     { slot:'pieds',  tex:'boots_steel',   stats:{ speed:2.08 } },   // 27/10 (Geoffrey) : buff +100 x, ≈ 500 x (avant 1,67 ; 25/10 : 1,08)
    'Pioche en acier':     { slot:'pioche', tex:'pickaxe_steel', stats:{ mineSpeed:0.58 } },    // 27/10 (Geoffrey) : buff ≈ +100 x, 0,58 (au centième, comme en session ; avant 0,5 ; 25/10 : nerf, avant 0,6)
    'Épée en acier':       { slot:'epee',   tex:'sword_steel',   set:{ damage:18.5 } },   // remplace les mains nues (5) ; 27/10 (Geoffrey) : buff +100 x (avant 16 ; 24/10 : 13)
    'Plastron de l\'équilibre': { slot:'torse', tex:'chest_balance', stats:{ pods:188, oxygenMax:30, mineSpeedPct:3, damagePct:3,
                                   attackSpeed:8, tenacity:3, fortune:2, looting:3, torches:8 } },   // 24/10 : × 1,5 arrondi (avant pods 125, oxygène 20, 2, 2, 5, 2, 1, 2, 5)
    /* tier 4 (Treasure T4, 27/10/2026, Geoffrey) : mithril = même stat que l'acier, à la valeur du T4 (650 x ; plastron
       hors règle, même rapport que l'acier : 137 pods pour 500 x). Thorium et cobalt (T4.5, 750 x) : deux stats à 50/50,
       aux prix du GS (worth, gs, avec les ajustements de Geoffrey UPGRADE.priceAdjust, 27/10) ; plastron
       × 1,644 comme l'acier. Pièces spéciales : 650 x (Lunettes : 1 Découverte = 190 x, le reste en oxygène) ;
       Jambières titanesques : 750 × 2,5 = 1 875 x, quatre parts égales */
    'Casque en mithril':   { slot:'casque', tex:'helmet_mithril', stats:{ oxygenMax:163 } },
    'Plastron en mithril': { slot:'torse',  tex:'chest_mithril',  stats:{ pods:178 } },
    'Jambes en mithril':   { slot:'jambes', tex:'legs_mithril',   stats:{ climbSpeed:2.6 } },
    'Bottes en mithril':   { slot:'pieds',  tex:'boots_mithril',  stats:{ speed:2.71 } },
    'Casque en thorium':   { slot:'casque', tex:'helmet_thorium', stats:{ oxygenMax:94, doubleAttack:11.7 } },   // 23,4 ÷ 2 (Geoffrey, 27/10)
    'Plastron en thorium': { slot:'torse',  tex:'chest_thorium',  stats:{ pods:103, damage:3.85 } },   // 7,7 ÷ 2
    'Jambes en thorium':   { slot:'jambes', tex:'legs_thorium',   stats:{ climbSpeed:1.5, damagePct:31.3 } },   // 93,8 ÷ 3
    'Bottes en thorium':   { slot:'pieds',  tex:'boots_thorium',  stats:{ speed:1.56, crit:7.2 } },   // 14,4 ÷ 2
    'Casque en cobalt':    { slot:'casque', tex:'helmet_cobalt',  stats:{ oxygenMax:94, piercing:13.4 } },   // 53,6 ÷ 4
    'Plastron en cobalt':  { slot:'torse',  tex:'chest_cobalt',   stats:{ pods:103, mineSpeed:0.158 } },   // 0,474 ÷ 3
    'Jambes en cobalt':    { slot:'jambes', tex:'legs_cobalt',    stats:{ climbSpeed:1.5, mineSpeedPct:9.6 } },   // 28,8 ÷ 3
    'Bottes en cobalt':    { slot:'pieds',  tex:'boots_cobalt',   stats:{ speed:1.56, oneTap:28.8 } },
    'Lunettes Gucci':      { slot:'casque',   tex:'glasses_gucci',  stats:{ discoverMax:1, oxygenMax:115 } },
    'Doc Martins':         { slot:'pieds',    tex:'boots_docs',     stats:{ knockRes:10.8, tenacity:16.25 } },   // recul 32,5 ÷ 3, ténacité 32,5 ÷ 2
    'Ceinture golémique':  { slot:'ceinture', tex:'belt_golem',     stats:{ pods:54, knockRes:10.8 } },   // recul 32,5 ÷ 3
    'Gants de boucher':    { slot:'gants',    tex:'gloves_butcher', stats:{ damage:4.05 } },   // 8,1 ÷ 2
    'Jambières titanesques': { slot:'jambes', tex:'legs_titan',     stats:{ climbSpeed:1.88, speed:1.95, mineSpeed:0.12, knockRes:15.6 } },   // minage 0,361 ÷ 3, recul 46,9 ÷ 3
    /* Coffre du Golbute (Instance II, 30/10/2026, Geoffrey) ; x → points au prix de dessin (designPrice : pods 6, marche
       240, dégâts % 6, butin des mobs 10, double attaque 16) */
    'Némésis du Golbute':    { slot:'pioche', tex:'pickaxe_nemesis', stats:{ mineSpeed:0.8 }, set:{ blockMinePct:25 } },   // passif : minage × 1,25 sur terre, pierre, pierre dure…
    'Torse de Gollex':       { slot:'torse',  tex:'chest_gollex',    stats:{ pods:167, speed:-1.04 } },   // pods +1 000 x, marche −250 x
    'Jambières du Golbute':  { slot:'jambes', tex:'legs_golbute',    stats:{ damagePct:33.3, looting:20, doubleAttack:21.9 } },   // 200 x, 200 x, 350 x
    'Âme du Golbute':        { slot:'torche', tex:'soul_golbute',    stats:{ torches:10 }, set:{ torchRadius:10, torchTime:0.5, golemOxygen:25 } },   // passif : +25 oxygène quand un golem meurt à 8 cases
    /* butin rare des mobs (MOB_DROPS) : pas craftables. Règle du 27/10/2026 (Geoffrey) : chacune vaut le x du tier 2
       (250, comme une pièce d'armure en fer), partagé à parts égales entre ses stats, aux prix mesurés du GS (worth, gs) ;
       une stat de combat (STUFF.combatStats) n'en reçoit que STUFF.combatOnStuff (la moitié) : le mineur se bat peu dans
       la mine, ses prix mesurés sont bas, et la même stat est bien plus forte là où on ne fait que se battre (tours).
       tests/stuff-balance.test.js garde cette règle. (Avant, 26/10 au soir : Lanières et Capuche au tableau des runes.)
       recycle : ce que rend le recyclage (quantités fixes, à la place de la part d'une recette) */
    'Lanières en cuir du gobelin': { slot:'torse', tex:'straps_goblin', stats:{ attackSpeed:31.9, looting:12.5 },   // 125 x chacune ; attaque 63,8 % ÷ 2 (avant 44 / 22)
                                     recycle:{ 'Chitine':20, 'Peau de gobelin':10 } },
    'Capuche sombre':      { slot:'casque', tex:'hood_dark',     stats:{ knockback:0.52, crit:4.8 },   // 125 x chacune, ÷ 2 (combat) : recul 1,04 → 0,52, critique 9,6 → 4,8 (avant 0,13 / 9,7)
                             recycle:{ 'Chitine':30, 'Tissu sombre':10 } },
    'Nuage magique':       { slot:'jambes', tex:'cloud_magic',   stats:{ speed:1.04 },   // 250 x, une seule stat (avant 1,1 ; d'abord 1,4)
                             recycle:{ 'Chitine':30, 'Vésicule de gaz':10 } },
    'Ceinture du Géant':   { slot:'ceinture', tex:'belt_giant',  stats:{ damage:1.5, tenacity:12.5 },   // 29/10 (Geoffrey) : dégâts 1,5 ≈ +10 % de DPS avec 14 dégâts fixes (avant 5) ; 28/10 : dégâts 5 (avant 1,6 : 125 x ÷ 2) ; ténacité 25 → 12,5 (d'abord 12,6 dégâts)
                             recycle:{ 'Chitine':50, 'Steel ingot':5 } },
    /* coffre du Roi Gobelin (GOBLIN_KING, 27/10/2026, Geoffrey) : pas craftables, valeurs du créateur */
    'Couronne du Roi Gobelin': { slot:'casque', tex:'crown_goblin_king', stats:{ fortune:10 }, set:{ goblinThrall:10 } },   // passif : gobelins asservis à 10 cases
    'Masse du Roi Gobelin':    { slot:'epee',   tex:'mace_goblin_king',  set:{ damage:14 }, stats:{ crit:15 } },          // remplace les mains nues (5), comme une épée
    'Cape royale du Gobelin':  { slot:'cape',   tex:'cape_goblin_royal', stats:{ damagePct:5, mineSpeedPct:5 } },
    /* anneaux : aucune stat pour le porteur seul, leur effet de groupe est dans RINGS */
    ...Object.fromEntries(Object.entries(RINGS.items).map(([n, d]) => [n, { slot:RINGS.slot, tex:d.tex }])),
  },
  statLabels: { oxygenMax:'Oxygène', pods:'Pods', climbSpeed:'Vitesse (échelle)', speed:'Vitesse (marche)',
                mineSpeed:'Vitesse de minage', damage:'Dégâts', light:'Vision', compass:'Portée boussole', compassRows:'Lignes boussole (dessus/dessous)',
                torches:'Torches', torchRadius:'Rayon des torches', torchTime:'Pose d\'une torche', bridges:'Passerelles', discoverMax:'Découverte',
                attackSpeed:'Vitesse d\'attaque', fortune:'Fortune', tenacity:'Ténacité',
                mineSpeedPct:'Vitesse de minage', damagePct:'Dégâts', crit:'Critique', oneTap:'Coup unique',
                piercing:'Perçage', looting:'Butin des mobs', doubleAttack:'Double attaque', knockRes:'Résistance au recul', reach:'Portée d\'attaque', knockback:'Recul',
                goblinThrall:'Gobelins asservis (rayon)', blockMinePct:'Minage des blocs de terrain', golemOxygen:'Oxygène par golem tué (8 cases)' },
  statUnits: { blockMinePct:' %', goblinThrall:' blocs', torchTime:' s', reach:' bloc', knockback:' bloc', doubleAttack:' %', attackSpeed:' %', fortune:' %', tenacity:' %', knockRes:' %', mineSpeedPct:' %', damagePct:' %', crit:' %', oneTap:' %', piercing:' %', looting:' %' },   // unité affichée après la valeur d'une stat
  /* décimales affichées au plus pour chaque stat (30/10/2026, Jules : pas de virgule quand elle ne sert à rien) ; une stat
     absente en a 1 (bonus en %, dégâts : une amélioration les fait bouger de quelques dixièmes). 0 : un compte (torches,
     pods, oxygène) ; 2 ou 3 : les vitesses, où 0,58 ou +0,206 se lisent (boosts de pioche, bottes, jambes) */
  statDecimals: { oxygenMax:0, pods:0, torches:0, golemOxygen:0, discoverMax:0, compass:0, compassRows:0,
                  speed:2, climbSpeed:2, reach:2, knockback:2, mineSpeed:3 },
  statFloor: ['torches'],   // arrondies à l'inférieur, comme en session (src/sim/mineur.js : 30,9 torches = 30 posées)
  /* stats du mineur affichées dans l'onglet Stuff (base STATS + bonus des pièces portées), dans cet ordre */
  shownStats: ['oxygenMax','pods','speed','climbSpeed','mineSpeed','mineSpeedPct','damage','damagePct','attackSpeed','doubleAttack','reach','knockback','crit','fortune','tenacity','knockRes','oneTap','piercing','looting',
               'discoverMax','light','compass','compassRows','torches','torchRadius','torchTime'],   // goblinThrall (Gobelins asservis) cachée le 27/10 (Geoffrey)
  /* ÉQUILIBRE DU STUFF (27/10/2026, Geoffrey ; gardé par tests/stuff-balance.test.js) :
     - casque, jambes et bottes en chitine, fer, acier valent en GS exactement la valeur de leur tier
       (UPGRADE.tiers : 100 / 250 / 500 x). Les plastrons sont hors règle : la pièce de torse est volontairement plus
       forte (pods ; chitine 180, fer 528, acier 822 x) ;
     - le butin des mobs vaut le tier 2, à parts égales entre ses stats, une stat de combat comptant pour combatOnStuff
       de ce que donnerait l'équation (prix mesurés). Les pièces dessinées à la main (épées, lance, pioches, Plastron de
       l'équilibre, gants, cape, ceinture en peau, boussole, lampe) ne suivent pas cette règle. */
  combatStats: ['damage','damagePct','attackSpeed','doubleAttack','crit','tenacity','knockRes','reach','knockback'],
  combatOnStuff: 1,   // 27/10/2026 (Geoffrey) : plus de demi-valeur, remplacée par UPGRADE.priceAdjust (ancien 0,5)
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
  /* Découverte : sur une rune R6 ou R7 seulement, une fois au plus ; aussi probable qu'une autre stat (25/10/2026, Geoffrey ;
     avant : 25 % de chance par ligne) */
  discover: { qualities:[6, 7], value:1 },
  /* stats qui peuvent tomber sur une ligne (toutes celles qui ont une valeur en x ; pas la Découverte, à part) */
  pool: ['mineSpeed','mineSpeedPct','damage','damagePct','attackSpeed','crit','fortune','oneTap','piercing','looting',
         'speed','climbSpeed','pods','oxygenMax',
         'tenacity','knockRes','reach','knockback','doubleAttack'],   // 25/10/2026 (Geoffrey) : ténacité, résistance au recul, portée, recul, double attaque
  /* VALEUR d'un objet en x = somme de ses stats × worth (catalogue mesuré de GAME_DESIGN §3, mineur de base) :
     pioche en pierre 0,1 × 1300 = 130 x, épée en fer (11 − 5) × 40 = 240 x. */
  worth: { mineSpeed:1300, speed:240, climbSpeed:250, pods:6, oxygenMax:4, damage:40, attackSpeed:1.96, fortune:36,
           discoverMax:190, compassRows:300, mineSpeedPct:13, damagePct:2, crit:13, oneTap:13, piercing:7, looting:10 },
  /* CONVERSION d'une ligne (identification, rune) : x par point de stat. Tableau du créateur du 22/10/2026, donné
     « pour 100 x » : vitesse de minage +0,05, minage % +5, dégâts +2,5, dégâts % +20, vitesse d'attaque +20, critique +7,
     fortune +2, coup unique +7, perçage +10, butin des mobs +10, marche +0,4, montée +0,3, pods +20, oxygène +25.
     prix = 100 ÷ valeur pour 100 x. Les pièces gardent leur %, elles suivent donc ce tableau sans migration. */
  prices: { mineSpeed:2000, mineSpeedPct:20, damage:40, damagePct:5, attackSpeed:5, crit:100/7, fortune:50, oneTap:100/7,
            piercing:10, looting:10, speed:250, climbSpeed:1000/3, pods:5, oxygenMax:4, discoverMax:190, compassRows:300,
            /* 25/10/2026 (provisoire, choix de Claude) : pour 100 x, ténacité +10 %, résistance au recul +20 %, portée +0,1,
               recul +0,1 ; double attaque +5 % (Geoffrey, 25/10 ; d'abord +20 % comme la vitesse d'attaque) */
            tenacity:10, knockRes:5, reach:1000, knockback:1000, doubleAttack:20 },
  /* GEAR SCORE (26/10/2026, Geoffrey) : x par point = worth (mesuré), plus ces stats simulées le 26/10 (document « Valeurs
     en x » : 24 sessions, mineur de base, mêmes seeds avec et sans) qui ne sont pas dans worth. Avant : prices. */
  gs: { doubleAttack:8, tenacity:5, knockRes:0, reach:0, knockback:120, torchRadius:27 },
  /* AJUSTEMENTS DE GEOFFREY (27/10/2026), pas des mesures : sur les prix mesurés (worth, gs), le nombre de points d'une
     stat pour 1 x est DIVISÉ par ce nombre (prix × ce nombre : si 10 dégâts valaient 1 x, 5 dégâts valent 1 x). Stats
     offensives ÷ 2 ; dégâts % ÷ 3 ; perçage ÷ 4 ; vitesse de minage (fixe et %) ÷ 3 ; ténacité ÷ 2 ; résistance au recul
     ÷ 3. Ils remplacent la stat de combat comptée à moitié sur le stuff (STUFF.combatOnStuff, ancien 0,5).
     À GARDER si les poids des stats sont resimulés (npm run weights, stat-values) : appliquer ces diviseurs aux nouvelles
     mesures, et le dire dans le rapport. Servent à DESSINER les pièces (src/meta/gearscore.js designPrice) ; le GS, lui, reste
     au prix mesuré (statPrice) : la stat est divisée ET sa valeur en GS aussi (28/10/2026, Geoffrey ; ancien : GS × ajustement). */
  priceAdjust: { damage:2, attackSpeed:2, doubleAttack:2, crit:2, reach:2, knockback:2,
                 damagePct:3, piercing:4, mineSpeed:3, mineSpeedPct:3, tenacity:2, knockRes:3 },
  /* stats sans prix mesuré (gs à 0) mais ajustées : le prix du tableau des lignes (prices) sert de base */
  priceBase: { knockRes:5 },
  /* GS des stats OFFENSIVES (28/10/2026, Geoffrey) : comptées au prix du tableau des lignes (prices, celui des runes), pas au
     prix mesuré en mine classique (qui les sous-estime : on s'y bat peu). Ex. une ligne de rune Dégâts +9,2 % = 46 GS
     (avant 18). Ne change ni le dessin des pièces (designPrice) ni les runes. */
  gsFromPrices: ['damage', 'damagePct', 'attackSpeed', 'doubleAttack', 'crit', 'oneTap', 'piercing'],   // portée et recul : prix mesuré (Geoffrey, 28/10)
  /* TIER d'une pièce (25/10/2026, Geoffrey) : une ligne (rune, ou identification d'avant le 22/10) vaut un % de la valeur
     du TIER de la pièce, plus de sa propre valeur (worth, ancien). T1 : pierre, chitine, plans du Treasure T1 ; T2 : fer
     (plans pourtant dans le T1 : la matière compte), plans du Treasure T2 ; T3 : acier, plans du Treasure T3 (Plastron
     de l'équilibre compris). Lignes gardées en % : les pièces déjà runées suivent sans migration. Une pièce absente des
     listes garderait sa propre valeur (tests/rune.test.js vérifie qu'il n'y en a pas). */
  tiers: {
    1: { x:100, items:['Pioche en pierre','Épée en pierre','Casque en chitine','Plastron en chitine','Jambes en chitine',
                       'Bottes en chitine','Ceinture en peau de gobelin','Boussole en or'] },
    2: { x:250, items:['Pioche en fer','Épée en fer','Lance en fer','Casque en fer','Plastron en fer','Jambes en fer','Bottes en fer',
                       'Gants tactique','Gants d\'ouvrier','Cape de Naingui','Lampe à incandescence',   // lampe : plan du T2 depuis le 26/10 (tier le 27/10)
                       'Lanières en cuir du gobelin','Capuche sombre','Nuage magique','Ceinture du Géant'] },   // butin des mobs : valeur du fer
    /* 27/10/2026 (Geoffrey) : 500 x (avant 400), avec le buff de +100 x des pièces en acier */
    3: { x:500, items:['Pioche en acier','Épée en acier','Casque en acier','Plastron en acier','Jambes en acier',
                       'Bottes en acier','Plastron de l\'équilibre',
                       'Masse du Roi Gobelin','Cape royale du Gobelin'] },   // stuff du Roi Gobelin : tier 3 (Geoffrey, 27/10)
    /* tier 4 (27/10/2026, Geoffrey) : 650 x (avant 600, Couronne seule) ; mithril et pièces spéciales du Treasure T4 */
    4: { x:650, items:['Couronne du Roi Gobelin', 'Casque en mithril', 'Plastron en mithril', 'Jambes en mithril', 'Bottes en mithril',
                       'Lunettes Gucci', 'Doc Martins', 'Ceinture golémique', 'Gants de boucher'] },
    /* tier 4.5 (27/10/2026, Geoffrey) : 750 x, thorium, cobalt, Jambières titanesques */
    '4.5': { x:750, items:[...['thorium', 'cobalt'].flatMap(m => ['Casque', 'Plastron', 'Jambes', 'Bottes'].map(p => `${p} en ${m}`)),
                           'Jambières titanesques', 'Némésis du Golbute', 'Torse de Gollex', 'Jambières du Golbute', 'Âme du Golbute'] },   // Coffre du Golbute (30/10) : T4.5
  },
  /* pas d'arrondi de chaque stat (valeur d'une ligne, et stats d'une pièce améliorée) */
  steps: { mineSpeed:0.001, speed:0.01, climbSpeed:0.01, pods:1, oxygenMax:1, damage:0.1, attackSpeed:0.1, fortune:0.1,
           discoverMax:1, compassRows:1, mineSpeedPct:0.1, damagePct:0.1, crit:0.1, oneTap:0.1, piercing:0.1, looting:0.1,
           tenacity:0.1, knockRes:0.1, reach:0.01, knockback:0.01, doubleAttack:0.1 },
  levels: [
    { pct:3, chance:1.00, cost:{ 'Plume d\'ange':6, 'Cristal de pleine lune':3 } },   // 26/10/2026, Geoffrey : +1 à +9, bonus 3 % par rang, réussite −5 % par rang ; coût 3 cristaux / 6 plumes au +1, puis ×1,5 (+2, +3), ×1,33 (+4 à +6), ×1,25 (+7 à +9) sur la valeur exacte, arrondi au-dessus. Avant : +1 à +3, bonus 5 / 10 / 15 %, 20 / 30 / 50 plumes, 3 / 5 / 7 cristaux
    { pct:6, chance:0.95, cost:{ 'Plume d\'ange':9, 'Cristal de pleine lune':5 } },
    { pct:9, chance:0.90, cost:{ 'Plume d\'ange':14, 'Cristal de pleine lune':7 } },
    { pct:12, chance:0.85, cost:{ 'Plume d\'ange':18, 'Cristal de pleine lune':9 } },
    { pct:15, chance:0.80, cost:{ 'Plume d\'ange':24, 'Cristal de pleine lune':12 } },
    { pct:18, chance:0.75, cost:{ 'Plume d\'ange':32, 'Cristal de pleine lune':16 } },
    { pct:21, chance:0.70, cost:{ 'Plume d\'ange':40, 'Cristal de pleine lune':20 } },
    { pct:24, chance:0.65, cost:{ 'Plume d\'ange':50, 'Cristal de pleine lune':25 } },
    { pct:27, chance:0.60, cost:{ 'Plume d\'ange':63, 'Cristal de pleine lune':32 } },
  ],
  /* cases de stuff dont les pièces ne s'identifient, ne s'améliorent ni ne s'enchantent pas (27/10/2026, Geoffrey) : celles
     qui existent déjà sont remises à zéro (qualité, niveau et rune retirés) à la relecture (src/meta/piece.js) */
  plainSlots: ['boussole', 'torche'],
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
  'Vésicule de gaz': { cat:'material',  tex:'gas_vesicle', stack:true },   // butin du méphite (24/10), sans usage pour l'instant
  'Pierre glissante': { cat:'material', tex:'slippery_stone', stack:true },   // butin du golem (26/10), sans usage pour l'instant
  'Plume d\'ange':   { cat:'material',  tex:'angel_feather', stack:true },
  /* parchemins de sorts (SPELLS) : appris dans l'onglet Sorts (consommés) ; aucune source pour l'instant (24/10) */
  ...Object.fromEntries(SPELLS.list.filter(s => s.unlock.scroll).map(s => [s.unlock.scroll, { cat:'scroll', tex:'scroll', w:1, stack:true }])),
  ...GLYPH_ITEMS,                                                                       // glyphes (GLYPHS, 25/10)
  [DUCK.heart.item]: { cat:'material',  tex:DUCK.heart.tex, w:1, stack:true },             // laissé par le Gallianix (DUCK)              // ramassée dans la mine instantanée (INSTANT_MINE)
  ...TREASURE_ITEMS,                                                                    // trésors des tours (RUNE)
  ...GOBLIN_CHEST_ITEMS,
  ...GOLBUTE_CHEST_ITEMS,                                                               // coffres du Golbute (GOLBUTE, 30/10)                                                                // coffres du Roi Gobelin (GOBLIN_KING, 27/10)
  'Four en or BP':     { cat:'blueprint', tex:'blueprint', stack:true },                // coffre du Roi Gobelin
  'Clé d\'instance I BP': { cat:'blueprint', tex:'blueprint', stack:true },             // ancien (28/10) : plus de source, la recette est de base ; un exemplaire gardé se recycle
  'Recette : Chitine': { cat:'blueprint', tex:'recipe_chitin', stack:true },            // débloque Peau de gobelin → Chitine au four
  'Pépite d\'argent':  { cat:'material',  tex:'nugget_silver', w:1, stack:true },       // récompense du bloc géant (GIANT.nugget, 27/10)
  'Cuir de minotaure': { cat:'material',  tex:'minotaur_leather', w:1, stack:true },    // butin du minotaure (DUNGEON.leather, 27/10)
  'Rotten flesh':      { cat:'material',  tex:'rotten_flesh', w:1, stack:true },        // butin du mur de chair (28/10)
  ...CHEST_ITEMS,                                                                       // ancien : coffres des tours (RUNE)
  [RUNE.item]:       { cat:'rune', tex:RUNE.tex, w:1, stack:false },                   // une rune = une pièce (qualité, lignes)
  [RUNE.fragment.item]: { cat:'rune', tex:RUNE.fragment.tex, w:1, stack:false, fragment:true },   // rune retirée : lignes ÷ 2
  [RUNE.dust.item]:  { cat:'material', tex:RUNE.dust.tex, w:1, stack:true },             // recyclage des runes (RUNE.dust)
  ...Object.fromEntries(Object.values(LOOT).flatMap(t => t.oneOf.flatMap(f =>
    f.items.map(i => [i.item, { cat:f.family, tex:i.tex || f.tex, stack:true }])))),
  'Clé d\'instance I': { cat:'key', tex:'key_instance_1', w:1, stack:true },            // Treasure T3 ; ouvre l'Instance I (INSTANCE)
  'Clé d\'instance II': { cat:'key', tex:'key_instance_2', w:1, stack:true },           // Treasure T4 (10 %) ; ouvre l'Instance II, le Golbute (30/10)
  'Orbe': { cat:'material', tex:'orb', w:1, stack:true },   // 30/10 (Geoffrey) : se crafte de base ; 31/10 : sert à la Clé d'instance I
  'Cristal de pleine lune': { cat:'material', tex:'moon_crystal', w:1, stack:true },   // butin du minotaure (DUNGEON.loot) et du Treasure T3 ; après LOOT pour garder son poids
  ...Object.fromEntries(Object.entries(STUFF.items).map(([n, d]) => [n, { cat:'stuff', slot:d.slot, tex:d.tex, stats:d.stats ?? {}, set:d.set ?? {}, w:0, stack:false }])),
};

/* grille d'inventaire : colonnes fixes (un objet garde sa place à l'écran), au moins minSlots affichés ;
   capacité illimitée pour l'instant (une ligne s'ajoute quand la grille est pleine) */
/* maxUniqueAdd : nombre max de pièces non empilables ajoutées en une fois (chacune prend un slot) : protège d'une
   quantité aberrante (bug ou triche) qui créerait des millions de slots */
/* sortGroups (bouton « Trier », 25/10/2026, Geoffrey) : ordre des types, chacun une liste de familles (ITEMS[].cat) ;
   dans un type, du plus rare au plus commun (RARITY, la rareté du catalogue, PAS la qualité d'identification R1-R7),
   puis l'ordre du catalogue. Les familles absentes d'ici viennent après, dans l'ordre du catalogue. */
export const INVENTORY = { cols:8, minSlots:48, maxUniqueAdd:1000,
  sortGroups: [
    { label:'Blocs',     cats:['bloc', 'residu'] },
    { label:'Minerais',  cats:['combustible', 'ore'] },
    { label:'Matériaux', cats:['ingot', 'material', 'mob', 'gem'] },
    { label:'Stuff',     cats:['stuff', 'rune'] },
  ],
  /* onglets (29/10/2026, Geoffrey) : un filtre de la grille. Icône = la texture d'un objet (icon) ou une icône pixel (px) ;
     le nom n'apparaît qu'en bulle. Un objet va dans le premier onglet qui le cite (items), sinon dans celui de sa
     catégorie (cats), sinon dans le dernier (divers). */
  tabs: [
    { id:'all',   px:'bag',               name:'Tout' },
    { id:'bloc',  icon:'Pierre',          name:'Blocs',            cats:['bloc'], items:['Stonebrick angélique', 'Stonebrick démoniaque'] },
    { id:'ore',   icon:'Fer',             name:'Minerais',         cats:['ore', 'combustible', 'residu'] },
    { id:'stuff', icon:'Casque en fer',   name:'Stuff',            cats:['stuff'] },
    { id:'mob',   icon:'Peau de gobelin', name:'Butin des mobs',   cats:['mob'],
      items:['Tissu sombre', 'Vésicule de gaz', 'Pierre glissante', 'Cuir de minotaure', 'Rotten flesh', 'Fragment de cœur'] },
    { id:'mat',   icon:'Lingot de fer',   name:'Matériaux (gemmes, lingots, alliages, plumes, cristaux, argent)', cats:['ingot', 'gem', 'material'] },
    { id:'rune',  icon:'Rune',            name:'Runes',            cats:['rune'], items:['Poudre de rêve'] },
    { id:'misc',  icon:'Treasure T1',     name:'Divers (coffres, clés, plans, parchemins, glyphes…)', cats:['treasure', 'key', 'blueprint', 'scroll', 'glyph', 'furnace'] },
  ] };

/* Recycler (inventaire, 25/10/2026, Geoffrey) : une pièce de stuff fabriquée (avec une recette du craft, src/recipes.js)
   est détruite et rend share de chaque ingrédient de sa recette, arrondi vers le bas (1 ingrédient → 0). Amélioration
   et rune sont perdues. Interdit pour une pièce portée ou enregistrée dans un set. Valeur provisoire.
   Une pièce sans recette qui a un `recycle` (STUFF.items, butin des mobs) rend ces quantités fixes à la place. */
export const RECYCLE = { share:0.6 };
/* tableau de bord de l'équipe (server/admin/dashboard.js, scripts/dashboard.js) : l'ilvl d'un joueur = somme des valeurs
   en x (itemValue) des pièces portées au lancement ; les courbes « par ilvl » regroupent les sessions par tranches de
   ilvlStep x. Mine classique seulement, sans les sessions dev ni les joueurs partis avant la fin. */
/* forecastDepth : la courbe « profondeur par ilvl du groupe » est prolongée par une droite de tendance (moindres carrés
   sur les sessions) jusqu'à cette profondeur ; il faut au moins forecastMin sessions et deux ilvl différents */
export const DASHBOARD = { ilvlStep:250, forecastDepth:350, forecastMin:3 };

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
  /* 28/10 (Geoffrey) : fer 27, or 20, charbon 40, + mithril 3, cobalt 1,5, thorium 1,5 (avant : charbon 20, fer 40, or 33 ;
     23/10 : or 39 → 33, + graphite 5, + diamant 1). Le dernier de la liste absorbe les arrondis (1,5 % de 2 500 = 37,5 → 38) :
     charbon 999. */
  comp: { iron:27, gold:20, graphite:5, diamond:1, mithril:3, cobalt:1.5, thorium:1.5, coal:40 }, feather: 1,
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
  /* descente (24/10, Geoffrey) : miner le bloc sous ses pieds coûte downWeight × le temps d'un pas. Sans ça, descendre
     était gratuit (il tombe tout seul) alors qu'aller sur le côté demande un pas : les caps en diagonale vers le bas
     devenaient des puits et les mineurs fonçaient au fond (3 mineurs, 20 seeds : 26/60 au fond, 42 % des blocs dans la
     moitié basse ; avec 1 : 2/60 et 25 %). À 1, bas et côté se valent et le cap décide ; au-dessus de 1, il évite de
     descendre (1,15 : galeries nettement horizontales, mais ≈ 15 % de plumes en moins). */
  downWeight: 1,
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
  /* Instances (27/10/2026, INSTANCE) : un groupe de 1 à 3, une clé chacun ; le lobby les montre sous un seul bouton
     « Instances » (src/ui/lobby.js) */
  { id:'instance_1', label:'Instance I', icon:'🗝', ready:true, instance:true },
  { id:'instance_2', label:'Instance II', icon:'🗝', ready:true, instance:true },   // Golbute (30/10/2026), même bouton « Instances »
  /* Bloc géant (26/10/2026) : on y entre seul depuis son panneau (GIANT), jamais par un lancement de groupe */
  { id:'giant', label:'Bloc géant', icon:'🌈', ready:true, giant:true },
  /* Prison (29/10/2026, PRISON) : solo, sans fin ; lancée et arrêtée par ses propres routes (/api/game/prison/…) */
  { id:'prison', label:'Prison', icon:'⛓', ready:true, prison:true, solo:true },
  /* tours du Jugement : proposées seulement quand elles sont ouvertes (JUDGMENT, TOWER) */
  { id:'tower_angel', label:'Tour de l\'Ange', icon:'😇', ready:true, tower:'angel' },
  { id:'tower_demon', label:'Tour du Démon',   icon:'😈', ready:true, tower:'demon' },
];

/* Wiki (27/10/2026, Geoffrey) : objets dont les effets restent cachés dans le wiki tant qu'aucun joueur ne les a
   trouvés en jeu (ouverture d'un coffre ou d'un trésor, fin de session ; un don d'administration ne compte pas). Le
   serveur retient le premier (server/game/service.js, ns « discovered ») ; le wiki le lui demande (GET /api/wiki). */
export const WIKI = { secret: ['Couronne du Roi Gobelin', 'Masse du Roi Gobelin', 'Cape royale du Gobelin',
  /* Treasure T4 (27/10/2026, Geoffrey) : révélés dès que leur BP sort pour la première fois (le stuff en mithril reste
     visible) ; cette première découverte est annoncée sur Discord avec les stats de la pièce */
  ...['thorium', 'cobalt'].flatMap(m => ['Casque', 'Plastron', 'Jambes', 'Bottes'].map(p => `${p} en ${m}`)),
  'Lunettes Gucci', 'Doc Martins', 'Ceinture golémique', 'Gants de boucher', 'Jambières titanesques'] };

/* Instances (concept de Geoffrey, 27/10/2026 ; spec docs/superpowers/specs/2026-10-27-instances-design.md). Valeurs
   provisoires. Lobby, « Où miner » → Instances : list (les instances pas prêtes sont grisées). Un groupe de 1 à 3, une
   clé par joueur (key), vérifiée au lancement et prise seulement à la victoire (30/10/2026, Geoffrey ; ancien : consommée au lancement, rendue en cas d'échec). Instance I (le roi gobelin) :
   - salle w × h cases d'air (sol, murs et plafond indestructibles), tout éclairé, pas d'oxygène ni de pods ; rebords
     (ledgeW cases de large, 1 de haut, collés aux murs) tous les ledgeEvery cases de hauteur, ledges par côté ; un
     spawner par rebord, collé au mur ; plateforme du roi : platform.w de large, à platform.height cases du sol ; départ
     au sol, au centre. Échelles illimitées ; on saute d'au plus maxFall cases (pas d'étourdissement en tombant).
   - spawner : un gobelin dès le début puis toutes les every s ; hp « coups de pioche » (chaque seconde de minage
     enlève la vitesse de minage effective, comme au Bloc géant) ; la Dynamite en enlève dynamite ; le mineur doit être
     sur la case à côté (le rebord, contre le spawner).
   - gobelin : hp PV, un coup toutes les hitEvery s ; le premier coup tacle ; chaque coup a knockChance de repousser de
     knock case(s), toujours vers le centre de la salle. Cibles : la provocation, puis un mineur qui casse un spawner à
     focusRange cases ou moins, puis le plus proche. Une case toutes les step s ; il tombe et monte aux échelles.
   - roi : w × h, s'éveille quand les spawners sont cassés (il descend en dropTime s), hp PV, knockRes %, vitesse de
     marche speedMul × un mineur de base ; un coup toutes les hitEvery s qui repousse de push case(s) vers le centre ;
     tous les boostEvery coups (tous ses coups) : projection de boostHigh cases de haut et boostLong de long, vers le
     centre. À chaque seuil cageAt de ses PV (tous les 20 % manquants) : chaque mineur est téléporté sur un rebord différent et enfermé (blocs de dureté
     cageHard dans un rayon cageRadius, sur le rebord et au-dessus) ; il attend qu'un mineur sorte de sa cage (au plus
     cageMaxWait s). Pendant ce temps et jusqu'à ce qu'un mineur pose le pied au sol, il régénère regenPct de ses PV max
     toutes les regenEvery s. Sous rageBelow : push ragePush, vitesse × rageSpeed. Mêmes cibles que les gobelins.
   - fin : roi mort (réussite) ou duration s de jeu (échec). Pas de récompense, pas d'XP, pas de butin pour l'instant. */
export const INSTANCE = {
  list: [
    { id:'instance_1', label:'Instance I',   sub:'Le roi gobelin', key:'Clé d\'instance I', keyFrom:'Treasure T3 (20 %)', ready:true, chest:'goblin' },   // chest : roi vaincu → un Coffre du Roi Gobelin par joueur (27/10)
    /* Instance II (30/10/2026, Geoffrey) : le Golbute, golem de 5 × 5 (INSTANCE.golbute, src/sim/instance/golbute.js) */
    { id:'instance_2', label:'Instance II',  sub:'Le Golbute', key:'Clé d\'instance II', keyFrom:'Treasure T4 (10 %)', ready:true, chest:'golbute' },
    { id:'instance_3', label:'Instance III', ready:false },
  ],
  duration: 600,                    // 10 min de jeu (27/10, Geoffrey ; avant 30 min)
  /* 27/10 (Geoffrey) : 5 cases d'air entre deux rebords (un tous les 6 ; avant 5), 3 rebords par côté (6 spawners ;
     4 essayés puis retirés), salle de 28 de large (avant 20) et 24 de haut (avant 20), plateforme du roi à 21 du sol */
  w: 28, h: 24, ledgeW: 6, ledgeEvery: 6, ledges: 3, maxFall: 7,
  platform: { w: 4, height: 21 },
  /* caméra (27/10/2026, Geoffrey) : rapprochée, cols × rows cases, elle suit ton mineur (comme la tour du Jugement,
     TOWER.view) ; avant : toute la salle à l'écran */
  view: { cols: 14, rows: 11 },
  spawner: { hp: 125, every: 20, dynamite: 6, focusRange: 10 },   // 125 coups (27/10, Geoffrey ; essayés : 50, 75, 200) ; un gobelin toutes les 20 s (27/10, Geoffrey ; avant 30)
  goblin: { hp: 200, hitEvery: 1.75,   // 200 PV, un coup toutes les 1,75 s (29/10, Geoffrey ; avant 150 PV et 2 s, puis 175 PV le même jour ; le 27/10 : 125 PV)
            knock: 0.5, knockChance: 1, step: 0.45 },   // recul à chaque coup (27/10, Geoffrey ; avant 30 % : presque invisible) ; step : une case toutes les 0,45 s, vitesse × 2 (27/10, Geoffrey ; avant 0,9)
  boss: { name: 'Roi gobelin', w: 3, h: 3, hp: 3500, knockRes: 25,   // 3 500 PV (27/10, Geoffrey ; avant 3 000, puis 2 000)
          speedMul: 3, hitEvery: 1.5, push: 0.5,
          boostEvery: 10, boostHigh: [6, 7], boostLong: [6, 7], dropTime: 0.8,
          cageAt: [0.8, 0.6, 0.4, 0.2], cageRadius: 3,   // tous les 20 % de PV manquants (27/10, Geoffrey ; avant 75 / 50 / 25 %)
          cageHard: 10, cageMaxWait: 90,
          /* régénération (29/10/2026, Geoffrey) : dès un enfermement, regenPct de ses PV max toutes les regenEvery s, tant
             qu'aucun mineur n'a posé le pied au sol ; un seuil déjà franchi ne réenferme pas (s'il remonte au-dessus) */
          regenPct: 0.01, regenEvery: 2,
          rageBelow: 0.33, ragePush: 1, rageSpeed: 2.5 },
  /* niveaux (29/10/2026, Geoffrey ; comme TOWER.levels) : choisis au lancement dans le Lobby, même clé (une par joueur).
     Chaque niveau remplace les valeurs ci-dessus qu'il donne (spawner, goblin, boss) ; chest : multiplicateurs du Coffre
     du Roi Gobelin de ce niveau (res : quantités des ressources sûres, drop : chances des objets). Valeurs provisoires. */
  /* Instance II : le Golbute (30/10/2026, Geoffrey ; src/sim/instance/golbute.js). Arène vide w × h (sol plat), les
     mineurs partent à gauche (spawn : colonnes), le Golbute (boss.w × boss.h, résistance au recul 100 %) au sol, au milieu.
     - slam (autoattack) : toutes les every s (× 1 / (1 + rage.atkSpeed) une fois enragé), chaque mineur au sol à range
       cases de lui au plus est propulsé de high cases vers le haut et back en arrière, avec chance × (1 − recul %) ×
       (1 − ténacité %) ; la chute qui suit l'étourdit (comme une chute dans la mine : CFG.stunFall cases, CFG.stunTime s).
     - avalanche : toutes les every s (× (1 + rage.avalancheCd) enragé), sur TOUS les mineurs vivants ; la ténacité
       l'esquive. Touché : étourdi stun s + un stack « Sonné » (dazed s, réactualisé à chaque coup) ; à deathStacks stacks,
       il est mort (au sol, ne fait plus rien, pas de réanimation). Tous morts = échec.
     - split (Division) : toutes les every s, le boss disparaît et laisse count golems 1 × 1 (PV du golem de l'area
       area, MOBS ; coups toutes les hitEvery s qui repoussent de knock, sans ébranlement) ; il revient avec ses PV quand ils
       sont tous morts. Il ne frappe plus pendant ce temps (l'avalanche continue). Repoussée pendant un cristal.
     - crystal : à at × ses PV max, il se cristallise : insensible aux coups, il faut le miner (hp « coups » de minage,
       comme un spawner de l'Instance I ; Dynamite = dynamite coups) ; seule l'avalanche continue.
     - rage : après le cristal du dernier palier (33 %).
     Valeurs provisoires (équilibrage : scripts/simulate-golbute.js). */
  golbute: {
    w: 20, h: 20, spawn: [1, 2, 3],
    boss: { name: 'Golbute', w: 5, h: 5, hp: 10700, knockRes: 100 },   // 10 700 PV : 40 victoires sur 160 pour la compo de référence (outils en acier + 20 %) avec 25 % de ténacité (30/10, simulation ; avant, outils en fer + 20 % : 7 600)
    slam: { every: 2, range: 3, chance: 0.5, high: 3, back: 1 },
    avalanche: { every: 60, stun: 5, dazed: 90, deathStacks: 6 },
    split: { every: 180, count: 10, area: 8, hitEvery: 1.5, knock: 0.5, step: 1.8 },
    crystal: { at: [0.66, 0.33], hp: 720, dynamite: 20 },   // 720 coups : 45 % des 10 min à miner (cible 45 %)
    rage: { atkSpeed: 0.5, chance: 0.65, avalancheCd: -0.25 },
  },
  levels: {
    1: { chest: { res: 1, drop: 1 } },
    2: { spawner: { hp: 200, every: 15 },
         goblin: { hp: 350, knock: 0.65 },
         boss: { hp: 6000, knockRes: 50, hitEvery: 1.25, boostEvery: 8, rageBelow: 0.4, ragePush: 1.3, regenPct: 0.02 },   // ragePush : 0,65 × 2
         chest: { res: 1.5, drop: 1.5 } },
  },
};


/* Shrines (28/10/2026, Geoffrey ; src/meta/shrines.js, GAME_DESIGN §6 « Shrines ») : bâtiments activés dans le lobby de la
   mine classique, rattachés au COMPTE DU CHEF (ou du joueur seul). Chaque membre du groupe peut donner autant qu'il veut
   des ressources du prix ; les dons restent sur le shrine du chef jusqu'à ce que le prix soit atteint, puis le shrine est
   actif pour `sessions` mines classiques lancées par ce chef (décomptées au lancement, mode dev exclu). Pas de
   réactivation tant qu'il est actif. Tant qu'un chef a un shrine (actif ou en cours de paiement), ses lobbies gardent le
   même code. Actif : dessiné à la surface près du coffre (décor, traversable).
   effect.orePoints : points de composition pris sur le terrain (pierre, pierre dure, terre, au prorata ; pas le vide) et
   donnés aux minerais (charbon compris) au prorata de chacun, dans toutes les areas de la session. Valeurs provisoires. */
export const SHRINES = {
  list: {
    abundance: { name:'Shrine d\'abondance', desc:'5 % de minerais en plus', tex:'shrine_abundance', sessions:5,
                 price:{ 'Pépite d\'argent':10, 'Résidu angélique':20 }, effect:{ orePoints:5 } },

    /* stèles des tours (30/10/2026, Geoffrey) : comme un shrine (don de n'importe quel membre, rattachées au chef), mais pour
       les tours du camp `tower` lancées par ce chef : UNE charge (sessions : 1 ; ancien : 3, décomptées au lancement),
       consommée seulement à la victoire, gardée sinon ; le chef peut l'activer ou la désactiver. Effet (TOWER.stele) : à la mort du boss, le boss de l'autre camp s'écrase sur le toit (phase 2) ; victoire =
       trésor béni (luck : RUNE.luck). Elles ne touchent pas la mine classique. */
    exorcisme: { name:'Stèle d\'exorcisme', desc:'Tour du Démon : l\'Ange s\'écrase après le boss ; anneaux ×2 dans le trésor', tex:'brick_angel',
                 sessions:1, tower:'demon', price:{ 'Stonebrick angélique':240 }, effect:{ phase2:true, luck:'beni' } },
    pacte:     { name:'Stèle du pacte', desc:'Tour de l\'Ange : le Démon s\'écrase après le boss ; anneaux ×2 dans le trésor', tex:'brick_demon',
                 sessions:1, tower:'angel', price:{ 'Stonebrick démoniaque':240 }, effect:{ phase2:true, luck:'beni' } },
  },
  opMemory: 50,          // dernières demandes de don retenues (une demande renvoyée n'agit pas deux fois)
  drawX: [20, 19, 18],   // colonnes de dessin à la surface, à gauche du coffre (CHEST_X = 22), un shrine actif par colonne
};
/* Bloc géant (concept de Geoffrey, 26/10/2026 ; spec docs/superpowers/specs/2026-10-26-bloc-geant-design.md).
   Une session commune à tout le serveur, de minuit à minuit (timeZone). Chacun y entre seul, une fois toutes les
   cooldownMs (depuis sa dernière entrée), pour une visite de visit s : son mineur frappe un bloc indestructible.
   Carte : w × h cases d'air ; bloc block × block collé en bas à droite ; spawn en bas à gauche (spawnX), fontaine en
   fountainX ; on mine le bloc par la gauche seulement (colonne w - block - 1), les mineurs se superposent.
   Points : chaque seconde à miner rapporte la vitesse de minage effective (stuff, skills, anneaux, sorts).
   Recul : chaque coup (vitesse de minage = coups par seconde) a knock.chance de le repousser en arc de knock.min à
   knock.max cases vers la gauche (vol de knock.flight s) ; la ténacité l'ignore, la résistance au recul réduit la
   distance (arrondie, knock.min au moins). Oxygène : oxygenDrain par seconde (×2 de la mine) ; la fontaine recharge
   fountainRefill par seconde au mineur à fountainRange case(s) ou moins ; il y va quand il lui en reste juste assez
   pour l'aller (oxygenMargin s de marge). Pas de pods, pas d'XP, pas de butin.
   Dynamite : dynamitePoints point(s) de plus, sans rien casser ; Inspiration : comme en mine (tous les présents) ;
   Fast learner : le bloc géant est « appris » (+bonus à la vitesse de minage pour la visite). Dash, Illumination, Ulti
   shen : sans effet. Anneaux : pour tous les joueurs présents, une fois par anneau différent.
   Récompense : à la fin de la session, à chaque joueur venu au moins minVisits fois, selon le score collectif ; les paliers
   s'additionnent ; plus des pépites d'argent selon ses propres points (nugget). maxPlayers : mineurs en même temps dans
   la carte ; top : lignes du classement. poll : rafraîchissement du panneau (ms). */
export const GIANT = {
  timeZone: 'Europe/Paris',
  visit: 180, cooldownMs: 3 * 3600e3, maxPlayers: 30,
  w: 15, h: 7, block: 5, spawnX: 0, fountainX: 1, fountainRange: 1,   // 15 de large (26/10, Geoffrey ; avant 10) : plus de chemin jusqu'au bloc
  knock: { chance: 0.10, min: 1, max: 3, flight: 0.4 },
  oxygenDrain: 2, fountainRefill: 30, oxygenMargin: 3,
  oxygenPerHit: 1,   // chaque coup sur le bloc coûte aussi cet oxygène (26/10/2026, Geoffrey)
  dynamitePoints: 1,
  tiers: [
    /* paliers 26/10/2026, Geoffrey (avant 1 000 / 2 500 / 5 000 / 7 500 / 10 000) */
    { min: 1000,  items: { 'Treasure T1': 1 } },
    { min: 5000,  items: { 'Treasure T1': 1, 'Blueprint parts': 15 } },
    { min: 10000, items: { 'Treasure T2': 1 } },
    { min: 15000, items: { 'Treasure T2': 1, 'Blueprint parts': 30 } },
    { min: 20000, items: { 'Treasure T3': 1 } },
  ],
  /* récompense seulement pour un joueur venu au moins minVisits fois dans la journée (27/10/2026, Geoffrey ; avant : une
     fois). Compté pour les journées à partir de minVisitsFrom : celles déjà finies gardent l'ancienne règle. */
  minVisits: 2, minVisitsFrom: '2026-10-27',
  /* en plus des paliers, chaque joueur qui a droit à la récompense reçoit 1 pépite d'argent par tranche de `per` points
     faits ce jour-là (ses points à lui, arrondi vers le bas) ; elle se fond au four (27/10/2026, Geoffrey) */
  nugget: { item:'Pépite d\'argent', per:100 },
  top: 10, poll: 3000, viewPoll: 500,
};
/* onglet Social : le navigateur redemande la liste d'amis et les notifications toutes les `poll` ms (onglet visible),
   `hiddenPoll` ms quand l'onglet est caché (ça reste un signe de vie : l'ami apparaît en ligne) */
export const SOCIAL = { poll:4000, hiddenPoll:20000, onlinePoll:5000 };   // onlinePoll : liste Online, onglet ouvert seulement
/* Le Carreau (29/10/2026, Jules ; src/shared/town.js, src/render/town.js, src/ui/town.js) : la ville du spawn, en
   surface de la mine, vue de côté. Hors session, elle remplace le mur du fond derrière les onglets ; ton mineur marche
   jusqu'au bâtiment de l'onglet ouvert, les autres joueurs en ligne qui ne sont pas en session sont devant le leur.
   Onglet Session sans session : la ville en plein écran, sans les panneaux, et on s'y promène (flèches, clic).
   buildings : de gauche à droite, un par onglet (tab) ; la Taverne à côté de la place (29/10 soir, demande de Jules :
   l'un des premiers bâtiments qu'on voit ; ancien : au bout gauche, l'Entrepôt à sa place) ; w × h : place du bâtiment en cases (largeur, hauteur au plus) ;
   sprite : sa texture, dessinée d'un bloc, posée sur le sol et centrée (scripts/gen_town.py, direction « Crépuscule de
   forge » inspirée de Darkest Dungeon, choisie par Jules le 29/10 ; ancien : maisons en tuiles mur + toit + enseigne) ;
   glows : halos de lumière [x, y, rayon, 'magic' pour le vert] en pixels du sprite ; smoke : [x, y] haut de la cheminée
   (fumée qui monte) ; kind : 'house', 'place' (Lobby : feu de camp, statue, bannières, sans sprite), 'headframe'
   (chevalement au-dessus du puits : l'onglet Session). gap : cases entre deux bâtiments ; margin : avant le premier et
   après le dernier. rows : hauteur de la scène en cases ; ground : ligne de l'herbe (les mineurs marchent dessus).
   walk : vitesse de marche (cases/s) ; rush : un trajet long se fait en au plus rush secondes (vitesse augmentée) ;
   spread : écart des joueurs devant une même porte (± cases, tiré de leur ID) ; dim : luminosité derrière les onglets ;
   poll / walkPoll / hiddenPoll : le navigateur donne sa place au serveur (ms ; en promenade, plus souvent) ;
   bubbleMs : un message du chat global reste en bulle au-dessus de son auteur ce temps ; reach : on entre dans un
   bâtiment à moins de reach cases de sa porte. rows 16 / ground 12 depuis le 29/10 après-midi (ancien 18 / 13 : un peu
   plus zoomé, demande de Jules).
   Ajouts du 29/10 après-midi : group : les membres d'un même groupe se tiennent ensemble sur la place, à ± group cases
   du point du groupe ; emotes : émotes de la promenade (id, icône, nom), visibles emoteMs ms, une toutes les emoteGapMs
   ms au plus (le serveur revérifie ; « ⛏️ On mine ? » remplacée le 30/10 par le bouton de recherche de groupe, src/ui/town.js) ; place : décor de la Place du Carreau (colonnes depuis son bord gauche : statue du
   n°1 du classement GS, bannières des jauges Ange / Démon, feu de camp au milieu) ; statueBoard : classement de la statue. */
export const TOWN = {
  rows: 16, ground: 12, gap: 3, margin: 7,
  walk: 6, rush: 4, spread: 2.2, dim: 0.55, group: 0.7,
  poll: 2500, walkPoll: 1000, hiddenPoll: 15000, bubbleMs: 7000, bubbleMax: 60, reach: 2.5,
  emoteMs: 3500, emoteGapMs: 1500,
  portraitCols: 12,   // téléphone en hauteur : cases visibles en largeur (la ville se cale sur la largeur, 29/10)
  chatMin: 220, chatMax: 360,   // chat global en promenade : largeur (px) ; moins de chatMin à côté de la barre d'action : au-dessus d'elle
  emotes: [
    { id:'wave',  icon:'👋', name:'Salut' },
    { id:'gg',    icon:'🎉', name:'GG' },
    { id:'laugh', icon:'😂', name:'Mdr' },
    { id:'heart', icon:'❤️', name:'Merci' },
    { id:'afk',   icon:'💤', name:'AFK' },
  ],
  place: { statue: 1, angel: 3, demon: 7 },
  statueBoard: 'gs',
  /* ciel de crépuscule (dégradé de haut en bas), falaises au loin (la plus lointaine d'abord), brume au ras du sol, sol
     assombri (luminosité des pavés et de la terre) ; « plus sombre et en dégradé » : demande de Jules, 29/10 */
  sky: ['#16070a', '#3e140f', '#7a2e18', '#b45a2c'], far: ['#4a1c14', '#2a0e0a'], fog: 'rgba(255,130,70,.2)', groundDim: 0.5,
  /* bords de la ville (29/10 soir, retours de Jules : « les bords de la map sont vides », puis la porte de palissade
     « pas ouf ») : falaise à gauche, terril qui couve à droite (ancien : palissade adossée à la roche), dessinés dans les
     marges (margin cases) ; on ne marche pas au-delà (src/shared/town.js, clampX) */
  edges: { left: 'town_cliff', right: 'town_slagheap' },
  buildings: [
    { tab:'inventaire',   name:'Entrepôt',             kind:'house', w:7, h:7,  sprite:'town_warehouse', glows:[[56, 34, 16], [18, 66, 10], [94, 66, 10]] },
    { tab:'historique',   name:'Archives',             kind:'house', w:5, h:7,  sprite:'town_archives', glows:[[19, 72, 14], [61, 72, 14], [40, 24, 10]] },
    { tab:'recherche',    name:'Bibliothèque',         kind:'house', w:6, h:9,  sprite:'town_library',
      glows:[[37, 84, 26], [13, 114, 12], [61, 114, 12], [80, 58, 12]] },
    { tab:'skills',       name:'Salle d\'entraînement', kind:'house', w:6, h:7,  sprite:'town_training',
      glows:[[26, 65, 12], [70, 65, 12], [27, 86, 14], [67, 86, 14]] },
    { tab:'sorts',        name:'Tour du mage',         kind:'house', w:4, h:11, sprite:'town_mage_tower',
      glows:[[33, 94, 18, 'magic'], [31, 122, 18, 'magic']] },
    { tab:'stuff',        name:'Armurerie',            kind:'house', w:6, h:6,  sprite:'town_armory', smoke:[77, 0], glows:[[65, 86, 34]] },
    { tab:'social',       name:'Taverne',              kind:'house', w:7, h:8,  sprite:'town_tavern',  smoke:[89, 0],
      glows:[[20, 57, 14], [57, 55, 14], [92, 55, 14], [86, 103, 16], [28, 103, 16]] },
    { tab:'lobby',        name:'Place du Carreau',     kind:'place', w:11, h:3 },
    { tab:'session',      name:'Chevalement',          kind:'headframe', w:5, h:7, sprite:'town_headframe', glows:[[59, 64, 20]] },
    { tab:'four',         name:'Fonderie',             kind:'house', w:6, h:9,  sprite:'town_foundry', smoke:[75, 0],
      glows:[[42, 128, 44], [12, 112, 12], [76, 112, 12]] },
    { tab:'concasseur',   name:'Concasseur',           kind:'house', w:5, h:7,  sprite:'town_crusher', smoke:[46, 0], glows:[[20, 75, 14]] },
    { tab:'craft',        name:'Atelier',              kind:'house', w:6, h:7,  sprite:'town_workshop', glows:[[65, 58, 16]] },
    { tab:'amelioration', name:'Joaillier',            kind:'house', w:5, h:8,  sprite:'town_jeweler', glows:[[40, 25, 14, 'magic'], [31, 96, 24]] },
  ],
};
/* Pop-ups (28/10/2026, Jules) : avant, elles restaient tant qu'on n'avait pas cliqué. popupMs : une pop-up en haut à
   gauche (invitation, demande d'ami, groupe trouvé) se ferme seule au bout de ce temps (ms) ; l'invitation et la demande
   restent dans le Lobby et l'onglet Social. noticeMs : un rappel de mine instantanée sans bouton se ferme au bout de ce
   temps ; le dernier (Rejoindre / Décliner) se ferme à l'ouverture de la mine. */
export const NOTIFY = { popupMs:20_000, noticeMs:12_000 };
/* Guide « Premiers pas » des nouveaux joueurs (src/ui/guide.js, 28/10/2026, Jules) : les objets que visent ses étapes
   (première pioche à crafter, lingot à fondre), et le délai entre deux relectures de l'état du joueur */
export const GUIDE = { pickaxe:'Pioche en pierre', ingot:'Lingot de fer', ore:'Fer', refreshMs:1500 };
/* Classements (onglet Social → Classements, 27/10/2026, Geoffrey ; src/meta/leaderboard.js) : top `size` joueurs + sa
   propre place ; le navigateur redemande le classement affiché toutes les `refresh` ms (sous-onglet ouvert seulement), le
   serveur recalcule au plus toutes les `cacheMs` ms. teamMax : coéquipiers gardés dans un record de tour.
   hidden : pseudos jamais classés (comptes de l'équipe pour tester, ex. « admin », 27/10). */
/* comptes de l'équipe qui voient les outils d'équilibrage dans le jeu (30/10/2026 : rendement de la prison, Mon compte),
   par pseudo ; le serveur refuse ces données à tout autre compte */
export const ADMIN_VIEW = { names:['admin'] };
export const LEADERBOARD = { size:50, refresh:30_000, cacheMs:15_000, teamMax:3, hidden:['admin'] };

/* Énergie du compte (29/10/2026) : lancer une mine classique coûte un entier tiré dans cost.min..cost.max (refus sous
   cost.min) ; la prison la recharge de prisonPerHour par heure de jeu. max : plafond · start : énergie d'un nouveau
   compte · memory : dernières clés d'opération mémorisées (idempotence). */
/* idlePerHour (30/10/2026, Geoffrey) : au repos (ni session en cours, ni prison), le compte regagne idlePerHour d'énergie
   par heure de JEU (× GAME.speed par heure réelle), plafonnée à max ; calculée par le serveur à la lecture */
export const ENERGY = { max: 100, start: 0, cost: { min: 6, max: 12 }, prisonPerHour: 8, idlePerHour: 3,   // prisonPerHour : 8 le 30/10 à 18 h (Geoffrey ; avant 4)
  memory: 200 };

/* Prison (29/10/2026, spec docs/superpowers/specs/2026-10-29-prison-energie-design.md ; src/sim/prison.js) : mode solo,
   une seule area (AREA_H lignes) au contenu de l'area max débloquée du joueur, width colonnes centrées sur le coffre
   entre deux rangées de barreaux incassables (bloc `bars`).
   oreMul : part de minerais de la composition (× oreMul, pris sur le terrain ; 0,24 depuis le 30/10 : 51 % sur le vrai profil de canoul, 200 runs, après les correctifs du golem au bord du puits et de l'arrondi des minerais rares ; avant 0,30 (29/10 au soir), 0,52) ·
   resetAt : part des minerais du run à miner avant la remontée de fin de run · runMax : durée max d'un run (s de jeu) ·
   returnMax : temps laissé à la remontée de fin de run (s de jeu) · treasureMul : chance d'un treasure ·
   rareMul : chances de butin rare (glyphes, butin des mobs, shiny, donjon) · dungeonWinchGap : écart minimal du donjon à
   la colonne du treuil en prison (DUNGEON.winchGap ne laisse pas de place dans 25 colonnes) ·
   offlineMax / batchMs / presentFor / seenWriteMs : temps réels (ms), serveur : plafond sans visite, écart entre deux
   paquets du joueur absent, « présent » si sa dernière demande date de moins de presentFor, écriture de lastSeenAt en
   base au plus toutes les seenWriteMs · payoutRetries : versements d'un run relancés par le serveur après un échec ·
   batchConcurrency : paquets d'absents calculés en même temps (les autres attendent le passage suivant, comme une
   seule session dépassée à la fois) · crashMax : plantages du moteur sur un même run avant que le serveur arrête la
   prison (rien n'est versé sans bilan) · uiRetry : premier délai (ms) avant de redemander la prison après une erreur,
   doublé à chaque erreur jusqu'à uiPoll ·
   salt : seed d'un run · uiPoll : le jeu ouvert redemande sa prison au moins toutes les uiPoll ms (navigateur, quand elle
   n'est pas à l'écran ; moins que presentFor, pour que le joueur reste « présent » et que sa prison tourne en direct). presentFor > 60 s (31/10/2026) : Chrome ne réveille
   un onglet caché depuis 5 min qu'une fois par minute ; à 30 s, le run était fermé et rejoué depuis son début à chaque réveil. */
/* spawnDelayMul (29/10/2026, Geoffrey) : l'attente entre deux tirages d'apparition de mobs est × 3 en prison : le mineur
   est seul, il subit le rythme d'un mineur d'une mine à 3 (où les tirages se partagent entre les 3) */
/* Profil des 10 dernières mines (29/10/2026, Geoffrey ; src/shared/prison-profile.js) : au lancement, la prison lit les
   profileSessions dernières mines classiques terminées du joueur (historique) : area = area moyenne atteinte (arrondie ;
   aucune mine, ou moyenne plus basse : fallbackArea, 2 depuis le 30/10, Geoffrey, avant 1 : départ d'un nouveau joueur, il y a du fer) ; minerais : leur répartition dans sa part du butin (la part totale de minerais reste celle
   de l'area × oreMul) ; treasures : tier tiré selon la répartition des Treasure TX reçus (aucun : celui de l'area) ; mobs :
   types tirés selon ses kills par type (enregistrés depuis le 29/10 ; aucun : la table de l'area). Figé pour toute la
   prison. trapMul : chance des pièges · kholeMul : chance du k hole (avant : pas de k hole en prison). */
/* stunReset (30/10/2026, Geoffrey) : le mineur étourdi stunReset s de suite (en cumulant les étourdissements qui
   s'enchaînent, à moins de stunGap s l'un de l'autre) → le run est fini tout de suite (coffre versé, sac perdu) et une
   carte neuve commence, au lieu d'attendre runMax. Valeurs provisoires. */
export const PRISON = { stunReset: 60, stunGap: 5, width: 25, oreMul: 0.27, resetAt: 0.8, runMax: 3 * 3600, returnMax: 600, treasureMul: 0.5, rareMul: 0.5, spawnDelayMul: 2.73,   /* 30/10 : 3 → 2,73 = +10 % de mobs */
  profileSessions: 10, fallbackArea: 2, trapMul: 0.5, kholeMul: 0.5,
  dungeonWinchGap: 3, offlineMax: 24 * 3600e3, batchMs: 10 * 60e3, presentFor: 90e3, seenWriteMs: 60e3, payoutRetries: 5,
  batchConcurrency: 1, crashMax: 5, uiRetry: 1000, bars: 24, salt: 0x9a150e, uiPoll: 15e3,
  fracSalt: 0x5f7a11,   // arrondi au hasard du nombre de cases de minerai d'une carte de prison (30/10/2026, src/sim/world.js fillComp)
  /* 31/10/2026 (Geoffrey) : part maximale d'un minerai dans la répartition des minerais du profil ; le surplus va aux minerais sans plafond */
  oreCap: { cobalt: 0.004, thorium: 0.004 } };

/* Chat de session (22/10/2026) : les joueurs d'une session (encore là) s'écrivent pendant la partie, dans l'onglet
   Session. Gardé en mémoire du serveur seulement (rien en base), effacé à la fin de la session.
   maxLen : caractères par message · keep : derniers messages gardés par session · gapMs : délai minimal entre deux
   messages d'un joueur · poll : rafraîchissement dans le navigateur (ms) · ttlMs : un salon sans message depuis ce
   temps est oublié (filet de sécurité, la session dure 1 h).
   Chat global (28/10/2026, Jules) : un seul salon pour tous les joueurs (invités compris), carte du Lobby, mêmes
   maxLen et keep, gardé en base (survit aux redémarrages). globalGapMs : délai minimal entre deux messages d'un joueur
   (plus long : tout le monde le lit). Relu seulement quand l'onglet Lobby est ouvert. */
/* maxAgeMs (30/10/2026, Geoffrey) : un message de 18 h ou plus disparaît (serveur et écran), en plus de la limite keep */
export const CHAT = { maxLen:200, keep:50, gapMs:1000, poll:3000, ttlMs:3*3600e3, globalGapMs:3000, maxAgeMs:18*3600e3 };

/* Modération du chat (30/10/2026, Geoffrey ; server/moderation/) : un mot interdit (server/moderation/words.js) est
   remplacé par des astérisques et vaut un avertissement à son auteur, avec un motif. warnings avertissements (comptés
   depuis le dernier ban) → ban de banMs : plus aucune action de jeu (seulement lire, et se déconnecter), sa prison
   s'arrête. Mots coupés sur plusieurs messages : les joinMessages derniers messages du salon de moins de joinWindowMs
   comptent avec le nouveau (« ni » puis « gger », même d'un autre joueur : c'est celui qui complète qui est averti).
   keep : avertissements et bans gardés par joueur (historique pour la commande scripts/moderation.js). */
export const MODERATION = { warnings: 3, banMs: 24 * 3600e3, joinMessages: 3, joinWindowMs: 60e3, keep: 50 };

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
  boss: { type:'minotaure', name:'Minotaure', tex:'minotaur', hp:2000 },   // 2 000 PV (30/10/2026, Jules : un « mob ++ », pas un boss ; preset acier à 3 ≈ 22 s, barbare seul ≈ 1 min 13 ; avant 1 000 : 11 s à 3)
  loot: { item:'Cristal de pleine lune', min:1, max:3, tex:'moon_crystal' },
  leather: { item:'Cuir de minotaure', min:1, max:3, tex:'minotaur_leather' },   // en plus des cristaux, même partage (27/10/2026, Geoffrey)
  scaredTime: 15,
  salt: 0x0d06e0,
};

/* ---- Minotaure : Charge et Rage (30/10/2026, Jules ; src/sim/minotaur.js) — valeurs provisoires ----
   Charge : dès qu'il a une proie, toutes les every s (la première après first s), il gratte le sol windup s (immobile,
   il ne frappe pas ; un étourdissement, ex. Dash du barbare, coupe la charge), puis fonce tout droit sur sa ligne vers sa
   proie, speed cases/s, maxRun cases au plus. Le premier mineur qu'il touche est projeté de knock cases (sa résistance au
   recul compte) et étourdi stun s (la ténacité l'ignore) ; la charge s'arrête là. S'il percute un obstacle sans avoir
   touché personne, c'est lui qui est sonné missStun s et prend missVuln de dégâts en plus (+50 %) pendant ce temps.
   Rage : sous below de ses PV, il frappe toutes les hitEvery s et repousse de knock (au lieu de MOBS.hitEvery et
   MOBS.knock.minotaure) ; sa charge revient toutes les chargeEvery s.
   variants : le minotaure du donjon a les deux ; dans l'Arène du k hole, le brun charge et le noir enrage (plus tôt,
   plus fort) ; rage d'une variante = valeurs qui remplacent celles de rage. */
export const MINOTAUR = {
  charge: { every: 8, first: 4, windup: 1.5, speed: 12, maxRun: 12, knock: 3, stun: 2, missStun: 3, missVuln: 0.5 },
  rage: { below: 0.33, hitEvery: 0.5, knock: 0.5, chargeEvery: 5 },
  /* 30/10/2026 (Geoffrey : mesurer au preset acier) : charge toutes les 8 s, la première après 4 s, 5 s en rage (avant 12 / 6 / 8) :
     à 3 en preset acier, 5 charges par combat au lieu de 2 */
  variants: {
    donjon: { name: 'Minotaure',      tex: 'minotaur',       charge: true,  rage: {} },
    brun:   { name: 'Minotaure brun', tex: 'minotaur',       charge: true,  rage: null },
    noir:   { name: 'Minotaure noir', tex: 'minotaur_black', charge: false, rage: { below: 0.5, hitEvery: 0.4, knock: 0.75 } },
  },
};

/* ---- Butin rare des mobs (26/10/2026, Geoffrey ; src/sim/actions.js killMob) ----
   Quand un mob de ce type meurt, chance qu'il lâche une pièce de stuff (STUFF.items), dans le sac du mineur qui l'a tué
   (puis le coffre commun : un seul joueur la reçoit, partage normal). kholeChance : dans un k hole. La chance est
   multipliée par 1 + le butin du mineur (skill Pillage + stat Butin des mobs ; 1 % avec +50 % → 1,5 %), toujours une
   seule pièce (26/10/2026, Geoffrey). Hasard à part (salt) : le reste de la partie ne bouge pas. */
export const MOB_DROPS = {
  salt: 0x570ffd,
  items: [
    /* 26/10/2026 au soir (Geoffrey) : nerf, avant 0,5 % (gobelin, occultiste, méphite) et 1 % / 2 % (minotaure) */
    { mob:'gobelin',          item:'Lanières en cuir du gobelin', chance:0.001 },
    { mob:'occultiste',       item:'Capuche sombre',              chance:0.001 },
    { mob:'mephite',          item:'Nuage magique',               chance:0.001 },
    { mob:DUNGEON.boss.type,  item:'Ceinture du Géant',           chance:0.005, kholeChance:0.01 },   // k hole : toujours le double (choix de Claude)
  ],
};

/* ---- Piège (src/sim/trap.js) — décisions du créateur, 22/10 ; valeurs provisoires ----
   À partir de l'area fromArea, tries tirages indépendants de chance chacun (tirage à part de la seed : le reste de
   l'area ne change pas) : 0, 1 ou 2 pièges par area. Un piège = une salle vide de w × h cases, entourée d'une paroi
   d'une case faite des blocs normaux de l'area (on ne la distingue pas de la roche), à margin cases des bords de la
   mine et de l'area, jamais sur la colonne du treuil ± winchGap, ni contre un donjon ou un autre piège.
   L'intérieur reste caché (la découverte du mineur l'ignore) tant qu'aucun bloc de la paroi n'a été retiré. Dès qu'un
   bloc de paroi disparaît, tout le piège se dévoile et ses mobs (mobs tirés dans la table de l'area, sans mimic, PV et
   vitesse × hpMul / speedMul) prennent en chasse le mineur le plus proche, sans limite de distance. Un barbare dans la
   partie vient tuer ces mobs, quels que soient ses réglages (comme au donjon ; les raisons de remonter passent avant).
   Les mobs du piège ne comptent pas dans le plafond de mobs (walkerCap) et ne touchent pas au rythme des apparitions. */
/* ---- K hole (src/sim/khole.js) — décisions du créateur, 25/10/2026 ; valeurs provisoires ----
   Un portail (bloc KHOLE_BLOCK, incassable) enfoui dans une area avec la chance `chance` (un tirage par area, à part de
   la seed : le reste de l'area ne change pas), à la place d'un bloc de terrain, hors donjon et piège. Dès qu'un mineur
   le découvre, il s'ouvre : `warn` s plus tard, TOUT le groupe est aspiré dans une autre dimension, une carte tirée
   parmi `maps` (selon weight ; même seed → même carte), pendant sa `duration` (s), prise sur l'heure de session. La mine
   est figée pendant ce temps (rien n'y bouge) ; à la fin, tout le groupe est téléporté à la SURFACE de la mine, avec ce
   qu'il porte ; le portail disparaît.
   Partout dans la dimension : pas d'oxygène consommé, pods sans limite, aucune remontée (on attend la fin), pas
   d'apparition de mobs normale. Chaque carte fait w × h cases, à la profondeur de l'area du k hole (les mobs et les
   treasures sont ceux de cette area), entourées de barrière.
   endMargin (25/10, Geoffrey) : quand il reste endMargin s de session, le k hole se referme (retour à la surface, le
   temps de déposer au coffre) ; un k hole découvert dans ces dernières secondes ne s'ouvre pas.
   map (mode dev) : 0 = carte tirée au hasard ; 1 à maps.length = cette carte à chaque fois.
   Les cartes (spawn : 'left' = en bas à gauche, 'middle' = au milieu, regroupés ; end : fin anticipée) :
   - filons : spawnCols colonnes de gauche vides, puis comp (% des cases hors arrivée), 1 donjon (DUNGEON), `traps`
     pièges (TRAP, toujours posés) et treasurePct % de treasures (tier de l'area) ;
   - arene : vide, un minotaure (DUNGEON.boss, à découvert) à chaque bout ; fin quand ils sont tous vaincus ;
     minoVariants : variante de chacun, de gauche à droite (MINOTAUR.variants ; 30/10/2026, Jules : un brun, un noir) ;
     minoHp : leurs PV (1 000 : la carte dure 2 min ; le minotaure du donjon en a DUNGEON.boss.hp) ;
   - tresor : vide, `treasures` treasures sur la droite, d'un tier tiré au hasard (TREASURE.tiers) ; fin quand ils sont
     tous ouverts ;
   torchEvery : salle éclairée dès l'arrivée, une torche (rayon STATS.torchRadius) toutes les torchEvery colonnes.
   seeAll : les mineurs voient toute la salle (ils combattent un mob hors de leur vision).
   allFight (27/10, Geoffrey) : tout le monde se bat, même réglé sur « Ignorer » ou « Fuir » (rien d'autre à faire dans la
   salle ; avant : réglage respecté, un mineur sur Ignorer restait planté et l'arène était souvent perdue).
   - vagues : vide, des vagues de wave mobs (table de l'area, sans mimic : comme un piège), posés au sol à une colonne au
     hasard ; une vague vaincue → la suivante, jusqu'à la fin du compteur. */
export const KHOLE = {
  chance: 0.02, fromArea: 0, warn: 3, endMargin: 30, map: 0, attempts: 20,   // chance : 2 % depuis le 25/10 (Geoffrey ; avant 1 %)
  maps: [
    { id:'filons', label:'Filons', weight:1, duration:300, w:25, h:25, spawn:'left', spawnCols:5,
      comp: { hardstone:37, iron:30, gold:20, graphite:8, diamond:3 }, traps:5, dungeons:1, treasurePct:1 },
    { id:'arene',  label:'Arène des minotaures', weight:1, duration:120, w:15, h:3, spawn:'middle', minotaurs:2, minoVariants:['brun','noir'], minoHp:1000, end:'bosses', seeAll:true, allFight:true, torchEvery:5 },
    { id:'tresor', label:'Salle au trésor', weight:1, duration:120, w:5, h:3, spawn:'left', treasures:2, end:'treasures', torchEvery:5 },
    { id:'vagues', label:'Vagues', weight:1, duration:180, w:15, h:3, spawn:'middle', wave:5, seeAll:true, allFight:true, torchEvery:5 },
  ],
  salt: 0x6b401e,
};

export const TRAP = {
  fromArea: 1, chance: 0.25, tries: 2, w: 5, h: 3, mobs: 5, hpMul: 1.5, speedMul: 1.5,
  margin: 2, winchGap: 2, attempts: 30,
  salt: 0x7a9b3e,
};

/* ---- Jugement : concept Ange vs Démon (22/10/2026, décisions du créateur ; spec docs/superpowers/specs/2026-10-22-ange-demon-design.md) ----
   Résidus : dans chaque area à partir de fromArea, pct % des cases de chaque sorte (tirage à part de la seed, à la place
   de terrain : le reste de l'area ne change pas). Jauges (serveur, ns judgment) : les résidus versés aux joueurs en fin
   de session s'ajoutent à la jauge de leur sorte ; à cap, le donjon associé ouvre pendant openHours h (la jauge
   repart de 0, le surplus est perdu ; elle continue de se remplir pendant l'ouverture). */
export const JUDGMENT = {
  /* cap : 200 depuis le 24/10/2026 (Geoffrey ; ancien 250) */
  /* pct : % des blocs de l'area, les deux résidus ensemble, pris sur la pierre normale (23/10) */
  fromArea: 4, pct: 0.5, cap: 200, openHours: 4, salt: 0x5e51d0e,   // openHours : 28/10 (Geoffrey), avant 6
  sides: {
    angel: { block: 12, item:'Résidu angélique',  label:'Ange',  tower:'Tour de l\'Ange',  color:'#f4f7ff' },
    demon: { block: 13, item:'Résidu démoniaque', label:'Démon', tower:'Tour du Démon',  color:'#8b3fd9' },
  },
  poll: 15000,          // ms : rafraîchissement de l'onglet Jugement
};

/* ---- Tours de l'Ange et du Démon (concept Ange vs Démon ; src/sim/tower/) ----
   Ouvertes par le Jugement (JUDGMENT) ; lancées depuis le Lobby (« Où miner »), groupe de 1 à maxPlayers.
   Refonte du 23/10 (Geoffrey ; avant : 15 × 30 pleine de stonebrick en labyrinthe, boss 1000 PV immobile) :
   tour de `width` colonnes (murs compris) × 32 lignes : `floors` étages de floorH lignes, chacun surmonté d'une ligne de
   séparation indestructible percée d'une porte de `gate` cases en stonebrick (4 s), collée à gauche ou à droite en
   alternance (serpentin : on traverse chaque étage). La séparation du dernier étage est le toit (porte au bord aussi) ;
   au-dessus (roofH lignes, à ciel ouvert), le boss. Étage 0 vide ; étages 1 à floors-1 en alternance « blocs » (plein
   de stonebrick) / « mobs » (vide, mobs.count mobs), le premier tiré par la seed. La porte du plafond d'un étage reste
   scellée tant qu'il reste un mob vivant (étage « mobs ») ou un bloc (étage « blocs », 25/10, Geoffrey).
   Découverte étage par étage (un mineur entre dans un étage : tout l'étage et son plafond se découvrent) ; lumière
   comme dans la mine (torches illimitées, rayon STATS.torchRadius, ralenti dans le noir). Gravité, échelles
   illimitées et partagées dans la tour ; ni oxygène, ni pods, ni butin. Boss mort = fin : un trésor par présent (RUNE).
   Carte : marge de `margin` colonnes de chaque côté, `sky` lignes de ciel au-dessus du boss, sol plein en dessous ;
   portes d'entrée : les doorH lignes du bas des deux murs. */
export const TOWER = {
  duration: 600,                                  // s de jeu (10 min)
  width: 20, floors: 6, floorH: 3, gate: 3,      // 6 × (3 + 1) = 24 lignes + 4 de toit = 28 (25/10 : 6 étages, avant 7 ; 7 essayés le 26/10 avec les pods, retirés)
  /* pods (26/10/2026, Geoffrey) : chaque stonebrick minée va dans le sac du mineur (son poids : BLOCKS) ; plein (plus de
     place pour une brique) et encore des briques dans la tour, il redescend au coffre commun, au milieu de l'étage
     floor, et le vide en deposit s. Victoire : coffre + sacs des présents, en parts égales (le reste tiré par le
     serveur) ; échec ou départ : rien. */
  chest: { floor: 0, deposit: 1, max: 500 },   // max : garde-fou du serveur (briques par objet ; une tour en a ≈ 183)
  sky: 4, margin: 8, doorH: 2,
  /* treuil du logisticien (25/10/2026, Geoffrey) : le premier logisticien qui a le skill Treuil et qui tombe au pied de
     la tour (dehors) va contre le mur, de son côté, et l'installe en setup s ; une colonne contre le mur extérieur, du
     sol jusqu'à la hauteur du toit, comme le puits de la mine (on y tient, seau à la vitesse WINCH, Escalateur compris,
     sans capacité). Un seul par partie. */
  winch: { setup: 10 },
  /* modulation (26/10/2026, Geoffrey, en test) : cochée au lancement d'une tour, chaque joueur du groupe doit avoir un
     gear score (src/meta/gearscore.js) strictement inférieur à gsMax. Récompense en plus : pas encore décidée.
     open : false = case cachée et refusée par le serveur, sauf en mode dev (26/10/2026, Geoffrey : pas encore prête) */
  modulation: { open: false, gsMax: 2000 },
  /* regroupement (25/10/2026, Geoffrey) : un mineur tombé qui remonte et trouve le toit vide attend au dernier pas avant
     le toit (sous la porte du toit, ou dans le seau du treuil, une case sous l'arrivée) ; ils repartent ensemble quand
     chaque mineur de la tour est à un point d'attente ou sur le toit. Au plus maxWait s chacun, puis il monte seul. */
  regroup: { maxWait: 45 },
  /* vue (navigateur) : caméra qui suit le mineur, aussi large que la tour (avant : 19 × 15) */
  view: { cols: 22, rows: 16 },
  /* mobs des étages « mobs » (Séraphins / Diablotins, 2 cases de haut) : réveillés quand un mineur entre dans
     l'étage ; ils marchent vers le mineur le plus proche de leur étage (step s par case, comme un mob de la mine) et
     le taclent à portée (COMBAT, 25/10) ; toutes les hitEvery s ils repoussent le mineur taclé de knock blocs. La porte
     du plafond de l'étage reste scellée tant qu'il en reste un vivant. */
  /* descend (28/10/2026, Geoffrey, tous niveaux) : un mob sans proie dans son étage, alors qu'un mineur est plus bas dans la
     tour, va à la porte ouverte du sol de son étage et saute à l'étage du dessous (ex. après avoir poussé un mineur dans le trou) */
  mobs: { count: 5, hp: 200, step: 0.9, hitEvery: 1, knock: 0.25, knockRes: -100, descend: true },   // knockRes : résistance au recul en % (−100 = le double : 0,5 bloc par coup normal ; 25/10 soir, remplace le temps sonné de 0,5 s)
  blockFront: 1,      // étage « blocs » : les mineurs ne visent que les blocs des colonnes pas encore vidées les plus proches de l'entrée, blockFront par mineur (25/10)
  /* boss (bossW × bossH sur le toit, au milieu au départ). Le combat commence au premier coup reçu ; ensuite, quand
     personne n'est à son contact, il marche vers le mineur le plus proche sur le toit (speedMul × vitesse d'un mineur de
     base), sans quitter le toit. Il frappe toutes les hitEvery s (rageEvery sous rageBelow de ses PV) le premier arrivé
     parmi ceux à son contact ; chaque coup a knockChance (knockBarb pour un barbare) de le projeter de knock cases
     vers l'extérieur : il tombe s'il passe le bord de la tour (jusqu'au sol, puis il remonte). Sinon, le coup le repousse
     de push blocs (recul). En rage, les chances passent à rageKnock / rageKnockBarb. Le boss résiste à 100 % au recul.
     25/10 au soir (Geoffrey) : projection 6 → 4 → 5 → 4 cases, chances 35 / 20 % → 25 / 10 %, en rage 50 / 25 % → 35 / 20 % ;
     saut : jumpHover 5 → 3 s, et l'atterrissage projette TOUS les mineurs du toit de jumpKnock cases (avant : seulement
     ceux qui étaient sous lui, de knock cases).
     Recul du boss (25/10 au soir) : seuls les coups de son focus le repoussent (COMBAT.knock), avec knockRes % de
     résistance ; les coups des autres mineurs ne le poussent pas (100 %). Avant : il ne reculait jamais.
     Refonte du 25/10 (Geoffrey ; avant : 20 / 10 %, push 0,25, il ne frappait que s'il n'avait personne à son contact
     pour marcher) : il FOCUS le premier arrivé à son contact (le barbare qui le provoque, s'il est sur le toit) et le
     suit quand il le repousse, à travers les autres mineurs (qui restent où ils sont, même sur lui) ; son focus
     tombé du toit, il en prend un autre ; plus personne sur le toit : il retourne au centre. Un mineur repoussé fait un
     petit arc (arcHigh blocs en arcMs ms, affichage seulement).
     Saut : à chaque tranche de jumpEvery de ses PV (75, 50, 25 %), il file au centre du toit (jumpFly s), jumpHigh
     blocs en l'air, y reste jumpHover s (intouchable, il ne frappe plus), puis retombe (jumpFall s) : tous les mineurs
     du toit sont étourdis jumpStun s (la ténacité peut l'ignorer) ; ceux qui étaient sous lui sont projetés de knock
     cases sur le côté le plus proche. Valeurs provisoires. */
  boss: { hp: 3500, w: 3, h: 5, hitEvery: 1, rageBelow: 0.33, rageEvery: 0.5, knockChance: 0.25, knockBarb: 0.10,
          rageKnock: 0.35, rageKnockBarb: 0.20, knock: 4, push: 0.5, knockRes: 25, speedMul: 2, arcHigh: 0.5, arcMs: 350,
          jumpEvery: 0.25, jumpHigh: 5, jumpFly: 0.6, jumpHover: 3, jumpFall: 0.3, jumpStun: 3, jumpKnock: 3 },
  /* niveaux (28/10/2026, Geoffrey) : choisis au lancement dans le lobby ; chaque niveau se gagne une fois par joueur et par
     ouverture (un trésor chacun, le même qu'au niveau 1). Multiplicateurs : hp = PV des mobs et du boss, hard = dureté des
     stonebricks, weight = poids des stonebricks dans le sac, mobKnock = recul des coups des Séraphins / Diablotins ;
     rageBelow : le boss enrage sous cette part de ses PV (niveau 1 : boss.rageBelow) ; summon : mobs invoqués sur le toit à
     chaque envol du boss (aux PV du niveau). 28/10 à 11 h (Geoffrey) : niveau 2 PV +150 % (avant × 2), dureté +75 %
     (avant × 2), invocation de 2 mobs. 29/10 (Geoffrey) : niveau 2 dureté × 2 (avant × 1,75), poids × 2 (avant × 1,5).
     Valeurs provisoires. */
  levels: {
    1: { hp: 1,   hard: 1,    weight: 1,   mobKnock: 1, rageBelow: 0.33, summon: 0 },
    2: { hp: 2.5, hard: 2,    weight: 2,   mobKnock: 2, rageBelow: 0.5,  summon: 2 },
  },
  /* stèle (30/10/2026, Geoffrey ; SHRINES exorcisme / pacte) : à la mort du boss, le boss de l'autre camp tombe du ciel
     (fallHigh blocs, fall s) et s'écrase au centre du toit : chaque mineur du toit est projeté de crashKnock cases (il tombe
     de la tour ; la ténacité peut l'éviter), puis étourdi comme à un atterrissage s'il est resté dessus. Un treuil posé est
     cassé (plus de treuil de la partie) ; sans treuil, le logisticien peut encore le poser. mobs mobs de l'autre camp par étage (étages floors), réveillés, PV × mobHp ; boss PV × bossHp (par-dessus le
     niveau). Même chrono ; victoire = le 2e boss tué (sinon rien). */
  stele: { fallHigh: 10, fall: 0.8, crashKnock: 10, mobs: 5, floors: [0, 1, 2, 3, 4, 5], mobHp: 1.5, bossHp: 1.5 },
  sides: {
    angel: { tower:'Tour de l\'Ange',  boss:'Ange',  brick:14, hard:15, bossTex:'boss_angel', icon:'😇', mob:'Séraphin',  mobTex:'seraph' },
    demon: { tower:'Tour du Démon', boss:'Démon', brick:16, hard:17, bossTex:'boss_demon', icon:'😈', mob:'Diablotin', mobTex:'imp' },
  },
  salt: 0x70e7e5,
};

/* mobs présentés dans le lobby (option « Aider allié » : ignoré oui / non) : nom et texture */
export const MOB_INFO = {
  bestiole:   { name:'Bestiole',   tex:'bug' },
  gobelin:    { name:'Gobelin',    tex:'goblin' },
  mimic:      { name:'Mimic',      tex:'mimic', under:'iron' },   // le mimic se dessine par-dessus un minerai
  occultiste: { name:'Occultiste', tex:'occultist' },
  mephite:    { name:'Méphite',    tex:'mephite' },
  golem:      { name:'Golem de sperme', tex:'golem' },
  chair:      { name:'Mur de chair', tex:'flesh_icon' },   // icône carrée ; le mob se dessine avec flesh_wall (1 × 6)
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
/* ores : focus minerai accessible en jeu (30/10/2026, Geoffrey : retiré pour l'instant, gardé dans le code ; true le rend).
   Quand il est false, le panneau « Focus minerai » est caché et le serveur ignore les minerais d'un focus envoyé ; le
   focus d'area reste. */
export const FOCUS = { ores:false, modes:['none','target','only'], minLeft:0.2, valFactor:2, maxChanges:500, maxArea:99 };

/* Spécialisation imposée aux mineurs en mode développeur (25/10/2026, Geoffrey) : pour chaque place (les joueurs du
   groupe dans l'ordre, puis les mineurs de test), un arbre de skills et un niveau ; l'arbre est rempli étage par étage
   avec les points de talent de ce niveau (niveau − 1). Ne touche ni aux skills du compte ni à l'XP. Bornes du niveau. */
export const DEV_SPEC = { minLevel:1, maxLevel:30 };

/* Presets de personnage (mode dev, 27/10/2026, Geoffrey) : un par spécialisation. Ce sont les comptes locaux créés par
   scripts/dev-presets.js ET ce qu'un mineur de test peut recevoir dans le panneau dev du lobby : niveau et spé au maximum
   stockable, arbre rempli, sorts de la spé équipés, stuff porté (gear, non identifié, +0), keys × key dans l'inventaire
   (comptes seulement). src/shared/dev-presets.js */
export const DEV_PRESETS = {
  names: { mineur:'Test_Mineur', logisticien:'Test_Logisticien', barbare:'Test_Barbare' },
  gear: ['Casque en acier', 'Plastron en acier', 'Jambes en acier', 'Bottes en acier', 'Pioche en acier', 'Épée en acier'],
  key: ['Clé d\'instance I', 'Clé d\'instance II'], keys: 10,   // 30/10 : une pile de chaque clé (Instance II)
};

/* Réglages modifiables en mode développeur seulement (panneau dev du lobby), appliqués à la session lancée.
   Le serveur les ignore en mode normal. [objet, clé, libellé, min, max] */
export const DEV_TUNABLES = [
  ['STATS','oxygenMax','Oxygène max',1,1e5], ['STATS','speed','Vitesse (blocs/s)',0.1,100], ['STATS','mineSpeed','Vitesse de minage',0.1,100],
  ['STATS','damage','Dégâts',0,1e4], ['STATS','attackSpeed','Vitesse d\'attaque (%)',10,10000], ['STATS','fortune','Fortune (%)',0,1000], ['STATS','pods','Pods',1,1e5], ['STATS','torchRadius','Rayon torche (blocs creusés)',0,50],
  ['STATS','discoverMax','Découverte max (blocs)',0,20], ['STATS','light','Vision mobs max',0,50], ['STATS','compass','Portée boussole',0,50], ['STATS','compassRows','Lignes boussole (±)',0,5],
  ['STATS','torches','Torches',0,1000], ['STATS','knockRes','Résistance au recul (%)',0,100], ['CFG','ladderTime','Temps échelle (s)',0,60],
  ['CFG','unlockRatio','Seuil déblocage (0-1)',0,1], ['KHOLE','chance','Chance de k hole par area (0-1)',0,1],
  ['KHOLE','map','Carte de k hole (0 = au hasard, 1-4)',0,4],
];
/* objets que les réglages dev modifient (premier élément de chaque ligne de DEV_TUNABLES) : lobby et serveur */
export const DEV_TARGETS = { STATS, CFG, KHOLE };
