/* Onglet Social : ajouter un ami par pseudo, demandes reçues (accepter / refuser) et envoyées, liste d'amis avec ce
   qu'ils font (hors ligne, en ligne, en session, dans le lobby n/3) et les boutons Inviter / Rejoindre.
   Affiche ce que renvoie le serveur ; chaque action passe par h (promesses rejetées avec un message lisible). */
import { pxi } from './pxicons.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export const STATUS = {
  offline: { label: 'Hors ligne',     cls: 'off' },
  online:  { label: 'En ligne',       cls: 'on' },
  session: { label: 'En session mine', cls: 'play' },
  lobby:   { label: 'Dans le lobby',  cls: 'on' },
};
export const statusText = f => f.status === 'lobby' ? `${STATUS.lobby.label} (${f.size}/${f.max})` : STATUS[f.status]?.label ?? '';

/* h : { request(name), accept(id), refuse(id), remove(id), invite(id), join(id) } */
export function setupSocial(h){
  let st = null, busy = false;

  function friendRow(f){
    const why = f.together ? 'Déjà dans ton groupe' : f.status === 'session' ? 'En session' : f.status === 'offline' ? 'Hors ligne' : '';
    return `<div class="frow"><span class="fdot ${STATUS[f.status].cls}"></span>`+
      `<span class="fname"><b>${esc(f.name)}</b><small class="mut">${esc(statusText(f))}${f.together ? ' · avec toi' : ''}</small></span>`+
      `<span class="fbtns"><button data-invite="${esc(f.id)}"${f.canInvite ? '' : ` disabled title="${esc(why || 'Indisponible')}"`}>${pxi('group')}Inviter</button>`+
      `<button data-join="${esc(f.id)}"${f.canJoin ? '' : ` disabled title="${esc(why || (f.status === 'lobby' ? 'Groupe complet' : 'Indisponible'))}"`}>${pxi('arrow')}Rejoindre</button>`+
      `<button class="x" data-remove="${esc(f.id)}" data-name="${esc(f.name)}" title="Retirer des amis">×</button></span></div>`;
  }

  function render(){
    if(!st) return;
    const on = st.friends.filter(f => f.status !== 'offline').length;
    $('socialReq').innerHTML = st.incoming.length
      ? st.incoming.map(r => `<div class="frow"><span class="fname"><b>${esc(r.name)}</b><small class="mut">veut devenir ton ami</small></span>`+
          `<span class="fbtns"><button class="on" data-accept="${esc(r.id)}">Accepter</button><button data-refuse="${esc(r.id)}">Refuser</button></span></div>`).join('')
      : '';
    $('socialReqCard').hidden = !st.incoming.length;
    $('socialFriends').innerHTML = st.friends.length ? st.friends.map(friendRow).join('')
      : '<p class="mut small">Pas encore d\'amis. Ajoute-en un avec son pseudo ci-dessus.</p>';
    $('socialCount').textContent = st.friends.length ? `${on} en ligne sur ${st.friends.length}` : '';
    $('socialOut').innerHTML = st.outgoing.map(r => `<div class="frow"><span class="fname"><b>${esc(r.name)}</b><small class="mut">demande envoyée · en attente</small></span>`+
      `<span class="fbtns"><button data-remove="${esc(r.id)}">Annuler</button></span></div>`).join('');
    $('socialOutCard').hidden = !st.outgoing.length;
  }

  const msg = (text, ok) => { const m = $('socialMsg'); m.textContent = text; m.className = ok ? 'okmsg small' : 'err small'; m.hidden = !text; };
  async function act(fn, okText){
    if(busy) return;
    busy = true; msg('');
    try { const r = await fn(); if(okText) msg(typeof okText === 'function' ? okText(r) : okText, true); }
    catch(e){ msg(e.message, false); }
    finally { busy = false; }
  }

  $('socialAdd').onsubmit = e => {
    e.preventDefault();
    const name = $('socialName').value;
    act(async () => { const r = await h.request(name); $('socialName').value = ''; return r; },
        r => r.friend ? `✔ ${r.friend} et toi êtes maintenant amis.` : `✔ Demande envoyée à ${r.sent}.`);
  };
  $('socialBody').onclick = e => {
    const b = e.target.closest('button'); if(!b || b.disabled) return;
    const d = b.dataset;
    if(d.accept) act(() => h.accept(d.accept));
    else if(d.refuse) act(() => h.refuse(d.refuse));
    else if(d.invite) act(() => h.invite(d.invite), '✔ Invitation envoyée.');
    else if(d.join) act(() => h.join(d.join));
    else if(d.remove && (!d.name || confirm(`Retirer ${d.name} de tes amis ?`))) act(() => h.remove(d.remove));
  };

  return {
    set(s){ if(s){ st = s; render(); } },
    message: msg,
  };
}
