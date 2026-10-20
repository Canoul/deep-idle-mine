/* Onglet Social : les invitations reçues (« X t'invite dans son lobby »), avec Rejoindre / Refuser.
   Lit l'état et appelle des fonctions : c'est le serveur qui fait entrer le joueur dans le lobby. */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* h : { onAccept(id), onDecline(id) } */
export function setupSocial(h){
  const st = { invites:[], busy:false, error:'', html:'' };

  function render(){
    const list = st.invites.length
      ? st.invites.map(i => `<div class="invRow">
          <span class="av">✉</span>
          <span class="grow"><b>${esc(i.from)}</b> t'invite dans ${i.from === i.host ? 'son' : 'le'} lobby
            <small class="mut">${i.from === i.host ? '' : `(hôte : ${esc(i.host)}) `}· ${i.players} joueur${i.players > 1 ? 's' : ''}</small></span>
          <button class="on" data-accept="${esc(i.id)}"${st.busy ? ' disabled' : ''}>Rejoindre</button>
          <button data-decline="${esc(i.id)}"${st.busy ? ' disabled' : ''}>Refuser</button></div>`).join('')
      : '<p class="mut">Aucune invitation pour l\'instant. Un ami peut t\'inviter avec ton pseudo ou ton ID de compte.</p>';
    const html = list + (st.error ? `<p class="err">${esc(st.error)}</p>` : '');
    if(html !== st.html){ $('socialInvites').innerHTML = html; st.html = html; }
  }

  $('socialInvites').onclick = async e => {
    const a = e.target.closest('[data-accept]'), d = e.target.closest('[data-decline]');
    if((!a && !d) || st.busy) return;
    st.busy = true; st.error = ''; render();
    try { a ? await h.onAccept(a.dataset.accept) : await h.onDecline(d.dataset.decline); }
    catch(err){ st.error = err.message; }
    finally { st.busy = false; render(); }
  };

  return { update(invites){ st.invites = invites ?? []; render(); } };
}
