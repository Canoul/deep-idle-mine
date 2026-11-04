/* Couche appli, ce qui n'existe que sur le téléphone (chargée seulement si le pont natif est là) : bouton retour Android, liens
   ouverts dans le navigateur du téléphone, écran « Pas de connexion ». Les plugins viennent de window.Capacitor.Plugins (pas de
   bundler). backStep et externalUrl : logique pure, testée. */
import { SITE } from '../config.js';
import { ask } from '../ui/dialog.js';
import { API_BASE } from '../net/base.js';

/* panneaux qui se ferment par un clic à côté (leur gestionnaire regarde e.target === le fond) */
const PANELS = ['account', 'fview', 'loot', 'spick', 'cpick', 'fpick', 'forming', 'setsSheet', 'skSheet', 'spSheet', 'hiSheet', 'frSheet'];   // setsSheet : menu des sets (03/11/2026)
const RETRY_MS = 3000;

/* que fait le bouton retour ? 'dialog' | 'panel' | 'tab' | 'home' | 'quit' */
export function backStep({ dialog = false, panel = false, gate = false, previous = false, home = false }){
  if(dialog) return 'dialog';
  if(gate) return 'quit';
  if(panel) return 'panel';
  if(previous) return 'tab';
  return home ? 'quit' : 'home';
}

/* adresse à ouvrir dehors, ou null : reste dans l'appli. Un lien relatif du jeu (wiki.html) vise le site. */
export function externalUrl(href, site, here){
  let u;
  try { u = new URL(href, here); } catch(e){ return null; }
  if(u.protocol === 'mailto:') return u.href;
  if(u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const local = new URL(here);
  if(u.origin !== local.origin) return u.href;
  return u.pathname === local.pathname || u.pathname === '/' ? null : new URL(u.pathname + u.search + u.hash, site).href;
}

export function startNative({ doc, win }){
  const { App, AppLauncher } = win.Capacitor.Plugins ?? {};
  if(!App || !AppLauncher) return { attach(){} };      // ancienne APK sans ces plugins
  let layer = null, off = null;
  const visible = id => { const el = doc.getElementById(id); return el && !el.hidden ? el : null; };

  async function onBack(){
    const dialog = visible('dialog'), acc = visible('account'), panel = PANELS.map(visible).find(Boolean);
    const step = backStep({ dialog: !!dialog, panel: !!panel, gate: !!acc?.classList.contains('gate'), previous: !!layer?.canGoBack(), home: !layer || layer.atHome() });
    if(step === 'dialog') return (dialog.querySelector('[data-dlg="no"]') ?? dialog.querySelector('[data-dlg="yes"]'))?.click();
    if(step === 'panel') return panel.click();
    if(step === 'tab') return layer.goBack();
    if(step === 'home') return layer.goHome();
    if(await ask('Quitter le jeu ?\nTon mineur continue sa session sur le serveur.', { ok: 'Quitter' })) App.exitApp();
  }
  App.addListener('backButton', () => { onBack().catch(console.warn); });

  doc.addEventListener('click', e => {
    const a = e.target.closest?.('a[href]');
    if(!a) return;
    const url = externalUrl(a.getAttribute('href'), SITE.url, win.location.href);
    if(!url) return;
    e.preventDefault();
    AppLauncher.openUrl({ url }).catch(console.warn);
  }, true);

  /* pas de réseau, ou serveur qui redémarre : l'écran reste tant que le serveur ne répond pas. Parti sans serveur au lancement : on
     recharge, le jeu a besoin de son compte. */
  async function waitServer(){
    try {
      const r = await win.fetch(`${API_BASE}/api/game/info`, { cache: 'no-store' });
      if((r.headers.get('content-type') ?? '').includes('application/json')){
        if(win.dimBootOffline) return win.location.reload();
        off.hidden = true; off = null;
        return;
      }
    } catch(e){ /* toujours pas de réseau */ }
    win.setTimeout(waitServer, RETRY_MS);
  }
  win.addEventListener('dim:offline', () => {
    if(off) return;
    off = doc.getElementById('appOffline');
    if(!off){ off = doc.createElement('div'); off.id = 'appOffline'; off.innerHTML = '<p>Pas de connexion, nouvelle tentative…</p>'; doc.body.append(off); }
    off.hidden = false;
    win.setTimeout(waitServer, RETRY_MS);
  });

  return { attach(l){ layer = l; } };
}
