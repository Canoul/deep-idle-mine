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
  'Casque en chitine':   { cost: { 'Lingot de fer': 5, 'Chitine': 70 },  qty: 1, unlock: null },
  'Plastron en chitine': { cost: { 'Lingot de fer': 8, 'Chitine': 30 },  qty: 1, unlock: null },
  'Jambes en chitine':   { cost: { 'Lingot de fer': 7, 'Chitine': 30 },  qty: 1, unlock: null },
  'Bottes en chitine':   { cost: { 'Lingot de fer': 4, 'Chitine': 70 },  qty: 1, unlock: null },

  /* débloquées par un blueprint (Treasure T1) */
  'Pioche en fer':       { cost: { 'Tainted iron': 20 },                 qty: 1, unlock: 'Pioche en fer BP' },
  'Épée en fer':         { cost: { 'Tainted iron': 10 },                 qty: 1, unlock: 'Épée en fer BP' },
  'Casque en fer':       { cost: { 'Tainted iron': 5 },                  qty: 1, unlock: 'Casque en fer BP' },
  'Plastron en fer':     { cost: { 'Tainted iron': 8 },                  qty: 1, unlock: 'Plastron en fer BP' },
  'Jambes en fer':       { cost: { 'Tainted iron': 7 },                  qty: 1, unlock: 'Jambes en fer BP' },
  'Bottes en fer':       { cost: { 'Tainted iron': 4, 'Peau de gobelin': 5, 'Lingot d\'or': 1 }, qty: 1, unlock: 'Bottes en fer BP' },
  'Ceinture en peau de gobelin': { cost: { 'Peau de gobelin': 20, 'Lingot d\'or': 20 }, qty: 1, unlock: 'Ceinture en peau de gobelin BP' },
};
