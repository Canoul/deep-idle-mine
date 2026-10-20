/* Panneau « Focus minerai » de l'onglet Mine, pendant la session : pour chaque minerai présent dans les areas
   débloquées, trois modes (Aucun / Cibler / Uniquement). Lit l'état, ne le modifie jamais : un clic demande le
   changement au serveur (h.onChange), qui l'enregistre ; la partie l'applique au tick indiqué. */
import { FOCUS } from '../config.js';
import { focusOptions } from '../sim/focus.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const LABELS = { none:'Aucun', target:'Cibler', only:'Uniquement' };
const TIPS = {
  none:'Comportement normal',
  target:'Pèse plus lourd que tous les autres minerais',
  only:'Ne vise que les minerais « Uniquement », ignore les autres',
};

/* h : { onChange(focus) → promesse de l'événement enregistré ({tick, …}) } */
export function setupFocusPanel(h){
  const st = { pending:null, until:null, mine:null, dismissed:null, html:'' };

  $('focusBody').onclick = e => {
    if(e.target.closest('[data-close]')){ st.dismissed = st.mine?.focusNotice?.t ?? null; st.html = ''; return; }
    const b = e.target.closest('button[data-k]'); if(!b || !st.mine || st.pending) return;
    const focus = { ...st.mine.prefs.focus };
    if(b.dataset.v === 'none') delete focus[b.dataset.k]; else focus[b.dataset.k] = b.dataset.v;
    st.pending = focus; st.until = null; st.html = '';
    // le choix reste affiché jusqu'à ce que la partie l'applique (au tick fixé par le serveur)
    Promise.resolve(h.onChange(focus)).then(ev => { st.until = ev?.tick ?? 0; },
                                            () => { st.pending = null; st.html = ''; });
  };

  return {
    /* G : partie affichée ; meId : ID du compte du joueur (son mineur) */
    update(G, meId){
      if(st.pending && st.until !== null && G.ticks > st.until){ st.pending = null; st.until = null; }
      const m = G.miners.find(x => x.account !== null && x.account === meId) ?? null;
      st.mine = m;
      $('focusCard').hidden = !m;
      if(!m) return;
      const focus = st.pending ?? m.prefs.focus;
      const only = Object.values(focus).includes('only');
      let html = focusOptions(G).map(o => {
        const mode = focus[o.key] ?? 'none', off = only && mode === 'target';
        return `<div class="pref${off ? ' off' : ''}"><span>${esc(o.name)} <small class="mut" title="restant / initial dans les areas débloquées">${o.left}/${o.total}</small></span>`+
          `<div class="seg">${FOCUS.modes.map(v =>
            `<button data-k="${o.key}" data-v="${v}" title="${esc(TIPS[v])}" class="${mode === v ? 'on' : ''}"${st.pending ? ' disabled' : ''}>${LABELS[v]}</button>`).join('')}</div></div>`;
      }).join('');
      if(only && Object.values(focus).includes('target')) html += '<div class="mut small">« Uniquement » l\'emporte : les minerais « Cibler » sont ignorés.</div>';
      if(st.pending) html += '<div class="mut small">Envoi…</div>';
      const n = m.focusNotice;
      if(n && n.t !== st.dismissed) html += `<div class="focusNote">⚠ ${esc(n.msg)} <button data-close title="Fermer">✕</button></div>`;
      if(html !== st.html){ $('focusBody').innerHTML = html; st.html = html; }   // pas de re-rendu inutile (clics)
    },
  };
}
