/* Toutes les valeurs d'équilibrage et constantes du jeu, au même endroit (voir GAME_DESIGN.md).
   Aucun nombre magique dans la logique : on ajoute une clé ici et on la lit ailleurs. */

export const W = 50, AREA_H = 50, SESSION_LEN = 3600, DT = 0.1;
/* couche 1 (juste sous la surface) : toujours en terre, hors areas (ne fausse pas les pourcentages).
   L'area 0 occupe donc les couches 2 à 51, l'area 1 les couches 52 à 101, etc. */
export const TOP_DIRT_ROWS = 1, AREA_Y0 = 1 + TOP_DIRT_ROWS;
export const SPAWN_X = 25, CHEST_X = 22;

/* stats du mineur (de base, avant équipement) */
/* speed = marche (horizontal), climbSpeed = sur échelle, montée comme descente (blocs/s) ; deux stats indépendantes */
export const STATS = { oxygenMax:300, speed:3, climbSpeed:2.25, mineSpeed:1, damage:5, pods:200, light:6, compass:8,
  torches:20, torchRadius:5, discoverMax:2, bridges:10 };

export const CFG = {
  ladderTime:2, refillRate:30, unlockRatio:0.4,
  climbFactor:0.75,       // bestioles seulement : vitesse sur échelle = ×climbFactor (le mineur a sa stat climbSpeed)
  oreReach:12, bridgeTime:1,
  futureTravelWeight:1, ladderPlanWeight:2, planMaxCost:30, foeLeash:10, foeGiveUp:15, mobStep:0.9,
  attackInterval:0.8, torchThreshold:0.33, darkLum:0.1, fallSpeed:8,
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
      { family:'gem', items:[
        { item:'Rubis inférieur',  chance:0.01, tex:'gem_ruby' },
        { item:'Jade inférieur',   chance:0.01, tex:'gem_jade' },
        { item:'Saphir inférieur', chance:0.01, tex:'gem_sapphire' },
      ]},
    ],
  },
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

/* textures : fichiers de textures/ (générés par scripts/gen_textures.py) */
export const TEXTURES = ['dirt','grass','stone','hardstone','coal','iron','gold','diamond','tunnel','barrier','sky','bridge','treasure','treasure_t1','treasure_t2',
  'blueprint','bp_parts','gem_ruby','gem_jade','gem_sapphire',
  'ingot_iron','ingot_gold','pickaxe_stone','helmet_chitin','chest_chitin','legs_chitin','boots_chitin',
  'ladder','chest','miner','mimic','bug','goblin','torch'];

/* ---- Hors session : four (onglet Four) ----
   Un four : une case minerai (famille ore), une case combustible (famille combustible), une case sortie (lingots).
   Chaque lingot consomme orePerIngot minerais + fuelPerIngot combustibles, en time secondes (temps réel, même
   page fermée : le serveur calcule l'avancée depuis l'heure de départ). Un minerai (famille ore) sans recette ne va pas
   dans le four (le diamant, pour l'instant).
   max : nombre de fours au maximum ; startOwned : fours possédés au départ (les autres sont sous cadenas).
   tiers : fours plus puissants à venir (speed divise le temps de fonte). */
export const FURNACE = {
  max:3, startOwned:1, orePerIngot:10, fuelPerIngot:10,
  tiers: [ { name:'Four en pierre', speed:1 } ],
  recipes: {
    Fer:     { out:'Lingot de fer',     time:60,  tex:'ingot_iron' },
    Or:      { out:'Lingot d\'or',      time:120, tex:'ingot_gold' },
  },
  opMemory: 50,        // dernières demandes retenues (une demande renvoyée n'agit pas deux fois)
};

/* ---- Hors session : stuff (onglet Stuff) ----
   slots : les cases d'équipement du mineur, dans l'ordre d'affichage (id, libellé, icône d'une case vide).
   items : les pièces d'équipement (famille stuff, ne s'empilent pas) et la case où elles vont.
   Équiper une pièce la sort de l'inventaire ; la retirer l'y remet. Les effets sur le mineur viendront plus tard.
   Les recettes de fabrication sont dans src/recipes.js. */
export const STUFF = {
  slots: [
    { id:'casque',   label:'Casque',   icon:'⛑' },  { id:'torse',    label:'Torse',    icon:'🦺' },
    { id:'jambes',   label:'Jambes',   icon:'👖' }, { id:'pieds',    label:'Pieds',    icon:'🥾' },
    { id:'gants',    label:'Gants',    icon:'🧤' }, { id:'ceinture', label:'Ceinture', icon:'🎗' },
    { id:'pioche',   label:'Pioche',   icon:'⛏' },  { id:'epee',     label:'Épée',     icon:'🗡' },
    { id:'cape',     label:'Cape',     icon:'🧣' }, { id:'boussole', label:'Boussole', icon:'🧭' },
  ],
  /* stats : bonus ajoutés aux STATS du mineur (clé de STATS → valeur). Affichés, pas encore appliqués en session. */
  items: {
    'Pioche en pierre':    { slot:'pioche', tex:'pickaxe_stone', stats:{ mineSpeed:0.1 } },
    'Casque en chitine':   { slot:'casque', tex:'helmet_chitin', stats:{ oxygenMax:30 } },
    'Plastron en chitine': { slot:'torse',  tex:'chest_chitin',  stats:{ pods:25 } },
    'Jambes en chitine':   { slot:'jambes', tex:'legs_chitin',   stats:{ climbSpeed:0.4 } },
    'Bottes en chitine':   { slot:'pieds',  tex:'boots_chitin',  stats:{ speed:0.5 } },
  },
  statLabels: { oxygenMax:'Oxygène', pods:'Pods', climbSpeed:'Vitesse (échelle)', speed:'Vitesse (marche)',
                mineSpeed:'Vitesse de minage', damage:'Dégâts', light:'Vision', compass:'Portée boussole',
                torches:'Torches', bridges:'Passerelles' },
  /* stats du mineur affichées dans l'onglet Stuff (base STATS + bonus des pièces portées), dans cet ordre */
  shownStats: ['oxygenMax','pods','speed','climbSpeed','mineSpeed','damage','light','compass','torches','bridges'],
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
  ...Object.fromEntries(Object.values(FURNACE.recipes).map(r => [r.out, { cat:'ingot', tex:r.tex, w:1, stack:true }])),
  ...Object.fromEntries(TREASURE.tiers.map(t => [t.item, { cat:'treasure', tex:t.tex, w:TREASURE.itemWeight, stack:true }])),
  [MOBS.bugItem]:    { cat:'mob',      tex:'bug',      w:1, stack:true },
  [MOBS.goblinItem]: { cat:'mob',      tex:'goblin',   w:1, stack:true },
  'Blueprint parts': { cat:'blueprint', tex:'bp_parts', stack:true },
  ...Object.fromEntries(Object.values(LOOT).flatMap(t => t.oneOf.flatMap(f =>
    f.items.map(i => [i.item, { cat:f.family, tex:i.tex || f.tex, stack:true }])))),
  ...Object.fromEntries(Object.entries(STUFF.items).map(([n, d]) => [n, { cat:'stuff', slot:d.slot, tex:d.tex, stats:d.stats ?? {}, w:0, stack:false }])),
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
  ['STATS','damage','Dégâts',0,1e4], ['STATS','pods','Pods',1,1e5], ['STATS','torchRadius','Rayon torche (blocs creusés)',0,50],
  ['STATS','discoverMax','Découverte max (blocs)',0,20], ['STATS','light','Vision mobs max',0,50], ['STATS','compass','Portée boussole',0,50],
  ['STATS','torches','Torches',0,1000], ['STATS','bridges','Passerelles',0,1000], ['CFG','ladderTime','Temps échelle (s)',0,60],
  ['CFG','unlockRatio','Seuil déblocage (0-1)',0,1],
];
