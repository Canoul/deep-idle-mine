/* Onglet Stuff : une case par pièce d'équipement. Un clic sur une case ouvre la liste des pièces de l'inventaire
   qui y vont (et « Retirer » si la case est occupée). Ne modifie rien lui-même : chaque action est demandée au
   serveur (onOp), qui renvoie l'inventaire et le stuff à jour. */
import { effectiveTenacity } from '../sim/tenacity.js';
import { STUFF } from '../config.js';
import { piecesFor, statsText, minerStats, rawDps, statNum } from '../meta/stuff.js';
import { sanitizeSkills, skillEffects } from '../meta/skills.js';
import { tipAttr } from './tooltip.js';
import { icon } from './craft.js';
import { rcls, pname, runeMark } from './rarity.js';
import { pxi } from './pxicons.js';
import { drawPortrait, lookOf } from '../render/portrait.js';
import { aurasOf } from '../meta/aura.js';
import { pieceGS, gearScore } from '../meta/gearscore.js';
import { STAT_HELP } from '../meta/stat-help.js';
/* nom d'une stat qui porte sa bulle d'aide (05/11/2026, Geoffrey ; ancien : un bouton « ? » par ligne) : souris posée dessus,
   ou doigt maintenu dessus (data-tiphold, src/ui/tooltip.js) */
const holdTip = (html, tip) => tip ? `<span class="statName" data-tip="${esc(tip)}" data-tipkind="help" data-tiphold="1" tabindex="0">${html}</span>` : html;

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* icône pixel d'une case vide (les autres cases restent sans icône) */
const SLOT_ICON = { casque:'helmet', torse:'shield', pioche:'pickaxe', epee:'sword', boussole:'target' };
const statLine = p => `<br><small class="stuffStats">${esc([statsText(p), `GS ${pieceGS(p).toLocaleString('fr-FR')}`].filter(Boolean).join(' · '))}</small>`;

/* les cases du stuff et le portrait au milieu, dans el. tag 'div' : en lecture seule (fiche d'un ami, onglet Social) */
/* le HTML seul (testé) : les 13 cases, puis le portrait et son gear score (le gear score et le +N des cases ne se voient que
   dans l'appli, mannequin du 03/11/2026 : src/app/app.css) */
export function renderSlotsHtml(worn, tag = 'button'){
  return STUFF.slots.map(s => {
    const p = worn[s.id];
    return `<${tag} class="stuffSlot${p ? ' full' : ''}" data-slot="${s.id}"${p ? tipAttr(p.item, p.item, p) : ` title="${esc(s.label)}"`}>`+
           `<span class="slot${p ? rcls(p.item) : ''}">${p ? icon(p.item) + runeMark(p) + (p.plus > 0 ? `<span class="splus">+${p.plus}</span>` : '') : `<span class="sico">${SLOT_ICON[s.id] ? pxi(SLOT_ICON[s.id]) : ''}</span>`}</span>`+
           `<span class="slbl">${esc(s.label)}</span>${p ? pname(p).replace('class="rn', 'class="sname rn') : '<span class="sname mut">vide</span>'}</${tag}>`;
  }).join('') + `<div class="stuffHero"><canvas width="16" height="16"></canvas><p class="stuffHeroGs">${gearScore(worn).toLocaleString('fr-FR')} GS</p></div>`;
}
export function renderSlots(el, worn, tag = 'button'){
  el.innerHTML = renderSlotsHtml(worn, tag);
  drawPortrait(el.querySelector('.stuffHero canvas'), lookOf(worn), aurasOf(worn));
}

/* stats du mineur : (base + bonus des pièces portées, en vert) × multiplicateur des skills (en bleu) ;
   un skill qui ajoute des points (ténacité) s'affiche « +5 % » en bleu ; l'effet des anneaux portés en violet
   (en session, ceux du reste du groupe s'y ajoutent) */
export function statsHTML(worn, effects){
  const fr = v => String(v).replace('.', ',');
  const list = minerStats(worn, effects);
  const rows = list.map(s => { const u = STUFF.statUnits?.[s.key] ?? '', n = v => statNum(s.key, v); return (
    `<div class="row"><span>${holdTip(esc(s.label), STAT_HELP[s.key] ? `${s.label}\n${STAT_HELP[s.key]}` : '')}</span><span><b>${n(s.total)}${u}</b>`+
    (s.bonus || s.mult !== 1 || s.skill ? ` <small class="mut">(`+
      (s.bonus ? `${n(s.base)} <span class="stuffStats" title="stuff">+${n(s.bonus)}${u}</span>` : n(s.base))+
      (s.mult === 1 && s.skill ? ` <span class="skillStats" title="skills">+${n(s.skill)}${u}</span>` : '')+
      (s.mult !== 1 ? `${s.bonus ? ')' : ''} <span class="skillStats" title="skills : multiplicateur">×${fr(s.mult)}</span>` : '')+
      `${s.bonus && s.mult !== 1 ? '' : ')'}</small>` : '')+
    (s.ring ? ` <small class="ringStats" title="anneaux (pour tout le groupe)">+${n(s.ring)}${u}</small>` : '')+
    (s.key === 'tenacity' && s.total > 0 ? ` <small class="mut" title="Chance réelle d'ignorer une mécanique de mob : la ténacité a un rendement décroissant (02/11)">→ ${fr(Math.round(effectiveTenacity(s.total) * 10) / 10)} % effectifs</small>` : '')+
    `</span></div>`); }).join('');
  const gs = `<div class="row"><span>${holdTip('<b>Gear score</b>', 'Gear score\nCe que ton stuff porté ajoute aux stats de base, en x (1 x = 1 s de travail) : stats, identification, rune, amélioration ; sans skills ni anneaux.')}</span><span><b>${gearScore(worn).toLocaleString('fr-FR')} GS</b></span></div>`;
  /* DPS brut (28/10) : stuff, skills et anneaux compris (les totaux affichés) ; sur cible immobile, sans recul */
  const dps = rawDps(Object.fromEntries(list.map(s => [s.key, s.total])));
  const dpsRow = `<div class="row"><span>${holdTip('<b>DPS</b> <small class="mut">(cible immobile)</small>', 'DPS\nDégâts par seconde en moyenne sur une cible immobile, sans recul ni obscurité : dégâts × critique × double attaque × vitesse d\'attaque (stuff, skills et anneaux compris ; sans Cri de guerre ni Pillage).')}</span><span><b>${fr(dps.toFixed(1))}</b></span></div>`;
  /* les skills de comportement (Navette, Treuil…) ne sont plus listés ici (28/10/2026, Geoffrey) : voir l'onglet Skills */
  return gs + dpsRow + rows;
}

/* onOp({ action:'equip'|'unequip', slot, uid }) → promesse (rejetée avec un message lisible) */
export function setupStuff({ onOp, onWorn }){
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
        ? `<div class="fopts">${list.map(p => `<button class="fopt" data-uid="${p.uid}"><span class="runeIco">${icon(p.item)}${runeMark(p)}</span><span>${pname(p)}${statLine(p)}</span><b>Équiper</b></button>`).join('')}</div>`
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
    set(w){ if(w){ worn = w; render(); onWorn?.(); } },   // onWorn : l'onglet Amélioration propose aussi les pièces portées
    /* skills du joueur (onglet Skills) : leurs bonus de stats s'affichent aussi ici */
    setSkills(s){ effects = skillEffects(sanitizeSkills(s)); renderStats(); },
    worn: () => worn,                 // pièces portées (l'inventaire dit ce qu'une pièce remplacerait)
  };
}
