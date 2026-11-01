/* Fenêtres de validation du site (28/10/2026, Geoffrey) : remplacent confirm / alert / prompt du navigateur, qui sortaient
   du thème. Au centre, au-dessus de tout (#dialog). Une à la fois : les suivantes attendent. Entrée = valider, Échap ou
   clic à côté = annuler. Elles ne font que demander : le serveur refait toujours ses vérifications.
     ask(text, { ok, cancel, danger }) → promesse true / false
     tell(text)                        → promesse, à la fermeture
     askText(text, value, { maxLength, readOnly }) → promesse du texte saisi, ou null si annulé */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* contenu de la fenêtre (logique pure, testée) ; kind : 'ask' | 'tell' | 'text' */
export function dialogHtml({ kind, text, ok = 'OK', cancel = 'Annuler', danger = false, value = '', maxLength = 200, readOnly = false }){
  const input = kind === 'text'
    ? `<input class="dlgInput" value="${esc(value)}" maxlength="${maxLength}"${readOnly ? ' readonly' : ''} autocomplete="off" spellcheck="false">` : '';
  const no = kind === 'ask' || (kind === 'text' && !readOnly) ? `<button data-dlg="no">${esc(cancel)}</button>` : '';
  return `<div class="box" role="dialog" aria-modal="true">`+
    `<p class="dlgText">${esc(text).split('\n').join('<br>')}</p>`+
    input+
    `<p class="dlgBtns">${no}<button class="${danger ? 'danger' : 'on'}" data-dlg="yes">${esc(ok)}</button></p></div>`;
}

let chain = Promise.resolve();
function open(opts){
  const run = () => new Promise(resolve => {
    const root = document.getElementById('dialog');
    root.innerHTML = dialogHtml(opts);
    root.hidden = false;
    const input = root.querySelector('.dlgInput');
    const done = yes => {
      removeEventListener('keydown', onKey, true);
      const v = input ? input.value : '';
      root.hidden = true; root.innerHTML = '';
      resolve(opts.kind === 'text' ? (yes || opts.readOnly ? v : null) : opts.kind === 'tell' ? undefined : yes);
    };
    const onKey = e => {
      if(e.key === 'Escape' || e.key === 'Enter'){ e.preventDefault(); e.stopPropagation(); done(e.key === 'Enter'); }
    };
    addEventListener('keydown', onKey, true);
    root.onclick = e => {
      const b = e.target.closest('[data-dlg]');
      if(b) done(b.dataset.dlg === 'yes'); else if(e.target === root) done(false);
    };
    if(input){ input.focus(); input.select(); } else root.querySelector('[data-dlg="yes"]').focus();
  });
  const p = chain.then(run);
  chain = p.catch(() => {});
  return p;
}

export const ask = (text, o = {}) => open({ ...o, kind:'ask', text });
export const tell = text => open({ kind:'tell', text });
export const askText = (text, value = '', o = {}) => open({ ...o, kind:'text', text, value });
