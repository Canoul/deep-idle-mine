/* Bulle d'info commune : tout élément portant data-tip (lignes séparées par \n, la première en titre) en affiche une
   au survol de la souris, ou quand on le touche sur un écran tactile (le title natif n'y existe pas).
   Toucher ailleurs, faire défiler ou quitter l'élément la ferme. */
import { stuffTip } from '../meta/stuff.js';
import { rarityOf } from '../meta/rarity.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* attribut à mettre sur l'icône d'un objet : bulle pour le stuff, title natif sinon */
export function tipAttr(item, title = item){
  const t = stuffTip(item);
  return t ? ` data-tip="${esc(t)}" data-rarity="${rarityOf(item)}"` : ` title="${esc(title)}"`;
}

export function setupTooltips(){
  const tip = document.createElement('div');
  tip.id = 'tip'; tip.hidden = true;
  document.body.append(tip);
  let cur = null;

  function show(el){
    if(el === cur && !tip.hidden) return;
    cur = el;
    const [title, ...lines] = el.dataset.tip.split('\n');
    const rar = el.dataset.rarity;
    tip.innerHTML = `<b${rar ? ` class="rn r-${esc(rar)}"` : ''}>${esc(title)}</b>` + lines.map(l => `<div>${esc(l)}</div>`).join('');
    tip.hidden = false;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    tip.style.top = (r.top - h - 8 >= 8 ? r.top - h - 8 : r.bottom + 8) + 'px';   // au-dessus, sinon en dessous
  }
  function hide(){ cur = null; tip.hidden = true; }
  const at = e => e.target.closest?.('[data-tip]') ?? null;

  document.addEventListener('pointerover', e => { if(e.pointerType === 'touch') return; const el = at(e); el ? show(el) : hide(); });
  /* toucher : ouvre la bulle de l'élément (ou la ferme) ; clic souris : la ferme (le clic ouvre souvent autre chose) */
  document.addEventListener('pointerdown', e => { const el = e.pointerType === 'touch' ? at(e) : null; el ? show(el) : hide(); });
  document.addEventListener('scroll', hide, true);
  addEventListener('blur', hide);
}
