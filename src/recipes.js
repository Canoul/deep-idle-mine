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
};
