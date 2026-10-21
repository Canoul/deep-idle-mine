/* Onglet Table de recherche : deux sous-onglets.
   - Recherche : choisir le tier, poser les Blueprint parts dans la case (0 ou le prix exact), lancer : un blueprint
     du tier pas encore appris arrive dans l'inventaire.
   - Recycle : poser un blueprint dans la case, recycler : il rend des Blueprint parts.
   Ne modifie rien lui-même : chaque action est demandée au serveur (onOp), qui tire le hasard et renvoie l'inventaire.
   Les blueprints possibles ne sont pas listés (les recettes restent secrètes) : seulement leur nombre. */
import { RESEARCH } from '../config.js';
import { itemDef, countOf } from '../meta/inventory.js';
import { rcls, rname } from './rarity.js';
import { PARTS, tierOf, researchPool, isBlueprint, tierOfBlueprint, tierUnlocked, recipesLeft } from '../meta/research.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const rangeText = r => `${r.min} à ${r.max}`;
const icon = item => { const d = itemDef(item); return d?.tex ? `<img src="textures/${d.tex}.png" alt="">` : ''; };

/* onOp({ action:'research', tier } | { action:'recycle', item }) → promesse du résultat ({ item, parts }) */
export function setupResearch({ onOp }){
  let inv = { slots:[], unlocked:[] }, tab = 'research', tier = RESEARCH.tiers[0].tier;
  let partsIn = false, bpIn = null, picking = false, busy = false, msg = null;

  const blueprints = () => [...new Set(inv.slots.filter(s => s && isBlueprint(s.item)).map(s => s.item))];

  function researchHtml(){
    if(!tierUnlocked(inv, tier)) tier = RESEARCH.tiers[0].tier;           // tier verrouillé (jamais reverrouillé en pratique)
    const def = tierOf(tier), have = countOf(inv, PARTS), left = researchPool(inv, tier).length;
    const lockedBy = RESEARCH.tiers.filter(t => !tierUnlocked(inv, t.tier));
    if(partsIn && have < def.cost) partsIn = false;           // plus assez (dépensées ailleurs) : la case se vide
    const ok = partsIn && left > 0 && !busy;
    return `<div class="rsRow"><label>Tier <select id="rsTier">${RESEARCH.tiers.map(t =>
              `<option value="${t.tier}"${t.tier === tier ? ' selected' : ''}${tierUnlocked(inv, t.tier) ? '' : ' disabled'}>${esc(t.label)}${tierUnlocked(inv, t.tier) ? '' : ' 🔒'}</option>`).join('')}</select></label>`+
           `<span class="mut small">${left} blueprint${left > 1 ? 's' : ''} du ${esc(def.label)} encore à découvrir</span></div>`+
           `<div class="rsBench"><div class="slot rsSlot${partsIn ? '' : ' empty'}" id="rsParts" title="Clique pour poser ou retirer ${def.cost} ${esc(PARTS)}">`+
             `${partsIn ? icon(PARTS) + `<span class="q">${def.cost}</span>` : `<span class="fhint">${def.cost} parts</span>`}</div>`+
           `<span class="rsArrow">➜</span><div class="slot rsSlot empty"><span class="fhint">?</span></div></div>`+
           `<p class="mut small">${icon(PARTS)} ${esc(PARTS)} : ${num(have)} / ${def.cost}${have < def.cost ? ' <span class="err">(pas assez)</span>' : ''}</p>`+
           lockedBy.map(t => { const p = tierOf(t.tier - 1), n = recipesLeft(inv, p.tier).length;
             return `<p class="mut small">🔒 ${esc(t.label)} : apprends encore ${n} recette${n > 1 ? 's' : ''} du ${esc(p.label)} pour l'ouvrir.</p>`; }).join('')+
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
        ? `✔ Nouveau blueprint : ${icon(r.item)} ${rname(r.item, r.item, 'b')}. Il est dans ton inventaire (sélectionne-le, puis « Utiliser »).`
        : `✔ ${rname(r.item)} recyclé : +${r.parts} ${esc(PARTS)}.` };
      partsIn = false; bpIn = null;
    } catch(e){ msg = { ok:false, html:esc(e.message) }; }
    finally { busy = false; render(); }
  }

  $('rsTabs').onclick = e => { const b = e.target.closest('[data-rs]'); if(b){ tab = b.dataset.rs; msg = null; picking = false; render(); } };
  $('rsBody').onclick = e => {
    if(e.target.closest('#rsParts')){ partsIn = !partsIn && countOf(inv, PARTS) >= tierOf(tier).cost; msg = null; return render(); }
    if(e.target.closest('#rsBp')){ picking = !picking; msg = null; return render(); }
    const b = e.target.closest('[data-bp]'); if(b){ bpIn = b.dataset.bp; picking = false; return render(); }
    if(e.target.closest('#rsGo')) go();
  };
  $('rsBody').onchange = e => { if(e.target.id === 'rsTier'){ tier = +e.target.value; partsIn = false; render(); } };

  render();
  return { setInventory(v){ inv = v; render(); } };
}
