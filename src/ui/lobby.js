/* Lobby de l'onglet Mine : les 3 places de la prochaine session, Lancer, Inviter, Critères / préférences,
   et (mode développeur seulement) seed, mineurs de test et réglages. Lit l'état et appelle des fonctions :
   la création de la session est faite par le serveur.
   Lobby partagé : st.lobby vient du serveur (relu régulièrement) ; clic sur une place libre = inviter un joueur
   par pseudo ou ID ; seul l'hôte lance. */
import { GAME, PREF_OPTIONS, DEV_TUNABLES, STATS, CFG, SESSION_LEN } from '../config.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const TARGETS = { STATS, CFG };

/* durée réelle lisible : 1800 s → « 30 min » */
const realLen = speed => { const m = Math.round(SESSION_LEN / speed / 60); return m >= 1 ? `${m} min` : `${Math.round(SESSION_LEN / speed)} s`; };

/* h : { onLaunch(opts), onPrefs(prefs), onInvite(pseudoOuId), onLeaveLobby() } */
export function setupLobby(h){
  const st = { account:null, offline:false, info:null, prefs:null, busy:false, lobby:null, inviting:false, slotsHtml:'', error:'' };

  /* places : les membres du lobby (ou toi seul), les invitations en attente, puis les places libres */
  function renderSlots(){
    const me = st.account, L = st.lobby, max = L?.maxPlayers ?? GAME.maxPlayers;
    const members = L ? L.members : [{ name:me?.displayName ?? '—', me:true, host:false }];
    let html = members.map(m => `<div class="pslot${m.me ? ' me' : ''}"><span class="av">${esc(m.name?.[0]?.toUpperCase() ?? '?')}</span>
      <span><b>${m.host && members.length > 1 ? '👑 ' : ''}${esc(m.name)}</b><small>${m.me ? 'Toi' + (me?.guest ? ' · invité' : '') : esc(m.displayId ?? '')}${m.host && members.length > 1 ? ' · hôte' : ''}</small></span></div>`).join('');
    const pending = L?.pending ?? [];
    for(let i = members.length; i < max; i++){
      const p = pending[i - members.length];
      if(p) html += `<div class="pslot free"><span class="av">✉</span><span><b>${esc(p.name)}</b><small>Invitation envoyée</small></span></div>`;
      else if(st.inviting && i === members.length + pending.length)
        html += `<form class="pslot free inviting" id="inviteForm"><input id="inviteInput" placeholder="Pseudo ou ID" maxlength="40" autocomplete="off">`+
                `<button class="on" type="submit">Inviter</button><button type="button" data-cancel title="Annuler">✕</button></form>`;
      else html += `<div class="pslot free" data-free title="Inviter un joueur"><span class="av">+</span><span><b>Place libre</b><small>Clique pour inviter</small></span></div>`;
    }
    if(pending.length > max - members.length) html += `<p class="mut small span3">+ ${pending.length - (max - members.length)} autre(s) invitation(s) en attente</p>`;
    if(html === st.slotsHtml) return;
    const typed = $('inviteInput')?.value, had = document.activeElement?.id === 'inviteInput';   // ne pas perdre la saisie
    $('lobbySlots').innerHTML = html; st.slotsHtml = html;
    const inp = $('inviteInput');
    if(inp){ if(typed) inp.value = typed; if(had || st.inviting) inp.focus(); }
  }

  function render(){
    const { account, offline, info } = st;
    renderSlots();
    const L = st.lobby, group = (L?.members.length ?? 1) > 1, waitHost = group && !L.isHost;

    const dev = !!info?.dev;
    $('lobbyInfo').innerHTML = offline ? ''
      : dev ? 'Mode développeur : vitesse au choix pendant la session, fin libre.'
      : `Session de <b>${realLen(info?.speed ?? GAME.speed)}</b> en temps réel (vitesse ×${info?.speed ?? GAME.speed}). `+
        'Elle continue même si tu fermes la page. '+(group ? 'Le coffre sera partagé à parts égales.' : 'Seul, tu gardes tout le coffre.');
    const err = offline ? 'Serveur de jeu injoignable : lance le jeu avec « npm start » (ou « npm run dev »).' : st.error;
    $('lobbyErr').hidden = !err; $('lobbyErr').textContent = err;
    $('launchBtn').disabled = offline || !account || st.busy || waitHost;
    $('launchBtn').textContent = st.busy ? '… Lancement' : waitHost ? '⏳ En attente de l\'hôte' : '▶ Lancer la session';
    $('leaveLobbyBtn').hidden = !group;
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
    box.innerHTML = `Clique sur une place libre et tape le pseudo (ou l'ID) d'un joueur : il recevra l'invitation dans
      son onglet Social. Ton ID de compte, pour qu'un ami t'invite : <b class="code">${esc(st.account?.displayId ?? '—')}</b>`;
  };

  /* inviter : clic sur une place libre → champ pseudo / ID */
  $('lobbySlots').onclick = e => {
    if(e.target.closest('[data-free]') && !st.offline && st.account){ st.inviting = true; renderSlots(); }
    else if(e.target.closest('[data-cancel]')){ st.inviting = false; renderSlots(); }
  };
  $('lobbySlots').onsubmit = async e => {
    e.preventDefault();
    const inp = $('inviteInput'), to = inp?.value.trim();
    if(!to || st.busy) return;
    inp.disabled = true;
    try { const r = await h.onInvite(to); st.inviting = false; st.lobby = r.lobby; st.slotsHtml = ''; render(); }
    catch(err){ inp.disabled = false; inp.focus(); }
  };
  $('leaveLobbyBtn').onclick = async () => {
    if(!confirm('Quitter ce lobby ? Tu retrouveras ton propre lobby, vide.')) return;
    try { const r = await h.onLeaveLobby(); st.lobby = r.lobby; render(); } catch {}
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
    error(msg){ st.error = msg || ''; $('lobbyErr').hidden = !st.error; $('lobbyErr').textContent = st.error; },
  };
}
