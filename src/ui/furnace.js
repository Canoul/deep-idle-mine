/* Onglet Four : affiche les fours (3 cases chacun) et la progression du lingot en cours.
   Ne modifie jamais rien lui-même : chaque action (poser, retirer, récupérer) est demandée au serveur (onOp),
   qui renvoie les fours et l'inventaire à jour. Entre deux réponses, la fonte est recalculée localement
   (même règle que le serveur, src/meta/furnace.js) pour faire avancer la barre : affichage seulement. */
import { FURNACE } from '../config.js';
import { itemDef, countOf } from '../meta/inventory.js';
import { rcls, rname } from './rarity.js';
import { advance, progress, ingotMs, accepts, recipeOf, activeRecipe, batches, alloyOf, alloysWith, INPUTS } from '../meta/furnace.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const icon = item => { const d = itemDef(item); return d?.tex ? `<img src="textures/${d.tex}.png" alt="">` : ''; };
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const LABEL = { ore:'Minerai', a:'Ingrédient 1', b:'Ingrédient 2', fuel:'Combustible', out:'Sortie' };
const MODE_LABEL = { smelt:'Fondre', alloy:'Alliage' };
const modeOf = f => f.mode === 'alloy' ? 'alloy' : 'smelt';
const x = (item, n) => `${icon(item)}${rname(item, `${item} ×${num(n)}`)}`;
/* recettes d'un mode, pour la fenêtre « ? » : [{ out, parts:[[objet, quantité]…], time }] */
const recipesOf = mode => mode === 'smelt'
  ? Object.entries(FURNACE.recipes).map(([ore, r]) => ({ out:r.out, parts:[[ore, FURNACE.orePerIngot], ['Charbon', FURNACE.fuelPerIngot]], time:r.time }))
  : FURNACE.alloys.map(r => ({ out:r.out, parts:[...Object.entries(r.in), ['Charbon', r.fuel]], time:r.time }));

/* onOp({ action, furnace, slot, item, qty }) → promesse (rejetée avec un message lisible) */
export function setupFurnace({ onOp }){
  let state = { list:[], max:FURNACE.max }, offset = 0, inv = { slots:[] }, shown = '', busy = false;
  const now = () => Date.now() + offset;
  /* état affiché : celui du serveur, avancé jusqu'à maintenant (copie : on ne touche pas à l'original) */
  const view = () => state.list.map(f => advance(structuredClone(f), now()));

  function slotHtml(i, slot, c, locked){
    const q = c ? `<span class="q">${num(c.qty)}</span>` : '';
    const hint = c ? `${esc(c.item)} × ${num(c.qty)}` : LABEL[slot];
    return `<div class="slot fslot ${slot}${c ? rcls(c.item) : ' empty'}" data-f="${i}" data-slot="${slot}" title="${esc(hint)}"${locked ? ' aria-disabled="true"' : ''}>`+
           `${c ? icon(c.item) : `<span class="fhint">${LABEL[slot]}</span>`}${q}</div>`;
  }

  function statusText(f){
    const r = activeRecipe(f);
    if(f.since !== null) {
      const left = ingotMs(f) - (now() - f.since), n = batches(f);
      return `🔥 ${esc(r.out)} : ${mmss(left)} · encore ${n} possible${n > 1 ? 's' : ''}`;
    }
    if(modeOf(f) === 'alloy') return alloyStatus(f, r);
    if(!f.ore) return 'Pose des minerais pour commencer.';
    if(f.ore.qty < FURNACE.orePerIngot) return `Il faut ${FURNACE.orePerIngot} ${esc(f.ore.item)} pour un lingot.`;
    if(!f.fuel || f.fuel.qty < FURNACE.fuelPerIngot) return `Il faut ${FURNACE.fuelPerIngot} combustibles pour un lingot.`;
    if(f.out && f.out.item !== r.out) return 'Sortie occupée : récupère les lingots pour continuer.';
    return 'À l\'arrêt.';
  }
  function alloyStatus(f, r){
    if(!f.a && !f.b) return 'Pose les deux ingrédients d\'un alliage (bouton ? pour les recettes).';
    if(!r){
      const one = (f.a || f.b).item, names = [...new Set(alloysWith(one).flatMap(a => Object.keys(a.in)).filter(i => i !== one))];
      return `Ajoute l'autre ingrédient : ${esc(names.join(' ou '))}.`;
    }
    for(const [slot, n] of Object.entries(r.need)) if(!f[slot] || f[slot].qty < n)
      return slot === 'fuel' ? `Il faut ${n} combustibles pour un ${esc(r.out)}.` : `Il faut ${n} ${esc(f[slot]?.item ?? '')} pour un ${esc(r.out)}.`;
    if(f.out && f.out.item !== r.out) return 'Sortie occupée : récupère-la pour continuer.';
    return 'À l\'arrêt.';
  }

  function render(){
    const list = view();
    let h = '';
    for(let i = 0; i < state.max; i++){
      const f = list[i];
      if(!f){ h += `<div class="furn locked"><h3>🔒 Four ${i + 1}</h3><p class="mut small">À débloquer (bientôt).</p></div>`; continue; }
      const mode = modeOf(f);
      h += `<div class="furn" data-f="${i}"><div class="fhead"><h3>Four ${i + 1} <span class="mut">· ${esc(FURNACE.tiers[f.tier].name)}</span></h3>`+
           `<div class="seg fmode">${Object.keys(MODE_LABEL).map(m => `<button data-f="${i}" data-mode="${m}"${m === mode ? ' class="on"' : ''}>${MODE_LABEL[m]}</button>`).join('')}</div>`+
           `<button class="fhelp" data-f="${i}" data-help="${mode}" title="Recettes : ${MODE_LABEL[mode]}">?</button></div>`+
           `<div class="fgrid"><div class="fin">${INPUTS[mode].map(s => slotHtml(i, s, f[s])).join('')}${slotHtml(i, 'fuel', f.fuel)}</div>`+
           `<div class="farrow"><div class="bar"><i style="width:${(progress(f, now()) * 100).toFixed(1)}%"></i></div><span>➜</span></div>`+
           `${slotHtml(i, 'out', f.out)}</div><p class="fstat small">${statusText(f)}</p></div>`;
    }
    $('furnList').innerHTML = h;
    shown = sig(list);
  }
  /* ce qui change l'affichage hors barre : contenu des cases et marche/arrêt */
  const sig = list => JSON.stringify(list.map(f => [f.mode, f.ore, f.a, f.b, f.fuel, f.out, f.since]));

  /* rafraîchissement léger : la barre et le texte avancent ; tout est redessiné si un lingot vient de finir */
  function refresh(){
    if($('furnList').closest('.view').hidden || !state.list.length) return;
    const list = view();
    if(sig(list) !== shown) return render();
    list.forEach((f, i) => {
      const card = $('furnList').querySelector(`.furn[data-f="${i}"]`);
      if(!card) return;
      card.querySelector('.bar i').style.width = (progress(f, now()) * 100).toFixed(1) + '%';
      card.querySelector('.fstat').innerHTML = statusText(f);
    });
  }
  setInterval(refresh, 250);

  async function send(op){
    if(busy) return;                       // une demande à la fois (le serveur protège de toute façon des doublons)
    busy = true; $('furnErr').hidden = true;
    try { await onOp(op); closePicker(); }
    catch(e){ const err = $('fpick').hidden ? $('furnErr') : $('fpickErr'); err.textContent = e.message; err.hidden = false; }
    finally { busy = false; }
  }

  /* ---- fenêtre de choix : objet, quantité (saisie libre ou Max), ou retirer le contenu ---- */
  function openPicker(i, slot){
    const f = view()[i], cur = f[slot], mode = modeOf(f);
    const other = slot === 'a' ? f.b : slot === 'b' ? f.a : null;   // alliage : l'autre ingrédient déjà posé
    const items = [...new Set(inv.slots.filter(s => s && accepts(slot, s.item, mode) && (!other || alloyOf(s.item, other.item))).map(s => s.item))];
    let pick = cur?.item ?? items[0] ?? null;
    const box = $('fpick').querySelector('.box');
    const info = it => {
      if(slot === 'ore'){ const r = recipeOf(it); return `${FURNACE.orePerIngot} → 1 ${esc(r.out)} · ${mmss(r.time * 1000)}`; }
      if(slot === 'fuel') return 'combustible';
      return alloysWith(it).map(r => `${r.in[it]} → 1 ${esc(r.out)}`).join(' · ');
    };
    const opts = items.map(it => {
      const lock = cur && cur.item !== it;
      return `<button class="fopt${it === pick ? ' on' : ''}" data-item="${esc(it)}"${lock ? ' disabled title="Vide la case d\'abord"' : ''}>`+
             `${icon(it)}<span>${rname(it)}<small class="mut">${info(it)}</small></span><b>${num(countOf(inv, it))}</b></button>`;
    }).join('');
    box.innerHTML = `<h3>Four ${i + 1} · case ${LABEL[slot].toLowerCase()}</h3>`+
      (cur ? `<div class="fcur">${icon(cur.item)}<span>Dedans : ${rname(cur.item, `${cur.item} × ${num(cur.qty)}`, 'b')}</span>`+
             `<button id="fpickOut">Tout retirer</button></div>` : '')+
      (items.length ? `<div class="fopts">${opts}</div>`+
         `<div class="fqty"><input id="fpickQty" type="number" min="1" step="1" inputmode="numeric" placeholder="Quantité">`+
         `<button id="fpickMax">Max</button><button class="on" id="fpickOk">Poser</button></div>`
       : `<p class="mut">${slot === 'ore' ? 'Aucun minerai à fondre dans ton inventaire.' : slot === 'fuel' ? 'Aucun combustible dans ton inventaire (charbon).' : 'Aucun ingrédient d\'alliage dans ton inventaire (bouton ? pour les recettes).'}</p>`)+
      `<p class="err" id="fpickErr" hidden></p><p style="text-align:right"><button id="fpickClose">Fermer</button></p>`;
    $('fpick').hidden = false;

    box.querySelectorAll('.fopt').forEach(b => b.onclick = () => {
      pick = b.dataset.item;
      box.querySelectorAll('.fopt').forEach(x => x.classList.toggle('on', x === b));
    });
    const qty = $('fpickQty');
    if(qty){
      qty.focus();
      $('fpickMax').onclick = () => { if(pick) qty.value = countOf(inv, pick); };
      const ok = () => {
        const n = Number(qty.value);
        if(!pick) return;
        if(!Number.isSafeInteger(n) || n <= 0){ $('fpickErr').textContent = 'Entre un nombre entier positif.'; $('fpickErr').hidden = false; return; }
        send({ action:'load', furnace:i, slot, item:pick, qty:n });
      };
      $('fpickOk').onclick = ok;
      qty.onkeydown = e => { if(e.key === 'Enter') ok(); };
    }
    if(cur) $('fpickOut').onclick = () => send({ action:'unload', furnace:i, slot });
    $('fpickClose').onclick = closePicker;
  }
  function closePicker(){ $('fpick').hidden = true; }

  /* fenêtre « ? » : les recettes du mode du four */
  function openHelp(mode){
    const box = $('fpick').querySelector('.box');
    box.innerHTML = `<h3>Recettes · ${MODE_LABEL[mode]}</h3><div class="frecipes">`+
      recipesOf(mode).map(r => `<div class="frec"><div class="fout">${icon(r.out)}${rname(r.out, r.out, 'b')}<span class="mut small">${mmss(r.time * 1000)}</span></div>`+
        `<div class="fparts">${r.parts.map(([it, n]) => x(it, n)).join('<span class="mut">+</span>')}</div></div>`).join('')+
      `</div><p class="mut small">Les ingrédients ne sont consommés qu'à la fin de chaque produit.${mode === 'alloy' ? ' Les deux ingrédients se posent dans n\'importe quel ordre.' : ''}</p>`+
      `<p style="text-align:right"><button id="fpickClose">Fermer</button></p>`;
    $('fpick').hidden = false;
    $('fpickClose').onclick = closePicker;
  }

  $('furnList').onclick = e => {
    const m = e.target.closest('[data-mode]');
    if(m){ const i = +m.dataset.f; if(modeOf(view()[i]) !== m.dataset.mode) send({ action:'mode', furnace:i, mode:m.dataset.mode }); return; }
    const h = e.target.closest('[data-help]'); if(h) return openHelp(h.dataset.help);
    const c = e.target.closest('.fslot'); if(!c) return;
    const i = +c.dataset.f, slot = c.dataset.slot;
    if(slot === 'out'){ if(view()[i]?.out) send({ action:'collect', furnace:i }); return; }
    openPicker(i, slot);
  };
  $('fpick').onclick = e => { if(e.target === $('fpick')) closePicker(); };

  return {
    /* fours envoyés par le serveur (avec son heure, pour caler la barre de progression) */
    set(furnaces){
      if(!furnaces) return;
      state = { list: furnaces.list, max: furnaces.max };
      offset = furnaces.now - Date.now();
      render();
    },
    setInventory(v){ inv = v; },
  };
}
