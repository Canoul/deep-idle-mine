/* Lobby de l'onglet Mine : les places de la prochaine session (le groupe), Lancer, Inviter (code, lien, ID),
   invitations reçues, Critères / préférences, et (mode développeur seulement) seed, mineurs de test et réglages.
   Lit l'état et appelle des fonctions : le groupe et la session sont gérés par le serveur. */
import { GAME, PREF_OPTIONS, MOB_INFO, DEV_TUNABLES, STATS, CFG, SESSION_LEN } from '../config.js';
import { joinLink } from '../shared/party.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const TARGETS = { STATS, CFG };

/* durée réelle lisible : 1800 s → « 30 min » */
const realLen = speed => { const m = Math.round(SESSION_LEN / speed / 60); return m >= 1 ? `${m} min` : `${Math.round(SESSION_LEN / speed)} s`; };

/* Places du lobby, depuis l'état du serveur (logique pure, testée) :
   membres du groupe (chef en premier), invitations en attente, puis places libres ; sans groupe : soi + places libres. */
export function lobbySlots(account, party, max = GAME.maxPlayers){
  const slots = [];
  if(party){
    for(const m of party.members) slots.push({ kind:'member', ...m });
    for(const i of party.invited) if(slots.length < max) slots.push({ kind:'invited', ...i });
  } else if(account){
    slots.push({ kind:'member', account:account.id, displayId:account.displayId, name:account.displayName, me:true, leader:false });
  }
  while(slots.length < max) slots.push({ kind:'free' });
  return slots.slice(0, Math.max(max, party?.members.length ?? 0));
}

/* Qui peut lancer, et ce que dit le bouton : seul ou chef = oui ; membre = on attend le chef */
export function launchState({ account, party, offline, busy }){
  if(offline || !account) return { can:false, label:'▶ Lancer la session' };
  if(busy || party?.launching) return { can:false, label:'… Lancement' };
  const leader = !party || party.leader === account.id;
  if(!leader) return { can:false, label:'En attente du chef…' };
  if(party?.members.some(m => m.playing)) return { can:false, label:'⏳ Le groupe finit sa session…' };
  const n = party?.members.length ?? 1;
  return { can:true, label: n > 1 ? `▶ Lancer à ${n}` : '▶ Lancer la session' };
}

/* h : { onLaunch(opts), onPrefs(prefs), party: { create, join(code), invite(id), decline(code), leave, kick(id) } }
   Les fonctions du groupe renvoient l'état du groupe ou lèvent une erreur (message lisible). */
export function setupLobby(h){
  const st = { account:null, offline:false, info:null, prefs:null, busy:false, party:null, invites:[], inviteOpen:false };

  function render(){
    const { account, offline, info, party } = st;
    const lead = party && party.leader === account?.id;
    $('lobbySlots').innerHTML = lobbySlots(account, party).map(s => {
      if(s.kind === 'free')
        return `<div class="pslot free"><span class="av">+</span><span><b>Place libre</b><small>Invite un ami</small></span></div>`;
      if(s.kind === 'invited')
        return `<div class="pslot free invited"><span class="av">✉</span><span><b>${esc(s.name)}</b><small>invité · en attente</small></span>`+
               (lead ? `<button class="x" data-kick="${esc(s.displayId)}" title="Annuler l'invitation">×</button>` : '')+`</div>`;
      const tags = [s.me && 'Toi', s.leader && 'chef', s.playing && 'en session', s.away && 'absent'].filter(Boolean).join(' · ') || 'Prêt';
      return `<div class="pslot${s.me ? ' me' : ''}${s.away ? ' away' : ''}"><span class="av">${s.leader ? '★' : esc(s.name?.[0]?.toUpperCase() ?? '?')}</span>`+
             `<span><b>${esc(s.name)}</b><small>${esc(tags)}</small></span>`+
             (lead && !s.me ? `<button class="x" data-kick="${esc(s.displayId)}" title="Retirer du groupe">×</button>` : '')+`</div>`;
    }).join('');

    const ls = launchState(st);
    $('launchBtn').disabled = !ls.can; $('launchBtn').textContent = ls.label;
    $('inviteBtn').disabled = offline || !account;
    $('inviteBtn').classList.toggle('on', st.inviteOpen);
    $('partyLeaveBtn').hidden = !party || party.members.length < 2;
    $('joinRow').hidden = offline || !account || (party && party.members.length > 1);

    const dev = !!info?.dev, n = party?.members.length ?? 1;
    $('lobbyInfo').innerHTML = offline ? ''
      : (n > 1 ? `Session commune à <b>${n}</b> : même mine pour tous, coffre partagé à parts égales entre les présents à la fin. ` : '')+
        (dev ? 'Mode développeur : vitesse au choix pendant la session, fin libre.'
             : `Session de <b>${realLen(info?.speed ?? GAME.speed)}</b> en temps réel (vitesse ×${info?.speed ?? GAME.speed}). `+
               'Elle continue même si tu fermes la page.'+(n > 1 ? '' : ' Seul, tu gardes tout le coffre.'));
    if(offline) error('Serveur de jeu injoignable : lance le jeu avec « npm start » (ou « npm run dev »).');
    $('devCard').hidden = !dev || (party && !lead);        // seuls les réglages de celui qui lance comptent
    renderInvite();
    renderInvites();
    renderPrefs();
  }

  /* panneau « Inviter » : code + lien du groupe, invitation par ID, son propre ID */
  function renderInvite(){
    const box = $('inviteBox'), p = st.party;
    box.hidden = !st.inviteOpen;
    /* reconstruit seulement si le code change : le lobby se rafraîchit souvent, on ne perd pas l'ID en cours de frappe */
    const key = st.inviteOpen ? `${p?.code ?? ''}|${st.account?.displayId ?? ''}` : '';
    if(box.dataset.key === key) return;
    box.dataset.key = key;
    if(!st.inviteOpen) return;
    const link = p ? joinLink(location.href, p.code) : '';
    box.innerHTML = (p ? `<div class="irow"><span>Code du groupe</span><b class="code" data-copy="${esc(p.code)}" title="Copier">${esc(p.code)}</b>
        <button data-copy="${esc(link)}">🔗 Copier le lien</button></div>
        <p class="mut small">Envoie le lien (ou le code) : ton ami clique, se connecte, et prend une place.</p>`
        : `<p class="mut small">Création du groupe…</p>`)+
      `<form class="irow" id="inviteForm"><span>Inviter par ID</span><input id="inviteId" placeholder="7K3Q-9XHP" autocomplete="off" spellcheck="false" maxlength="12">
        <button>✉ Inviter</button></form>
      <p class="mut small">Ton ID, à donner à un ami : <b class="code" data-copy="${esc(st.account?.displayId ?? '')}" title="Copier">${esc(st.account?.displayId ?? '—')}</b></p>`;
    $('inviteForm').onsubmit = e => { e.preventDefault(); act(() => h.party.invite($('inviteId').value), () => { $('inviteId').value = ''; }); };
  }

  /* invitations reçues */
  function renderInvites(){
    const list = st.invites ?? [];
    $('invitesCard').hidden = !list.length;
    $('invitesList').innerHTML = list.map(i =>
      `<div class="row invitation"><span><b>${esc(i.from)}</b> t'invite <span class="mut">(${esc(i.members.join(', '))})</span></span>
        <span><button class="on" data-accept="${esc(i.code)}"${i.full ? ' disabled title="Groupe complet"' : ''}>Rejoindre</button>
        <button data-decline="${esc(i.code)}">Refuser</button></span></div>`).join('');
  }

  function renderPrefs(){
    const p = st.prefs ?? {};
    $('prefsBox').innerHTML = Object.entries(PREF_OPTIONS).map(([k, def]) =>
      `<div class="pref"><span>${esc(def.label)}</span><div class="seg">${def.options.map(([v, label], i) =>
        `<button data-k="${k}" data-i="${i}" class="${p[k] === v ? 'on' : ''}">${esc(label)}</button>`).join('')}</div></div>`).join('')
      + (p.helpAllies ? helpList(p.helpIgnore ?? []) : '');
  }

  /* « Aider allié » : chaque type de mob, avec son dessin, ignoré oui / non (ignoré = il ne va pas aider contre lui) */
  function helpList(ignored){
    return `<div class="helpMobs"><div class="mut">Ignorer ces mobs quand un allié est pris en chasse ?</div>${
      Object.entries(MOB_INFO).map(([t, d]) => {
        const off = ignored.includes(t);
        return `<div class="pref"><span class="mobName"><span class="mobIco">${d.under ? `<img src="textures/${d.under}.png" alt="">` : ''}<img src="textures/${d.tex}.png" alt=""></span>${esc(d.name)}</span>
          <div class="seg"><button data-ign="${t}" data-v="1" class="${off ? 'on' : ''}">Ignoré</button><button data-ign="${t}" data-v="0" class="${off ? '' : 'on'}">Aider</button></div></div>`;
      }).join('')}</div>`;
  }

  function error(msg){ $('lobbyErr').hidden = !msg; $('lobbyErr').textContent = msg || ''; }

  /* action sur le groupe : met à jour l'état renvoyé par le serveur, affiche l'erreur sinon */
  async function act(fn, done){
    error('');
    try {
      const r = await fn();
      if(r && 'party' in r) st.party = r.party;
      done?.();
    } catch(e){ error(e.message); }
    render();
  }

  async function copy(text, el){
    try { await navigator.clipboard.writeText(text); el.classList.add('copied'); setTimeout(() => el.classList.remove('copied'), 1200); }
    catch { prompt('Copie ce texte :', text); }
  }

  $('prefsBox').onclick = e => {
    const ig = e.target.closest('button[data-ign]');
    if(ig && !st.offline){
      const t = ig.dataset.ign, cur = new Set(st.prefs?.helpIgnore ?? []);
      if(ig.dataset.v === '1') cur.add(t); else cur.delete(t);
      st.prefs = { ...st.prefs, helpIgnore: [...cur] };
      renderPrefs(); h.onPrefs(st.prefs); return;
    }
    const b = e.target.closest('button[data-k]'); if(!b || st.offline) return;
    const k = b.dataset.k, v = PREF_OPTIONS[k].options[+b.dataset.i][0];
    st.prefs = { ...st.prefs, [k]: v };
    renderPrefs();
    h.onPrefs(st.prefs);
  };

  $('inviteBtn').onclick = () => {
    st.inviteOpen = !st.inviteOpen;
    render();
    if(st.inviteOpen && !st.party) act(() => h.party.create());          // un code à partager tout de suite
    if(st.inviteOpen) setTimeout(() => $('inviteId')?.focus(), 0);
  };
  $('inviteBox').onclick = e => { const c = e.target.closest('[data-copy]'); if(c) copy(c.dataset.copy, c); };
  $('lobbySlots').onclick = e => {
    const b = e.target.closest('[data-kick]'); if(!b) return;
    act(() => h.party.kick(b.dataset.kick));
  };
  $('invitesList').onclick = e => {
    const a = e.target.closest('[data-accept]'), d = e.target.closest('[data-decline]');
    if(a) act(() => h.party.join(a.dataset.accept), () => { st.invites = st.invites.filter(i => i.code !== a.dataset.accept); });
    if(d) act(() => h.party.decline(d.dataset.decline), () => { st.invites = st.invites.filter(i => i.code !== d.dataset.decline); });
  };
  $('partyLeaveBtn').onclick = () => {
    if(confirm('Quitter le groupe ? Tu te retrouves seul dans ton lobby.')) act(() => h.party.leave(), () => { st.inviteOpen = false; });
  };
  $('joinForm').onsubmit = e => {
    e.preventDefault();
    act(() => h.party.join($('joinCode').value), () => { $('joinCode').value = ''; });
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
    /* rejoindre par un code venu d'un lien d'invitation */
    join(code){ return act(() => h.party.join(code)); },
    error,
  };
}
