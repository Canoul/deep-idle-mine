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
import { rcls, rname, rlabel, pname, runeMark, rframe } from './rarity.js';
import { glyphInfo } from '../meta/glyphs.js';
import { pxi } from './pxicons.js';
import { lootHelp } from './loot-tip.js';
import { lootTableOf } from '../meta/loot-table.js';

const $ = id => document.getElementById(id);
/* dans l'appli mobile (classe app, src/app/boot.js) : slots plus petits, pas de survol */
const inApp = () => !!globalThis.document?.body?.classList.contains('app');
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
/* une décimale arrondie vers le bas : 2,2 pour 2,29 (jamais plus qu'on n'a) */
const floor1 = n => fr(Math.floor(n * 10) / 10, 1);
/* quantité compacte pour tenir dans un slot : 950 · 9 999 · 12,3k · 456k · 1,2M */
export function fmtQty(n, { short = false } = {}){
  /* short (appli, 03/11/2026) : 4 caractères au plus, arrondi vers le bas : 999 · 2,2k · 12k · 456k · 1,2M · 12M */
  if(short){
    if(n < 1000) return String(n);
    if(n < 1e4)  return floor1(n/1000)+'k';
    if(n < 1e6)  return Math.floor(n/1000)+'k';
    if(n < 1e7)  return floor1(n/1e6)+'M';
    return Math.floor(n/1e6)+'M';
  }
  if(n < 10000)   return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if(n < 100000)  return fr(n/1000, 1)+'k';
  if(n < 1e6)     return Math.floor(n/1000)+'k';
  if(n < 1e8)     return fr(n/1e6, 1)+'M';
  return Math.floor(n/1e6)+'M';
}
const fullQty = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* Pièces simples empilées à l'affichage (04/11/2026, Geoffrey) : une pièce de stuff non identifiée, sans amélioration ni
   rune (isPlainPiece) ne se distingue pas d'une autre du même objet ; toutes celles d'un même objet tiennent dans UNE case
   (× n), à la place de la première. Chacune garde son uid dans l'inventaire du serveur (rien ne change pour l'équiper, la
   recycler, un set ou un craft) : c'est l'affichage qui les regroupe. Logique pure, testée (tests/inventory-stack.test.js). */
export const isPlainPiece = s => !!s && s.uid != null && !isStackable(s.item) && !s.q && !(s.plus > 0) && !s.rune && !(s.lines?.length);
/* cases à dessiner pour ces slots (shown : indices) : [{ i, uids? }] ; uids : les pièces simples regroupées sur la case i.
   Les cases libérées par le regroupement sont rendues en fin de grille (extra : indices libres au-delà de l'inventaire) */
export function inventoryCells(inv, shown){
  const cells = [], groups = new Map();
  for(const i of shown){
    const s = inv.slots[i];
    if(isPlainPiece(s)){
      const g = groups.get(s.item);
      if(g){ g.uids.push(s.uid); continue; }
      const c = { i, uids:[s.uid] }; groups.set(s.item, c); cells.push(c); continue;
    }
    cells.push({ i });
  }
  const hidden = shown.length - cells.length, all = shown.length && shown.every((v, k) => v === k);
  if(all) for(let k = 0; k < hidden; k++) cells.push({ i: Math.max(inv.slots.length, shown.length) + k });   // « Tout » : la grille garde sa taille
  return cells;
}

export function slotHtml(s, i, fresh, n = 1){   // exportée : banque de guilde (05/11)
  if(!s) return `<div class="slot empty" data-i="${i}"></div>`;
  const q = isStackable(s.item) ? `<span class="q">${fmtQty(s.qty, { short:inApp() })}</span>` : n > 1 ? `<span class="q">${fmtQty(n, { short:inApp() })}</span>` : s.plus > 0 ? `<span class="q">+${s.plus}</span>` : '';
  return `<div class="slot${rcls(s.item)}${fresh.has(i)?' fresh':''}"${rframe(s)} data-i="${i}" draggable="true"${tipAttr(s.item, `${pieceName(s)} × ${fullQty(n > 1 ? n : s.qty)}`, s.uid != null ? s : null)}>${iconHtml(s.item)}${runeMark(s)}${q}</div>`;
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
const recycleHtml = (s, group = null) => s.uid != null && recyclable(s.item)
  ? ` <button class="invRecycle" data-uid="${s.uid}" title="${recycleRange(s.item) ? 'Détruit la rune et rend de la Poudre de rêve' : 'Détruit la pièce et rend une partie de ses matériaux'}">♻ Recycler</button>`+
    (group?.length > 1 ? ` <button class="invRecycle" data-uid="${s.uid}" data-all="1" title="Détruit les ${group.length} pièces (sauf celles d'un set) et rend une partie de leurs matériaux">♻ Recycler tout (${group.length})</button>` : '')   // pièces simples empilées (04/11)
  : '';

/* déplacer un objet (glisser-déposer du PC, bouton « Déplacer » de l'appli) : la demande envoyée au serveur, ou null s'il n'y a
   rien à faire (même case, case de départ vide). L'objet de la case d'arrivée, s'il y en a un, prend la place de from. */
export function moveOp(inv, from, to){
  const s = inv.slots[from];
  if(!s || from === to) return null;
  return { from, to, item:s.item, ...(s.uid != null ? { uid:s.uid } : {}) };
}

/* moveFrom (appli, 04/11/2026) : case de l'objet choisi, pour le bouton « Déplacer » (au doigt, pas de glisser-déposer) */
/* group : uids des pièces simples empilées dans cette case (04/11/2026) ; leur nombre remplace la quantité */
export function infoHtml(s, pinned=false, inv=null, worn=null, furn=null, moveFrom=null, group=null){
  if(!s) return inApp()
    ? '<span class="mut">Touche un objet pour voir son détail.</span>'
    : '<span class="mut">Survole ou clique un objet pour voir son détail.</span>';
  const d = itemDef(s.item);
  const piece = s.uid != null ? s : null;
  const bits = [ piece ? pname(piece, 'b') : rname(s.item, undefined, 'b'), `× ${fullQty(group?.length > 1 ? group.length : s.qty)}` ];
  if(d) bits.push(CAT_LABEL[d.cat] || d.cat);
  bits.push(rlabel(s.item));
  if(!isStackable(s.item)) bits.push(isPlainPiece(s) ? 's\'empile tant qu\'elle n\'est pas identifiée' : 'ne s\'empile pas');
  if(piece && !piece.q) bits.push('<span class="mut">non identifiée</span>');
  const stats = statLines(piece ?? s.item);
  const n = inv ? countOf(inv, s.item) : 0;
  const open = pinned && canOpen(s.item) ? ` <button class="on invOpen" data-item="${esc(s.item)}">Ouvrir</button>`+
    (n > 1 ? ` <button class="on invOpen" data-item="${esc(s.item)}" data-all="1" title="Ouvre tous tes ${esc(s.item)} d'un coup">Ouvrir tout (${fullQty(Math.min(n, TREASURE.openAllMax))})</button>` : '') : '';
  const learn = pinned && inv ? blueprintHtml(inv, s) : '';
  const equip = pinned && worn ? equipHtml(s, worn) : '';
  const unlock = pinned ? unlockHtml(s, furn) : '';
  const recycle = pinned ? recycleHtml(s, group) : '';
  const move = pinned && Number.isInteger(moveFrom) ? ` <button class="invMove" data-i="${moveFrom}" title="Puis touche la case où le poser">↔ Déplacer</button>` : '';
  const loot = lootTableOf(s.item) ? ' ' + lootHelp(`item:${s.item}`, 'Butin') : '';   // tableau de butin à la demande (04/11)
  const acts = open + loot + learn + equip + unlock + recycle + move;
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
/* rangée d'onglets, aussi celle de l'onglet Craft (31/10/2026) : active = onglet ouvert, items = objets à compter, unit = mot
   de la bulle (« 3 slots », « 3 recettes »), all = compte de « Tout », hideEmpty = pas d'onglet vide (Craft) */
export function tabsHtml(active, items, unit, all = items.length, hideEmpty = false){
  const n = {}; for(const item of items){ const t = tabOf(item); n[t] = (n[t] || 0) + 1; }
  return INVENTORY.tabs.filter(t => !hideEmpty || t.id === 'all' || n[t.id]).map(t => {
    const icon = t.px ? pxi(t.px) : iconHtml(t.icon), c = t.id === 'all' ? all : n[t.id] || 0;
    return `<button class="invTab${t.id === active ? ' on' : ''}${c ? '' : ' none'}" data-tab="${t.id}" role="tab" aria-selected="${t.id === active}" `+
           `aria-label="${esc(t.name)}" data-tip="${esc(t.name)}\n${c} ${unit}${c > 1 ? 's' : ''}">${icon}</button>`;
  }).join('');
}

/* fresh : slots qui viennent de recevoir des objets (mis en évidence jusqu'à la prochaine visite) ;
   actions : sur l'objet sélectionné (chacune a son bouton) : onOpen(item) ouvrir un treasure, onLearn(item) utiliser
   un blueprint, onEquip(slot, uid) équiper une pièce de stuff, onSort() trier, onMove({ from, to, item, uid }) déplacer
   (glisser-déposer : l'objet en to, s'il y en a un, prend la place de from) ; worn() : pièces portées (pour dire ce qui
   est remplacé) */
export function renderInventory(inv, fresh=new Set(), actions={}){
  const grid = $('invGrid'), n = gridSize(inv, INVENTORY.cols, INVENTORY.minSlots);
  let cells = [], groupAt = new Map();   // pièces simples empilées (04/11) : case → uids
  grid.style.setProperty('--cols', INVENTORY.cols);
  const draw = () => {
    $('invTabs').innerHTML = tabsHtml(tab, inv.slots.filter(Boolean).map(s => s.item), 'slot', usedSlots(inv));
    const shown = tabSlots(inv, tab, n);
    cells = inventoryCells(inv, shown); groupAt = new Map(cells.filter(c => c.uids).map(c => [c.i, c.uids]));
    grid.innerHTML = cells.map(c => slotHtml(inv.slots[c.i] || null, c.i, fresh, c.uids?.length ?? 1)).join('') ||
      `<p class="mut invNone">Rien dans « ${esc(INVENTORY.tabs.find(t => t.id === tab)?.name ?? '')} ».</p>`;
  };
  draw();
  $('invTabs').onclick = e => { const b = e.target.closest('[data-tab]'); if(b && b.dataset.tab !== tab){ tab = b.dataset.tab; draw(); } };
  const used = usedSlots(inv);
  $('invCount').textContent = used ? `${used} slot${used>1?'s':''} utilisé${used>1?'s':''}` : 'Vide : termine une session pour remplir ton inventaire.';
  $('invInfo').innerHTML = infoHtml(null);

  let pinned = null, moving = null;   // moving (appli) : case de l'objet à déplacer, en attente de la case d'arrivée
  $('invMoveBar')?.remove(); grid.classList.remove('moving');
  const stopMove = () => { moving = null; $('invMoveBar')?.remove(); grid.classList.remove('moving'); };
  const at = e => { const c = e.target.closest('.slot'); return c ? inv.slots[+c.dataset.i] || null : undefined; };
  /* survol : souris seulement. Sur un écran tactile, le survol simulé au premier appui changeait la fiche et l'iPhone
     avalait le clic : la pièce n'était jamais choisie, donc pas de bouton « Équiper » (30/10, Geoffrey) */
  const hover = !matchMedia('(hover: none)').matches;
  grid.onmouseover = e => { if(pinned || !hover) return; const s = at(e), c = e.target.closest('.slot'); if(s !== undefined) $('invInfo').innerHTML = infoHtml(s, false, null, null, null, null, c ? groupAt.get(+c.dataset.i) : null); };
  grid.onmouseleave = () => { if(!pinned && hover) $('invInfo').innerHTML = infoHtml(null); };
  grid.onclick = e => {
    const c = e.target.closest('.slot'); if(!c) return;
    if(moving !== null){                            // appli : la case d'arrivée (la case de départ annule)
      const op = moveOp(inv, moving, +c.dataset.i);
      stopMove();
      if(op) actions.onMove?.(op);
      return;
    }
    grid.querySelectorAll('.slot.sel').forEach(x => x.classList.remove('sel'));
    const s = inv.slots[+c.dataset.i] || null;
    pinned = (s && pinned !== s) ? s : null;
    if(pinned) c.classList.add('sel');
    $('invInfo').innerHTML = infoHtml(pinned || s, !!pinned, inv, actions.worn?.(), actions.furnaces?.(), inApp() && pinned ? +c.dataset.i : null, groupAt.get(+c.dataset.i) ?? null);
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
    const op = c && from !== null ? moveOp(inv, from, +c.dataset.i) : null;
    if(op) actions.onMove?.(op);
  };
  $('invInfo').onclick = e => {
    const b = e.target.closest('.invOpen, .invLearn, .invEquip, .invUnlock, .invRecycle, .invMove');
    if(!b) return;
    if(b.classList.contains('invMove')){             // appli : on attend la case d'arrivée (rien n'est envoyé avant)
      moving = +b.dataset.i;
      const s = inv.slots[moving], bar = document.createElement('div');
      bar.id = 'invMoveBar'; bar.className = 'invMoveBar';
      bar.innerHTML = `${s ? iconHtml(s.item) : ''}<span>Touche la case où le poser</span><button>Annuler</button>`;
      bar.querySelector('button').onclick = stopMove;
      $('invTabs').before(bar); grid.classList.add('moving');
      return;
    }
    if(b.classList.contains('invRecycle')){         // rien n'est envoyé avant la confirmation
      const s = inv.slots.find(x => x?.uid === +b.dataset.uid);
      if(!s) return;
      /* pile de pièces simples (04/11) : une pièce hors set (ou toutes avec « Recycler tout ») */
      const group = [...groupAt.values()].find(g => g.includes(s.uid));
      if(group){
        const free = group.filter(u => !(actions.setsOf?.(u) ?? []).length);
        if(!free.length){ showRecycle(s, actions.setsOf?.(s.uid) ?? [], () => {}); return; }
        const uids = b.dataset.all ? free : [free[0]], one = inv.slots.find(x => x?.uid === uids[0]);
        showRecycle(one, [], () => uids.length > 1 ? actions.onRecycleAll?.(uids) : actions.onRecycle?.(uids[0]), uids.length);
        return;
      }
      showRecycle(s, actions.setsOf?.(s.uid) ?? [], () => actions.onRecycle?.(s.uid));
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
/* count : nombre de pièces simples recyclées d'un coup (« Recycler tout », 04/11/2026) */
export function showRecycle(piece, sets, onOk, count = 1){
  const box = $('loot'), close = () => { box.hidden = true; };
  const title = `<h3>${iconHtml(piece.item)} ${count > 1 ? `${fullQty(count)} × ` : ''}${pname(piece)}</h3>`;
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
  box.querySelector('.box').innerHTML = title + (count > 1 ? `<p>Recycler ces <b>${fullQty(count)}</b> pièces ? Elles seront <b>détruites</b> (pas celles d'un set). Tu récupères :</p>`
                                                 : '<p>Recycler cette pièce ? Elle sera <b>détruite</b>. Tu récupères :</p>')+
    (names.length ? `<div class="lootList">${names.map(n => `<div class="lootRow">${iconHtml(n)}${rname(n)}<b>× ${fullQty(refund[n] * count)}</b></div>`).join('')}</div>`
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
