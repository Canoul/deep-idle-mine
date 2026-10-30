/* Onglet Inventaire : affiche la grille de slots. Lit l'inventaire, ne le modifie jamais : ouvrir un treasure
   (onOpen), utiliser un blueprint (onLearn), équiper une pièce (onEquip), trier (onSort) ou glisser un objet dans un
   autre slot (onMove) est demandé au serveur, qui renvoie le nouvel inventaire. */
import { INVENTORY, STUFF, TREASURE, RUNE } from '../config.js';
import { itemDef, isStackable, usedSlots, gridSize, countOf } from '../meta/inventory.js';
import { canOpen } from '../meta/loot.js';
import { unlockOf, unlockError } from '../meta/furnace.js';
import { recipeOfBlueprint, isUnlocked, recyclable, recycleRefund, recycleRange } from '../meta/craft.js';
import { statLines, equipSlotFor } from '../meta/stuff.js';
import { tipAttr } from './tooltip.js';
import { pieceName } from '../meta/piece.js';
import { rcls, rname, rlabel, pname } from './rarity.js';
import { glyphInfo } from '../meta/glyphs.js';
import { pxi } from './pxicons.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export const CAT_LABEL = { terrain:'Terrain', bloc:'Bloc', residu:'Résidu', rune:'Rune', ore:'Minerai', treasure:'Treasure', blueprint:'Blueprint', gem:'Gemme',
                           mob:'Butin de mob', stuff:'Équipement',
                           combustible:'Combustible', ingot:'Lingot', material:'Matériau', furnace:'Four', scroll:'Parchemin de sort', glyph:'Glyphe', key:'Clé' };
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
  const q = isStackable(s.item) ? `<span class="q">${fmtQty(s.qty)}</span>` : s.plus > 0 ? `<span class="q">+${s.plus}</span>` : '';
  return `<div class="slot${rcls(s.item)}${fresh.has(i)?' fresh':''}" data-i="${i}" draggable="true"${tipAttr(s.item, `${pieceName(s)} × ${fullQty(s.qty)}`, s.uid != null ? s : null)}>${iconHtml(s.item)}${q}</div>`;
}

/* blueprint : bouton « Utiliser » (débloque sa recette), ou pourquoi on ne peut pas */
function blueprintHtml(inv, s){
  if(itemDef(s.item)?.cat !== 'blueprint' || s.item === 'Blueprint parts') return '';
  const r = recipeOfBlueprint(s.item);
  if(!r) return ' <span class="mut small">ne débloque rien pour l\'instant</span>';
  if(isUnlocked(r, inv)) return ` <span class="mut small">recette « ${esc(r)} » déjà débloquée</span>`;
  return ` <button class="on invLearn" data-item="${esc(s.item)}" title="Le blueprint est consommé, la recette reste débloquée pour toujours">Utiliser</button>`;
}

/* pièce de stuff : bouton « Équiper » (dans sa case ; la pièce qui y est revient dans l'inventaire). Un anneau va dans
   la case qui porte déjà le même anneau, sinon dans une case vide (src/meta/stuff.js equipSlotFor) */
export function equipHtml(s, worn){
  const slot = equipSlotFor(s.item, worn ?? {});
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
  if(e) return ` <span class="mut small">${esc(UNLOCK_WHY[e] ?? 'inutilisable')}</span>`;
  return ` <button class="on invUnlock" data-item="${esc(s.item)}" title="L'objet est consommé : le four ${d.slot + 1} s'ouvre pour toujours">Utiliser</button>`+
         ` <span class="mut small">ouvre le four ${d.slot + 1}</span>`;
}

/* pièce de stuff fabriquée (ou butin de mob à recyclage fixe), rune : bouton « Recycler » (une fenêtre demande de confirmer) */
const recycleHtml = s => s.uid != null && recyclable(s.item)
  ? ` <button class="invRecycle" data-uid="${s.uid}" title="${recycleRange(s.item) ? 'Détruit la rune et rend de la Poudre de rêve' : 'Détruit la pièce et rend une partie de ses matériaux'}">♻ Recycler</button>` : '';

function infoHtml(s, pinned=false, inv=null, worn=null, furn=null){
  if(!s) return '<span class="mut">Survole ou clique un objet pour voir son détail.</span>';
  const d = itemDef(s.item);
  const piece = s.uid != null ? s : null;
  const bits = [ piece ? pname(piece, 'b') : rname(s.item, undefined, 'b'), `× ${fullQty(s.qty)}` ];
  if(d) bits.push(CAT_LABEL[d.cat] || d.cat);
  bits.push(rlabel(s.item));
  if(!isStackable(s.item)) bits.push('ne s\'empile pas');
  if(piece && !piece.q) bits.push('<span class="mut">non identifiée</span>');
  const stats = statLines(piece ?? s.item);
  const n = inv ? countOf(inv, s.item) : 0;
  const open = pinned && canOpen(s.item) ? ` <button class="on invOpen" data-item="${esc(s.item)}">Ouvrir</button>`+
    (n > 1 ? ` <button class="on invOpen" data-item="${esc(s.item)}" data-all="1" title="Ouvre tous tes ${esc(s.item)} d'un coup">Ouvrir tout (${fullQty(Math.min(n, TREASURE.openAllMax))})</button>` : '') : '';
  const learn = pinned && inv ? blueprintHtml(inv, s) : '';
  const equip = pinned && worn ? equipHtml(s, worn) : '';
  const unlock = pinned ? unlockHtml(s, furn) : '';
  const recycle = pinned ? recycleHtml(s) : '';
  const acts = open + learn + equip + unlock + recycle;
  /* trois blocs (28/10/2026, Geoffrey) : description, puis les stats (une par ligne), puis les boutons */
  return `<div class="iiDesc">${bits.join(' <span class="mut">·</span> ')}</div>`+
    (stats.length ? `<ul class="iiStats stuffStats">${stats.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '')+
    (glyphInfo(s.item) ? `<p class="iiStats stuffStats">${esc(glyphInfo(s.item))}</p>` : '')+   // glyphe : skill visé, effet
    (acts ? `<div class="iiActs">${acts}</div>` : '');
}

/* onglet d'un objet (INVENTORY.tabs, 29/10/2026) : le premier qui le cite, sinon celui de sa catégorie, sinon le dernier */
export function tabOf(item, tabs = INVENTORY.tabs){
  const cat = itemDef(item)?.cat, list = tabs.filter(t => t.id !== 'all');
  return (list.find(t => t.items?.includes(item)) ?? list.find(t => t.cats?.includes(cat)) ?? list[list.length - 1]).id;
}
/* slots montrés par l'onglet tab : tous (avec les vides) pour « all », sinon les objets de l'onglet, sans trou */
export function tabSlots(inv, tab, n){
  if(tab === 'all') return Array.from({ length:n }, (_, i) => i);
  return inv.slots.map((s, i) => s && tabOf(s.item) === tab ? i : -1).filter(i => i >= 0);
}
let tab = 'all';   // onglet ouvert (gardé d'un affichage à l'autre)
function tabsHtml(inv){
  const n = {}; for(const s of inv.slots) if(s){ const t = tabOf(s.item); n[t] = (n[t] || 0) + 1; }
  return INVENTORY.tabs.map(t => {
    const icon = t.px ? pxi(t.px) : iconHtml(t.icon), c = t.id === 'all' ? usedSlots(inv) : n[t.id] || 0;
    return `<button class="invTab${t.id === tab ? ' on' : ''}${c ? '' : ' none'}" data-tab="${t.id}" role="tab" aria-selected="${t.id === tab}" `+
           `aria-label="${esc(t.name)}" data-tip="${esc(t.name)}\n${c} slot${c > 1 ? 's' : ''}">${icon}</button>`;
  }).join('');
}

/* fresh : slots qui viennent de recevoir des objets (mis en évidence jusqu'à la prochaine visite) ;
   actions : sur l'objet sélectionné (chacune a son bouton) : onOpen(item) ouvrir un treasure, onLearn(item) utiliser
   un blueprint, onEquip(slot, uid) équiper une pièce de stuff, onSort() trier, onMove({ from, to, item, uid }) déplacer
   (glisser-déposer : l'objet en to, s'il y en a un, prend la place de from) ; worn() : pièces portées (pour dire ce qui
   est remplacé) */
export function renderInventory(inv, fresh=new Set(), actions={}){
  const grid = $('invGrid'), n = gridSize(inv, INVENTORY.cols, INVENTORY.minSlots);
  grid.style.setProperty('--cols', INVENTORY.cols);
  const draw = () => {
    $('invTabs').innerHTML = tabsHtml(inv);
    const shown = tabSlots(inv, tab, n);
    grid.innerHTML = shown.map(i => slotHtml(inv.slots[i] || null, i, fresh)).join('') ||
      `<p class="mut invNone">Rien dans « ${esc(INVENTORY.tabs.find(t => t.id === tab)?.name ?? '')} ».</p>`;
  };
  draw();
  $('invTabs').onclick = e => { const b = e.target.closest('[data-tab]'); if(b && b.dataset.tab !== tab){ tab = b.dataset.tab; draw(); } };
  const used = usedSlots(inv);
  $('invCount').textContent = used ? `${used} slot${used>1?'s':''} utilisé${used>1?'s':''}` : 'Vide : termine une session pour remplir ton inventaire.';
  $('invInfo').innerHTML = infoHtml(null);

  let pinned = null;
  const at = e => { const c = e.target.closest('.slot'); return c ? inv.slots[+c.dataset.i] || null : undefined; };
  /* survol : souris seulement. Sur un écran tactile, le survol simulé au premier appui changeait la fiche et l'iPhone
     avalait le clic : la pièce n'était jamais choisie, donc pas de bouton « Équiper » (30/10, Geoffrey) */
  const hover = !matchMedia('(hover: none)').matches;
  grid.onmouseover = e => { if(pinned || !hover) return; const s = at(e); if(s !== undefined) $('invInfo').innerHTML = infoHtml(s); };
  grid.onmouseleave = () => { if(!pinned && hover) $('invInfo').innerHTML = infoHtml(null); };
  grid.onclick = e => {
    const c = e.target.closest('.slot'); if(!c) return;
    grid.querySelectorAll('.slot.sel').forEach(x => x.classList.remove('sel'));
    const s = inv.slots[+c.dataset.i] || null;
    pinned = (s && pinned !== s) ? s : null;
    if(pinned) c.classList.add('sel');
    $('invInfo').innerHTML = infoHtml(pinned || s, !!pinned, inv, actions.worn?.(), actions.furnaces?.());
    /* petit écran : la fiche (et ses boutons Équiper, Ouvrir…) est sous la grille, on la fait venir à l'écran */
    if(pinned && matchMedia('(max-width: 1100px)').matches) $('invInfo').scrollIntoView({ behavior:'smooth', block:'nearest' });
  };
  $('invSort').disabled = !used;
  $('invSort').onclick = () => { $('invSort').disabled = true; actions.onSort?.(); };
  /* glisser-déposer : on lâche sur n'importe quel slot de la grille (vide ou non) */
  let drag = null;
  const over = (c, on) => c?.classList.toggle('dropTo', on);
  grid.ondragstart = e => { const c = e.target.closest('.slot'); drag = c && inv.slots[+c.dataset.i] ? +c.dataset.i : null;
                            if(drag === null) return e.preventDefault(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(drag)); };
  grid.ondragover = e => { if(drag !== null && e.target.closest('.slot')) e.preventDefault(); };
  grid.ondragenter = e => { if(drag !== null) over(e.target.closest('.slot'), true); };
  grid.ondragleave = e => { const c = e.target.closest('.slot'); if(c && !c.contains(e.relatedTarget)) over(c, false); };
  grid.ondragend = () => { drag = null; grid.querySelectorAll('.dropTo').forEach(c => over(c, false)); };
  grid.ondrop = e => {
    e.preventDefault();
    const c = e.target.closest('.slot'), from = drag; drag = null;
    grid.querySelectorAll('.dropTo').forEach(x => over(x, false));
    if(!c || from === null || +c.dataset.i === from) return;
    const s = inv.slots[from];
    actions.onMove?.({ from, to: +c.dataset.i, item: s.item, ...(s.uid != null ? { uid: s.uid } : {}) });
  };
  $('invInfo').onclick = e => {
    const b = e.target.closest('.invOpen, .invLearn, .invEquip, .invUnlock, .invRecycle');
    if(!b) return;
    if(b.classList.contains('invRecycle')){         // rien n'est envoyé avant la confirmation
      const s = inv.slots.find(x => x?.uid === +b.dataset.uid);
      if(s) showRecycle(s, actions.setsOf?.(s.uid) ?? [], () => actions.onRecycle?.(s.uid));
      return;
    }
    b.disabled = true;               // un clic = une demande
    if(b.classList.contains('invOpen')) actions.onOpen?.(b.dataset.item, !!b.dataset.all);
    else if(b.classList.contains('invLearn')) actions.onLearn?.(b.dataset.item);
    else if(b.classList.contains('invUnlock')) actions.onUnlock?.(b.dataset.item);
    else actions.onEquip?.(b.dataset.slot, +b.dataset.uid);
  };
}

/* fenêtre de recyclage : ce que la pièce rend (60 % de sa recette, arrondi vers le bas) et ce qui est perdu ; si elle
   est dans un set, on prévient seulement (le serveur refuserait de toute façon) */
export function showRecycle(piece, sets, onOk){
  const box = $('loot'), close = () => { box.hidden = true; };
  const title = `<h3>${iconHtml(piece.item)} ${pname(piece)}</h3>`;
  if(sets.length){
    box.querySelector('.box').innerHTML = title +
      `<p>Impossible de recycler cette pièce : elle est enregistrée dans ${sets.length > 1 ? 'les sets' : 'le set'} ${sets.map(n => `« ${esc(n)} »`).join(', ')}.</p>`+
      `<p class="mut small">Enregistre ce set avec une autre pièce, ou supprime-le (onglet Stuff), puis recycle-la.</p>`+
      `<p style="text-align:right"><button class="on" id="recOk">OK</button></p>`;
    box.hidden = false; $('recOk').onclick = close;
    return;
  }
  const range = recycleRange(piece.item);
  if(range){                                   // rune ou fragment (29/10/2026) : Poudre de rêve, quantité tirée au recyclage
    const frag = piece.item !== RUNE.item;
    box.querySelector('.box').innerHTML = title + `<p>Recycler ${frag ? 'ce fragment' : 'cette rune'} ? ${frag ? 'Il' : 'Elle'} sera <b>détrui${frag ? 't' : 'te'}</b>, avec ses lignes. Tu récupères :</p>`+
      `<div class="lootList"><div class="lootRow">${iconHtml(range.item)}${rname(range.item)}<b>× ${range.min} à ${range.max}</b></div></div>`+
      `<p style="text-align:right"><button id="recNo">Annuler</button> <button class="on" id="recYes">♻ Recycler</button></p>`;
    box.hidden = false;
    $('recNo').onclick = close;
    $('recYes').onclick = () => { $('recYes').disabled = true; close(); onOk(); };
    return;
  }
  const refund = recycleRefund(piece.item), names = Object.keys(refund);
  const lost = [piece.plus > 0 && `son amélioration +${piece.plus}`, piece.rune && 'sa rune', piece.q && 'sa qualité'].filter(Boolean);
  box.querySelector('.box').innerHTML = title + '<p>Recycler cette pièce ? Elle sera <b>détruite</b>. Tu récupères :</p>'+
    (names.length ? `<div class="lootList">${names.map(n => `<div class="lootRow">${iconHtml(n)}${rname(n)}<b>× ${fullQty(refund[n])}</b></div>`).join('')}</div>`
                  : '<p class="mut">rien (chaque ingrédient de sa recette ne rend que 60 %, arrondi vers le bas)</p>')+
    (lost.length ? `<p class="err small">Perdu avec elle : ${lost.join(', ')}.</p>` : '')+
    `<p style="text-align:right"><button id="recNo">Annuler</button> <button class="on" id="recYes">♻ Recycler</button></p>`;
  box.hidden = false;
  $('recNo').onclick = close;
  $('recYes').onclick = () => { $('recYes').disabled = true; close(); onOk(); };
}

/* fenêtre « treasure ouvert » : le butin, objets rares en tête */
export function showLoot(item, loot, onClose, count = 1){
  const names = Object.keys(loot).sort((a, b) => isRare(b) - isRare(a));
  const rows = names.map(n => `<div class="lootRow${isRare(n)?' rare':''}">${iconHtml(n)}${rname(n)}`+
                              `<b>× ${fullQty(loot[n])}</b></div>`).join('');
  const box = $('loot');
  box.querySelector('.box').innerHTML = `<h3>${iconHtml(item)} ${count > 1 ? `${fullQty(count)} × ${rname(item)} ouverts !` : `${rname(item)} ouvert !`}</h3>`+
    (names.some(isRare) ? '<div class="lootRare">✨ Objet rare !</div>' : '') +
    `<div class="lootList">${rows}</div><p style="text-align:right"><button class="on" id="lootOk">OK</button></p>`;
  box.hidden = false;
  $('lootOk').onclick = () => { box.hidden = true; onClose?.(); };
}

export function lootError(msg){
  $('invInfo').innerHTML = `<span class="err">${esc(msg)}</span>`;
}
