/* Onglet Four : affiche les fours (3 cases chacun) et la progression du lingot en cours.
   Ne modifie jamais rien lui-même : chaque action (poser, retirer, récupérer) est demandée au serveur (onOp),
   qui renvoie les fours et l'inventaire à jour. Entre deux réponses, la fonte est recalculée localement
   (même règle que le serveur, src/meta/furnace.js) pour faire avancer la barre : affichage seulement. */
import { FURNACE } from '../config.js';
import { itemDef, countOf } from '../meta/inventory.js';
import { rcls, rname } from './rarity.js';
import { advance, progress, ingotMs, accepts, recipeOf, activeRecipe, batches, alloyOf, alloysWith, INPUTS, oreFor,
         allRecipes, recipeUsable, recipeMax, recipePlan, FUEL } from '../meta/furnace.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const icon = item => { const d = itemDef(item); return d?.tex ? `<img src="textures/${d.tex}.png" alt="">` : ''; };
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const LABEL = { ore:'Minerai', a:'Ingrédient 1', b:'Ingrédient 2', fuel:'Combustible', out:'Sortie' };
const MODE_LABEL = { smelt:'Fondre', alloy:'Alliage' };
const modeOf = f => f.mode === 'alloy' ? 'alloy' : 'smelt';
const FURN_SLOTS = ['ore', 'a', 'b', 'fuel', 'out'];   // toutes les cases d'un four (« Tout retirer »)
const x = (item, n) => `${icon(item)}${rname(item, `${item} ×${num(n)}`)}`;

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
    if(f.ore.qty < oreFor(recipeOf(f.ore.item))) return `Il faut ${oreFor(recipeOf(f.ore.item))} ${esc(f.ore.item)} pour ${r?.qty > 1 ? `${r.qty} ${esc(r.out)}` : 'un lingot'}.`;
    if(!f.fuel || f.fuel.qty < FURNACE.fuelPerIngot) return `Il faut ${FURNACE.fuelPerIngot} combustibles pour un lingot.`;
    if(f.out && f.out.item !== r.out) return 'Sortie occupée : récupère les lingots pour continuer.';
    return 'À l\'arrêt.';
  }
  function alloyStatus(f, r){
    if(!f.a && !f.b) return 'Pose les deux ingrédients d\'un alliage (bouton Recettes).';
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
      if(!f){
        const key = Object.keys(FURNACE.unlockItems).find(k => FURNACE.unlockItems[k].slot === i);
        h += `<div class="furn locked"><h3>🔒 Four ${i + 1}</h3><p class="mut small">${key
          ? `À débloquer avec un ${rname(key)} (à fabriquer dans l'onglet Craft, puis « Utiliser » dans l'inventaire).` : 'À débloquer (bientôt).'}</p></div>`;
        continue;
      }
      const mode = modeOf(f);
      h += `<div class="furn" data-f="${i}"><div class="fhead"><h3>Four ${i + 1} <span class="mut">· ${esc(FURNACE.tiers[f.tier].name)}${FURNACE.tiers[f.tier].speed !== 1 ? ` (vitesse ×${String(FURNACE.tiers[f.tier].speed).replace('.', ',')})` : ''}</span></h3>`+
           `<div class="seg fmode">${Object.keys(MODE_LABEL).map(m => `<button data-f="${i}" data-mode="${m}"${m === mode ? ' class="on"' : ''}>${MODE_LABEL[m]}</button>`).join('')}</div>`+
           `<button class="fhelp on" data-f="${i}" data-help="${mode}" title="Choisir une recette : le four pose lui-même les ingrédients et le charbon">Recettes</button>`+
           `<button class="fempty" data-empty="${i}" title="Vide toutes les cases de ce four dans l'inventaire"${FURN_SLOTS.some(s => f[s]) ? '' : ' disabled'}>Tout retirer</button></div>`+
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
    try {
      const r = await onOp(op); closePicker();
      if(r?.left){ $('furnErr').textContent = `Inventaire plein : ${r.left} case${r.left > 1 ? 's sont restées' : ' est restée'} dans le four.`; $('furnErr').hidden = false; }
    }
    catch(e){ const err = $('fpick').hidden ? $('furnErr') : $('fpickErr'); err.textContent = e.message; err.hidden = false; }
    finally { busy = false; }
  }

  /* ---- fenêtre de choix : objet, quantité (saisie libre ou Max), ou retirer le contenu ---- */
  function openPicker(i, slot){
    const f = view()[i], cur = f[slot], mode = modeOf(f);
    const other = slot === 'a' ? f.b : slot === 'b' ? f.a : null;   // alliage : l'autre ingrédient déjà posé
    const items = [...new Set(inv.slots.filter(s => s && accepts(slot, s.item, mode, inv) && (!other || alloyOf(s.item, other.item))).map(s => s.item))];   // recette fermée : seulement une fois apprise
    let pick = cur?.item ?? items[0] ?? null;
    const box = $('fpick').querySelector('.box');
    const info = it => {
      if(slot === 'ore'){ const r = recipeOf(it); return `${oreFor(r)} → ${r.qty ?? 1} ${esc(r.out)} · ${mmss(r.time * 1000)}`; }
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
         `<button id="fpickHalf" title="La moitié de ton stock">½</button><button id="fpickMax">Max</button><button class="on" id="fpickOk">Poser</button></div>`
       : `<p class="mut">${slot === 'ore' ? 'Aucun minerai à fondre dans ton inventaire.' : slot === 'fuel' ? 'Aucun combustible dans ton inventaire (charbon).' : 'Aucun ingrédient d\'alliage dans ton inventaire (bouton Recettes).'}</p>`)+
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
      $('fpickHalf').onclick = () => { if(pick) qty.value = Math.max(1, Math.floor(countOf(inv, pick) / 2)); };   // moitié, arrondie en dessous (au moins 1)
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

  /* fenêtre « Recettes » : choisir une recette et un nombre de fournées ; le serveur pose tout (ingrédients, charbon) et
     change le mode du four si besoin (28/10/2026) */
  const WHY = { not_enough:'il en manque', inventory_full:'inventaire plein' };
  function openRecipes(i){
    const f = view()[i], box = $('fpick').querySelector('.box'), speed = FURNACE.tiers[f.tier]?.speed || 1;
    const rows = allRecipes().map(rec => {
      const usable = recipeUsable(rec, inv), max = usable ? recipeMax(f, inv, rec.out) : 0;
      const why = !usable ? '🔒 à apprendre' : max ? `max ${num(max)}` : WHY[recipePlan(f, inv, rec.out, 1).error] ?? '—';
      const back = max ? recipePlan(f, inv, rec.out, 1).back : [];   // ce qui reviendra dans l'inventaire (changement de recette)
      return { rec, max, back, html: `<button class="fopt frecRow" data-out="${esc(rec.out)}"${max ? '' : ' disabled'}>${icon(rec.out)}`+
        `<span>${rname(rec.out, rec.qty > 1 ? `${rec.out} ×${rec.qty}` : rec.out)}`+
        `<span class="fparts">${[...Object.entries(rec.in), [FUEL, rec.fuel]].map(([it, n]) => x(it, n)).join('<span class="mut">+</span>')}`+
        `<span class="mut">· ${mmss(rec.time * 1000 / speed)}</span></span></span>`+
        `<b class="small">${why}</b></button>` };
    });
    let pick = rows.find(r => r.max)?.rec.out ?? null;
    box.innerHTML = `<h3>Four ${i + 1} · choisir une recette</h3><div class="fopts frecs">${rows.map((r, k) =>
        (r.rec.mode !== rows[k - 1]?.rec.mode ? `<p class="mut small">${MODE_LABEL[r.rec.mode]}</p>` : '') + r.html).join('')}</div>`+
      `<div class="fqty"><input id="fpickQty" type="number" min="1" step="1" inputmode="numeric" placeholder="Fournées">`+
      `<button id="fpickHalf" title="La moitié du maximum">½</button><button id="fpickMax">Max</button><button class="on" id="fpickOk"${pick ? '' : ' disabled'}>Lancer</button></div>`+
      `<p class="mut small" id="fpickInfo"></p><p class="err" id="fpickErr" hidden></p>`+
      `<p class="mut small">Le four pose lui-même les ingrédients et le charbon pour le nombre de fournées choisi, en plus de ce qu'il contient déjà. Ils ne sont consommés qu'à la fin de chaque produit. Changer de recette rend à l'inventaire ce qui ne sert plus (le produit en cours est annulé, rien n'est perdu).</p>`+
      `<p style="text-align:right"><button id="fpickClose">Fermer</button></p>`;
    $('fpick').hidden = false;
    const qty = $('fpickQty'), maxOf = () => rows.find(r => r.rec.out === pick)?.max ?? 0;
    const info = () => {
      const row = rows.find(r => r.rec.out === pick), rec = row?.rec, n = Number(qty.value);
      const back = row?.back?.length ? `Reviennent dans l'inventaire : ${row.back.map(b => `${b.item} ×${num(b.qty)}`).join(', ')}. ` : '';
      $('fpickInfo').textContent = back + (rec && Number.isSafeInteger(n) && n > 0
        ? `${num(n * rec.qty)} ${rec.out} en ${mmss(n * rec.time * 1000 / speed)} (sans compter ce qui est déjà dans le four).` : '');
    };
    const select = out => {
      pick = out;
      box.querySelectorAll('.frecRow').forEach(b => b.classList.toggle('on', b.dataset.out === out));
      $('fpickOk').disabled = !out; info();
    };
    select(pick);
    box.querySelectorAll('.frecRow').forEach(b => b.onclick = () => select(b.dataset.out));
    qty.oninput = info;
    $('fpickMax').onclick = () => { if(pick){ qty.value = maxOf(); info(); } };
    $('fpickHalf').onclick = () => { if(pick){ qty.value = Math.max(1, Math.floor(maxOf() / 2)); info(); } };
    const ok = () => {
      const n = Number(qty.value);
      if(!pick) return;
      if(!Number.isSafeInteger(n) || n <= 0){ $('fpickErr').textContent = 'Entre un nombre entier positif.'; $('fpickErr').hidden = false; return; }
      send({ action:'recipe', furnace:i, out:pick, count:n });
    };
    $('fpickOk').onclick = ok;
    qty.onkeydown = e => { if(e.key === 'Enter') ok(); };
    qty.focus();
    $('fpickClose').onclick = closePicker;
  }

  $('furnList').onclick = e => {
    const m = e.target.closest('[data-mode]');
    if(m){ const i = +m.dataset.f; if(modeOf(view()[i]) !== m.dataset.mode) send({ action:'mode', furnace:i, mode:m.dataset.mode }); return; }
    const h = e.target.closest('[data-help]'); if(h) return openRecipes(+h.dataset.f);
    const em = e.target.closest('[data-empty]'); if(em) return send({ action:'empty', furnace:+em.dataset.empty });
    const c = e.target.closest('.fslot'); if(!c) return;
    const i = +c.dataset.f, slot = c.dataset.slot;
    if(slot === 'out'){ if(view()[i]?.out) send({ action:'collect', furnace:i }); return; }
    openPicker(i, slot);
  };
  $('fpick').onclick = e => { if(e.target === $('fpick')) closePicker(); };
  $('furnEmptyAll').onclick = () => { if(view().some(f => FURN_SLOTS.some(s => f[s]))) send({ action:'emptyAll' }); };

  return {
    /* fours envoyés par le serveur (avec son heure, pour caler la barre de progression) */
    set(furnaces){
      if(!furnaces) return;
      state = { list: furnaces.list, max: furnaces.max };
      offset = furnaces.now - Date.now();
      render();
    },
    setInventory(v){ inv = v; },
    /* fours possédés (pour l'inventaire : un Four en fer peut-il ouvrir le suivant ?) */
    state: () => state,
  };
}
