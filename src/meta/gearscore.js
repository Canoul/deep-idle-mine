/* Gear score (GS) : la puissance du stuff en x (1 x = 1 s de travail), concept « modulation » du 26/10/2026 (Geoffrey).
   GS d'une pièce = ce qu'elle ajoute aux stats de base, converti en x avec les prix mesurés (UPGRADE.worth, complétés
   par UPGRADE.gs ; avant le 26/10 au soir : UPGRADE.prices, le tableau de conversion des lignes). Comptent : les stats de l'objet, ses lignes d'identification, sa rune (ou son
   fragment) et son amélioration (pieceBonus les contient toutes). Une valeur qui remplace la base (l'épée : Dégâts 14)
   compte pour ce qu'elle ajoute à la base (14 − 5). Un malus (Lance : vitesse d'attaque −10 %) retire des x.
   GS du joueur = somme des GS des pièces portées = stats avec le stuff − stats de base (en x).
   Pas comptés : les skills, les sorts, les glyphes ; les anneaux (effet de groupe) ; les stats sans prix en x
   (torches portées, pose des torches, lumière, portée de la boussole…). */
import { STATS, UPGRADE } from '../config.js';
import { pieceBonus, isRing } from './piece.js';

/* x par point d'une stat pour le GS : prix mesuré (worth, sinon gs ; sinon priceBase), SANS l'ajustement de Geoffrey.
   28/10/2026 (Geoffrey) : l'ajustement (UPGRADE.priceAdjust) divise les points d'une stat pour 1 x quand on DESSINE une
   pièce (une pièce de 250 x porte 3 fois moins de minage), mais le GS reste au prix mesuré : la stat ne bouge pas, sa
   valeur en GS est divisée d'autant (pioche en fer : 0,4 × 1 300 = 520 GS, pas 1 560). Ancien (27/10) : GS × ajustement. */
export const statPrice = k => (UPGRADE.worth[k] ?? (UPGRADE.gs[k] || UPGRADE.priceBase?.[k])) ?? 0;
/* x par point pour dessiner une pièce (stats du tier 4, butin des mobs) : prix mesuré × UPGRADE.priceAdjust (27/10) */
export const designPrice = k => statPrice(k) * (UPGRADE.priceAdjust?.[k] ?? 1);
const priceOf = statPrice;

/* GS d'une pièce (nom d'objet ou pièce avec qualité, lignes, rune, niveau), arrondi à l'unité */
export function pieceGS(entry){
  const item = typeof entry === 'string' ? entry : entry?.item;
  if(!item || isRing(item)) return 0;
  const b = pieceBonus(entry);
  let x = 0;
  for(const [k, v] of Object.entries(b.stats)) if(Number.isFinite(v)) x += v * priceOf(k);
  for(const [k, v] of Object.entries(b.set)) if(Number.isFinite(v) && Number.isFinite(STATS[k])) x += (v - STATS[k]) * priceOf(k);
  return Math.round(x);
}

/* GS du joueur : pièces portées ({ slot: pièce | null } ou liste de pièces) */
export function gearScore(worn){
  const pieces = Array.isArray(worn) ? worn : Object.values(worn || {});
  return pieces.filter(Boolean).reduce((s, p) => s + pieceGS(p), 0);
}
