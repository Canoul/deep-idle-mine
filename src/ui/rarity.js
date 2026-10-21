/* Affichage de la rareté : classe CSS d'une case (contour) et nom d'objet coloré. Couleurs : style.css (--r-…),
   reprises de RARITY en config. */
import { RARITY } from '../config.js';
import { rarityOf, rarityDef } from '../meta/rarity.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* classe à ajouter à la case d'un objet (avec l'espace devant) : ' r-commun', ' r-inhabituel'… */
export const rcls = item => ` r-${rarityOf(item)}`;

/* nom de l'objet dans la couleur de sa rareté ; text : texte affiché (par défaut le nom) */
export const rname = (item, text = item, tag = 'span') => `<${tag} class="rn r-${rarityOf(item)}">${esc(text)}</${tag}>`;

/* libellé de la rareté, dans sa couleur (« Inhabituel ») */
export const rlabel = item => `<span class="rn r-${rarityOf(item)}">${esc(rarityDef(item).label)}</span>`;

/* couleurs des raretés reprises de la config (une seule source de vérité) ; style.css n'a que des valeurs de repli */
export function applyRarityColors(root = document.documentElement){
  for(const t of RARITY.tiers) root.style.setProperty(`--r-${t.id}`, t.color);
}
