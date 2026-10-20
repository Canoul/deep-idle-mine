/* Onglet Craft : les recettes disponibles (icônes) ; un clic montre la recette (x / besoin pour chaque ingrédient)
   et le bouton Craft, grisé tant qu'il manque quelque chose. Ne modifie rien lui-même : la fabrication est
   demandée au serveur (onCraft), qui renvoie l'inventaire à jour. */
import { itemDef } from '../meta/inventory.js';
import { craftable, needs, canCraft, recipeOf } from '../meta/craft.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const icon = item => { const d = itemDef(item); return d?.tex ? `<img src="textures/${d.tex}.png" alt="">` : `<span class="noicon">${esc(item.slice(0,2))}</span>`; };

/* onCraft(item) → promesse (rejetée avec un message lisible) */
export function setupCraft({ onCraft }){
  let inv = { slots:[] }, sel = null, busy = false, msg = '';

  function render(){
    const list = craftable();
    if(!sel || !list.includes(sel)) sel = list[0] ?? null;
    $('craftList').innerHTML = list.map(n =>
      `<button class="slot craftItem${n === sel ? ' sel' : ''}${canCraft(inv, n) ? ' ready' : ''}" data-item="${esc(n)}" title="${esc(n)}">${icon(n)}</button>`).join('')
      || '<p class="mut">Aucune recette pour l\'instant.</p>';
    if(!sel){ $('craftInfo').innerHTML = ''; return; }
    const r = recipeOf(sel), ok = canCraft(inv, sel);
    $('craftInfo').innerHTML =
      `<h3>${icon(sel)} ${esc(sel)}${r.qty > 1 ? ` <span class="mut">× ${r.qty}</span>` : ''}</h3>`+
      `<div class="craftNeeds">${needs(inv, sel).map(n =>
        `<div class="craftNeed${n.have >= n.need ? ' ok' : ''}">${icon(n.item)}<span>${esc(n.item)}</span><b>${num(n.have)}/${num(n.need)}</b></div>`).join('')}</div>`+
      `<p><button class="on" id="craftBtn"${ok && !busy ? '' : ' disabled'}>🔨 Craft</button>`+
      `${msg ? ` <span class="${msg.startsWith('✔') ? 'okmsg' : 'err'}">${esc(msg)}</span>` : ''}</p>`;
    $('craftBtn').onclick = async () => {
      if(busy || !canCraft(inv, sel)) return;
      busy = true; msg = ''; render();
      try { await onCraft(sel); msg = `✔ ${sel} fabriqué${r.qty > 1 ? 's' : ''} : il est dans ton inventaire.`; }
      catch(e){ msg = e.message; }
      finally { busy = false; render(); }
    };
  }

  $('craftList').onclick = e => {
    const b = e.target.closest('.craftItem'); if(!b) return;
    sel = b.dataset.item; msg = ''; render();
  };

  return { setInventory(v){ inv = v; render(); } };
}
