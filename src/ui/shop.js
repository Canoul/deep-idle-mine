/* Onglet Boutique (05/11/2026, Geoffrey ; config SHOP, règle src/meta/shop.js) : objets exclusifs payés en émeraudes. Lit
   l'inventaire, ne le modifie jamais : un achat est demandé au serveur (onBuy), qui renvoie le nouvel inventaire. */
import { SHOP } from '../config.js';
import { itemDef, countOf } from '../meta/inventory.js';
import { affordable } from '../meta/shop.js';
import { lootTableOf } from '../meta/loot-table.js';
import { lootHelp } from './loot-tip.js';
import { rname } from './rarity.js';
import { ask } from './dialog.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const icon = item => { const t = itemDef(item)?.tex; return t ? `<img src="textures/${t}.png" alt="">` : ''; };
const nf = n => n.toLocaleString('fr-FR');

/* contenu fixe d'un article (coffre : ses « toujours ») : [{ item, qty }] */
export function contentsOf(item){
  const t = lootTableOf(item);
  return t ? t.groups.flatMap(g => g.rows).filter(r => r.item && r.min === r.max && r.chance == null).map(r => ({ item:r.item, qty:r.min })) : [];
}

/* HTML de l'onglet ; inv : inventaire ; busy : achat en cours ; msg : { ok, text } */
export function shopHtml(inv, { busy = false, msg = null } = {}){
  const have = countOf(inv, SHOP.currency);
  const cards = SHOP.items.map(o => {
    const can = affordable(inv, o) > 0, list = contentsOf(o.item);
    return `<div class="card shopCard"><div class="shopHead"><span class="shopIco">${icon(o.item)}</span>`+
      `<div class="shopName">${rname(o.item, undefined, 'b')}<div class="shopPrice">${icon(SHOP.currency)}<b>${nf(o.price)}</b></div></div></div>`+
      (list.length ? `<ul class="shopList">${list.map(c => `<li>${icon(c.item)}${rname(c.item)} <b>× ${nf(c.qty)}</b></li>`).join('')}</ul>`
                   : `<p class="small">${lootHelp(`item:${o.item}`, 'Contenu')}</p>`)+
      `<button class="on shopBuy" data-id="${esc(o.id)}"${busy || !can ? ' disabled' : ''}>`+
      `${can ? 'Acheter' : `Il te manque ${nf(o.price - have)} émeraude${o.price - have > 1 ? 's' : ''}`}</button></div>`;
  }).join('');
  return `<div class="shopWallet">${icon(SHOP.currency)} Tes émeraudes : <b>${nf(have)}</b></div>`+
    (msg ? `<p class="small ${msg.ok ? 'mut' : 'err'}">${esc(msg.text)}</p>` : '')+
    `<div class="shopGrid">${cards}</div>`;
}

/* onBuy(id) → promesse (rejetée avec un message lisible) */
export function setupShop({ onBuy }){
  const root = document.getElementById('shopBody');
  let inv = { slots:[] }, busy = false, msg = null;
  const render = () => { if(root) root.innerHTML = shopHtml(inv, { busy, msg }); };
  root?.addEventListener('click', async e => {
    const b = e.target.closest('.shopBuy'); if(!b || b.disabled || busy) return;
    const o = SHOP.items.find(x => x.id === b.dataset.id); if(!o) return;
    if(!await ask(`Acheter « ${o.item} » pour ${nf(o.price)} émeraudes ?`, { ok:'Acheter' })) return;
    busy = true; msg = null; render();
    try { await onBuy(o.id); msg = { ok:true, text:`${o.item} acheté : il est dans ton inventaire.` }; }
    catch(err){ msg = { ok:false, text:err.message }; }
    finally { busy = false; render(); }
  });
  render();
  return { setInventory(i){ inv = i ?? { slots:[] }; render(); }, refresh: render };
}
