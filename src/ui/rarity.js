/* Affichage de la rareté : classe CSS d'une case (contour) et nom d'objet coloré. Couleurs : style.css (--r-…),
   reprises de RARITY en config. */
import { RARITY, RUNE } from '../config.js';
import { rarityOf, rarityDef } from '../meta/rarity.js';
import { pieceName, pieceColor, itemName, itemColor } from '../meta/piece.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* classe à ajouter à la case d'un objet (avec l'espace devant) : ' r-commun', ' r-inhabituel'… */
export const rcls = item => ` r-${rarityOf(item)}`;

/* nom de l'objet dans la couleur de sa rareté (un trésor : dans la couleur de sa qualité) ; text : texte affiché (par
   défaut le nom affiché, src/meta/piece.js itemName) */
export function rname(item, text = itemName(item), tag = 'span'){
  const c = itemColor(item);
  return `<${tag} class="rn r-${rarityOf(item)}"${c ? ` style="color:${c}"` : ''}>${esc(text)}</${tag}>`;
}

/* nom d'une pièce de stuff (« Excellent : Pioche en pierre +2 ») : dans la couleur de sa qualité si elle est identifiée
   (elle passe avant la couleur de la rareté du type ; le contour de la case, lui, garde la rareté du type) */
export function pname(p, tag = 'span'){
  const c = pieceColor(p);
  return c ? `<${tag} class="rn rq" style="color:${c}">${esc(pieceName(p))}</${tag}>` : rname(p.item, pieceName(p), tag);
}

/* petite texture en bas à gauche de la case d'une pièce : la rune ou le fragment qu'elle porte (rien sinon). En fond
   de <span>, pour échapper aux tailles que style.css impose aux <img> des cases et des listes */
export const runeMark = p => p?.rune
  ? `<span class="runeMark" style="background-image:url(textures/${p.rune.frag ? RUNE.fragment.tex : RUNE.tex}.png)"></span>`
  : '';

/* libellé de la rareté, dans sa couleur (« Inhabituel ») */
export const rlabel = item => `<span class="rn r-${rarityOf(item)}">${esc(rarityDef(item).label)}</span>`;

/* couleurs des raretés reprises de la config (une seule source de vérité) ; style.css n'a que des valeurs de repli */
export function applyRarityColors(root = document.documentElement){
  for(const t of RARITY.tiers) root.style.setProperty(`--r-${t.id}`, t.color);
}
