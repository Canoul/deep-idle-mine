/* Mesures d'affichage (25/10/2026, Geoffrey : la tour semblait moins fluide en ligne qu'en local). Visibles seulement
   avec ?perf dans l'adresse du jeu (ex. https://deepmineidle.fr/?perf) : images par seconde du navigateur, délai entre
   deux envois du serveur, temps de réponse du serveur, ticks de jeu par envoi. Moyennes sur les dernières secondes.
   Logique pure (pas de DOM) : src/main.js lui donne les heures et affiche perfText(). */
const WINDOW = 2000;   // ms : on moyenne sur les 2 dernières secondes
const HICCUP = 300;    // ms : un arrêt plus court entre deux pas est un micro-arrêt (plus long : il mine, ou il se bat)
const STEPS = 10e3;    // ms : les micro-arrêts se comptent sur 10 s, il faut assez de marche

/* part (%) du temps de marche perdue en micro-arrêts ; null sans marche */
function hiccups(steps){
  let moving = 0, lost = 0, run = 0, started = false;
  for(const s of steps){
    if(!s.still){
      if(started && run > 0 && run <= HICCUP) lost += run;
      moving += s.dt; run = 0; started = true;
    } else run += s.dt;
  }
  return moving ? lost / (moving + lost) * 100 : null;
}

export function createPerf(){
  const frames = [], views = [], steps = [];   // frames : heures des images ; views : { at, rtt, ticks } ; steps : { at, still }
  let lastTick = null, lastPos = null;
  const trim = (list, now, at = x => x) => { while(list.length && now - at(list[0]) > WINDOW) list.shift(); };
  return {
    /* une image affichée, à l'heure now (ms) */
    frame(now){ frames.push(now); trim(frames, now); },
    /* position à l'écran du mineur suivi, à chaque image */
    step([x, y], now = frames.at(-1) ?? 0){
      if(lastPos) steps.push({ at: now, dt: now - (steps.at(-1)?.at ?? now - 16), still: Math.hypot(x - lastPos[0], y - lastPos[1]) < 1e-3 });
      lastPos = [x, y];
      while(steps.length && now - steps[0].at > STEPS) steps.shift();
    },
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
      const mean = avg(gaps);
      return { fps: span > 0 ? (frames.length - 1) * 1000 / span : null, every: mean, rtt: avg(views.map(v => v.rtt)),
               jitter: gaps.length ? Math.sqrt(avg(gaps.map(g => (g - mean) ** 2))) : null,
               stops: hiccups(steps),
               ticks: avg(views.map(v => v.ticks).filter(t => t != null)) };
    },
  };
}

/* texte affiché dans la barre du haut */
export function perfText(s){
  const n = (v, d = 0) => v == null ? '–' : v.toFixed(d);
  return `${n(s.fps)} img/s · envoi toutes les ${n(s.every)} ms · réponse ${n(s.rtt)} ms · ${n(s.ticks, 1)} ticks/envoi · écart ${n(s.jitter)} ms · micro-arrêts ${n(s.stops)} %`;
}
