/* Bulle d'info commune : tout élément portant data-tip (lignes séparées par \n, la première en titre) en affiche une
   au survol de la souris, ou quand on le touche sur un écran tactile (le title natif n'y existe pas).
   Toucher ailleurs, faire défiler ou quitter l'élément la ferme. */
import { stuffTip } from '../meta/stuff.js';
import { rarityOf } from '../meta/rarity.js';
import { pieceColor } from '../meta/piece.js';
import { lootTableOf } from '../meta/loot-table.js';
import { lootTipHtml } from './loot-tip.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* attribut à mettre sur l'icône d'un objet : bulle pour le stuff, title natif sinon. piece : la pièce elle-même
   (qualité, lignes, niveau), sinon les effets de l'objet de base ; titre dans la couleur de la qualité si identifiée.
   Un objet qui s'ouvre (treasure, coffre de tour ou d'instance) : bulle avec son tableau de butin (src/ui/loot-tip.js) */
export function tipAttr(item, title = item, piece = null){
  if(lootTableOf(item)) return ` data-tip="${esc(title)}" data-loot="item:${esc(item)}"`;
  const t = stuffTip(piece ?? item), c = pieceColor(piece);
  return t ? ` data-tip="${esc(t)}" data-rarity="${rarityOf(item)}"${c ? ` data-color="${c}"` : ''}` : ` title="${esc(title)}"`;
}

export function setupTooltips(){
  const tip = document.createElement('div');
  tip.id = 'tip'; tip.hidden = true;
  document.body.append(tip);
  let cur = null;

  function show(el){
    if(el === cur && !tip.hidden) return;
    cur = el;
    const loot = el.dataset.loot ? lootTipHtml(el.dataset.loot) : null;   // tableau de butin (src/ui/loot-tip.js)
    if(loot) return place(el, loot, el.dataset.tipkind === 'help' ? 'help loot' : 'loot');
    const [title, ...lines] = el.dataset.tip.split('\n');
    const rar = el.dataset.rarity;
    const col = /^#[0-9a-f]{6}$/i.test(el.dataset.color ?? '') ? ` style="color:${el.dataset.color}"` : '';
    place(el, `<b${rar ? ` class="rn r-${esc(rar)}"` : ''}${col}>${esc(title)}</b>` + lines.map(l => `<div>${esc(l)}</div>`).join(''),
          el.dataset.tipkind === 'help' ? 'help' : '');   // bulle d'aide « ? » (src/ui/help.js) : texte, pas des stats
  }
  function place(el, html, cls){
    tip.innerHTML = html;
    tip.className = cls;
    tip.hidden = false;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    /* au-dessus, sinon en dessous ; trop haute pour les deux (grand tableau de butin) : collée en haut de l'écran */
    tip.style.top = (r.top - h - 8 >= 8 ? r.top - h - 8 : r.bottom + 8 + h <= innerHeight - 8 ? r.bottom + 8 : 8) + 'px';
  }
  function hide(){ cur = null; tip.hidden = true; }
  const at = e => e.target.closest?.('[data-tip]') ?? null;

  document.addEventListener('pointerover', e => { if(e.pointerType === 'touch') return; const el = at(e); el ? show(el) : hide(); });
  /* toucher : ouvre la bulle de l'élément (ou la ferme) ; clic souris : la ferme (le clic ouvre souvent autre chose),
     sauf sur un « ? » d'aide, qui ne fait rien d'autre qu'expliquer */
  document.addEventListener('pointerdown', e => {
    const el = at(e), keep = el && (e.pointerType === 'touch' || el.dataset.tipkind === 'help');
    keep ? show(el) : hide();
  });
  /* clavier (Tab) : la bulle suit l'élément qui a le focus */
  document.addEventListener('focusin', e => { const el = at(e); if(el) show(el); });
  document.addEventListener('focusout', e => { if(at(e) === cur) hide(); });
  document.addEventListener('scroll', hide, true);
  addEventListener('blur', hide);
}
