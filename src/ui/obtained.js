/* Pop-up « Tu as obtenu » au centre de l'écran (28/10/2026) : nom de l'objet dans sa couleur, sa texture en grand et ses
   stats en dessous. Montrée quand un objet arrive ou change hors session : craft, blueprint de la table de recherche,
   identification, amélioration réussie, enchantement, rune retirée (fragment). Les trésors gardent leur propre bilan
   (src/ui/inventory.js showLoot). Plusieurs objets d'affilée : ils passent l'un après l'autre. Un clic, Entrée ou Échap
   la ferme. N'affiche que ce que le serveur a renvoyé : elle ne modifie rien. */
import { ITEMS } from '../config.js';
import { statLines } from '../meta/stuff.js';
import { isRing } from '../meta/piece.js';
import { pieceGS } from '../meta/gearscore.js';
import { recipeOfBlueprint } from '../meta/craft.js';
import { icon } from './craft.js';
import { rcls, rname, pname } from './rarity.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* lignes affichées sous l'objet (logique pure, testée) : entry = nom d'objet ou pièce { item, q, plus, lines, rune } */
export function obtainedLines(entry){
  const item = typeof entry === 'string' ? entry : entry?.item;
  const cat = ITEMS[item]?.cat;
  if(cat === 'rune') return statLines(entry);
  if(cat === 'stuff'){
    const lines = statLines(entry);
    return [...(lines.length ? lines : ['Aucun effet']), ...(isRing(item) ? [] : [`GS ${pieceGS(entry)}`])];
  }
  if(cat === 'blueprint'){
    const r = recipeOfBlueprint(item);
    return r ? [`Débloque la recette : ${r}`, ...(ITEMS[r]?.cat === 'stuff' ? statLines(r) : [])] : [];
  }
  return [];
}

export function setupObtained(root){
  const queue = [];
  root.onclick = () => next();
  addEventListener('keydown', e => { if(!root.hidden && (e.key === 'Escape' || e.key === 'Enter')){ e.preventDefault(); next(); } });

  function draw({ title, entry, qty = 1 }){
    const item = typeof entry === 'string' ? entry : entry.item;
    const name = typeof entry === 'string' ? rname(entry, undefined, 'b') : pname(entry, 'b');
    root.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="${esc(title)}">`+
      `<p class="obTitle">${esc(title)}</p>`+
      `<div class="slot obIcon${rcls(item)}">${icon(item)}</div>`+
      `<p class="obName">${name}${qty > 1 ? ` <span class="mut">× ${qty}</span>` : ''}</p>`+
      obtainedLines(entry).map(l => `<div class="obLine">${esc(l)}</div>`).join('')+
      `<p class="mut small obHint">Clique pour fermer</p></div>`;
    root.hidden = false;
  }
  function next(){
    queue.shift();
    if(queue.length) draw(queue[0]); else { root.hidden = true; root.innerHTML = ''; }
  }

  return {
    /* show({ title, entry, qty }) : entry = nom d'objet (craft, blueprint) ou pièce renvoyée par le serveur */
    show(o){ if(!o?.entry) return; queue.push(o); if(queue.length === 1) draw(o); },
  };
}
