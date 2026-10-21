/* Onglet Inventaire : affiche la grille de slots. Lit l'inventaire, ne le modifie jamais : ouvrir un treasure
   (onOpen), utiliser un blueprint (onLearn) ou équiper une pièce (onEquip) est demandé au serveur, qui renvoie le
   nouvel inventaire. */
import { INVENTORY, STUFF } from '../config.js';
import { itemDef, isStackable, usedSlots, gridSize } from '../meta/inventory.js';
import { canOpen } from '../meta/loot.js';
import { unlockOf, unlockError } from '../meta/furnace.js';
import { recipeOfBlueprint, isUnlocked } from '../meta/craft.js';
import { statsText, slotOf } from '../meta/stuff.js';
import { tipAttr } from './tooltip.js';
import { rcls, rname, rlabel } from './rarity.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export const CAT_LABEL = { terrain:'Terrain', ore:'Minerai', treasure:'Treasure', blueprint:'Blueprint', gem:'Gemme',
                           mob:'Butin de mob', stuff:'Équipement',
                           combustible:'Combustible', ingot:'Lingot', material:'Matériau', furnace:'Four' };
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
  return `<div class="slot${rcls(s.item)}${fresh.has(i)?' fresh':''}" data-i="${i}"${tipAttr(s.item, `${s.item} × ${fullQty(s.qty)}`)}>${iconHtml(s.item)}${q}</div>`;
}

/* blueprint : bouton « Utiliser » (débloque sa recette), ou pourquoi on ne peut pas */
function blueprintHtml(inv, s){
  if(itemDef(s.item)?.cat !== 'blueprint' || s.item === 'Blueprint parts') return '';
  const r = recipeOfBlueprint(s.item);
  if(!r) return ' <span class="mut">· ne débloque rien pour l\'instant</span>';
  if(isUnlocked(r, inv)) return ` <span class="mut">· recette « ${esc(r)} » déjà débloquée</span>`;
  return ` <button class="on invLearn" data-item="${esc(s.item)}" title="Le blueprint est consommé, la recette reste débloquée pour toujours">Utiliser</button>`;
}

/* pièce de stuff : bouton « Équiper » (dans sa case ; la pièce qui y est revient dans l'inventaire) */
export function equipHtml(s, worn){
  const slot = slotOf(s.item);
  if(!slot || s.uid == null) return '';
  const label = STUFF.slots.find(x => x.id === slot)?.label ?? slot, cur = worn?.[slot]?.item;
  return ` <button class="on invEquip" data-uid="${s.uid}" data-slot="${slot}">Équiper</button>`+
         ` <span class="mut small">case ${esc(label.toLowerCase())}${cur ? ` · remplace ${esc(cur)}` : ''}</span>`;
}

/* objet de four (Four en fer) : bouton « Utiliser » qui ouvre le four suivant, ou pourquoi on ne peut pas */
const UNLOCK_WHY = { already_unlocked:'four déjà débloqué', locked_before:'débloque d\'abord le four d\'avant' };
function unlockHtml(s, furn){
  const d = unlockOf(s.item);
  if(!d || !furn) return '';
  const e = unlockError(furn, s.item);
  if(e) return ` <span class="mut">· ${esc(UNLOCK_WHY[e] ?? 'inutilisable')}</span>`;
  return ` <button class="on invUnlock" data-item="${esc(s.item)}" title="L'objet est consommé : le four ${d.slot + 1} s'ouvre pour toujours">Utiliser</button>`+
         ` <span class="mut small">ouvre le four ${d.slot + 1}</span>`;
}

function infoHtml(s, pinned=false, inv=null, worn=null, furn=null){
  if(!s) return '<span class="mut">Survole ou clique un objet pour voir son détail.</span>';
  const d = itemDef(s.item);
  const bits = [ rname(s.item, s.item, 'b'), `× ${fullQty(s.qty)}` ];
  if(d) bits.push(CAT_LABEL[d.cat] || d.cat);
  bits.push(rlabel(s.item));
  if(d?.w) bits.push(`poids ${d.w}`);
  if(!isStackable(s.item)) bits.push('ne s\'empile pas');
  if(statsText(s.item)) bits.push(`<span class="stuffStats">${esc(statsText(s.item))}</span>`);
  const open = pinned && canOpen(s.item) ? ` <button class="on invOpen" data-item="${esc(s.item)}">Ouvrir</button>` : '';
  const learn = pinned && inv ? blueprintHtml(inv, s) : '';
  const equip = pinned && worn ? equipHtml(s, worn) : '';
  const unlock = pinned ? unlockHtml(s, furn) : '';
  return bits.join(' <span class="mut">·</span> ') + open + learn + equip + unlock;
}

/* fresh : slots qui viennent de recevoir des objets (mis en évidence jusqu'à la prochaine visite) ;
   actions : sur l'objet sélectionné (chacune a son bouton) : onOpen(item) ouvrir un treasure, onLearn(item) utiliser
   un blueprint, onEquip(slot, uid) équiper une pièce de stuff ; worn() : pièces portées (pour dire ce qui est remplacé) */
export function renderInventory(inv, fresh=new Set(), actions={}){
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
    $('invInfo').innerHTML = infoHtml(pinned || s, !!pinned, inv, actions.worn?.(), actions.furnaces?.());
  };
  $('invInfo').onclick = e => {
    const b = e.target.closest('.invOpen, .invLearn, .invEquip, .invUnlock');
    if(!b) return;
    b.disabled = true;               // un clic = une demande
    if(b.classList.contains('invOpen')) actions.onOpen?.(b.dataset.item);
    else if(b.classList.contains('invLearn')) actions.onLearn?.(b.dataset.item);
    else if(b.classList.contains('invUnlock')) actions.onUnlock?.(b.dataset.item);
    else actions.onEquip?.(b.dataset.slot, +b.dataset.uid);
  };
}

/* fenêtre « treasure ouvert » : le butin, objets rares en tête */
export function showLoot(item, loot, onClose){
  const names = Object.keys(loot).sort((a, b) => isRare(b) - isRare(a));
  const rows = names.map(n => `<div class="lootRow${isRare(n)?' rare':''}">${iconHtml(n)}${rname(n)}`+
                              `<b>× ${fullQty(loot[n])}</b></div>`).join('');
  const box = $('loot');
  box.querySelector('.box').innerHTML = `<h3>${iconHtml(item)} ${rname(item)} ouvert !</h3>`+
    (names.some(isRare) ? '<div class="lootRare">✨ Objet rare !</div>' : '') +
    `<div class="lootList">${rows}</div><p style="text-align:right"><button class="on" id="lootOk">OK</button></p>`;
  box.hidden = false;
  $('lootOk').onclick = () => { box.hidden = true; onClose?.(); };
}

export function lootError(msg){
  $('invInfo').innerHTML = `<span class="err">${esc(msg)}</span>`;
}
