/* Onglet Concasseur : 8 cases d'entrée (blocs), une barre de cycle, 8 cases de sortie (butin).
   Ne modifie jamais rien lui-même : chaque action (poser, retirer, récupérer) est demandée au serveur (onOp), qui
   renvoie le concasseur et l'inventaire à jour. Le butin est tiré par le serveur : quand la barre du cycle est pleine,
   l'onglet redemande l'état (onSync) au lieu de calculer quoi que ce soit. */
import { CRUSHER } from '../config.js';
import { itemDef, countOf } from '../meta/inventory.js';
import { rcls, rname } from './rarity.js';
import { crushable, nextSlot, lotsLeft, progress, cycleMs, dropOdds } from '../meta/crusher.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const icon = item => { const d = itemDef(item); return d?.tex ? `<img src="textures/${d.tex}.png" alt="">` : ''; };
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
/* chance en % lisible : 0,1 % · 0,015 % */
const pct = p => (Math.round(p * 1e6) / 1e4).toString().replace('.', ',') + ' %';
const BATCH = CRUSHER.batch;

/* onOp({ action, slot, item, qty }) et onSync() → promesses (rejetées avec un message lisible) */
export function setupCrusher({ onOp, onSync }){
  let st = null, offset = 0, inv = { slots:[] }, busy = false, syncing = false, lastSync = 0, shown = '';
  const now = () => Date.now() + offset;
  const visible = () => !$('crushBody').closest('.view').hidden;

  function slotHtml(side, i, s){
    const q = s ? `<span class="q">${num(s.qty)}</span>` : '';
    const next = side === 'in' && st.since !== null && nextSlot(st) === i ? ' next' : '';
    const title = s ? `${s.item} × ${num(s.qty)}` : side === 'in' ? 'Poser des blocs' : 'Sortie';
    return `<div class="slot cslot ${side}${s ? rcls(s.item) : ' empty'}${next}" data-side="${side}" data-i="${i}" title="${esc(title)}">${s ? icon(s.item) : ''}${q}</div>`;
  }

  function statusText(){
    const k = nextSlot(st);
    if(st.since !== null){
      const n = lotsLeft(st);
      return `⚙ Concasse ${BATCH} ${esc(st.in[k].item)} (case ${k + 1}) : ${mmss(cycleMs() - (now() - st.since))} · encore ${n} lot${n > 1 ? 's' : ''}`;
    }
    if(st.in.every(s => !s)) return 'Pose des blocs (terre, pierre, pierre dure) pour commencer.';
    if(k < 0) return `Il faut au moins ${BATCH} blocs dans une case pour un concassage.`;
    if(st.out.every(Boolean)) return 'Sortie pleine : récupère le butin pour continuer.';
    return 'À l\'arrêt.';
  }

  function findsHtml(){
    if(!st.finds.length) return '<p class="mut small">Rien trouvé pour l\'instant.</p>';
    return '<ul class="cfinds">' + st.finds.slice().reverse().map(f => {
      const d = new Date(f.at), at = `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}`;
      return `<li><span class="mut small">${at}</span> ${BATCH} ${esc(f.from)} → ${Object.entries(f.loot).map(([i, q]) => `${icon(i)}${rname(i, q > 1 ? `${i} ×${q}` : i, 'b')}`).join(', ')}</li>`;
    }).join('') + '</ul>';
  }

  function render(){
    if(!st) return;
    $('crushBody').innerHTML =
      `<div class="crush"><div class="fhead"><h3>Entrée <span class="mut small">· ${BATCH} blocs par cycle, de la case 1 à la case ${CRUSHER.inSlots}</span></h3>`+
      `<button class="fhelp" id="crushHelp" title="Tables de butin">Butin</button></div>`+
      `<div class="cgrid" style="--cols:${CRUSHER.cols}">${st.in.map((s, i) => slotHtml('in', i, s)).join('')}</div>`+
      `<div class="farrow cbar"><div class="bar"><i style="width:${(progress(st, now()) * 100).toFixed(1)}%"></i></div><span>⬇</span></div>`+
      `<p class="fstat small" id="crushStat">${statusText()}</p>`+
      `<div class="fhead"><h3>Sortie</h3><button id="crushAll"${st.out.some(Boolean) ? '' : ' disabled'}>Tout récupérer</button></div>`+
      `<div class="cgrid" style="--cols:${CRUSHER.cols}">${st.out.map((s, i) => slotHtml('out', i, s)).join('')}</div></div>`+
      `<div class="crush"><h3>Dernières trouvailles <span class="mut small">· ${num(st.crushed)} lot${st.crushed > 1 ? 's' : ''} concassé${st.crushed > 1 ? 's' : ''} en tout</span></h3>${findsHtml()}</div>`;
    shown = sig();
  }
  const sig = () => JSON.stringify([st.in, st.out, st.since, st.crushed]);

  /* barre et texte toutes les 250 ms ; cycle fini → on redemande l'état au serveur (au plus toutes les 3 s) */
  function tick(){
    if(!st || !visible()) return;
    if(sig() !== shown) return render();
    if(st.since !== null && now() - st.since >= cycleMs() && !syncing && Date.now() - lastSync > 3000){
      syncing = true; lastSync = Date.now();
      onSync().catch(() => {}).finally(() => { syncing = false; });
    }
    const bar = $('crushBody').querySelector('.cbar .bar i');
    if(bar) bar.style.width = (progress(st, now()) * 100).toFixed(1) + '%';
    const s = $('crushStat'); if(s) s.innerHTML = statusText();
  }
  setInterval(tick, 250);

  async function send(op){
    if(busy) return;                       // une demande à la fois (le serveur protège de toute façon des doublons)
    busy = true; $('crushErr').hidden = true;
    try { await onOp(op); closePicker(); }
    catch(e){ const err = $('cpick').hidden ? $('crushErr') : $('cpickErr'); err.textContent = e.message; err.hidden = false; }
    finally { busy = false; }
  }

  /* ---- fenêtre de choix pour une case d'entrée : bloc, quantité (saisie libre ou Max), ou retirer ---- */
  function openPicker(i){
    const cur = st.in[i];
    const items = [...new Set(inv.slots.filter(s => s && crushable(s.item)).map(s => s.item))];
    let pick = cur?.item ?? items[0] ?? null;
    const box = $('cpick').querySelector('.box');
    const opts = items.map(it => {
      const lock = cur && cur.item !== it;
      return `<button class="fopt${it === pick ? ' on' : ''}" data-item="${esc(it)}"${lock ? ' disabled title="Vide la case d\'abord"' : ''}>`+
             `${icon(it)}<span>${rname(it)}<small class="mut">${BATCH} par cycle</small></span><b>${num(countOf(inv, it))}</b></button>`;
    }).join('');
    box.innerHTML = `<h3>Concasseur · case ${i + 1}</h3>`+
      (cur ? `<div class="fcur">${icon(cur.item)}<span>Dedans : ${rname(cur.item, `${cur.item} × ${num(cur.qty)}`, 'b')}</span>`+
             `<button id="cpickOut">Tout retirer</button></div>` : '')+
      (items.length ? `<div class="fopts">${opts}</div>`+
         `<div class="fqty"><input id="cpickQty" type="number" min="1" step="1" inputmode="numeric" placeholder="Quantité">`+
         `<button id="cpickMax">Max</button><button class="on" id="cpickOk">Poser</button></div>`
       : `<p class="mut">Aucun bloc à concasser dans ton inventaire (terre, pierre, pierre dure).</p>`)+
      `<p class="err" id="cpickErr" hidden></p><p style="text-align:right"><button id="cpickClose">Fermer</button></p>`;
    $('cpick').hidden = false;

    box.querySelectorAll('.fopt').forEach(b => b.onclick = () => {
      pick = b.dataset.item;
      box.querySelectorAll('.fopt').forEach(x => x.classList.toggle('on', x === b));
    });
    const qty = $('cpickQty');
    if(qty){
      qty.focus();
      $('cpickMax').onclick = () => { if(pick) qty.value = countOf(inv, pick); };
      const ok = () => {
        const n = Number(qty.value);
        if(!pick) return;
        if(!Number.isSafeInteger(n) || n <= 0){ $('cpickErr').textContent = 'Entre un nombre entier positif.'; $('cpickErr').hidden = false; return; }
        send({ action:'load', slot:i, item:pick, qty:n });
      };
      $('cpickOk').onclick = ok;
      qty.onkeydown = e => { if(e.key === 'Enter') ok(); };
    }
    if(cur) $('cpickOut').onclick = () => send({ action:'unload', slot:i });
    $('cpickClose').onclick = closePicker;
  }
  function closePicker(){ $('cpick').hidden = true; }

  /* fenêtre « ? » : les vraies chances de chaque bloc, par lot. Par famille (une gemme, un treasure) : la chance
     par lot ; puis le détail objet par objet. Ni moyenne ni temps estimé. */
  function openHelp(){
    const box = $('cpick').querySelector('.box');
    const FAMILY = { gem:'Une gemme', treasure:'Un treasure' };
    const family = f => f.items.length === 1
      ? `<div class="fodds">${icon(f.items[0].item)}${rname(f.items[0].item, f.items[0].item, 'b')} <b>${pct(f.chance)}</b></div>`
      : `<div class="fodds"><b>${FAMILY[f.family] ?? esc(f.family)} : ${pct(f.chance)}</b></div>`+
        `<div class="fparts">${f.items.map(i => `${icon(i.item)}${rname(i.item)} <span class="mut">${pct(i.chance)}</span>`).join('<span class="mut">·</span>')}</div>`;
    box.innerHTML = `<h3>Chances par lot de ${BATCH} blocs</h3><div class="frecipes">`+
      Object.keys(CRUSHER.loot).map(b => `<div class="frec"><div class="fout">${icon(b)}<b>${BATCH} ${esc(b)}</b></div>`+
        dropOdds(b).map(family).join('') + `</div>`).join('')+
      `</div><p class="mut small">Un lot par ${CRUSHER.time} s, même page fermée. À chaque lot, un seul tirage pour les gemmes ` +
      `(au plus une) et un pour le treasure : la plupart des lots ne donnent rien.</p>`+
      `<p style="text-align:right"><button id="cpickClose">Fermer</button></p>`;
    $('cpick').hidden = false;
    $('cpickClose').onclick = closePicker;
  }

  $('crushBody').onclick = e => {
    if(e.target.closest('#crushHelp')) return openHelp();
    if(e.target.closest('#crushAll')) return send({ action:'collect', slot:'all' });
    const c = e.target.closest('.cslot'); if(!c) return;
    const i = +c.dataset.i;
    if(c.dataset.side === 'out'){ if(st.out[i]) send({ action:'collect', slot:i }); return; }
    openPicker(i);
  };
  $('cpick').onclick = e => { if(e.target === $('cpick')) closePicker(); };

  return {
    /* concasseur envoyé par le serveur (avec son heure, pour caler la barre) */
    set(c){
      if(!c) return;
      st = c; offset = c.now - Date.now();
      render();
    },
    setInventory(v){ inv = v; },
  };
}
