/* Apparence des mineurs (skins) : un fichier à part, comme les recettes. Tous les mineurs ont le même corps ;
   ce qui change, c'est le stuff équipé, dessiné par-dessus, et l'outil qu'ils sortent pour miner.
   Les textures (PNG 16×16, regard vers la droite) sont dans textures/skins/, générées par scripts/gen_textures.py.
   Ajouter une pièce d'équipement visible = une ligne ici + son dessin dans gen_textures.py.
   Purement visuel : les effets des pièces sont dans STUFF (src/config.js). */
export const SKIN = {
  body: 'skins/body',                       // le mineur, sans équipement (tenue de base)

  /* armure : un calque par case, dessiné par-dessus le corps dans cet ordre (le casque en dernier) */
  layers: ['pieds', 'jambes', 'ceinture', 'torse', 'cape', 'casque'],
  armor: {
    'Casque en chitine':   'skins/chitin_helmet',      // chitine : rouge
    'Plastron en chitine': 'skins/chitin_chest',
    'Jambes en chitine':   'skins/chitin_legs',
    'Bottes en chitine':   'skins/chitin_boots',
    'Casque en fer':       'skins/iron_helmet',        // fer : gris acier
    'Plastron en fer':     'skins/iron_chest',
    'Jambes en fer':       'skins/iron_legs',
    'Bottes en fer':       'skins/iron_boots',
    'Casque en acier':     'skins/steel_helmet',       // acier : gris bleuté sombre
    'Plastron en acier':   'skins/steel_chest',
    'Jambes en acier':     'skins/steel_legs',
    'Bottes en acier':     'skins/steel_boots',
    'Plastron de l\'équilibre': 'skins/balance_chest',  // moitié blanc angélique, moitié rouge démoniaque
    'Ceinture en peau de gobelin': 'skins/goblin_belt', // bande verte, boucle dorée
    'Cape de Naingui':     'skins/naingui_cape_front', // devant : col violet et fermoir doré (le dos : back)
    /* butin rare des mobs (26/10/2026, MOB_DROPS) */
    'Lanières en cuir du gobelin': 'skins/goblin_straps', // torse nu, deux sangles de cuir des épaules le long des côtes
    'Capuche sombre':      'skins/dark_hood',          // capuche violette de l'occultiste, visage sombre, yeux rouges
    'Nuage magique':       'skins/magic_cloud',        // les jambes deviennent un nuage jaune
    'Ceinture du Géant':   'skins/giant_belt',         // bande noire, cornes claires
  },
  /* calques dessinés DERRIÈRE le corps (même ordre de cases), ex. le dos d'une cape */
  back: {
    'Cape de Naingui':     'skins/naingui_cape',       // tissu sombre violet, jusqu'aux chevilles
  },

  /* torches posées (26/10/2026, Geoffrey) : selon la pièce de la case torche de celui qui l'a posée (torche.item),
     sinon la torche de base. Texture de textures/ (pas un calque du mineur) */
  torch: {
    base:                    'torch',
    'Lampe à incandescence': 'torch_lamp',          // lampe de mine suspendue : ampoule dans sa cage, câble
  },

  /* outil sorti pour miner (et frapper) : la pioche équipée, sinon la pioche en bois de base */
  pickaxe: {
    base:               'skins/pick_wood',             // bois : marron
    'Pioche en pierre': 'skins/pick_stone',            // pierre : grise
    'Pioche en fer':    'skins/pick_iron',             // fer : acier clair
    'Pioche en acier':  'skins/pick_steel',            // acier : gris bleuté
  },
  /* arme sortie pour frapper un mob : l'épée équipée, sinon la pioche (mains nues + pioche) */
  sword: {
    'Épée en pierre':   'skins/sword_stone',
    'Épée en fer':      'skins/sword_iron',
    'Lance en fer':     'skins/spear_iron',
    'Épée en acier':    'skins/sword_steel',
  },
};

/* toutes les textures de skins, à charger avec les autres */
export const SKIN_TEXTURES = [SKIN.body, ...Object.values(SKIN.armor), ...Object.values(SKIN.back), ...Object.values(SKIN.pickaxe), ...Object.values(SKIN.sword),
                              ...Object.values(SKIN.torch).filter(t => t !== SKIN.torch.base)];

/* calques à dessiner pour un mineur d'après son équipement (look : { case: objet }) */
export const armorLayers = look => SKIN.layers.map(slot => SKIN.armor[look?.[slot]]).filter(Boolean);
/* les mêmes calques avec leur case : [[case, texture]…] (l'aura d'une pièce se lit par case, src/meta/aura.js) */
export const armorPieces = look => SKIN.layers.filter(slot => SKIN.armor[look?.[slot]]).map(slot => [slot, SKIN.armor[look[slot]]]);
/* calques derrière le corps : [[case, texture]…] ; une pièce qui en a un porte son aura sur ce calque (le plus grand) */
export const backPieces = look => SKIN.layers.filter(slot => SKIN.back[look?.[slot]]).map(slot => [slot, SKIN.back[look[slot]]]);
/* les calques qui portent l'aura de leur case : le dos s'il y en a un, sinon le calque de devant */
export const auraPieces = look => { const back = backPieces(look), has = new Set(back.map(([s]) => s));
  return [...back, ...armorPieces(look).filter(([s]) => !has.has(s))]; };
/* texture d'une torche posée ({ x, y, r, item? }) */
export const torchTexOf = t => SKIN.torch[t?.item] ?? SKIN.torch.base;
export const pickaxeOf = look => SKIN.pickaxe[look?.pioche] ?? SKIN.pickaxe.base;
/* outil en main : pour frapper, l'épée équipée s'il en a une ; sinon (et pour miner) la pioche */
export const toolOf = (look, action) => (action === 'attack' && SKIN.sword[look?.epee]) || pickaxeOf(look);
/* case de cet outil en main (pour son aura, src/meta/aura.js) : 'epee', 'pioche', ou null (pioche en bois de base) */
export const toolSlotOf = (look, action) => action === 'attack' && SKIN.sword[look?.epee] ? 'epee'
  : look?.pioche !== 'base' && SKIN.pickaxe[look?.pioche] ? 'pioche' : null;
