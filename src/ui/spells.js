/* Onglet Sorts : à gauche les emplacements (SPELLS.slots, dont SPELLS.openSlots ouverts, les autres avec un cadenas),
   à droite tous les sorts. Un sort disponible s'équipe d'un clic (premier emplacement libre, sinon celui choisi) ou en
   le glissant sur un emplacement ; un sort verrouillé est grisé avec son cadenas, on voit son nom et sa condition.
   Un parchemin possédé s'apprend d'ici. Le serveur vérifie tout (onOp) ; ce module ne fait qu'afficher ce qu'il renvoie.
   Débloqué / équipable : recalculé ici avec la spécialisation et les niveaux du moment (mêmes règles que le serveur). */
import { SPELLS } from '../config.js';
import { pxi } from './pxicons.js';
import { SPELL, isUnlocked, equipBlocked, unlockText } from '../meta/spells.js';
import { countOf } from '../meta/inventory.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const TREE_LABEL = { mineur:'Mineur', logisticien:'Logisticien', barbare:'Barbare' };
const WHY = { locked:'Pas encore débloqué', wrong_tree:'Réservé à une autre spécialisation' };

/* onOp({ action:'equip', spell, slot } | { action:'unequip', slot } | { action:'learn', item }) → promesse de la réponse
   du serveur ({ spells, inventory? }) ; onInventory(inv) : inventaire renvoyé après un parchemin appris */
export function setupSpells({ onOp, onInventory = () => {} }){
  let st = { learned:[], slots:Array(SPELLS.openSlots).fill(null) }, ctx = { tree:null, spec:{} }, inv = { slots:[] };
  let sel = 0, busy = false, msg = '';

  const owned = id => SPELL[id].unlock.scroll ? countOf(inv, SPELL[id].unlock.scroll) : 0;

  function render(){
    $('spellSlots').innerHTML = Array.from({ length:SPELLS.slots }, (_, i) => {
      if(i >= SPELLS.openSlots)
        return `<div class="spSlot locked" data-tip="Emplacement verrouillé">${pxi('lock')}</div>`;
      const id = st.slots[i], s = id && SPELL[id], bad = id && equipBlocked(st, id, ctx);
      const tip = s ? [s.name, s.desc, `Recharge ${s.cd} s`, bad ? `⚠ ${WHY[bad]} : il n'agira pas` : '', 'Clic : retirer'].filter(Boolean).join('\n')
                    : 'Emplacement libre : clique un sort, ou glisse-le ici';
      return `<div class="spSlot${s ? ' full' : ''}${i === sel ? ' sel' : ''}${bad ? ' bad' : ''}" data-slot="${i}" role="button" tabindex="0" data-tip="${esc(tip)}">`+
             (s ? `<span class="spIcon">${s.icon}</span><span class="spName">${esc(s.name)}</span>` : '<span class="mut small">Libre</span>')+`</div>`;
    }).join('');
    $('spellList').innerHTML = SPELLS.list.map(s => {
      const unlocked = isUnlocked(st, s.id, ctx), why = equipBlocked(st, s.id, ctx), on = st.slots.includes(s.id);
      const learn = !unlocked && owned(s.id) > 0;
      const tip = [s.name, s.desc, `Recharge ${s.cd} s`, unlocked ? '' : '🔒 ' + unlockText(s.id),
                   s.needTree ? `Réservé au ${TREE_LABEL[s.needTree]}` : 'Toutes les spécialisations',
                   !why && !busy ? (on ? 'Déjà équipé' : 'Clic ou glisser : équiper') : ''].filter(Boolean).join('\n');
      return `<div class="spCard${why ? ' off' : ''}${on ? ' on' : ''}"${!why ? ` data-spell="${s.id}" draggable="true" role="button" tabindex="0"` : ''} data-tip="${esc(tip)}">`+
             `<span class="spIcon">${unlocked ? s.icon : pxi('lock')}</span><span class="spText"><b>${esc(s.name)}</b>`+
             `<small class="mut">${esc(unlocked ? (why ? WHY[why] : `Recharge ${s.cd} s`) : unlockText(s.id))}</small></span>`+
             (learn ? `<button data-learn="${esc(s.unlock.scroll)}"${busy ? ' disabled' : ''}>Apprendre</button>` : '')+`</div>`;
    }).join('');
    $('spellMsg').textContent = msg;
    $('spellMsg').hidden = !msg;
  }

  async function send(op){
    if(busy) return;
    busy = true; msg = ''; render();
    try { const r = await onOp(op); st = r.spells; if(r.inventory){ inv = r.inventory; onInventory(r.inventory); } }
    catch(e){ msg = e.message; }
    finally { busy = false; render(); }
  }
  /* équiper : dans l'emplacement donné, sinon le premier libre, sinon celui choisi */
  function equip(spell, slot){
    if(slot == null){ const free = st.slots.indexOf(null); slot = free >= 0 ? free : sel; }
    sel = slot;
    send({ action:'equip', spell, slot });
  }

  $('spellList').onclick = e => {
    const l = e.target.closest('[data-learn]');
    if(l){ send({ action:'learn', item:l.dataset.learn }); return; }
    const c = e.target.closest('[data-spell]');
    if(c && !st.slots.includes(c.dataset.spell)) equip(c.dataset.spell);
  };
  $('spellList').onkeydown = e => { const c = e.target.closest('[data-spell]'); if(c && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); equip(c.dataset.spell); } };
  $('spellList').ondragstart = e => { const c = e.target.closest('[data-spell]'); if(c) e.dataTransfer.setData('text/plain', c.dataset.spell); };
  $('spellSlots').onclick = e => {
    const b = e.target.closest('[data-slot]'); if(!b) return;
    const i = +b.dataset.slot;
    if(st.slots[i]) send({ action:'unequip', slot:i }); else { sel = i; render(); }
  };
  $('spellSlots').ondragover = e => { if(e.target.closest('[data-slot]')) e.preventDefault(); };
  $('spellSlots').ondrop = e => {
    const b = e.target.closest('[data-slot]'), id = e.dataTransfer.getData('text/plain');
    if(b && Object.hasOwn(SPELL, id)){ e.preventDefault(); equip(id, +b.dataset.slot); }
  };

  render();
  return {
    set(s){ if(s){ st = s; render(); } },
    /* spécialisation choisie (onglet Skills) et niveaux de spécialisation (progression) : débloqué / équipable */
    setContext(c){ ctx = { ...ctx, ...c }; render(); },
    setInventory(i){ inv = i ?? { slots:[] }; render(); },
  };
}
