/* Recettes de craft (onglet Craft) : un seul fichier, séparé de la config, pour les retrouver et les équilibrer
   facilement. Les noms d'objets sont ceux de l'inventaire (voir ITEMS dans src/config.js).

   'Objet fabriqué': {
     cost   : { ingrédient: quantité, … }   ce qui est consommé (tout ou rien)
     qty    : exemplaires obtenus
     unlock : null = débloquée de base ; sinon le nom du blueprint qui la débloque (ex. 'Pioche en fer BP') : le joueur
              « utilise » le blueprint depuis l'inventaire (il est consommé), la recette reste débloquée pour toujours
   }
   Toutes les valeurs sont provisoires (équilibrage). Les recettes du four (fonte) restent dans FURNACE (config). */
export const RECIPES = {
  'Pioche en pierre':    { cost: { 'Lingot de fer': 30 },                qty: 1, unlock: null },
  'Épée en pierre':      { cost: { 'Lingot de fer': 15 },                qty: 1, unlock: null },
  'Casque en chitine':   { cost: { 'Lingot de fer': 5, 'Chitine': 70 },  qty: 1, unlock: null },
  'Plastron en chitine': { cost: { 'Lingot de fer': 8, 'Chitine': 30 },  qty: 1, unlock: null },
  'Jambes en chitine':   { cost: { 'Lingot de fer': 7, 'Chitine': 30 },  qty: 1, unlock: null },
  'Bottes en chitine':   { cost: { 'Lingot de fer': 4, 'Chitine': 70 },  qty: 1, unlock: null },
  /* Rune (29/10/2026, Geoffrey) : qualité tirée à la fabrication (RUNE.craftChances), lignes comme une rune de tour.
     La Poudre de rêve vient du recyclage des runes (RUNE.dust) */
  'Rune':                { cost: { 'Poudre de rêve': 100 },              qty: 1, unlock: null },

  /* Lampe à incandescence (25/10/2026, Geoffrey) : blueprint du Treasure T2 depuis le 26/10 (avant : de base) */
  'Lampe à incandescence': { cost: { 'Vésicule de gaz': 200, 'Charbon': 2000, 'Fragment de cœur': 20 }, qty: 1, unlock: 'Lampe à incandescence BP' },

  /* débloquées par un blueprint (Treasure T1) */
  'Pioche en fer':       { cost: { 'Tainted iron': 20 },                 qty: 1, unlock: 'Pioche en fer BP' },
  'Épée en fer':         { cost: { 'Tainted iron': 10 },                 qty: 1, unlock: 'Épée en fer BP' },
  'Lance en fer':        { cost: { 'Tainted iron': 10 },                 qty: 1, unlock: 'Lance en fer BP' },   // 25/10 : même prix que l'épée (provisoire)
  /* armure en fer : + 20 peaux de gobelin chacune (25/10/2026, Geoffrey ; avant : aucune, 5 pour les bottes) */
  'Casque en fer':       { cost: { 'Tainted iron': 5, 'Peau de gobelin': 20 },  qty: 1, unlock: 'Casque en fer BP' },
  'Plastron en fer':     { cost: { 'Tainted iron': 8, 'Peau de gobelin': 20 },  qty: 1, unlock: 'Plastron en fer BP' },
  'Jambes en fer':       { cost: { 'Tainted iron': 7, 'Peau de gobelin': 20 },  qty: 1, unlock: 'Jambes en fer BP' },
  'Bottes en fer':       { cost: { 'Tainted iron': 4, 'Peau de gobelin': 20, 'Lingot d\'or': 1 }, qty: 1, unlock: 'Bottes en fer BP' },
  'Ceinture en peau de gobelin': { cost: { 'Peau de gobelin': 20, 'Lingot d\'or': 20 }, qty: 1, unlock: 'Ceinture en peau de gobelin BP' },

  /* débloquées par un blueprint (Treasure T1) : le four se pose avec « Utiliser » (2e four), la boussole s'équipe */
  'Four en fer':         { cost: { 'Charbon': 1000, 'Tainted iron': 20, 'Shiny iron': 5 },     qty: 1, unlock: 'Four en fer BP' },
  'Boussole en or':      { cost: { 'Tainted gold': 20, 'Shiny gold': 5 },                      qty: 1, unlock: 'Boussole en or BP' },
  /* 3e four (27/10/2026, Geoffrey) : blueprint du coffre du Roi Gobelin ; « Utiliser » ouvre le four 3 (× 1,5) */
  'Four en or':          { cost: { 'Shiny gold': 50, 'Tainted gold': 50, 'Diamant': 50 },      qty: 1, unlock: 'Four en or BP' },

  /* débloquées par un blueprint (Treasure T2) */
  'Gants tactique':      { cost: { 'Shiny iron': 20, 'Tainted iron': 20, 'Jade inférieur': 1 },   qty: 1, unlock: 'Gants tactique BP' },
  'Gants d\'ouvrier':    { cost: { 'Shiny gold': 20, 'Tainted iron': 20 },                        qty: 1, unlock: 'Gants d\'ouvrier BP' },
  'Cape de Naingui':     { cost: { 'Tissu sombre': 20, 'Rubis inférieur': 1, 'Saphir inférieur': 1 }, qty: 1, unlock: 'Cape de Naingui BP' },

  /* débloquées par un blueprint (Treasure T3, 23/10/2026, Geoffrey) */
  /* armure en acier : Tainted gold = la moitié du Steel ingot (24/10/2026, Geoffrey) */
  'Casque en acier':     { cost: { 'Steel ingot': 10, 'Tainted gold': 5, 'Shiny iron': 10, 'Tissu sombre': 10 }, qty: 1, unlock: 'Casque en acier BP' },
  'Plastron en acier':   { cost: { 'Steel ingot': 16, 'Tainted gold': 8, 'Shiny iron': 10, 'Tissu sombre': 10 }, qty: 1, unlock: 'Plastron en acier BP' },
  'Jambes en acier':     { cost: { 'Steel ingot': 14, 'Tainted gold': 7, 'Shiny iron': 10, 'Tissu sombre': 10 }, qty: 1, unlock: 'Jambes en acier BP' },
  'Bottes en acier':     { cost: { 'Steel ingot': 8,  'Tainted gold': 4, 'Shiny iron': 10, 'Tissu sombre': 10 }, qty: 1, unlock: 'Bottes en acier BP' },
  'Pioche en acier':     { cost: { 'Steel ingot': 20, 'Shiny gold': 10, 'Diamant': 10 },      qty: 1, unlock: 'Pioche en acier BP' },
  'Épée en acier':       { cost: { 'Steel ingot': 10, 'Shiny gold': 10, 'Diamant': 10 },      qty: 1, unlock: 'Épée en acier BP' },
  'Plastron de l\'équilibre': { cost: { 'Steel ingot': 50, 'Shiny gold': 20, 'Rubis inférieur': 1, 'Saphir inférieur': 1,
                         'Jade inférieur': 1, 'Résidu angélique': 50, 'Résidu démoniaque': 50 }, qty: 1, unlock: 'Plastron de l\'équilibre BP' },

  /* Treasure T4 (27/10/2026, Geoffrey) : toutes débloquées par leur blueprint. Thorium et cobalt se fabriquent à partir de
     la pièce en mithril (consommée : l'exemplaire le plus simple d'abord, src/meta/craft.js) */
  /* 30/10/2026 (Geoffrey) : lingots de mithril × 2 sur les pièces en mithril (avant 15 / 24 / 21 / 16) */
  'Casque en mithril':   { cost: { 'Mithril ingot': 30, 'Steel ingot': 5, 'Shiny iron': 10 }, qty: 1, unlock: 'Casque en mithril BP' },
  'Plastron en mithril': { cost: { 'Mithril ingot': 48, 'Steel ingot': 8, 'Shiny iron': 10 }, qty: 1, unlock: 'Plastron en mithril BP' },
  'Jambes en mithril':   { cost: { 'Mithril ingot': 42, 'Steel ingot': 7, 'Shiny iron': 10 }, qty: 1, unlock: 'Jambes en mithril BP' },
  'Bottes en mithril':   { cost: { 'Mithril ingot': 32, 'Steel ingot': 4, 'Shiny iron': 10 }, qty: 1, unlock: 'Bottes en mithril BP' },
  'Casque en thorium':   { cost: { 'Casque en mithril': 1, 'Thorium ingot': 10, 'Rubis': 1, 'Diamant': 25 },   qty: 1, unlock: 'Casque en thorium BP' },
  'Plastron en thorium': { cost: { 'Plastron en mithril': 1, 'Thorium ingot': 16, 'Topaze': 1, 'Diamant': 25 }, qty: 1, unlock: 'Plastron en thorium BP' },
  'Jambes en thorium':   { cost: { 'Jambes en mithril': 1, 'Thorium ingot': 14, 'Saphir': 1, 'Diamant': 25 },  qty: 1, unlock: 'Jambes en thorium BP' },
  'Bottes en thorium':   { cost: { 'Bottes en mithril': 1, 'Thorium ingot': 8, 'Jade': 1, 'Diamant': 25 },     qty: 1, unlock: 'Bottes en thorium BP' },
  'Casque en cobalt':    { cost: { 'Casque en mithril': 1, 'Cobalt ingot': 10, 'Rubis': 1, 'Diamant': 25 },    qty: 1, unlock: 'Casque en cobalt BP' },
  'Plastron en cobalt':  { cost: { 'Plastron en mithril': 1, 'Cobalt ingot': 16, 'Topaze': 1, 'Diamant': 25 },  qty: 1, unlock: 'Plastron en cobalt BP' },
  'Jambes en cobalt':    { cost: { 'Jambes en mithril': 1, 'Cobalt ingot': 14, 'Saphir': 1, 'Diamant': 25 },   qty: 1, unlock: 'Jambes en cobalt BP' },
  'Bottes en cobalt':    { cost: { 'Bottes en mithril': 1, 'Cobalt ingot': 8, 'Jade': 1, 'Diamant': 25 },      qty: 1, unlock: 'Bottes en cobalt BP' },
  'Lunettes Gucci':      { cost: { 'Diamant': 20, 'Mithril ingot': 10, 'Cobalt ingot': 2 },                    qty: 1, unlock: 'Lunettes Gucci BP' },
  'Doc Martins':         { cost: { 'Cuir de minotaure': 50, 'Thorium ingot': 4, 'Tissu sombre': 100 },          qty: 1, unlock: 'Doc Martins BP' },
  'Ceinture golémique':  { cost: { 'Pierre glissante': 50, 'Thorium ingot': 5, 'Vésicule de gaz': 100 },         qty: 1, unlock: 'Ceinture golémique BP' },
  'Gants de boucher':    { cost: { 'Rotten flesh': 50, 'Mithril ingot': 15, 'Peau de gobelin': 500 },          qty: 1, unlock: 'Gants de boucher BP' },
  'Cape inclusive':      { cost: { 'Tainted iron': 20, 'Tainted gold': 20, 'Diamant': 20, 'Graphite ingot': 20, 'Steel ingot': 20, 'Mithril ingot': 20,
                           'Thorium ingot': 20, 'Cobalt ingot': 20, 'Orbe supérieur': 5 }, qty: 1, unlock: 'Cape inclusive BP' },   // 31/10 (Geoffrey)
  'Jambières titanesques': { cost: { 'Cobalt ingot': 25, 'Thorium ingot': 25, 'Topaze': 1, 'Jade': 1, 'Saphir': 1, 'Rubis': 1,
                           'Shiny gold': 50 }, qty: 1, unlock: 'Jambières titanesques BP' },
  'Saphir':              { cost: { 'Diamant': 50, 'Saphir inférieur': 3 }, qty: 1, unlock: 'Saphir BP' },
  'Rubis':               { cost: { 'Diamant': 50, 'Rubis inférieur': 3 },  qty: 1, unlock: 'Rubis BP' },
  'Jade':                { cost: { 'Diamant': 50, 'Jade inférieur': 3 },   qty: 1, unlock: 'Jade BP' },
  'Orbe supérieur':      { cost: { 'Rotten flesh': 20, 'Chair de vers': 20, 'Peau de chien de magma': 20 }, qty: 1, unlock: null },   // 31/10 (Geoffrey) : de base
  'Orbe':                { cost: { 'Tissu sombre': 30, 'Vésicule de gaz': 30, 'Pierre glissante': 10 }, qty: 1, unlock: null },   // 30/10 (Geoffrey) : de base
  'Clé d\'instance I':   { cost: { 'Barre d\'argent': 1, 'Orbe': 5 }, qty: 1, unlock: null },   // 31/10 (Geoffrey) ; ancien : 250 Peau de gobelin, 20 Pierre glissante, 50 Tissu sombre, 1 Barre d'argent ; 28/10 : de base (avant : Clé d'instance I BP, Treasure T4)
};
