/* Couche appli, démarrage (appelé par src/main.js). Sur le SITE, ce module ne fait rien : il ne touche pas au
   document, le site garde exactement sa page (décision de Jules, 28/10 : la nouvelle interface est dans l'appli
   seulement). Dans l'appli, ou avec ?app dans l'adresse : classe « app » sur <body>, CSS de l'appli, page bord à bord
   (encoches, barres système) ; src/main.js charge ensuite src/app/main.js.

   Le badge ne reste que si le pont natif est bloqué : sans lui, pas de notifications. */
import { nativeStatus, isAppMode } from './mode.js';

export function bootApp({ doc, win }){
  const status = nativeStatus(win), app = isAppMode({ status, search: win.location.search });
  if(!app) return { status, app };
  doc.body.classList.add('app');
  const css = doc.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'src/app/app.css';
  doc.head.append(css);
  const viewport = doc.querySelector('meta[name="viewport"]');
  viewport.content += ',viewport-fit=cover';
  if(status === 'blocked'){
    const b = doc.createElement('div');
    b.id = 'appBadge';
    b.textContent = 'APPLI ⚠ pont bloqué';
    /* styles en ligne : la politique du serveur les autorise (pas les scripts en ligne) */
    Object.assign(b.style, { position: 'fixed', top: '4px', right: '4px', zIndex: '9999', padding: '2px 6px',
      font: '11px/1.4 ui-monospace,monospace', color: '#1a0f08', pointerEvents: 'none',
      background: '#ffb84d' });
    doc.body.append(b);
  }
  return { status, app };
}
