/* Onglet Inventaire : affiche la grille de slots. Lit l'inventaire, ne le modifie jamais. */
import { INVENTORY } from '../config.js';
import { itemDef, isStackable, usedSlots, gridSize } from '../meta/inventory.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export const CAT_LABEL = { terrain:'Terrain', ore:'Minerai', treasure:'Trésor', mob:'Butin de mob', stuff:'Équipement' };

const fr = (n, d) => n.toFixed(d).replace('.', ',').replace(/,0$/, '');
/* quantité compacte pour tenir dans un slot : 950 · 9 999 · 12,3k · 456k · 1,2M */
export function fmtQty(n){
  if(n < 10000)   return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if(n < 100000)  return fr(n/1000, 1)+'k';
  if(n < 1e6)     return Math.floor(n/1000)+'k';
  if(n < 1e8)     return fr(n/1e6, 1)+'M';
  return Math.floor(n/1e6)+'M';
}
const fullQty = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function slotHtml(s, i, fresh){
  if(!s) return `<div class="slot empty" data-i="${i}"></div>`;
  const d = itemDef(s.item);
  const icon = d?.tex ? `<img src="textures/${d.tex}.png" alt="">` : `<span class="noicon">${esc(s.item.slice(0,2))}</span>`;
  const q = isStackable(s.item) ? `<span class="q">${fmtQty(s.qty)}</span>` : '';
  return `<div class="slot${fresh.has(i)?' fresh':''}" data-i="${i}" title="${esc(s.item)} × ${fullQty(s.qty)}">${icon}${q}</div>`;
}

function infoHtml(s){
  if(!s) return '<span class="mut">Survole ou clique un objet pour voir son détail.</span>';
  const d = itemDef(s.item);
  const bits = [ `<b>${esc(s.item)}</b>`, `× ${fullQty(s.qty)}` ];
  if(d) bits.push(CAT_LABEL[d.cat] || d.cat);
  if(d?.w) bits.push(`poids ${d.w}`);
  if(!isStackable(s.item)) bits.push('ne s\'empile pas');
  return bits.join(' <span class="mut">·</span> ');
}

/* fresh : slots qui viennent de recevoir des objets (mis en évidence jusqu'à la prochaine visite) */
export function renderInventory(inv, fresh=new Set()){
  const grid = $('invGrid'), n = gridSize(inv, INVENTORY.cols, INVENTORY.minSlots);
  grid.style.setProperty('--cols', INVENTORY.cols);
  let h = '';
  for(let i=0; i<n; i++) h += slotHtml(inv.slots[i] || null, i, fresh);
  grid.innerHTML = h;
  const used = usedSlots(inv);
  $('invCount').textContent = used ? `${used} slot${used>1?'s':''} utilisé${used>1?'s':''}` : 'Vide : termine une session pour remplir ton inventaire.';
  $('invInfo').innerHTML = infoHtml(null);

  let pinned = null;
  const at = e => { const c = e.target.closest('.slot'); return c ? inv.slots[+c.dataset.i] || null : undefined; };
  grid.onmouseover = e => { if(pinned) return; const s = at(e); if(s !== undefined) $('invInfo').innerHTML = infoHtml(s); };
  grid.onmouseleave = () => { if(!pinned) $('invInfo').innerHTML = infoHtml(null); };
  grid.onclick = e => {
    const c = e.target.closest('.slot'); if(!c) return;
    grid.querySelectorAll('.slot.sel').forEach(x => x.classList.remove('sel'));
    const s = inv.slots[+c.dataset.i] || null;
    pinned = (s && pinned !== s) ? s : null;
    if(pinned) c.classList.add('sel');
    $('invInfo').innerHTML = infoHtml(pinned || s);
  };
}
