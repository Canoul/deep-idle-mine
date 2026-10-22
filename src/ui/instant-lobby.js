/* Mine instantanée, hors partie : la carte du Lobby (« Où miner » → Mine instantanée : compte à rebours, inscrits,
   S'inscrire / Se désinscrire) et les rappels avant l'ouverture, visibles depuis tous les onglets (GAME_DESIGN §6).
   Le serveur décide de tout (heure, inscriptions) ; ici on affiche et on demande. */
import { INSTANT_MINE as MI, GAME } from '../config.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const p2 = n => String(n).padStart(2, '0');

/* « 1 h 05 min 12 s », « 4 min 03 s », « 12 s » */
export function countdownText(ms){
  const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60;
  return h ? `${h} h ${p2(m)} min ${p2(r)} s` : m ? `${m} min ${p2(r)} s` : `${r} s`;
}
/* « 30 min », « 5 min », « 30 secondes » (texte des rappels) */
export const noticeDelay = s => s >= 60 ? `${Math.round(s / 60)} min` : `${s} secondes`;

/* rappel dont le moment vient de passer entre prev et now (ms, heure du serveur), pour une ouverture à nextAt ;
   plusieurs à la fois (page en veille) : le plus proche de l'ouverture seulement. null sinon. */
export function crossedNotice(prev, now, nextAt, notify = MI.notify){
  if(prev == null || now <= prev) return null;
  const hit = notify.filter(s => { const at = nextAt - s * 1000; return prev < at && at <= now; });
  return hit.length ? Math.min(...hit) : null;
}

/* inscriptions ouvertes au moment t (ms, heure du serveur) pour cet état du serveur (fenêtre des 30 dernières minutes ;
   mode dev : toujours) */
export const canSignup = (st, t) => !!st && (st.dev || (t >= st.signupAt && t < st.nextAt));
/* « 11 h 30 » : heure de Paris de l'ouverture des inscriptions */
export const clockText = ms => new Date(ms).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', timeZone: MI.timeZone }).replace(':', ' h ');

/* h : { api: { state, join, quit, devOpen }, canNotify() (pas pendant la mine instantanée), inSession() (en session
         normale : s'inscrire reste possible, mais il faudra l'avoir finie à l'heure), onJoined() (aller au lobby, mode MI), onState(st) (le lobby sait si on est inscrit),
         onOpened() (mode dev : la mine vient d'être ouverte) } */
export function setupInstantLobby(h){
  let st = null, offset = 0, prev = null, busy = false, err = '', timer = null, refreshing = null, shownOpen = null;
  const now = () => Date.now() + offset;

  async function refresh(){
    if(refreshing) return refreshing;
    refreshing = (async () => {
      try { st = await h.api.state(); offset = st.now - Date.now(); err = ''; h.onState?.(st); }
      catch(e){ err = e.message; }
      finally { refreshing = null; render(); }
    })();
    return refreshing;
  }

  function render(){
    const box = $('miCardBody');
    if(!box) return;
    if(!st){ box.innerHTML = `<p class="mut">${esc(err || 'Chargement…')}</p>`; return; }
    const left = st.nextAt - now(), real = Math.round(MI.duration / GAME.speed), open = canSignup(st, now());
    shownOpen = open;
    box.innerHTML =
      `<div class="miCount"><span class="mut">La mine instantanée commence dans</span><b id="miCountdown">${countdownText(left)}</b></div>`+
      `<div class="row"><span>Inscrits</span><b>${st.count}</b></div>`+
      `<div class="lobbyActions">${st.registered
        ? `<button id="miQuit"${busy ? ' disabled' : ''}>Se désinscrire</button><span class="okmsg">✔ Tu es inscrit</span>`
        : open ? `<button class="on big" id="miJoin"${busy ? ' disabled' : ''}>🌀 S'inscrire</button>`
               : `<button class="big" disabled>🔒 Inscriptions à ${clockText(st.signupAt)}</button>`}`+
        (st.dev ? `<button id="miDevOpen"${busy || !st.count ? ' disabled' : ''} title="Mode développeur : sans attendre l'heure">⚡ Ouvrir maintenant (dev)</button>` : '')+`</div>`+
      `<p class="mut small">Toutes les ${MI.everyHours} h pile (heure de Paris). ${Math.floor(real / 60)} min ${p2(real % 60)} de pillage dans une mine
        ${MI.w}×${MI.h} pleine de minerais, avec tous les inscrits : <b>chacun pour soi</b>, chacun son butin, pas d'XP.
        Des tas de <b>plumes d'ange</b> s'y cachent. Tu peux fermer la page ; seul <b>Quitter</b> te fait tout perdre.
        Inscriptions <b>${MI.signupBefore / 60} min avant</b>, même en session ; entrer dans la mine te fait quitter ton groupe.</p>`+
      (st.registered && h.inSession?.() ? `<p class="small"><b>⚠ Tu es en session :</b> si elle n'est pas finie à l'heure, tu rates la mine instantanée (ta session continue).</p>` : '')+
      (err ? `<p class="err">${esc(err)}</p>` : '');
    $('miJoin')?.addEventListener('click', () => act(h.api.join));
    $('miQuit')?.addEventListener('click', () => act(h.api.quit));
    $('miDevOpen')?.addEventListener('click', () => act(h.api.devOpen).then(ok => ok && h.onOpened?.()));
  }

  async function act(fn){
    if(busy) return;
    busy = true; err = ''; render();
    try { st = await fn(); offset = st.now - Date.now(); h.onState?.(st); }
    catch(e){ err = e.message; }
    finally { busy = false; render(); }
    return !err;
  }

  /* chaque seconde : compte à rebours, rappels, et relecture à l'ouverture (nouvelle heure, inscrits remis à zéro) */
  function tick(){
    if(st){
      const t = now(), el = $('miCountdown');
      if(el) el.textContent = countdownText(st.nextAt - t);
      if(canSignup(st, t) !== shownOpen) render();          // 11 h 30 pile : le bouton S'inscrire apparaît
      const n = crossedNotice(prev, t, st.nextAt);
      if(n != null && h.canNotify()) notice(n);
      prev = t;
      if(t >= st.nextAt) refresh();
    }
    timer = setTimeout(tick, 1000);
  }

  /* fenêtre de rappel ; au dernier (inviteAt), pour un joueur pas inscrit : Rejoindre / Décliner */
  function notice(s){
    const box = $('miNotice'), invite = s <= MI.inviteAt && !st.registered;
    const sub = st.registered ? (h.inSession?.() ? 'Tu es inscrit : finis ta session avant le départ.' : 'Tu es inscrit.')
              : s >= MI.signupBefore ? 'Les inscriptions sont ouvertes (Lobby, « Où miner »).' : '';
    box.innerHTML = `<div><b>🌀 La mine instantanée commence dans ${noticeDelay(s)}</b>`+
      (sub ? `<div class="mut small">${sub}</div>` : '')+`</div>`+
      (invite ? `<div class="miNoticeBtns"><button class="on" id="miNoticeJoin">Rejoindre</button><button id="miNoticeNo">Décliner</button></div>`
              : `<button class="x" id="miNoticeNo" title="Fermer">×</button>`);
    box.hidden = false;
    clearTimeout(box._t);
    if(!invite) box._t = setTimeout(() => { box.hidden = true; }, 12e3);
    $('miNoticeNo').onclick = () => { box.hidden = true; };
    const j = $('miNoticeJoin');
    if(j) j.onclick = async () => {
      j.disabled = true;
      const ok = await act(h.api.join);
      box.hidden = true;
      if(ok) h.onJoined?.(); else alert(err);
    };
  }

  return {
    start(){ clearTimeout(timer); refresh().then(() => { prev = now(); tick(); }); },
    stop(){ clearTimeout(timer); timer = null; st = null; prev = null; },
    refresh, render,
    get state(){ return st; },
    _notice: notice,        // pour essayer à la main depuis la console
  };
}
