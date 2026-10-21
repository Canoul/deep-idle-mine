/* Notifications en pop-up, en haut à gauche de l'écran (invitation de groupe, demande d'ami).
   sync(items) reçoit la liste complète de ce qui doit être affiché (items = [{ key, icon, text, actions:[{ label,
   primary, run }] }]) : une notification déjà là reste en place, une nouvelle apparaît, une disparue (acceptée ailleurs,
   expirée) s'en va. Un bouton lance son action (une promesse) ; la notification part dès qu'elle a réussi. */
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export function setupNotify(root){
  const shown = new Map();                   // key → élément
  const done = new Set();                    // traitées ici : cachées même si le serveur ne l'a pas encore vu

  function make(it){
    const el = document.createElement('div');
    el.className = 'notif';
    el.innerHTML = `<div class="ntext"><span class="nico">${it.icon ?? ''}</span><span>${it.text}</span></div>`+
      `<div class="nbtns">${it.actions.map((a, i) => `<button data-a="${i}"${a.primary ? ' class="on"' : ''}>${esc(a.label)}</button>`).join('')}</div>`+
      `<p class="err small" hidden></p>`;
    el.onclick = async e => {
      const b = e.target.closest('[data-a]'); if(!b || el.classList.contains('busy')) return;
      el.classList.add('busy');
      const err = el.querySelector('.err'); err.hidden = true;
      try { await it.actions[+b.dataset.a].run(); done.add(it.key); remove(it.key); }
      catch(x){ err.textContent = x.message; err.hidden = false; }
      finally { el.classList.remove('busy'); }
    };
    return el;
  }
  function remove(key){ shown.get(key)?.remove(); shown.delete(key); }

  return {
    sync(items){
      const keys = new Set(items.map(i => i.key));
      for(const k of [...shown.keys()]) if(!keys.has(k)) remove(k);
      for(const k of [...done]) if(!keys.has(k)) done.delete(k);      // le serveur l'a oubliée : la mémoire aussi
      for(const it of items){
        if(shown.has(it.key) || done.has(it.key)) continue;
        const el = make(it); shown.set(it.key, el); root.appendChild(el);
      }
    },
  };
}
