/* Mesures d'affichage (25/10/2026, Geoffrey : la tour semblait moins fluide en ligne qu'en local). Visibles seulement
   avec ?perf dans l'adresse du jeu (ex. https://deepmineidle.fr/?perf) : images par seconde du navigateur, délai entre
   deux envois du serveur, temps de réponse du serveur, ticks de jeu par envoi. Moyennes sur les dernières secondes.
   Logique pure (pas de DOM) : src/main.js lui donne les heures et affiche perfText(). */
const WINDOW = 2000;   // ms : on moyenne sur les 2 dernières secondes

export function createPerf(){
  const frames = [], views = [];   // frames : heures des images ; views : { at, rtt, ticks }
  let lastTick = null;
  const trim = (list, now, at = x => x) => { while(list.length && now - at(list[0]) > WINDOW) list.shift(); };
  return {
    /* une image affichée, à l'heure now (ms) */
    frame(now){ frames.push(now); trim(frames, now); },
    /* un envoi reçu : demandé à start, reçu à end (ms) ; tick : tick de la partie dans cet envoi */
    view(start, end, tick){
      const ticks = Number.isFinite(tick) && lastTick != null ? tick - lastTick : null;
      if(Number.isFinite(tick)) lastTick = tick;
      views.push({ at: end, rtt: end - start, ticks }); trim(views, end, v => v.at);
    },
    /* { fps, every (ms entre deux envois), rtt (ms), ticks (par envoi) } ; null quand on ne sait pas encore */
    stats(){
      const span = frames.length > 1 ? frames.at(-1) - frames[0] : 0;
      const gaps = views.slice(1).map((v, i) => v.at - views[i].at);
      const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
      return { fps: span > 0 ? (frames.length - 1) * 1000 / span : null, every: avg(gaps), rtt: avg(views.map(v => v.rtt)),
               ticks: avg(views.map(v => v.ticks).filter(t => t != null)) };
    },
  };
}

/* texte affiché dans la barre du haut */
export function perfText(s){
  const n = (v, d = 0) => v == null ? '–' : v.toFixed(d);
  return `${n(s.fps)} img/s · envoi toutes les ${n(s.every)} ms · réponse ${n(s.rtt)} ms · ${n(s.ticks, 1)} ticks/envoi`;
}
