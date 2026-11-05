/* Explication de chaque stat du mineur (05/11/2026, Geoffrey ; avant : dans src/wiki/data.js seulement) : une seule liste,
   lue par le wiki (src/wiki/data.js) et par les bulles « ? » de la carte « Stats du mineur » (onglet Stuff, src/ui/stuff.js).
   Logique pure. */
import { CFG } from '../config.js';

const num = n => String(Math.round(n * 100) / 100).replace('.', ',');

export const STAT_HELP = {
  oxygenMax:  'Combien de secondes il peut rester sous terre avant de remonter respirer.',
  pods:       'Ce que son sac peut porter (chaque bloc a un poids). Sac plein = retour au coffre.',
  speed:      'Vitesse de marche à l\'horizontale, en blocs par seconde.',
  climbSpeed: 'Vitesse sur les échelles, pour monter comme pour descendre.',
  mineSpeed:  'Vitesse de minage : temps pour casser un bloc = sa dureté ÷ cette valeur.',
  damage:     'Dégâts de chaque coup contre un mob. L\'épée remplace la valeur des mains nues.',
  attackSpeed:`Rythme des coups : à 100 %, un coup toutes les ${num(CFG.attackInterval)} s ; à 200 %, deux fois plus vite.`,
  fortune:    'Chance de doubler un minerai miné (tu en gagnes 2 au lieu de 1).',
  discoverMax:'Distance (en blocs) jusqu\'à laquelle il découvre les blocs autour de lui, s\'il y a de la lumière.',
  light:      'Distance jusqu\'à laquelle il repère les mobs.',
  compass:    'Portée de la boussole : elle repère les minerais à gauche et à droite, sur sa ligne.',
  compassRows:'Lignes en plus que voit la boussole, au-dessus ET en dessous de la sienne.',
  torches:    'Torches qu\'il emporte. À 0, il remonte en chercher.',
  torchRadius:"Distance éclairée par les torches qu'il pose (le long des galeries creusées). Chaque torche garde le rayon de celui qui l'a posée.",
  blockMinePct:"Némésis du Golbute : vitesse de minage en plus sur les blocs de terrain (terre, pierre, pierre dure, résidus), pas sur les minerais.",
  golemOxygen:"Âme du Golbute : un golem qui meurt à 8 cases ou moins de toi te rend cet oxygène (sans dépasser ton maximum).",
  goblinThrall:"Couronne du Roi Gobelin : un gobelin qui apparaît à cette distance ou moins du porteur est asservi. Il ne se bat pas, mine les minerais autour de lui (la roche s'il n'y en a pas) pendant 30 s (vitesse d'un mineur de base, même priorité que le porteur) et ce qu'il mine va directement au coffre commun, puis il disparaît.",
  torchTime:  "Temps qu'il met à poser une torche.",
  bridges:    'Passerelles pour traverser les trous (illimitées).',
  tenacityResilience:"Après une mécanique esquivée grâce à la ténacité, la chance d'esquiver la suivante est réduite de 50 % (puis redevient normale). La résilience réduit cette baisse : 100 % l'annule.",
  tenacity:   "Chance d'ignorer une mécanique de mob qui le vise : vol du gobelin, canalisation de l'occultiste, asphyxie du méphite, recul et étourdissements des boss, Fear de Lucifer… (un tirage à chaque fois). Rendement décroissant : 10 % de ténacité donnent 8,9 % de chance réelle, 30 % → 22,4 %, 50 % → 32,4 %, 100 % → 50 % (chance réelle affichée à côté). Certains boss en ignorent une partie.",
  reach:      "Portée de ses coups, en blocs, en plus de la portée de base (0,5) : il frappe un mob avant que celui-ci soit au contact, et il le touche encore après l'avoir repoussé. La Lance en fer en donne +0,25.",
  knockback:  "Recul qu'il inflige, en blocs, en plus du recul de base (0,25). Un coup qui repousse un mob au-delà de sa portée de tacle (0,5) lui fait lâcher le mineur ; repoussé une fois, il ne peut plus l'être avant d'être revenu à portée. La Lance en fer en donne +0,5.",
  doubleAttack: "Chance, en %, qu'un coup frappe deux fois au lieu d'une (le second coup a son propre critique ; le mob n'est repoussé qu'une fois). Vient des runes.",
  knockRes:   "Réduit le recul subi quand un mob ou un boss le frappe : à 50 %, il recule deux fois moins ; à 100 %, plus du tout.",
  mineSpeedPct:'Bonus de vitesse de minage en %, sur certaines pièces identifiées : vitesse = (base + bonus fixes) × (1 + ce %).',
  damagePct:  'Bonus de dégâts en %, sur certaines pièces identifiées : dégâts = (base + bonus fixes) × (1 + ce %).',
  crit:       'Chance qu\'un coup contre un mob fasse le double de dégâts.',
  oneTap:     'Chance de casser un bloc instantanément. Sur le Bloc géant, les spawners et le cristal du Golbute : à chaque seconde de minage, chance de compter une seconde de plus.',
  piercing:   'Chance de casser aussi le bloc juste derrière celui qu\'il mine.',
  looting:    "Chance, en %, d'un butin en plus à chaque mob tué (comme le skill Pillage).",
};
