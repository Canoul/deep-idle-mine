/* Couche appli, démarrage (appelé par src/main.js). Sur le SITE, ce module ne fait rien : il ne touche pas au
   document, le site garde exactement sa page (décision de Jules, 28/10 : la nouvelle interface est dans l'appli
   seulement). Dans l'appli, ou avec ?app dans l'adresse : classe « app » sur <body>, que la couche appli utilisera.

   Badge PROVISOIRE (étape 1 de l'appli, remplacé à l'étape 2) : dans l'appli, il dit si le pont natif répond,
   pour le voir d'un coup d'œil sur un téléphone de test. */
import { nativeStatus, isAppMode } from './mode.js';

const BADGE = { ok: 'APPLI ✓', blocked: 'APPLI ⚠ pont bloqué' };

export function bootApp({ doc, win }){
  const status = nativeStatus(win), app = isAppMode({ status, search: win.location.search });
  if(!app) return { status, app };
  doc.body.classList.add('app');
  if(status !== 'web'){
    const b = doc.createElement('div');
    b.id = 'appBadge';
    b.textContent = BADGE[status];
    /* styles en ligne : la politique du serveur les autorise (pas les scripts en ligne) */
    Object.assign(b.style, { position: 'fixed', top: '4px', right: '4px', zIndex: '9999', padding: '2px 6px',
      font: '11px/1.4 ui-monospace,monospace', color: '#1a0f08', pointerEvents: 'none',
      background: status === 'ok' ? '#3fbf5a' : '#ffb84d' });
    doc.body.append(b);
  }
  return { status, app };
}
