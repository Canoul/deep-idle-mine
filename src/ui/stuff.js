/* Onglet Stuff : une case par pièce d'équipement. Un clic sur une case ouvre la liste des pièces de l'inventaire
   qui y vont (et « Retirer » si la case est occupée). Ne modifie rien lui-même : chaque action est demandée au
   serveur (onOp), qui renvoie l'inventaire et le stuff à jour. */
import { STUFF } from '../config.js';
import { piecesFor, statsText, minerStats } from '../meta/stuff.js';
import { sanitizeSkills, skillEffects, behaviourSkills } from '../meta/skills.js';
import { tipAttr } from './tooltip.js';
import { icon } from './craft.js';
import { rcls, pname } from './rarity.js';
import { pxi } from './pxicons.js';
import { drawPortrait, lookOf } from '../render/portrait.js';
import { aurasOf } from '../meta/aura.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* icône pixel d'une case vide (les autres cases restent sans icône) */
const SLOT_ICON = { casque:'helmet', torse:'shield', pioche:'pickaxe', epee:'sword', boussole:'target' };
const statLine = p => statsText(p) ? `<br><small class="stuffStats">${esc(statsText(p))}</small>` : '';

/* les cases du stuff et le portrait au milieu, dans el. tag 'div' : en lecture seule (fiche d'un ami, onglet Social) */
export function renderSlots(el, worn, tag = 'button'){
  el.innerHTML = STUFF.slots.map(s => {
    const p = worn[s.id];
    return `<${tag} class="stuffSlot${p ? ' full' : ''}" data-slot="${s.id}"${p ? tipAttr(p.item, p.item, p) : ` title="${esc(s.label)}"`}>`+
           `<span class="slot${p ? rcls(p.item) : ''}">${p ? icon(p.item) : `<span class="sico">${SLOT_ICON[s.id] ? pxi(SLOT_ICON[s.id]) : ''}</span>`}</span>`+
           `<span class="slbl">${esc(s.label)}</span>${p ? pname(p).replace('class="rn', 'class="sname rn') : '<span class="sname mut">vide</span>'}</${tag}>`;
  }).join('');
  el.insertAdjacentHTML('beforeend', '<div class="stuffHero"><canvas width="16" height="16"></canvas></div>');
  drawPortrait(el.querySelector('.stuffHero canvas'), lookOf(worn), aurasOf(worn));
}

/* stats du mineur : (base + bonus des pièces portées, en vert) × multiplicateur des skills (en bleu) ;
   un skill qui ajoute des points (ténacité) s'affiche « +5 % » en bleu ; l'effet des anneaux portés en violet
   (en session, ceux du reste du groupe s'y ajoutent) */
export function statsHTML(worn, effects){
  const fr = v => String(v).replace('.', ',');
  const rows = minerStats(worn, effects).map(s => { const u = STUFF.statUnits?.[s.key] ?? ''; return (
    `<div class="row"><span>${esc(s.label)}</span><span><b>${fr(s.total)}${u}</b>`+
    (s.bonus || s.mult !== 1 || s.skill ? ` <small class="mut">(`+
      (s.bonus ? `${fr(s.base)} <span class="stuffStats" title="stuff">+${fr(s.bonus)}${u}</span>` : fr(s.base))+
      (s.mult === 1 && s.skill ? ` <span class="skillStats" title="skills">+${fr(s.skill)}${u}</span>` : '')+
      (s.mult !== 1 ? `${s.bonus ? ')' : ''} <span class="skillStats" title="skills : multiplicateur">×${fr(s.mult)}</span>` : '')+
      `${s.bonus && s.mult !== 1 ? '' : ')'}</small>` : '')+
    (s.ring ? ` <small class="ringStats" title="anneaux (pour tout le groupe)">+${fr(s.ring)}${u}</small>` : '')+
    `</span></div>`); }).join('');
  /* skills de comportement (pas des stats) : ce qu'ils font pendant la partie */
  const extra = behaviourSkills(effects);
  return rows + (extra.length ? `<div class="row"><span class="skillStats">Skills en partie</span><span></span></div>`+
    extra.map(k => `<div class="row"><span>${k.icon} ${esc(k.name)}</span><span><small class="skillStats">${esc(k.text)}</small></span></div>`).join('') : '');
}

/* onOp({ action:'equip'|'unequip', slot, uid }) → promesse (rejetée avec un message lisible) */
export function setupStuff({ onOp }){
  let inv = { slots:[] }, worn = {}, effects = {}, busy = false, open = null;

  function render(){
    renderSlots($('stuffGrid'), worn);
    renderStats();
    if(open) renderPicker();
  }

  function renderStats(){ $('stuffStatsBody').innerHTML = statsHTML(worn, effects); }

  function renderPicker(){
    const s = STUFF.slots.find(x => x.id === open), cur = worn[open], list = piecesFor(inv, open);
    $('spick').querySelector('.box').innerHTML =
      `<h3>${s.icon} ${esc(s.label)}</h3>`+
      (cur ? `<div class="fcur">${icon(cur.item)}<span>Équipé : ${pname(cur, 'b')}${statLine(cur)}</span><button id="spickOff">Retirer</button></div>` : '')+
      (list.length
        ? `<div class="fopts">${list.map(p => `<button class="fopt" data-uid="${p.uid}">${icon(p.item)}<span>${pname(p)}${statLine(p)}</span><b>Équiper</b></button>`).join('')}</div>`
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
    /* skills du joueur (onglet Skills) : leurs bonus de stats s'affichent aussi ici */
    setSkills(s){ effects = skillEffects(sanitizeSkills(s)); renderStats(); },
    worn: () => worn,                 // pièces portées (l'inventaire dit ce qu'une pièce remplacerait)
  };
}
