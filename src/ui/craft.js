/* Onglet Craft : les recettes disponibles (icônes) ; un clic montre la recette (x / besoin pour chaque ingrédient)
   et le bouton Craft, grisé tant qu'il manque quelque chose ; une recette en série (orbes, clés…, 04/11/2026) a un champ
   Quantité et un bouton Max. Ne modifie rien lui-même : la fabrication est
   demandée au serveur (onCraft), qui renvoie l'inventaire à jour. */
import { itemDef } from '../meta/inventory.js';
import { craftable, needs, canCraft, recipeOf, inBatch, maxCrafts } from '../meta/craft.js';
import { statsText } from '../meta/stuff.js';
import { tipAttr } from './tooltip.js';
import { rcls, rname } from './rarity.js';
import { tabOf, tabsHtml } from './inventory.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const icon = item => { const d = itemDef(item); return d?.tex ? `<img src="textures/${d.tex}.png" alt="">` : `<span class="noicon">${esc(item.slice(0,2))}</span>`; };

/* recettes de l'onglet tab (mêmes onglets que l'inventaire, 31/10/2026, Geoffrey) */
export const recipesIn = (list, tab) => tab === 'all' ? list : list.filter(n => tabOf(n) === tab);

/* onCraft(item, count) → promesse (rejetée avec un message lisible) */
export function setupCraft({ onCraft }){
  let inv = { slots:[] }, sel = null, busy = false, msg = '', tab = 'all', count = 1;

  function render(){
    /* seulement les recettes débloquées : celles à blueprint restent secrètes tant qu'on ne l'a pas utilisé */
    const known = craftable(inv);
    if(!recipesIn(known, tab).length) tab = 'all';
    const list = recipesIn(known, tab);
    $('craftTabs').innerHTML = tabsHtml(tab, known, 'recette', known.length, true);
    if(!sel || !list.includes(sel)) sel = list[0] ?? null;
    $('craftList').innerHTML = list.map(n =>
      `<button class="slot craftItem${rcls(n)}${n === sel ? ' sel' : ''}${canCraft(inv, n) ? ' ready' : ''}" data-item="${esc(n)}"${tipAttr(n)}>${icon(n)}</button>`).join('')
      || '<p class="mut">Aucune recette pour l\'instant.</p>';
    if(!sel){ $('craftInfo').innerHTML = ''; return; }
    const r = recipeOf(sel), batch = inBatch(sel), max = maxCrafts(inv, sel);
    count = Math.max(1, Math.min(count, max || 1));
    const ok = canCraft(inv, sel) && count <= max;
    $('craftInfo').innerHTML =
      `<h3>${icon(sel)} ${rname(sel)}${r.qty > 1 ? ` <span class="mut">× ${r.qty}</span>` : ''}</h3>`+
      (statsText(sel) ? `<p class="stuffStats">${esc(statsText(sel))}</p>` : '')+
      `<div class="craftNeeds">${needs(inv, sel).map(n =>
        `<div class="craftNeed${n.have >= n.need ? ' ok' : ''}">${icon(n.item)}${rname(n.item)}<b>${num(n.have)}/${num(n.need)}</b></div>`).join('')}</div>`+
      (batch ? `<div class="fqty craftQty"><input id="craftQty" type="number" min="1" max="${Math.max(1, max)}" step="1" inputmode="numeric" value="${count}" aria-label="Quantité">`+
               `<button id="craftMax"${max > 1 && !busy ? '' : ' disabled'}>Max (${num(max)})</button></div>` : '')+
      `<p><button class="on" id="craftBtn"${ok && !busy ? '' : ' disabled'}>🔨 Craft${batch && count > 1 ? ` × ${num(count)}` : ''}</button>`+
      `${msg ? ` <span class="${msg.startsWith('✔') ? 'okmsg' : 'err'}">${esc(msg)}</span>` : ''}</p>`;
    if(batch){
      $('craftQty').oninput = e => {
        const n = Number(e.target.value);
        if(Number.isSafeInteger(n) && n >= 1){ count = n; const b = $('craftBtn'); b.disabled = busy || n > max; b.textContent = `🔨 Craft${n > 1 ? ` × ${num(n)}` : ''}`; }
      };
      $('craftQty').onchange = () => render();      // valeur hors bornes : ramenée entre 1 et le max
      $('craftMax').onclick = () => { count = max; render(); };
    }
    $('craftBtn').onclick = async () => {
      const n = batch ? count : 1;
      if(busy || maxCrafts(inv, sel) < n) return;
      busy = true; msg = ''; render();
      try { await onCraft(sel, n); const made = n * r.qty; msg = `✔ ${made > 1 ? `${num(made)} × ` : ''}${sel} fabriqué${made > 1 ? 's' : ''} : dans ton inventaire.`; count = 1; }
      catch(e){ msg = e.message; }
      finally { busy = false; render(); }
    };
  }

  $('craftTabs').onclick = e => { const b = e.target.closest('[data-tab]'); if(b && b.dataset.tab !== tab){ tab = b.dataset.tab; msg = ''; render(); } };
  $('craftList').onclick = e => {
    const b = e.target.closest('.craftItem'); if(!b) return;
    sel = b.dataset.item; msg = ''; render();
  };

  return { setInventory(v){ inv = v; render(); } };
}
