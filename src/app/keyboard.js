/* Couche appli : le clavier du téléphone (03/11/2026, Geoffrey). Sur un Galaxy S24, en tapant son pseudo ou son mot de
   passe, la page partait tout en bas et le champ était caché : le clavier passe PAR-DESSUS la page (appli bord à bord,
   la page n'est pas raccourcie). Ici : la hauteur du clavier va dans --kb-h (sur <body>), les fenêtres en tiennent
   compte (src/app/app.css), et le champ touché est ramené au milieu de ce qui reste visible.
   Sources de la hauteur : le plugin Keyboard s'il est là (évènements keyboardWillShow / keyboardWillHide), sinon la
   fenêtre visible du navigateur (visualViewport). keyboardHeight et isField : logique pure, testée. */

/* hauteur cachée par le clavier (px) : celle du plugin si on l'a, sinon ce que visualViewport ne montre plus */
export function keyboardHeight({ plugin = null, inner = 0, vvHeight = null, vvTop = 0 } = {}){
  if(Number.isFinite(plugin) && plugin > 0) return Math.round(plugin);
  if(!Number.isFinite(vvHeight)) return 0;
  const hidden = inner - vvHeight - (vvTop || 0);
  return hidden > 60 ? Math.round(hidden) : 0;            // moins : barre d'adresse, zoom, pas un clavier
}

/* un champ où l'on tape (le clavier s'ouvre) */
const TYPED = new Set(['text', 'password', 'search', 'email', 'number', 'tel', 'url']);
export const isField = el => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TYPED.has((el.type || 'text').toLowerCase())));

export function startKeyboard({ doc, win }){
  let fromPlugin = 0;
  const vv = win.visualViewport;
  function apply(){
    const h = keyboardHeight({ plugin: fromPlugin, inner: win.innerHeight, vvHeight: vv?.height ?? null, vvTop: vv?.offsetTop ?? 0 });
    doc.body.style.setProperty('--kb-h', h + 'px');
    doc.body.classList.toggle('appKb', h > 0);
    const el = doc.activeElement;
    if(h > 0 && isField(el)) win.setTimeout(() => el.scrollIntoView({ block: 'center', inline: 'nearest' }), 50);
  }
  const K = win.Capacitor?.Plugins?.Keyboard;
  if(K?.addListener){
    try {
      K.addListener('keyboardWillShow', i => { fromPlugin = i?.keyboardHeight || 0; apply(); });
      K.addListener('keyboardDidShow', i => { fromPlugin = i?.keyboardHeight || fromPlugin; apply(); });
      K.addListener('keyboardWillHide', () => { fromPlugin = 0; apply(); });
    } catch(e){ console.warn(e); }
  }
  vv?.addEventListener('resize', apply);
  /* le champ touché : au milieu de ce qui reste visible, une fois le clavier ouvert */
  doc.addEventListener('focusin', e => { if(isField(e.target)) win.setTimeout(apply, 300); });
  doc.addEventListener('focusout', () => win.setTimeout(apply, 300));
  apply();
}
