/* Lien de lobby dans le chat global (31/10/2026, Geoffrey). Survol : aperçu du groupe tel qu'il est maintenant (portrait de
   chaque joueur, places libres). Clic : rejoindre le groupe. Le serveur vérifie tout, par le numéro du message.
   h : { log, peek(id) → aperçu, join(id), onError(texte) } */
import { lobbyLabel } from '../shared/chat.js';
import { drawPortrait } from '../render/portrait.js';
import { portraitLook, portraitAuras } from './lobby.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const FRESH = 5000;   // ms : un aperçu relu au plus souvent que ça (survols répétés)

/* état d'un groupe lu dans son aperçu ; null : on peut le rejoindre */
export function peekStatus(p){
  if(!p.open) return 'Ce groupe n\'existe plus';
  if(p.locked) return 'Groupe verrouillé';
  if(p.playing) return 'En session';
  return p.size >= p.max ? 'Complet' : null;
}

/* contenu de l'aperçu : p = { mode, level, open, size, max, members:[{ name, leader, look, auras }], playing } */
export function peekHTML(p){
  const status = peekStatus(p);
  const slots = (p.members ?? []).map((m, i) =>
    `<div class="pslot"><span class="av"><canvas width="16" height="16" data-peek="${i}"></canvas></span><span><b>${m.leader ? '★ ' : ''}${esc(m.name)}</b></span></div>`);
  if(p.open) for(let i = slots.length; i < p.max; i++) slots.push('<div class="pslot free"><span class="av"></span><span>Place libre</span></div>');
  return `<b class="tit">${esc(lobbyLabel(p))}</b><div class="peekSlots">${slots.join('')}</div><div class="mut small">${esc(status ?? 'Clique pour rejoindre')}</div>`;
}

export function setupChatLobby(h){
  const tip = document.createElement('div');
  tip.className = 'lobbyPeek'; tip.hidden = true;
  document.body.append(tip);
  const seen = new Map();   // numéro du message → { at, peek }
  let shown = null;         // lien survolé
  const hide = () => { shown = null; tip.hidden = true; };

  function place(el){
    const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(innerWidth - t.width - 8, r.left)) + 'px';
    tip.style.top = (r.top - t.height - 6 >= 8 ? r.top - t.height - 6 : r.bottom + 6) + 'px';
  }
  async function show(el){
    if(shown === el) return;
    shown = el;
    const id = +el.dataset.lobby;
    try {
      let c = seen.get(id);
      if(!c || Date.now() - c.at >= FRESH) seen.set(id, c = { at: Date.now(), peek: await h.peek(id) });
      if(shown !== el) return;
      tip.innerHTML = peekHTML(c.peek); tip.hidden = false;
      tip.querySelectorAll('canvas').forEach(cv => { const m = c.peek.members[+cv.dataset.peek]; drawPortrait(cv, portraitLook(m), portraitAuras(m)); });
      place(el);
    } catch(e){ if(shown === el){ tip.textContent = e.message; tip.hidden = false; place(el); } }
  }
  h.log.addEventListener('mouseover', e => { const el = e.target.closest?.('[data-lobby]'); if(el) show(el); else hide(); });
  h.log.addEventListener('mouseleave', hide);
  h.log.addEventListener('click', async e => {
    const el = e.target.closest?.('[data-lobby]');
    if(!el) return;
    hide();
    try { await h.join(+el.dataset.lobby); } catch(err){ h.onError(err.message); }
  });
}
