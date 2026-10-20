/* Onglet Stuff : une case par pièce d'équipement. Un clic sur une case ouvre la liste des pièces de l'inventaire
   qui y vont (et « Retirer » si la case est occupée). Ne modifie rien lui-même : chaque action est demandée au
   serveur (onOp), qui renvoie l'inventaire et le stuff à jour. */
import { STUFF } from '../config.js';
import { piecesFor, statsText, minerStats } from '../meta/stuff.js';
import { tipAttr } from './tooltip.js';
import { icon } from './craft.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const statLine = item => statsText(item) ? `<br><small class="stuffStats">${esc(statsText(item))}</small>` : '';

/* onOp({ action:'equip'|'unequip', slot, uid }) → promesse (rejetée avec un message lisible) */
export function setupStuff({ onOp }){
  let inv = { slots:[] }, worn = {}, busy = false, open = null;

  function render(){
    $('stuffGrid').innerHTML = STUFF.slots.map(s => {
      const p = worn[s.id];
      return `<button class="stuffSlot${p ? ' full' : ''}" data-slot="${s.id}"${p ? tipAttr(p.item) : ` title="${esc(s.label)}"`}>`+
             `<span class="slot">${p ? icon(p.item) : `<span class="sico">${s.icon}</span>`}</span>`+
             `<span class="slbl">${esc(s.label)}</span><span class="sname mut">${p ? esc(p.item) : 'vide'}</span></button>`;
    }).join('');
    renderStats();
    if(open) renderPicker();
  }

  /* stats du mineur : base + bonus des pièces portées (le bonus en vert) */
  function renderStats(){
    const fr = v => String(v).replace('.', ',');
    $('stuffStatsBody').innerHTML = minerStats(worn).map(s =>
      `<div class="row"><span>${esc(s.label)}</span><span><b>${fr(s.total)}</b>`+
      (s.bonus ? ` <small class="mut">(${fr(s.base)} <span class="stuffStats">+${fr(s.bonus)}</span>)</small>` : '')+
      `</span></div>`).join('');
  }

  function renderPicker(){
    const s = STUFF.slots.find(x => x.id === open), cur = worn[open], list = piecesFor(inv, open);
    $('spick').querySelector('.box').innerHTML =
      `<h3>${s.icon} ${esc(s.label)}</h3>`+
      (cur ? `<div class="fcur">${icon(cur.item)}<span>Équipé : <b>${esc(cur.item)}</b>${statLine(cur.item)}</span><button id="spickOff">Retirer</button></div>` : '')+
      (list.length
        ? `<div class="fopts">${list.map(p => `<button class="fopt" data-uid="${p.uid}">${icon(p.item)}<span>${esc(p.item)}${statLine(p.item)}</span><b>Équiper</b></button>`).join('')}</div>`
        : `<p class="mut">Aucune pièce « ${esc(s.label.toLowerCase())} » dans ton inventaire.${open === 'pioche' ? ' Fabrique-en une dans l\'onglet Craft.' : ''}</p>`)+
      `<p class="err" id="spickErr" hidden></p><p style="text-align:right"><button id="spickClose">Fermer</button></p>`;
    $('spick').hidden = false;
    const box = $('spick').querySelector('.box');
    box.querySelectorAll('.fopt').forEach(b => b.onclick = () => send({ action:'equip', slot:open, uid:+b.dataset.uid }));
    if(cur) $('spickOff').onclick = () => send({ action:'unequip', slot:open });
    $('spickClose').onclick = close;
  }
  function close(){ open = null; $('spick').hidden = true; }

  async function send(op){
    if(busy) return;
    busy = true;
    try { await onOp(op); close(); }
    catch(e){ const err = $('spickErr'); if(err){ err.textContent = e.message; err.hidden = false; } }
    finally { busy = false; }
  }

  $('stuffGrid').onclick = e => { const b = e.target.closest('.stuffSlot'); if(b){ open = b.dataset.slot; renderPicker(); } };
  $('spick').onclick = e => { if(e.target === $('spick')) close(); };

  return {
    setInventory(v){ inv = v; render(); },
    set(w){ if(w){ worn = w; render(); } },
  };
}
