/* Lobby de l'onglet Mine : les 3 places de la prochaine session, Lancer, Inviter, Critères / préférences,
   et (mode développeur seulement) seed, mineurs de test et réglages. Lit l'état et appelle des fonctions :
   la création de la session est faite par le serveur. */
import { GAME, PREF_OPTIONS, DEV_TUNABLES, STATS, CFG, SESSION_LEN } from '../config.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const TARGETS = { STATS, CFG };

/* durée réelle lisible : 1800 s → « 30 min » */
const realLen = speed => { const m = Math.round(SESSION_LEN / speed / 60); return m >= 1 ? `${m} min` : `${Math.round(SESSION_LEN / speed)} s`; };

/* h : { onLaunch(opts), onPrefs(prefs) } */
export function setupLobby(h){
  const st = { account:null, offline:false, info:null, prefs:null, busy:false };

  function render(){
    const { account, offline, info } = st, me = account;
    /* places : toi, puis les places libres (le jeu est prévu à 3) */
    let slots = `<div class="pslot me"><span class="av">${esc(me?.displayName?.[0]?.toUpperCase() ?? '?')}</span>
      <span><b>${esc(me?.displayName ?? '—')}</b><small>Toi${me?.guest ? ' · invité' : ''}</small></span></div>`;
    for(let i = 1; i < GAME.maxPlayers; i++)
      slots += `<div class="pslot free"><span class="av">+</span><span><b>Place libre</b><small>Invite un ami</small></span></div>`;
    $('lobbySlots').innerHTML = slots;

    const dev = !!info?.dev;
    $('lobbyInfo').innerHTML = offline ? ''
      : dev ? 'Mode développeur : vitesse au choix pendant la session, fin libre.'
      : `Session de <b>${realLen(info?.speed ?? GAME.speed)}</b> en temps réel (vitesse ×${info?.speed ?? GAME.speed}). `+
        'Elle continue même si tu fermes la page. Seul, tu gardes tout le coffre.';
    const err = offline ? 'Serveur de jeu injoignable : lance le jeu avec « npm start » (ou « npm run dev »).' : '';
    $('lobbyErr').hidden = !err; $('lobbyErr').textContent = err;
    $('launchBtn').disabled = offline || !account || st.busy;
    $('launchBtn').textContent = st.busy ? '… Lancement' : '▶ Lancer la session';
    $('devCard').hidden = !dev;
    renderPrefs();
  }

  function renderPrefs(){
    const p = st.prefs ?? {};
    $('prefsBox').innerHTML = Object.entries(PREF_OPTIONS).map(([k, def]) =>
      `<div class="pref"><span>${esc(def.label)}</span><div class="seg">${def.options.map(([v, label], i) =>
        `<button data-k="${k}" data-i="${i}" class="${p[k] === v ? 'on' : ''}">${esc(label)}</button>`).join('')}</div></div>`).join('');
  }

  $('prefsBox').onclick = e => {
    const b = e.target.closest('button[data-k]'); if(!b || st.offline) return;
    const k = b.dataset.k, v = PREF_OPTIONS[k].options[+b.dataset.i][0];
    st.prefs = { ...st.prefs, [k]: v };
    renderPrefs();
    h.onPrefs(st.prefs);
  };

  $('inviteBtn').onclick = () => {
    const box = $('inviteBox');
    box.hidden = !box.hidden;
    box.innerHTML = `Les invitations arrivent bientôt. Ton ID de compte, à donner à un ami :
      <b class="code">${esc(st.account?.displayId ?? '—')}</b>`;
  };

  /* panneau dev : réglages appliqués à la session lancée (le serveur les vérifie et les borne) */
  $('devStats').innerHTML = DEV_TUNABLES.map(([obj, key, label, min, max]) =>
    `<span>${esc(label)}</span><input type="number" step="any" min="${min}" max="${max}" data-obj="${obj}" data-key="${key}" data-base="${TARGETS[obj][key]}" value="${TARGETS[obj][key]}">`).join('');
  function devOptions(){
    const seed = parseInt($('devSeed').value, 10), overrides = {};
    for(const i of $('devStats').querySelectorAll('input')){
      const v = parseFloat(i.value);
      if(Number.isFinite(v) && v !== +i.dataset.base) (overrides[i.dataset.obj] ??= {})[i.dataset.key] = v;   // seulement ce qui change
    }
    return { seed: Number.isSafeInteger(seed) ? seed : undefined, bots: +$('devBots').value, overrides };
  }

  $('launchBtn').onclick = async () => {
    if(st.busy) return;
    st.busy = true; render();
    try { await h.onLaunch(st.info?.dev ? devOptions() : {}); }
    finally { st.busy = false; render(); }
  };

  return {
    update(patch){ Object.assign(st, patch); render(); },
    error(msg){ $('lobbyErr').hidden = !msg; $('lobbyErr').textContent = msg || ''; },
  };
}
