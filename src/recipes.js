/* Recettes de craft (onglet Craft) : un seul fichier, séparé de la config, pour les retrouver et les équilibrer
   facilement. Les noms d'objets sont ceux de l'inventaire (voir ITEMS dans src/config.js).

   'Objet fabriqué': {
     cost   : { ingrédient: quantité, … }   ce qui est consommé (tout ou rien)
     qty    : exemplaires obtenus
     unlock : null = débloquée de base ; plus tard, le nom du blueprint qui la débloque (ex. 'Pioche en fer BP')
   }
   Toutes les valeurs sont provisoires (équilibrage). Les recettes du four (fonte) restent dans FURNACE (config). */
export const RECIPES = {
  'Pioche en pierre':    { cost: { 'Lingot de fer': 30 },                qty: 1, unlock: null },
  'Casque en chitine':   { cost: { 'Lingot de fer': 5, 'Chitine': 70 },  qty: 1, unlock: null },
  'Plastron en chitine': { cost: { 'Lingot de fer': 8, 'Chitine': 30 },  qty: 1, unlock: null },
  'Jambes en chitine':   { cost: { 'Lingot de fer': 7, 'Chitine': 30 },  qty: 1, unlock: null },
  'Bottes en chitine':   { cost: { 'Lingot de fer': 4, 'Chitine': 70 },  qty: 1, unlock: null },
};
