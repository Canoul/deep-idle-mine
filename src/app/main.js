/* Couche appli, assemblage : chargée seulement dans l'appli ou avec ?app (src/main.js). Pilote la navigation du jeu
   (nav.show) sans la remplacer. */
import { barHtml, subHtml } from './bar.js';
import { familyOf, targetTab, sessionRedirect } from './families.js';
import { startNotifs } from './native.js';
import { startHome } from './home-ui.js';
import { startPerso } from './perso.js';
import { startStoreNudge } from './store-nudge.js';

const KEY = 'deepIdleMine.appFamilyTab';   // dernier sous-onglet ouvert, par famille
const load = win => { try { return JSON.parse(win.localStorage.getItem(KEY)) ?? {}; } catch(e){ return {}; } };
const save = (win, v) => { try { win.localStorage.setItem(KEY, JSON.stringify(v)); } catch(e){} };
const HOME = 'lobby', TRAIL = 20;          // écran d'accueil ; onglets retenus pour le bouton retour

/* home : { lobby: () => l'objet de setupLobby, data: () => { now, sessionTimes, furnaces } } pour l'Accueil (03/11/2026) */
export function startApp({ doc, win, nav, shown, notifData, home: homeDeps }){
  const remembered = load(win);
  let marks = new Set(), wasShown = false, drawn = '';
  const trail = [];                        // onglets précédents (bouton retour Android)
  let last = nav.current(), goingBack = false;
  const bar = doc.createElement('nav'), sub = doc.createElement('div');
  bar.id = 'appBar'; sub.id = 'appSub';
  doc.body.append(sub, bar);
  const home = homeDeps ? startHome({ doc, nav, ...homeDeps }) : null;
  startPerso({ doc });   // Stuff : mannequin, onglets Équipement | Stats

  function draw(){
    const current = nav.current(), family = familyOf(current), inSession = shown();
    const html = barHtml({ active:family, marks }), subs = subHtml({ family, current, marks, inSession });
    if(html + subs === drawn) return;
    drawn = html + subs;
    bar.innerHTML = html;
    sub.innerHTML = subs;
    doc.body.classList.toggle('appSubOn', !!subs);
  }

  /* Session sans rien à montrer → Historique ; session retrouvée → retour à la mine */
  function sync(){
    const now = shown(), to = sessionRedirect({ tab:nav.current(), shown:now, wasShown });
    wasShown = now;
    if(to) nav.show(to); else draw();
    home?.render();   // minuteries des rendez-vous et de la session
  }

  bar.onclick = e => {
    const f = e.target.closest('[data-family]')?.dataset.family;
    if(f) nav.show(targetTab(f, remembered[f], { inSession:shown() }));
    if(f === 'accueil') home?.show();   // déjà sur le Lobby, nav.show ne fait rien : on revient quand même à l'Accueil
  };
  sub.onclick = e => { const t = e.target.closest('[data-subtab]')?.dataset.subtab; if(t) nav.show(t); };
  /* le guide « Premiers pas » compte comme une pastille */
  nav.onMark(({ badges, guide }) => { marks = new Set(guide ? [...badges, guide] : badges); draw(); });
  sync();
  /* aucun événement commun à la mine, la mine instantanée, les tours, l'instance, le Bloc géant et la prison */
  win.setInterval(sync, 1000);
  const notifs = startNotifs({ win, doc, data:notifData, open:tab => nav.show(tab) });
  startStoreNudge({ win }).catch(console.warn);   // nouvelle appli sur le store (03/11)

  return {
    notifOptions: notifs.options,
    setNotif: notifs.set,
    refreshNotifs: notifs.refresh,
    onTab(id){
      if(id !== last && !goingBack){ trail.push(last); if(trail.length > TRAIL) trail.shift(); }
      last = id; goingBack = false;
      const f = familyOf(id);
      if(f){ remembered[f] = id; save(win, remembered); }
      sync();
    },
    canGoBack: () => trail.length > 0,
    goBack(){ goingBack = true; nav.show(trail.pop()); },
    atHome: () => nav.current() === HOME && (home?.shown() ?? true),
    goHome(){ nav.show(HOME); home?.show(); },
  };
}
