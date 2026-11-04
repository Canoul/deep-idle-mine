/* Onglet Table de recherche : deux sous-onglets.
   - Recherche : choisir le tier, poser les Blueprint parts dans la case (0 ou le prix exact), lancer : un blueprint
     du tier pas encore appris arrive dans l'inventaire.
   - Recycle : poser un blueprint dans la case, recycler : il rend des Blueprint parts.
   Ne modifie rien lui-même : chaque action est demandée au serveur (onOp), qui tire le hasard et renvoie l'inventaire.
   Les blueprints possibles ne sont pas listés (les recettes restent secrètes) : seulement leur nombre. */
import { RESEARCH } from '../config.js';
import { itemDef, countOf } from '../meta/inventory.js';
import { rcls, rname } from './rarity.js';
import { tipAttr } from './tooltip.js';
import { recipeOfBlueprint } from '../meta/craft.js';
import { statLines } from '../meta/stuff.js';
import { PARTS, tierOf, researchPool, researchStage, isBlueprint, tierOfBlueprint, tierUnlocked, tiersBlocking } from '../meta/research.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const rangeText = r => `${r.min} à ${r.max}`;
const icon = item => { const d = itemDef(item); return d?.tex ? `<img src="textures/${d.tex}.png" alt="">` : ''; };
/* dans l'appli mobile (classe app, src/app/boot.js) : les tiers en boutons au lieu de la liste déroulante */
const inApp = () => !!globalThis.document?.body?.classList.contains('app');

/* appli (04/11/2026, Jules, spec 2026-11-04-appli-ecrans-fin-design.md) : un bouton par tier, 🔒 s'il est fermé */
export const tierChipsHtml = (inv, tier) => `<div class="seg rsTiers">${RESEARCH.tiers.map(t => {
  const open = tierUnlocked(inv, t.tier), cls = [t.tier === tier && 'on', !open && 'locked'].filter(Boolean).join(' ');
  return `<button${cls ? ` class="${cls}"` : ''} data-rtier="${t.tier}">${open ? '' : '🔒 '}${esc(t.label)}</button>`;
}).join('')}</div>`;
/* ce qui manque pour ouvrir le tier t (rien s'il est ouvert) */
export function tierWhyHtml(inv, t){
  if(tierUnlocked(inv, t)) return '';
  return `🔒 ${esc(tierOf(t).label)} : apprends encore ${tiersBlocking(inv, t)
    .map(b => `${b.left} recette${b.left > 1 ? 's' : ''} du ${esc(b.label)}`).join(' et ')} pour l'ouvrir.`;
}

/* onOp({ action:'research', tier } | { action:'recycle', item }) → promesse du résultat ({ item, parts }) */
export function setupResearch({ onOp }){
  let inv = { slots:[], unlocked:[] }, tab = 'research', tier = RESEARCH.tiers[0].tier;
  let partsIn = false, bpIn = null, picking = false, busy = false, msg = null, found = null;   // found : dernier BP obtenu
  let why = null;                                      // appli : tier fermé touché (on dit ce qu'il manque)

  const blueprints = () => [...new Set(inv.slots.filter(s => s && isBlueprint(s.item)).map(s => s.item))];

  function researchHtml(){
    if(!tierUnlocked(inv, tier)) tier = RESEARCH.tiers[0].tier;           // tier verrouillé (jamais reverrouillé en pratique)
    const def = tierOf(tier), have = countOf(inv, PARTS), left = researchPool(inv, tier).length, stage = researchStage(inv, tier);
    const lockedBy = RESEARCH.tiers.filter(t => !tierUnlocked(inv, t.tier));
    if(partsIn && have < def.cost) partsIn = false;           // plus assez (dépensées ailleurs) : la case se vide
    const ok = partsIn && left > 0 && !busy;
    const app = inApp(), count = `${stage ? `Étape ${stage.index + 1} / ${stage.count} : ${left} plan${left > 1 ? 's' : ''} possible${left > 1 ? 's' : ''}` : `${left} blueprint${left > 1 ? 's' : ''} du ${esc(def.label)} encore à découvrir`}`;
    return (app ? tierChipsHtml(inv, tier) + `<p class="mut small rsCount">${count}</p>` : `<div class="rsRow"><label>Tier <select id="rsTier">${RESEARCH.tiers.map(t =>
              `<option value="${t.tier}"${t.tier === tier ? ' selected' : ''}${tierUnlocked(inv, t.tier) ? '' : ' disabled'}>${esc(t.label)}${tierUnlocked(inv, t.tier) ? '' : ' 🔒'}</option>`).join('')}</select></label>`+
           `<span class="mut small">${count}</span></div>`)+
           `<div class="rsBench"><div class="slot rsSlot${partsIn ? '' : ' empty'}" id="rsParts" title="Clique pour poser ou retirer ${def.cost} ${esc(PARTS)}">`+
             `${partsIn ? icon(PARTS) + `<span class="q">${def.cost}</span>` : `<span class="fhint">${def.cost} parts</span>`}</div>`+
           `<span class="rsArrow">➜</span>`+
           (found ? `<div class="slot rsSlot${rcls(found)}"${tipAttr(found)}>${icon(found)}</div>` : `<div class="slot rsSlot empty"><span class="fhint">?</span></div>`)+`</div>`+
           (found ? bpInfoHtml(found) : '')+
           `<p class="mut small">${icon(PARTS)} ${esc(PARTS)} : ${num(have)} / ${def.cost}${have < def.cost ? ' <span class="err">(pas assez)</span>' : ''}</p>`+
           (app ? (why && tierWhyHtml(inv, why) ? `<p class="mut small rsWhy">${tierWhyHtml(inv, why)}</p>` : '')
                : lockedBy.map(t => `<p class="mut small">${tierWhyHtml(inv, t.tier)}</p>`).join(''))+
           `<p><button class="on" id="rsGo"${ok ? '' : ' disabled'}>🔬 Rechercher</button></p>`;
  }

  function recycleHtml(){
    const list = blueprints();
    if(bpIn && !countOf(inv, bpIn)) bpIn = null;
    const pick = picking ? `<div class="rsPick">${list.length ? list.map(b =>
        `<button class="fopt" data-bp="${esc(b)}">${icon(b)}${rname(b)}<b>${num(countOf(inv, b))}</b></button>`).join('')
        : '<p class="mut">Aucun blueprint dans ton inventaire.</p>'}</div>` : '';
    return `<div class="rsBench"><div class="slot rsSlot${bpIn ? rcls(bpIn) : ' empty'}" id="rsBp" title="Clique pour choisir le blueprint à recycler">`+
             `${bpIn ? icon(bpIn) : '<span class="fhint">BP</span>'}</div>`+
           `<span class="rsArrow">➜</span><div class="slot rsSlot empty">${icon(PARTS)}</div></div>`+
           pick+
           `<p class="mut small">${bpIn ? rname(bpIn) + ' : rend ' + rangeText((tierOfBlueprint(bpIn) ?? RESEARCH.tiers[0]).recycle) : 'Rend ' + RESEARCH.tiers.map(t => `${rangeText(t.recycle)} (${esc(t.label)})`).join(', ')} ${esc(PARTS)}. Le blueprint est détruit.</p>`+
           `<p><button class="on" id="rsGo"${bpIn && !busy ? '' : ' disabled'}>♻ Recycler</button></p>`;
  }

  function render(){
    $('rsTabs').innerHTML = [['research', '🔬 Recherche'], ['recycle', '♻ Recycle']].map(([id, l]) =>
      `<button data-rs="${id}"${id === tab ? ' class="on"' : ''}>${l}</button>`).join('');
    $('rsBody').innerHTML = (tab === 'research' ? researchHtml() : recycleHtml())+
      (msg ? `<p class="${msg.ok ? 'okmsg' : 'err'}">${msg.html}</p>` : '');
  }

  async function go(){
    if(busy) return;
    const op = tab === 'research' ? { action:'research', tier } : { action:'recycle', item:bpIn };
    busy = true; msg = null; render();
    try {
      const r = await onOp(op);
      msg = { ok:true, html: tab === 'research'
        ? `✔ Nouveau blueprint : ${icon(r.item)} ${rname(r.item, r.item, 'b')}`
        : `✔ ${rname(r.item)} recyclé : +${r.parts} ${esc(PARTS)}.` };
      if(tab === 'research') found = r.item;            // le blueprint obtenu s'affiche dans la case de résultat
      partsIn = false; bpIn = null;
    } catch(e){ msg = { ok:false, html:esc(e.message) }; }
    finally { busy = false; render(); }
  }

  $('rsTabs').onclick = e => { const b = e.target.closest('[data-rs]'); if(b){ tab = b.dataset.rs; msg = null; picking = false; render(); } };
  $('rsBody').onclick = e => {
    const c = e.target.closest('[data-rtier]');
    if(c){                                         // appli : un tier ouvert se choisit, un fermé dit ce qu'il manque
      const t = +c.dataset.rtier;
      if(tierUnlocked(inv, t)){ if(t !== tier){ tier = t; partsIn = false; found = null; } why = null; }
      else why = t;
      msg = null; return render();
    }
    if(e.target.closest('#rsParts')){ partsIn = !partsIn && countOf(inv, PARTS) >= tierOf(tier).cost; msg = null; found = null; return render(); }
    if(e.target.closest('#rsBp')){ picking = !picking; msg = null; return render(); }
    const b = e.target.closest('[data-bp]'); if(b){ bpIn = b.dataset.bp; picking = false; return render(); }
    if(e.target.closest('#rsGo')) go();
  };
  $('rsBody').onchange = e => { if(e.target.id === 'rsTier'){ tier = +e.target.value; partsIn = false; found = null; render(); } };

  render();
  return { setInventory(v){ inv = v; render(); } };
}

/* description d'un blueprint, sous la table : ce qu'il débloque et ce que fait l'objet, puis comment s'en servir */
export function bpInfoHtml(bp){
  const r = recipeOfBlueprint(bp), lines = r ? statLines(r) : [];
  return `<div class="rsInfo"><b>${rname(bp)}</b>`+
    (r ? `<div>Débloque la recette : <b>${rname(r)}</b>${lines.length ? ' — ' + lines.map(esc).join(' · ') : ''}</div>`
       : '<div class="mut">Ne débloque encore aucune recette (garde-le, ou recycle-le).</div>')+
    `<div class="mut small">Il est dans ton inventaire : sélectionne-le puis « Utiliser » pour apprendre la recette.</div></div>`;
}
