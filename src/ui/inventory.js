/* Onglet Inventaire : affiche la grille de slots. Lit l'inventaire, ne le modifie jamais : ouvrir un treasure
   est demandé au serveur (onOpen), qui renvoie le nouvel inventaire. */
import { INVENTORY } from '../config.js';
import { itemDef, isStackable, usedSlots, gridSize } from '../meta/inventory.js';
import { canOpen } from '../meta/loot.js';
import { statsText } from '../meta/stuff.js';
import { tipAttr } from './tooltip.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export const CAT_LABEL = { terrain:'Terrain', ore:'Minerai', treasure:'Treasure', blueprint:'Blueprint', gem:'Gemme',
                           mob:'Butin de mob', stuff:'Équipement',
                           combustible:'Combustible', ingot:'Lingot' };
/* objets rares du butin : mis en avant dans la fenêtre d'ouverture */
const RARE = new Set(['blueprint', 'gem']);
const isRare = item => RARE.has(itemDef(item)?.cat) && item !== 'Blueprint parts';
const iconHtml = item => {
  const d = itemDef(item);
  return d?.tex ? `<img src="textures/${d.tex}.png" alt="">` : `<span class="noicon">${esc(item.slice(0,2))}</span>`;
};

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
  const q = isStackable(s.item) ? `<span class="q">${fmtQty(s.qty)}</span>` : '';
  return `<div class="slot${fresh.has(i)?' fresh':''}" data-i="${i}"${tipAttr(s.item, `${s.item} × ${fullQty(s.qty)}`)}>${iconHtml(s.item)}${q}</div>`;
}

function infoHtml(s, pinned=false){
  if(!s) return '<span class="mut">Survole ou clique un objet pour voir son détail.</span>';
  const d = itemDef(s.item);
  const bits = [ `<b>${esc(s.item)}</b>`, `× ${fullQty(s.qty)}` ];
  if(d) bits.push(CAT_LABEL[d.cat] || d.cat);
  if(d?.w) bits.push(`poids ${d.w}`);
  if(!isStackable(s.item)) bits.push('ne s\'empile pas');
  if(statsText(s.item)) bits.push(`<span class="stuffStats">${esc(statsText(s.item))}</span>`);
  const open = pinned && canOpen(s.item) ? ` <button class="on invOpen" data-item="${esc(s.item)}">Ouvrir</button>` : '';
  return bits.join(' <span class="mut">·</span> ') + open;
}

/* fresh : slots qui viennent de recevoir des objets (mis en évidence jusqu'à la prochaine visite) ;
   onOpen(item) : le joueur demande à ouvrir un treasure (le bouton apparaît sur un treasure sélectionné) */
export function renderInventory(inv, fresh=new Set(), onOpen=null){
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
    $('invInfo').innerHTML = infoHtml(pinned || s, !!pinned);
  };
  $('invInfo').onclick = e => {
    const b = e.target.closest('.invOpen');
    if(!b || !onOpen) return;
    b.disabled = true;               // un clic = une demande
    onOpen(b.dataset.item);
  };
}

/* fenêtre « treasure ouvert » : le butin, objets rares en tête */
export function showLoot(item, loot, onClose){
  const names = Object.keys(loot).sort((a, b) => isRare(b) - isRare(a));
  const rows = names.map(n => `<div class="lootRow${isRare(n)?' rare':''}">${iconHtml(n)}<span>${esc(n)}</span>`+
                              `<b>× ${fullQty(loot[n])}</b></div>`).join('');
  const box = $('loot');
  box.querySelector('.box').innerHTML = `<h3>${iconHtml(item)} ${esc(item)} ouvert !</h3>`+
    (names.some(isRare) ? '<div class="lootRare">✨ Objet rare !</div>' : '') +
    `<div class="lootList">${rows}</div><p style="text-align:right"><button class="on" id="lootOk">OK</button></p>`;
  box.hidden = false;
  $('lootOk').onclick = () => { box.hidden = true; onClose?.(); };
}

export function lootError(msg){
  $('invInfo').innerHTML = `<span class="err">${esc(msg)}</span>`;
}
