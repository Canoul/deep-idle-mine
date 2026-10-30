/* Panneau « Focus minerai » de l'onglet Mine, pendant la session : pour chaque minerai présent dans les areas
   débloquées, trois modes (Aucun / Cibler / Uniquement). Lit l'état, ne le modifie jamais : un clic demande le
   changement au serveur (h.onChange), qui l'enregistre ; la partie l'applique au tick indiqué. */
import { FOCUS } from '../config.js';
import { focusOptions, areaOreLeft, activeOres } from '../sim/focus.js';
import { areaOf } from '../sim/world.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const LABELS = { none:'Aucun', target:'Cibler', only:'Uniquement' };
const TIPS = {
  none:'Comportement normal',
  target:'Pèse plus lourd que tous les autres minerais',
  only:'Ne vise que les minerais « Uniquement », ignore les autres',
};

/* h : { onChange(focus) → promesse de l'événement enregistré ({tick, …}) }
   Le panneau « Focus area » (area visée, ou toujours plus profond) partage le même focus et le même envoi. */
export function setupFocusPanel(h){
  const st = { pending:null, until:null, mine:null, dismissed:null, html:'', areaHtml:'' };

  /* le choix reste affiché jusqu'à ce que la partie l'applique (au tick fixé par le serveur) */
  const send = focus => {
    st.pending = focus; st.until = null; st.html = ''; st.areaHtml = '';
    Promise.resolve(h.onChange(focus)).then(ev => { st.until = ev?.tick ?? 0; },
                                            () => { st.pending = null; st.html = ''; st.areaHtml = ''; });
  };

  /* message « focus abandonné » : dans le panneau du focus concerné (area ou minerai), jusqu'à ce qu'on le ferme */
  const noticeHtml = (m, kind) => {
    const n = m.focusNotice;
    return n && (n.kind === 'area') === (kind === 'area') && n.t !== st.dismissed
      ? `<div class="focusNote">⚠ ${esc(n.msg)} <button data-close title="Fermer">✕</button></div>` : '';
  };
  const dismiss = e => {
    if(!e.target.closest('[data-close]')) return false;
    st.dismissed = st.mine?.focusNotice?.t ?? null; st.html = ''; st.areaHtml = '';
    return true;
  };

  $('focusBody').onclick = e => {
    if(dismiss(e)) return;
    const b = e.target.closest('button[data-k]'); if(!b || !st.mine || st.pending) return;
    const focus = { ...st.mine.prefs.focus };
    if(b.dataset.v === 'none') delete focus[b.dataset.k]; else focus[b.dataset.k] = b.dataset.v;
    send(focus);
  };

  $('focusAreaBody').onclick = e => {
    if(dismiss(e)) return;
    const b = e.target.closest('button[data-area]'); if(!b || !st.mine || st.pending) return;
    const focus = { ...st.mine.prefs.focus };
    if(b.dataset.area === 'deep') delete focus.area; else focus.area = +b.dataset.area;
    send(focus);
  };

  /* boutons : toujours plus profond (de base), puis chaque area débloquée */
  function areaHtml(G, m, focus){
    const cur = Number.isSafeInteger(focus.area) && focus.area < G.unlockedAreas ? focus.area : null;
    const btn = (v, label, tip, on) =>
      `<button data-area="${v}" title="${esc(tip)}" class="${on ? 'on' : ''}"${st.pending ? ' disabled' : ''}>${esc(label)}</button>`;
    let html = '<div class="seg areaSeg">' + btn('deep', 'Plus profond', 'Toujours l\'area débloquée la plus profonde', cur === null);
    for(let k=0; k<G.unlockedAreas; k++){
      const o = areaOreLeft(G, k);
      html += btn(k, String(k), `Travailler uniquement dans l'area ${k} (minerais restants : ${o.left}/${o.total})`, cur === k);
    }
    html += '</div>';
    const where = Math.max(0, areaOf(m.y));
    const deep = FOCUS.ores && activeOres(focus).length ? 'Focus minerai : l\'area la plus proche qui en a encore.'
      : 'Rejoint l\'area la plus profonde et la suit à chaque déblocage.';
    html += `<div class="mut small">${cur === null ? deep
      : cur === where ? `Reste dans l'area ${cur}.` : `Rejoint l'area ${cur}.`}</div>`;
    if(st.pending) html += '<div class="mut small">Envoi…</div>';
    return html + noticeHtml(m, 'area');
  }

  return {
    /* G : partie affichée ; meId : ID du compte du joueur (son mineur) */
    update(G, meId){
      if(st.pending && st.until !== null && G.ticks > st.until){ st.pending = null; st.until = null; }
      const m = G.miners.find(x => x.account !== null && x.account === meId) ?? null;
      st.mine = m;
      $('focusCard').hidden = !m || !FOCUS.ores;   // focus minerai retiré du jeu pour l'instant (30/10, FOCUS.ores)
      $('focusAreaCard').hidden = !m;
      if(!m) return;
      const focus = st.pending ?? m.prefs.focus;
      const ah = areaHtml(G, m, focus);
      if(ah !== st.areaHtml){ $('focusAreaBody').innerHTML = ah; st.areaHtml = ah; }
      const only = Object.values(focus).includes('only');
      let html = focusOptions(G).map(o => {
        const mode = focus[o.key] ?? 'none', off = only && mode === 'target';
        return `<div class="pref${off ? ' off' : ''}"><span>${esc(o.name)} <small class="mut" title="restant / initial dans les areas débloquées">${o.left}/${o.total}</small></span>`+
          `<div class="seg">${FOCUS.modes.map(v =>
            `<button data-k="${o.key}" data-v="${v}" title="${esc(TIPS[v])}" class="${mode === v ? 'on' : ''}"${st.pending ? ' disabled' : ''}>${LABELS[v]}</button>`).join('')}</div></div>`;
      }).join('');
      if(only && Object.values(focus).includes('target')) html += '<div class="mut small">« Uniquement » l\'emporte : les minerais « Cibler » sont ignorés.</div>';
      if(st.pending) html += '<div class="mut small">Envoi…</div>';
      html += noticeHtml(m, 'ore');
      if(html !== st.html){ $('focusBody').innerHTML = html; st.html = html; }   // pas de re-rendu inutile (clics)
    },
  };
}
