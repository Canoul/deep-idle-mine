/* Apparence des mineurs (skins) : un fichier à part, comme les recettes. Tous les mineurs ont le même corps ;
   ce qui change, c'est le stuff équipé, dessiné par-dessus, et l'outil qu'ils sortent pour miner.
   Les textures (PNG 16×16, regard vers la droite) sont dans textures/skins/, générées par scripts/gen_textures.py.
   Ajouter une pièce d'équipement visible = une ligne ici + son dessin dans gen_textures.py.
   Purement visuel : aucun effet sur la partie. */
export const SKIN = {
  body: 'skins/body',                       // le mineur, sans équipement (tenue de base)

  /* armure : un calque par case, dessiné par-dessus le corps dans cet ordre (le casque en dernier) */
  layers: ['pieds', 'jambes', 'torse', 'casque'],
  armor: {
    'Casque en chitine':   'skins/chitin_helmet',      // chitine : rouge
    'Plastron en chitine': 'skins/chitin_chest',
    'Jambes en chitine':   'skins/chitin_legs',
    'Bottes en chitine':   'skins/chitin_boots',
  },

  /* outil sorti pour miner (et frapper) : la pioche équipée, sinon la pioche en bois de base */
  pickaxe: {
    base:               'skins/pick_wood',             // bois : marron
    'Pioche en pierre': 'skins/pick_stone',            // pierre : grise
  },
};

/* toutes les textures de skins, à charger avec les autres */
export const SKIN_TEXTURES = [SKIN.body, ...Object.values(SKIN.armor), ...Object.values(SKIN.pickaxe)];

/* calques à dessiner pour un mineur d'après son équipement (look : { case: objet }) */
export const armorLayers = look => SKIN.layers.map(slot => SKIN.armor[look?.[slot]]).filter(Boolean);
export const pickaxeOf = look => SKIN.pickaxe[look?.pioche] ?? SKIN.pickaxe.base;
