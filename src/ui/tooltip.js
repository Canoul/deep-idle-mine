/* Bulle d'info commune : tout élément portant data-tip (lignes séparées par \n, la première en titre) en affiche une
   au survol de la souris, ou quand on le touche sur un écran tactile (le title natif n'y existe pas).
   Toucher ailleurs, faire défiler ou quitter l'élément la ferme. */
import { stuffTip } from '../meta/stuff.js';
import { rarityOf } from '../meta/rarity.js';
import { pieceColor } from '../meta/piece.js';
import { lootTableOf } from '../meta/loot-table.js';
import { lootTipHtml } from './loot-tip.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* Bulle au doigt (03/11/2026, Geoffrey : sur un Galaxy S24, le tableau de butin d'un Treasure T4, plus haut que l'écran,
   cachait le bouton « Ouvrir » et ne se faisait pas défiler). Au doigt, une bulle trop haute tient entre la barre du haut
   et celle du bas (top, maxHeight, en px) et défile ; sinon : au-dessus de l'élément, puis en dessous, puis en haut.
   Logique pure, testée (tests/tooltip.test.js). r : rectangle de l'élément ; h : hauteur de la bulle ; view : hauteur de
   l'écran ; top / bottom : bords de la zone libre (sous la barre du haut, au-dessus de celle du bas). */
export function tipPlace({ r, h, view, top = 0, bottom = view, touch = false, gap = 8 }){
  const lo = top + gap, hi = bottom - gap;
  if(touch && h > hi - lo) return { top: lo, maxHeight: Math.max(0, hi - lo), scroll: true };
  if(r.top - h - gap >= lo) return { top: r.top - h - gap, maxHeight: null, scroll: false };
  if(r.bottom + gap + h <= hi) return { top: r.bottom + gap, maxHeight: null, scroll: false };
  return { top: lo, maxHeight: touch ? Math.max(0, hi - lo) : null, scroll: touch };
}

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
  let cur = null, touch = false;

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
  /* zone libre : sous la barre du haut et au-dessus de la barre du bas (celle du site ou celle de l'appli) */
  const edge = (sel, side) => { const b = document.querySelector(sel)?.getBoundingClientRect(); return b?.height ? b[side] : null; };   // caché : rien
  function place(el, html, cls){
    tip.innerHTML = html + (touch ? '<p class="tipClose">Touche la bulle ou à côté pour la fermer</p>' : '');
    tip.className = cls + (touch ? ' touch' : '');
    tip.style.maxHeight = ''; tip.hidden = false;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    const top = touch ? edge('.topbar', 'bottom') ?? 0 : 0;
    const bottom = touch ? Math.min(edge('#appBar', 'top') ?? innerHeight, edge('#nav', 'top') ?? innerHeight) : innerHeight;
    const p = tipPlace({ r, h, view: innerHeight, top, bottom, touch });
    tip.style.top = p.top + 'px';
    if(p.maxHeight != null) tip.style.maxHeight = p.maxHeight + 'px';
    tip.classList.toggle('scroll', p.scroll);
    tip.scrollTop = 0;
  }
  function hide(){ cur = null; tip.hidden = true; }
  const inTip = e => tip.contains(e.target);
  /* au doigt, la bulle se touche : un appui (sans défiler) la ferme ; on peut la faire défiler. Seulement un appui
     COMMENCÉ sur la bulle : celle qui vient de s'ouvrir sous le doigt reçoit le clic de l'appui qui l'a ouverte */
  let downInTip = false;
  tip.addEventListener('click', () => { if(touch && downInTip) hide(); downInTip = false; });
  const at = e => e.target.closest?.('[data-tip]') ?? null;

  document.addEventListener('pointerover', e => { if(e.pointerType === 'touch') return; const el = at(e); el ? show(el) : hide(); });
  /* toucher : ouvre la bulle de l'élément (ou la ferme) ; clic souris : la ferme (le clic ouvre souvent autre chose),
     sauf sur un « ? » d'aide, qui ne fait rien d'autre qu'expliquer */
  document.addEventListener('pointerdown', e => {
    downInTip = inTip(e);
    if(downInTip) return;                                  // on fait défiler la bulle : elle reste
    touch = e.pointerType === 'touch';
    const el = at(e), keep = el && (touch || el.dataset.tipkind === 'help');
    keep ? show(el) : hide();
  });
  /* clavier (Tab) : la bulle suit l'élément qui a le focus */
  document.addEventListener('focusin', e => { const el = at(e); if(el){ touch = false; show(el); } });
  document.addEventListener('focusout', e => { if(at(e) === cur) hide(); });
  document.addEventListener('scroll', e => { if(e.target !== tip) hide(); }, true);
  addEventListener('blur', hide);
}
