/* Couche appli, assemblage : chargée seulement dans l'appli ou avec ?app (src/main.js). Pilote la navigation du jeu
   (nav.show) sans la remplacer. */
import { barHtml, subHtml } from './bar.js';
import { familyOf, targetTab, sessionRedirect } from './families.js';

const KEY = 'deepIdleMine.appFamilyTab';   // dernier sous-onglet ouvert, par famille
const load = win => { try { return JSON.parse(win.localStorage.getItem(KEY)) ?? {}; } catch(e){ return {}; } };
const save = (win, v) => { try { win.localStorage.setItem(KEY, JSON.stringify(v)); } catch(e){} };

export function startApp({ doc, win, nav, shown }){
  const remembered = load(win);
  let marks = new Set(), wasShown = false, drawn = '';
  const bar = doc.createElement('nav'), sub = doc.createElement('div');
  bar.id = 'appBar'; sub.id = 'appSub';
  doc.body.append(sub, bar);

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
  }

  bar.onclick = e => {
    const f = e.target.closest('[data-family]')?.dataset.family;
    if(f) nav.show(targetTab(f, remembered[f], { inSession:shown() }));
  };
  sub.onclick = e => { const t = e.target.closest('[data-subtab]')?.dataset.subtab; if(t) nav.show(t); };
  /* le guide « Premiers pas » compte comme une pastille */
  nav.onMark(({ badges, guide }) => { marks = new Set(guide ? [...badges, guide] : badges); draw(); });
  sync();
  /* aucun événement commun à la mine, la mine instantanée, les tours, l'instance, le Bloc géant et la prison */
  win.setInterval(sync, 1000);

  return {
    onTab(id){
      const f = familyOf(id);
      if(f){ remembered[f] = id; save(win, remembered); }
      sync();
    },
  };
}
