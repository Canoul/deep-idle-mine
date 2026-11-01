/* Fenêtres de validation du site (28/10/2026, Geoffrey) : remplacent confirm / alert / prompt du navigateur, qui sortaient
   du thème. Au centre, au-dessus de tout (#dialog). Une à la fois : les suivantes attendent. Entrée = valider, Échap ou
   clic à côté = annuler. Elles ne font que demander : le serveur refait toujours ses vérifications.
     ask(text, { ok, cancel, danger }) → promesse true / false
     tell(text)                        → promesse, à la fermeture
     askText(text, value, { maxLength, readOnly }) → promesse du texte saisi, ou null si annulé
     askMenu(text, [{ id, label, danger }]) → promesse de l'id choisi, ou null si annulé (01/11/2026)
     askForm({ text, ok, choices:[{ id, label }], noteLabel, noteMax }) → promesse de { choice, note }, ou null si annulé : un choix
       obligatoire et une note facultative (01/11/2026)
   ask accepte aussi links:[{ href, label }] : des liens ouverts à part, sous le texte. */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* contenu de la fenêtre (logique pure, testée) ; kind : 'ask' | 'tell' | 'text' */
export function dialogHtml({ kind, text, ok = 'OK', cancel = 'Annuler', danger = false, value = '', maxLength = 200, readOnly = false, links = [], actions = [], choices = [], noteLabel = '', noteMax = 200 }){
  const input = kind === 'text'
    ? `<input class="dlgInput" value="${esc(value)}" maxlength="${maxLength}"${readOnly ? ' readonly' : ''} autocomplete="off" spellcheck="false">` : '';
  const no = kind === 'ask' || kind === 'menu' || kind === 'form' || (kind === 'text' && !readOnly) ? `<button data-dlg="no">${esc(cancel)}</button>` : '';
  const head = `<div class="box" role="dialog" aria-modal="true"><p class="dlgText">${esc(text).split('\n').join('<br>')}</p>`;
  if(kind === 'menu')
    return head + `<p class="dlgBtns dlgMenu">${actions.map(a => `<button${a.danger ? ' class="danger"' : ''} data-dlg-act="${esc(a.id)}">${esc(a.label)}</button>`).join('')}${no}</p></div>`;
  if(kind === 'form')
    return head + `<div class="dlgChoices">${choices.map(c => `<label class="chk"><input type="radio" name="dlgChoice" value="${esc(c.id)}"> ${esc(c.label)}</label>`).join('')}</div>`+
      `<label class="dlgNote"><span>${esc(noteLabel)}</span><textarea class="dlgInput" rows="3" maxlength="${noteMax}"></textarea></label>`+
      `<p class="dlgBtns">${no}<button class="on" data-dlg="yes" disabled>${esc(ok)}</button></p></div>`;
  const link = links.length ? `<p class="dlgLinks">${links.map(l => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</p>` : '';
  return head + link + input+
    `<p class="dlgBtns">${no}<button class="${danger ? 'danger' : 'on'}" data-dlg="yes">${esc(ok)}</button></p></div>`;
}

let chain = Promise.resolve();
function open(opts){
  const run = () => new Promise(resolve => {
    const root = document.getElementById('dialog');
    root.innerHTML = dialogHtml(opts);
    root.hidden = false;
    const input = root.querySelector('.dlgInput'), okBtn = root.querySelector('[data-dlg="yes"]');
    const picked = () => root.querySelector('input[name="dlgChoice"]:checked')?.value ?? null;
    const done = (yes, act = null) => {
      removeEventListener('keydown', onKey, true);
      const v = input ? input.value : '', choice = picked();
      root.hidden = true; root.innerHTML = '';
      if(opts.kind === 'menu') return resolve(act);
      if(opts.kind === 'form') return resolve(yes && choice ? { choice, note: v.trim() } : null);
      resolve(opts.kind === 'text' ? (yes || opts.readOnly ? v : null) : opts.kind === 'tell' ? undefined : yes);
    };
    const onKey = e => {
      if(e.key === 'Enter' && (e.target.tagName === 'TEXTAREA' || okBtn?.disabled)) return;   // à la ligne dans le commentaire ; pas encore de motif
      if(e.key === 'Enter' && opts.kind === 'menu') return;                                  // Entrée agit sur le bouton qui a le focus
      if(e.key === 'Escape' || e.key === 'Enter'){ e.preventDefault(); e.stopPropagation(); done(e.key === 'Enter'); }
    };
    addEventListener('keydown', onKey, true);
    root.onclick = e => {
      const a = e.target.closest('[data-dlg-act]');
      if(a) return done(true, a.dataset.dlgAct);
      const b = e.target.closest('[data-dlg]');
      if(b){ if(!b.disabled) done(b.dataset.dlg === 'yes'); } else if(e.target === root) done(false);
    };
    root.onchange = () => { if(okBtn && opts.kind === 'form') okBtn.disabled = !picked(); };
    if(opts.kind === 'form' || opts.kind === 'menu') root.querySelector('button')?.focus();
    else if(input){ input.focus(); input.select(); } else okBtn.focus();
  });
  const p = chain.then(run);
  chain = p.catch(() => {});
  return p;
}

export const ask = (text, o = {}) => open({ ...o, kind:'ask', text });
export const tell = text => open({ kind:'tell', text });
export const askText = (text, value = '', o = {}) => open({ ...o, kind:'text', text, value });
export const askMenu = (text, actions) => open({ kind:'menu', text, actions });
export const askForm = o => open({ ...o, kind:'form' });
