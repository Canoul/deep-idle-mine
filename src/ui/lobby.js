/* Onglet Lobby : où miner (Mine, ou Mine instantanée : sa carte d'inscription, src/ui/instant-lobby.js), les places de la prochaine session (le groupe), Lancer,
   Inviter (code, lien, ID), invitations reçues, Critères / préférences, et (mode développeur seulement) seed, mineurs
   de test et réglages. Pendant une session, il reste visible en LECTURE SEULE (bandeau « En session dans la mine ») :
   la session elle-même est dans l'onglet Session.
   Lit l'état et appelle des fonctions : le groupe et la session sont gérés par le serveur. */
import { gearScore } from '../meta/gearscore.js';
import { statusText } from './social.js';
import { GAME, PREF_OPTIONS, MOB_INFO, DEV_TUNABLES, DEV_TARGETS, DEV_SPEC, SESSION_LEN, SKILLS, MINE_MODES, TOWER } from '../config.js';
import { joinLink } from '../shared/party.js';
import { queueTime } from '../shared/lfg.js';
import { pxi } from './pxicons.js';
import { drawPortrait } from '../render/portrait.js';
import { sanitizeLook } from '../meta/stuff.js';
import { sanitizeAuras } from '../meta/aura.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const TARGETS = DEV_TARGETS;   // objets des réglages dev (config)

/* durée réelle lisible : 1800 s → « 30 min » */
const realLen = speed => { const m = Math.round(SESSION_LEN / speed / 60); return m >= 1 ? `${m} min` : `${Math.round(SESSION_LEN / speed)} s`; };

/* Places du lobby, depuis l'état du serveur (logique pure, testée) :
   membres du groupe (chef en premier), invitations en attente, puis places libres ; sans groupe : soi + places libres. */
export function lobbySlots(account, party, max = GAME.maxPlayers, myTree = null){
  const slots = [];
  if(party){
    for(const m of party.members) slots.push({ kind:'member', ...m });
    for(const i of party.invited) if(slots.length < max) slots.push({ kind:'invited', ...i });
  } else if(account){
    slots.push({ kind:'member', account:account.id, displayId:account.displayId, name:account.displayName, me:true, leader:false, tree:myTree });
  }
  while(slots.length < max) slots.push({ kind:'free' });
  return slots.slice(0, Math.max(max, party?.members.length ?? 0));
}

/* skin d'une place : le sien = son stuff actuel (à jour sans attendre le serveur) ; les autres = l'équipement porté
   envoyé par le serveur (look), revérifié */
export const portraitLook = (slot, myLook = {}) => slot.me ? myLook : sanitizeLook(slot.look);
/* et son aura (src/meta/aura.js), de la même façon */
export const portraitAuras = (slot, mine = {}) => slot.me ? mine : sanitizeAuras(slot.auras);

/* spécialisation d'un joueur (arbre de skills choisi) : « 🪜 Logisticien (SP lvl : 3) », ou « Sans spécialisation » ;
   level : son niveau de spécialisation dans cet arbre (absent = pas affiché) */
export function specLabel(tree, level = null){
  const t = SKILLS.trees.find(x => x.id === tree);
  return t ? `${t.icon} ${t.label}${Number.isSafeInteger(level) ? ` (SP lvl : ${level})` : ''}` : 'Sans spécialisation';
}

/* Ce que fait le bouton principal : seul ou chef = Lancer (si tous les autres membres sont prêts) ; membre = se dire
   prêt / ne plus l'être (action:'ready', ready = la valeur à envoyer) */
export function launchState({ account, party, offline, busy, session }){
  if(offline || !account) return { can:false, label:'▶ Lancer la session' };
  if(session) return { can:false, label:'⛏ Session en cours' };
  if(busy || party?.launching) return { can:false, label:'… Lancement' };
  const leader = !party || party.leader === account.id;
  if(!leader){
    const me = party.members.find(m => m.account === account.id);
    if(me?.always) return { can:false, label:'✔ Prêt tout le temps' };   // seule la case l'enlève (23/10)
    return me?.ready ? { can:true, label:'✔ Prêt (annuler)', action:'ready', ready:false }
                     : { can:true, label:'✋ Je suis prêt', action:'ready', ready:true };
  }
  if(party?.members.some(m => m.playing)) return { can:false, label:'⏳ Le groupe finit sa session…' };
  const waiting = party?.members.filter(m => m.account !== party.leader && !m.ready) ?? [];
  if(waiting.length) return { can:false, label:`⏳ Pas prêt : ${waiting.map(m => m.name).join(', ')}` };
  const n = party?.members.length ?? 1;
  return { can:true, label: n > 1 ? `▶ Lancer à ${n}` : '▶ Lancer la session' };
}

/* Case « Prêt tout le temps » : seulement pour un membre (pas le chef) d'un groupe ; utilisable aussi pendant une
   session, pour être prêt dès la suivante */
/* case « Modulation » du lobby (tours) : visible pour celui qui lance (seul, ou chef du groupe) quand une tour est choisie,
   si elle est ouverte (TOWER.modulation.open) ou en mode dev ; over : les joueurs au-dessus du plafond (le serveur
   revérifie au lancement) */
export function modulationState({ tower, locked, party, account, slots = [], myGs, dev = false }){
  const leader = !party || party.members.length < 2 || party.leader === account?.id;
  const show = (TOWER.modulation.open || dev) && !!tower && !locked && !!account && leader;
  const max = TOWER.modulation.gsMax;
  const members = slots.filter(s => s.kind === 'member').map(s => ({ name: s.me ? 'Toi' : s.name, gs: s.me ? myGs : s.gs }));
  const over = members.filter(m => Number.isFinite(m.gs) && m.gs >= max);
  const esc2 = v => String(v).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const text = `Modulation : moins de ${max.toLocaleString('fr-FR')} GS chacun`+
    (over.length ? ` <small class="err">(${over.map(m => `${esc2(m.name)} : ${m.gs.toLocaleString('fr-FR')} GS`).join(', ')})</small>` : '');
  return { show, over, text };
}

/* « Who ? » (tour ouverte) : une ligne par joueur en ligne qui n'a pas encore fait la tour ; « Inviter » (par son ID)
   s'il n'est pas en session et pas déjà dans mon groupe. p = { id, displayId, name, status…, friend } */
export function whoRows(list, party){
  const inParty = new Set((party?.members ?? []).map(m => m.account));
  return (list?.players ?? []).map(p => ({ ...p, text: statusText(p), canInvite: p.status !== 'session' && p.status !== 'offline' && !inParty.has(p.id) }));
}

export function alwaysReadyState({ account, party, offline }){
  if(offline || !account || !party || party.members.length < 2 || party.leader === account.id) return { show:false };
  const me = party.members.find(m => m.account === account.id);
  return { show: !!me, checked: !!me?.always };
}

/* compteur de la recherche de groupe, visible même sans chercher (23/10) : vaut-il la peine de s'inscrire ? Mine
   classique, hors session ; null sinon. players : joueurs en recherche (un groupe de 2 compte pour 2) */
export function lfgCountText({ account, offline, session, mode, lfg }){
  if(offline || !account || session || mode !== MINE_MODES[0].id || !Number.isSafeInteger(lfg?.players)) return null;
  const n = lfg.players;
  return n === 0 ? 'Personne en recherche' : `${n} joueur${n > 1 ? 's' : ''} en recherche`;
}

/* Recherche de groupe (mine classique seulement) : rien, le bouton « Chercher un groupe » (seul, ou chef d'un groupe de
   2), ou la recherche en cours (cancel : c'est la sienne, on peut l'annuler ; sinon c'est celle de son chef) */
export function lfgState({ account, party, offline, session, mode, lfg }){
  if(offline || !account || session || party?.launching || mode !== MINE_MODES[0].id) return { show:false };
  const search = lfg?.search;
  if(search) return { show:true, searching:true, cancel:search.mine, auto:search.auto };
  const n = party?.members.length ?? 1;
  if(n >= GAME.maxPlayers || (n > 1 && party.leader !== account.id)) return { show:false };
  return { show:true, searching:false };
}

/* Boutons « Où miner » : le mode choisi, les modes pas encore prêts grisés (« bientôt »), tout grisé pendant une session
   sauf la mine instantanée et le Bloc géant (on les regarde ; leur carte et le serveur refusent d'y entrer).
   Tours du Jugement : seulement quand elles sont ouvertes (judgment : vue du serveur, src/meta/judgment.js) ; grisées
   si le joueur les a déjà faites pendant cette ouverture. Mode dev : toujours là et jamais grisées (illimitées). */
export function mineModes(cur, locked = false, judgment = null, dev = false){
  return MINE_MODES.filter(m => !m.tower || dev || judgment?.sides?.[m.tower]?.open).map(m => {
    const done = !dev && !!m.tower && !!judgment?.sides?.[m.tower]?.done;
    /* pendant une session, on peut encore regarder la mine instantanée et s'y inscrire (22/10), et regarder le Bloc géant
       (26/10 : scores, classement, récompenses ; « Entrer » y est grisé) */
    return { id:m.id, label:`${m.icon} ${m.label}`, on: m.id === cur, soon: !m.ready, done, disabled: (locked && !m.scheduled && !m.giant) || !m.ready || done };
  });
}

/* Cartes visibles du lobby. view 'jugement' : les jauges à gauche, l'équipe à droite comme pour la Mine (25/10), mais
   rien ne se lance d'ici (pas de Lancer, de préférences ni de réglages dev). Mine instantanée : sa carte d'inscription
   à la place de l'équipe. dev : réglages dev permis (mode dev, celui qui lance, hors session). */
export function lobbyCards({ view, mode, dev = false }){
  const jv = view === 'jugement', def = MINE_MODES.find(m => m.id === mode), mi = !!def?.scheduled, tower = !!def?.tower, giant = !jv && !!def?.giant;
  /* Bloc géant : sa carte à la place de l'équipe (on y entre seul), ni Lancer ni préférences (26/10) */
  return { judgment:jv, mi:!jv && mi, giant, team:(!mi && !giant) || jv, launch:!jv && !giant, prefs:!jv && !mi && !tower && !giant, dev:!jv && !mi && !giant && dev };
}

/* boutons du chef sur la place d'un autre membre : nommer chef (★) même pendant une session (25/10/2026 ; le serveur
   l'accepte, sauf pendant le lancement), retirer (×) seulement hors session */
export function slotButtons({ account, party, session }, slot){
  const leader = !!party && party.leader === account?.id && !slot.me && slot.kind !== 'free';
  return { promote: leader && slot.kind !== 'invited', kick: leader && !session };
}

/* h : { onLaunch(opts), onPrefs(prefs), onShowSession(), onMode(mode), onJudgment(), party: { create, join(code), invite(id), decline(code), leave, kick(id), ready(bool), alwaysReady(bool), promote(id), lfg(auto), lfgCancel } }
   Les fonctions du groupe renvoient l'état du groupe ou lèvent une erreur (message lisible). */
export function setupLobby(h){
  /* session : la session en cours ({ id }) ou null ; pendant une session, le lobby est en lecture seule */
  const st = { account:null, offline:false, info:null, prefs:null, busy:false, party:null, invites:[], inviteOpen:false,
               session:null, mode:MINE_MODES[0].id, view:null, judgmentPending:false, who:null,     // view 'jugement' : jauges à la place de l'équipe
               lfg:null, lfgStart:0, lfgAuto:false, lfgWant:null };   // lfgWant : sa recherche, à relancer si le serveur a redémarré

  function render(){
    const { account, offline, info, party } = st;
    const locked = !!st.session;
    if(locked) st.inviteOpen = false;
    $('lobby').classList.toggle('locked', locked);
    $('lobbySession').hidden = !locked;
    $('teamTitle').textContent = locked ? 'Ton groupe' : 'Équipe de la prochaine session';
    /* Mine instantanée : pas d'équipe ni de Lancer (elle s'ouvre à heure fixe), sa carte d'inscription à la place */
    /* une tour choisie qui vient de fermer (ou déjà faite) : retour à la Mine */
    const modes = mineModes(st.mode, locked, st.judgment, !!st.info?.dev);
    if(!locked && !modes.some(m => m.id === st.mode && !m.done)) st.mode = MINE_MODES[0].id;
    const def = MINE_MODES.find(m => m.id === st.mode), mi = def?.scheduled, tower = def?.tower;
    const jv = st.view === 'jugement';   // Jugement : on regarde les jauges (et son équipe), rien ne se lance d'ici
    const cards = lobbyCards({ view:st.view, mode:st.mode, dev:!!info?.dev && !locked && !(party && party.leader !== account?.id) });
    $('judgmentCard').hidden = !cards.judgment;
    $('miCard').hidden = !cards.mi; $('teamCard').hidden = !cards.team; $('prefsCard').hidden = !cards.prefs;
    const giantWas = $('giantCard').hidden; $('giantCard').hidden = !cards.giant;
    if(giantWas && cards.giant) h.onMode?.('giant');   // la carte vient d'apparaître : elle se met à jour
    $('launchBtn').hidden = !cards.launch;
    const btn = m => `<button data-mode="${m.id}" class="${m.on && !jv ? 'on' : ''}"${m.disabled ? ' disabled' : ''}${m.soon ? ' title="Bientôt disponible"' : m.done ? ' title="Déjà faite pendant cette ouverture"' : ''}>${esc(m.label)}`+
      `${m.soon ? ' <small>(bientôt)</small>' : m.done ? ' <small>(déjà faite)</small>' : ''}</button>`;
    const judge = `<button data-view="jugement" class="${jv ? 'on' : ''}" title="Jauges Ange contre Démon et tours">⚖ Jugement${st.judgmentPending ? ' <small class="jnew">● tour ouverte</small>' : ''}</button>`;
    const all = modes.map(btn), at = modes.filter(m => !MINE_MODES.find(d => d.id === m.id)?.tower).length;   // après Mine et Mine instantanée, avant les tours
    all.splice(at, 0, judge);
    $('mineModes').innerHTML = all.join('');
    const slots = lobbySlots(account, party, GAME.maxPlayers, st.myTree);
    $('lobbySlots').innerHTML = slots.map((s, i) => {
      if(s.kind === 'free')
        return `<div class="pslot free"><span class="av">${pxi('person')}</span><span><b>Place libre</b><small>Invite un ami</small></span></div>`;
      if(s.kind === 'invited')
        return `<div class="pslot free invited"><span class="av">${pxi('group')}</span><span><b>${esc(s.name)}</b><small>invité · en attente</small></span>`+
               (slotButtons(st, s).kick ? `<button class="x" data-kick="${esc(s.displayId)}" title="Annuler l'invitation">×</button>` : '')+`</div>`;
      const ready = party && !s.leader && !s.playing ? (s.always ? '✔ prêt tout le temps' : s.ready ? '✔ prêt' : 'pas prêt') : null;   // le chef : lancer = prêt
      const gs = s.me ? h.gs?.() : s.gs;
      const tags = [s.me && 'Toi', s.leader && 'chef', ready, (s.playing || s.me && locked) && 'en session', s.away && 'absent',
                    Number.isFinite(gs) && `${gs.toLocaleString('fr-FR')} GS`].filter(Boolean).join(' · ') || 'Prêt';
      return `<div class="pslot${s.me ? ' me' : ''}${s.away ? ' away' : ''}"><span class="av"><canvas width="16" height="16" data-slot="${i}"></canvas></span>`+
             `<span><b>${esc(s.name)}</b><small class="spec">${esc(s.me && st.myTree !== undefined ? specLabel(st.myTree, st.mySpec?.[st.myTree]?.level) : specLabel(s.tree, s.specLevel))}</small><small>${esc(tags)}</small></span>`+
             (slotButtons(st, s).promote ? `<button class="x promote" data-promote="${esc(s.displayId)}" title="Nommer chef">★</button>` : '')+
             (slotButtons(st, s).kick ? `<button class="x" data-kick="${esc(s.displayId)}" title="Retirer du groupe">×</button>` : '')+`</div>`;
    }).join('');
    /* sprite de chaque joueur, avec son équipement */
    $('lobbySlots').querySelectorAll('canvas').forEach(c => drawPortrait(c, portraitLook(slots[+c.dataset.slot], h.look?.() ?? {}), portraitAuras(slots[+c.dataset.slot], h.auras?.() ?? {})));

    const ls = launchState(st);
    if(tower && ls.can) ls.label = ls.label.replace('la session', 'la tour').replace('Lancer à', 'Lancer la tour à');
    $('launchBtn').disabled = !ls.can; $('launchBtn').innerHTML = pxi('arrow') + esc(ls.label.replace(/^[^\p{L}\d]+/u, ''));   // l'icône pixel remplace le « ▶ » du texte
    /* modulation : seulement pour une tour, et pour celui qui lance (seul ou chef) */
    const mod = modulationState({ tower:!!tower, locked, party, account, slots, myGs: h.gs?.(), dev: !!st.info?.dev });
    $('modulationRow').hidden = !mod.show;
    $('modulationText').innerHTML = mod.text;
    if(!mod.show) $('modulation').checked = false;
    const ar = alwaysReadyState(st);
    $('alwaysReadyRow').hidden = !ar.show;
    $('alwaysReady').checked = !!ar.checked;
    $('inviteBtn').disabled = offline || !account || locked;
    $('inviteBtn').classList.toggle('on', st.inviteOpen);
    $('partyLeaveBtn').hidden = !party || party.members.length < 2;
    $('partyLeaveBtn').disabled = locked;
    $('joinRow').hidden = offline || !account || locked || (party && party.members.length > 1);
    renderLfg();

    const dev = !!info?.dev, n = party?.members.length ?? 1;
    $('lobbyInfo').innerHTML = offline ? ''
      : locked ? 'Le lobby est en lecture seule pendant la session : tu pourras relancer à la fin.'
      : jv ? 'Pour lancer, choisis la Mine ou une tour ouverte dans « Où miner ».'
      : def?.giant ? ''
      : tower ? `${esc(def.label)} : <b>${TOWER.duration / 60} min</b> de jeu pour traverser les ${TOWER.floors} étages (briques et mobs) et vaincre le boss sur le toit. `+
                `Victoire : un trésor pour chaque joueur présent. Une seule victoire par ouverture. `+
                `<button class="small${st.who?.side === def.tower ? ' on' : ''}" id="whoBtn" title="Joueurs en ligne qui n'ont pas encore fait cette tour">Who ?</button>`
      : (n > 1 ? `Session à <b>${n}</b> : même mine, coffre partagé à la fin. ` : '')+
        (dev ? 'Mode développeur : vitesse au choix pendant la session, fin libre.'
             : `Session de <b>${realLen(info?.speed ?? GAME.speed)}</b>. Elle continue même si tu fermes la page.`);
    renderWho(tower && !locked && !offline ? def.tower : null);
    if(offline) error('Serveur injoignable. Réessaie dans un instant.');
    $('devCard').hidden = !cards.dev;   // seuls les réglages de celui qui lance comptent ; rien pour la MI
    renderInvite();
    renderInvites();
    renderPrefs();
  }

  /* recherche de groupe : bouton, « lancer dès que plein », timer, « groupe trouvé » */
  function renderLfg(){
    const lf = lfgState(st), mine = lf.show && (!lf.searching || lf.cancel), found = st.lfg?.found;
    $('lfgBtn').hidden = $('lfgAutoRow').hidden = !mine;
    $('lfgBtn').classList.toggle('on', !!lf.searching);
    $('lfgBtn').innerHTML = pxi('group') + (lf.searching ? 'Annuler la recherche' : 'Chercher un groupe');
    $('lfgAuto').checked = lf.searching ? lf.auto : st.lfgAuto;
    const status = lf.searching
      ? `En recherche de groupe… <b id="lfgTime">${queueTime(Date.now() - st.lfgStart)}</b>`+
        (lf.cancel ? '' : ' <span class="small">(lancée par le chef)</span>')+(lf.auto ? ' · lancement dès que plein' : '')
      : found && !st.session ? `Groupe trouvé : <b>${esc(found.names.join(', '))}</b>`+
        (found.error ? ` · lancement automatique impossible : ${esc(found.error)}` : '')
      : '';
    $('lfgStatus').hidden = !status;
    $('lfgStatus').innerHTML = status;
    const count = lfgCountText(st);
    $('lfgCount').hidden = !count;
    $('lfgCount').innerHTML = count ? pxi('group') + esc(count) : '';
  }
  setInterval(() => { const t = $('lfgTime'); if(t) t.textContent = queueTime(Date.now() - st.lfgStart); }, 1000);
  /* état de la recherche reçu du serveur ; serveur redémarré (boot a changé) pendant sa recherche : on la relance */
  function setLfg(lfg){
    st.lfg = lfg;
    if(lfg?.search) st.lfgStart = Date.now() - lfg.search.waited;
    if(lfg?.search?.mine) st.lfgWant = { boot:lfg.boot, auto:lfg.search.auto };
    else if(st.lfgWant && lfg && (lfg.boot === st.lfgWant.boot || lfg.found)) st.lfgWant = null;   // annulée, trouvée, sortie
    else if(st.lfgWant && lfg){ const auto = st.lfgWant.auto; st.lfgWant = null; act(() => h.party.lfg(auto)); }
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
        <span><button class="on" data-accept="${esc(i.code)}"${i.full ? ' disabled title="Groupe complet"' : st.session ? ' disabled title="Termine ta session pour rejoindre"' : ''}>Rejoindre</button>
        <button data-decline="${esc(i.code)}">Refuser</button></span></div>`).join('');
  }

  function renderPrefs(){
    const p = st.prefs ?? {};
    $('prefsBox').innerHTML = Object.entries(PREF_OPTIONS).map(([k, def]) =>
      `<div class="pref"><span>${esc(def.label)}</span><div class="seg">${def.options.map(([v, label], i) =>
        `<button data-k="${k}" data-i="${i}" class="${p[k] === v ? 'on' : ''}"${st.session ? ' disabled' : ''}>${esc(label)}</button>`).join('')}</div></div>`).join('')
      + (p.helpAllies ? helpList(p.helpIgnore ?? []) : '');
  }

  /* « Aider allié » : chaque type de mob, avec son dessin, ignoré oui / non (ignoré = il ne va pas aider contre lui) */
  function helpList(ignored){
    const dis = st.session ? ' disabled' : '';
    return `<div class="helpMobs"><div class="mut">Ignorer ces mobs quand un allié est pris en chasse ?</div>${
      Object.entries(MOB_INFO).map(([t, d]) => {
        const off = ignored.includes(t);
        return `<div class="pref"><span class="mobName"><span class="mobIco">${d.under ? `<img src="textures/${d.under}.png" alt="">` : ''}<img src="textures/${d.tex}.png" alt=""></span>${esc(d.name)}</span>
          <div class="seg"><button data-ign="${t}" data-v="1" class="${off ? 'on' : ''}"${dis}>Ignoré</button><button data-ign="${t}" data-v="0" class="${off ? '' : 'on'}"${dis}>Aider</button></div></div>`;
      }).join('')}</div>`;
  }

  function error(msg){ $('lobbyErr').hidden = !msg; $('lobbyErr').textContent = msg || ''; }

  /* action sur le groupe : met à jour l'état renvoyé par le serveur, affiche l'erreur sinon */
  async function act(fn, done){
    error('');
    try {
      const r = await fn();
      if(r && 'party' in r) st.party = r.party;
      if(r && 'lfg' in r) setLfg(r.lfg);
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
    if(st.session) return;                                            // préférences figées pendant la session
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

  $('mineModes').onclick = e => {
    if(e.target.closest('button[data-view]')){ st.view = 'jugement'; render(); h.onJudgment?.(); return; }
    const b = e.target.closest('button[data-mode]');
    if(!b || b.disabled) return;
    pick(b.dataset.mode);
  };
  function pick(mode){ st.view = null; st.mode = mode; render(); h.onMode?.(st.mode); }
  $('lobbyToSession').onclick = () => h.onShowSession?.();

  $('lfgBtn').onclick = () => act(() => st.lfg?.search?.mine ? h.party.lfgCancel() : h.party.lfg(st.lfgAuto));
  $('modulation').onchange = () => render();
  $('alwaysReady').onchange = () => act(() => h.party.alwaysReady($('alwaysReady').checked));
  $('lfgAuto').onchange = () => {
    st.lfgAuto = $('lfgAuto').checked;
    if(st.lfg?.search?.mine) act(() => h.party.lfg(st.lfgAuto));     // déjà en recherche : on garde sa place
  };

  $('inviteBtn').onclick = () => {
    st.inviteOpen = !st.inviteOpen;
    render();
    if(st.inviteOpen && !st.party) act(() => h.party.create());          // un code à partager tout de suite
    if(st.inviteOpen) setTimeout(() => $('inviteId')?.focus(), 0);
  };
  $('inviteBox').onclick = e => { const c = e.target.closest('[data-copy]'); if(c) copy(c.dataset.copy, c); };
  $('lobbySlots').onclick = e => {
    const p = e.target.closest('[data-promote]');
    if(p){ if(confirm("Lui donner ta place de chef ? C'est lui qui lancera les sessions.")) act(() => h.party.promote(p.dataset.promote)); return; }
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
  /* spécialisation imposée par place de mineur (joueurs du groupe dans l'ordre, puis mineurs de test) et niveau */
  $('devSpecs').innerHTML = Array.from({ length: GAME.maxPlayers }, (_, i) =>
    `<span>Spé du mineur ${i + 1}</span><span class="devSpec"><select data-spec="${i}"><option value="">La sienne</option>${
      SKILLS.trees.map(t => `<option value="${t.id}">${t.icon} ${esc(t.label)}</option>`).join('')}</select>` +
    `<input type="number" data-level="${i}" min="${DEV_SPEC.minLevel}" max="${DEV_SPEC.maxLevel}" step="1" value="${DEV_SPEC.maxLevel}" title="Niveau (points de talent = niveau − 1)"></span>`).join('') +
    `<p class="mut small devNote">Dans l'ordre : les joueurs du groupe, puis les mineurs de test. Le niveau remplit l'arbre étage par étage (points = niveau − 1).</p>`;
  const devSpecs = () => Array.from({ length: GAME.maxPlayers }, (_, i) => {
    const tree = $('devSpecs').querySelector(`[data-spec="${i}"]`).value, level = parseInt($('devSpecs').querySelector(`[data-level="${i}"]`).value, 10);
    return tree ? { tree, level: Math.max(DEV_SPEC.minLevel, Math.min(DEV_SPEC.maxLevel, Number.isSafeInteger(level) ? level : DEV_SPEC.maxLevel)) } : null;
  });
  /* liste « Who ? » sous l'info de la tour (fermée si on change de mode) */
  function renderWho(side){
    const box = $('towerWho');
    if(!side || st.who?.side !== side){ box.hidden = true; if(st.who && st.who.side !== side) st.who = null; return; }
    const w = st.who;
    const rows = whoRows(w.data, st.party);
    box.hidden = false;
    box.innerHTML = w.busy && !w.data ? '<p class="mut small">Chargement…</p>'
      : w.err ? `<p class="err small">${esc(w.err)}</p>`
      : !rows.length ? '<p class="mut small">Personne d\'autre en ligne n\'a cette tour à faire.</p>'
      : `<p class="small"><b>${rows.length}</b> joueur${rows.length > 1 ? 's' : ''} en ligne sans cette tour :</p>`+
        rows.map(p => `<div class="frow"><span class="fname"><b>${esc(p.name)}</b><small class="mut">${esc(p.text)}${p.friend ? ' · ami' : ''}</small></span>`+
          (p.canInvite ? `<button class="small" data-who-invite="${esc(p.displayId)}">Inviter</button>` : '')+`</div>`).join('');
  }
  async function loadWho(side){
    st.who = { side, busy:true, data:st.who?.side === side ? st.who.data : null }; render();
    try { st.who = { side, data: await h.towerWho(side) }; }
    catch(e){ st.who = { side, err: e.message }; }
    render();
  }
  $('lobbyInfo').addEventListener('click', e => {
    if(!e.target.closest('#whoBtn')) return;
    const side = MINE_MODES.find(m => m.id === st.mode)?.tower;
    if(!side) return;
    if(st.who?.side === side){ st.who = null; render(); return; }   // second clic : fermer
    loadWho(side);
  });
  $('towerWho').addEventListener('click', e => {
    const b = e.target.closest('[data-who-invite]'); if(!b) return;
    act(() => h.party.invite(b.dataset.whoInvite));
  });

  function devOptions(){
    const seed = parseInt($('devSeed').value, 10), overrides = {};
    for(const i of $('devStats').querySelectorAll('input')){
      const v = parseFloat(i.value);
      if(Number.isFinite(v) && v !== +i.dataset.base) (overrides[i.dataset.obj] ??= {})[i.dataset.key] = v;   // seulement ce qui change
    }
    return { seed: Number.isSafeInteger(seed) ? seed : undefined, bots: +$('devBots').value, overrides, devSpecs: devSpecs() };
  }

  $('launchBtn').onclick = async () => {
    if(st.busy) return;
    const ls = launchState(st);
    if(ls.action === 'ready') return act(() => h.party.ready(ls.ready));   // membre : prêt / plus prêt
    st.busy = true; render();
    const tw = !!MINE_MODES.find(m => m.id === st.mode)?.tower;
    try { await h.onLaunch({ mode: st.mode, ...(tw && $('modulation').checked ? { modulation: true } : {}), ...(st.info?.dev ? devOptions() : {}) }); }
    finally { st.busy = false; render(); }
  };

  return {
    update(patch){
      const { lfg, ...rest } = patch;
      Object.assign(st, rest);
      if('lfg' in patch) setLfg(lfg);
      render();
    },
    /* rejoindre par un code venu d'un lien d'invitation */
    join(code){ return act(() => h.party.join(code)); },
    /* afficher les jauges du Jugement (ancien onglet, lien #jugement) */
    showJudgment(){ st.view = 'jugement'; render(); h.onJudgment?.(); },
    /* choisir un type de mine (ex. la tour ouverte, depuis le Jugement) s'il est proposé et pas déjà fait */
    pickMode(mode){ if(mineModes(st.mode, !!st.session, st.judgment, !!st.info?.dev).some(m => m.id === mode && !m.disabled)) pick(mode); },
    error,
  };
}
