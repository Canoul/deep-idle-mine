/* Onglet Lobby : le menu des activités, puis l'activité ouverte (Mine, ou Mine instantanée : sa carte d'inscription, src/ui/instant-lobby.js), les places de la prochaine session (le groupe), Lancer,
   Inviter (code, lien, ID), invitations reçues, Critères / préférences, et (mode développeur seulement) seed, mineurs
   de test et réglages. Pendant une session, il reste visible en LECTURE SEULE (bandeau « En session dans la mine ») :
   la session elle-même est dans l'onglet Session.
   Lit l'état et appelle des fonctions : le groupe et la session sont gérés par le serveur. */
import { gearScore } from '../meta/gearscore.js';
import { leftText, statusText } from './social.js';
import { canBeInvited } from '../shared/party.js';
import { GAME, PREF_OPTIONS, MOB_INFO, DEV_TUNABLES, DEV_TARGETS, DEV_SPEC, SESSION_LEN, SKILLS, MINE_MODES, TOWER, INSTANCE, SHRINES } from '../config.js';
import { joinLink } from '../shared/party.js';
import { presetName, copyPresetId, copyName } from '../shared/dev-presets.js';
import { queueTime } from '../shared/lfg.js';
import { pxi } from './pxicons.js';
import { qhelp } from './help.js';
import { drawPortrait } from '../render/portrait.js';
import { sanitizeLook } from '../meta/stuff.js';
import { sanitizeAuras } from '../meta/aura.js';
import { ask, askText } from './dialog.js';
import { prisonActive, launchCostText, readyPrisonText, prisonProfileText } from './prison.js';

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

/* membre que le chef attend : son nom et son temps restant (pas de temps en mode dev) */
const waitingText = m => { const left = leftText(m.playingLeftMs); return left ? `${m.name} (${left})` : m.name; };

/* Ce que fait le bouton principal : seul ou chef = Lancer (si tous les autres membres sont prêts) ; membre = se dire
   prêt / ne plus l'être (action:'ready', ready = la valeur à envoyer) */
export function launchState({ account, party, offline, busy, session }){
  if(offline || !account) return { can:false, label:'▶ Lancer la session' };
  if(session) return { can:false, label:'⛏ Session en cours' };
  if(busy || party?.launching) return { can:false, label:'… Lancement' };
  const leader = !party || party.leader === account.id;
  if(!leader){
    const me = party.members.find(m => m.account === account.id);
    return me?.ready ? { can:true, label:'✔ Prêt (annuler)', action:'ready', ready:false }
                     : { can:true, label:'✋ Je suis prêt', action:'ready', ready:true };
  }
  const playing = party?.members.filter(m => m.playing) ?? [];
  if(playing.length) return { can:false, label:`⏳ Attente de ${playing.map(waitingText).join(', ')}` };
  const waiting = party?.members.filter(m => m.account !== party.leader && !m.ready) ?? [];
  if(waiting.length) return { can:false, label:`⏳ Pas prêt : ${waiting.map(m => m.name).join(', ')}` };
  const n = party?.members.length ?? 1;
  return { can:true, label: n > 1 ? `▶ Lancer à ${n}` : '▶ Lancer la session' };
}

/* bouton principal quand « Prison » est choisie (29/10) : entrer (seul, hors session), ou la voir quand elle tourne */
export function prisonLaunchState({ account, party, offline, busy, session, prison }){
  if(prisonActive(prison)) return { can: !offline && !!account, label:'⛓ Voir la prison', action:'view' };
  if(offline || !account) return { can:false, label:'⛓ Entrer en prison' };
  if(session) return { can:false, label:'⛏ Session en cours' };
  if(busy) return { can:false, label:'… Lancement' };
  if((party?.members.length ?? 1) > 1) return { can:false, label:'⛓ Seul seulement (quitte ton groupe)' };
  return { can:true, label:'⛓ Entrer en prison', action:'start' };
}

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

/* niveau d'instance (29/10/2026, Geoffrey ; INSTANCE.levels) : choisi par celui qui lance (seul, ou chef du groupe) ; ouvert
   à tous, sans limite (même clé). Le serveur revérifie. Tours : plus de niveau au choix, voir le Shrine héroïque (31/10). */
export function instanceLevelState({ instance, locked, party, account, cur = null, mode = 'instance_1' }){
  const leader = !party || party.members.length < 2 || party.leader === account?.id;
  /* Instance II (30/10) : un seul niveau, pas de rangée « Niveau » */
  const levels = (mode === 'instance_1' ? Object.keys(INSTANCE.levels).map(Number) : [1]).map(level => ({ level, done: false }));
  return { show: !!instance && !locked && !!account && leader && levels.length > 1, levels, level: levels.some(l => l.level === cur) ? cur : levels[0].level };
}

/* shrines visibles dans le lobby : mine classique, ceux sans tour ; lobby d'une tour, sa stèle (30/10/2026) et les shrines
   des deux tours (tower:'any', 31/10) ; rien ailleurs (Jugement, prison, instances…). mine : carte de la mine classique ; tower : camp de la tour choisie */
export const shownShrines = (list, { mine = false, tower = null } = {}) => (list ?? []).filter(sh => sh.tower ? sh.tower === tower || (sh.tower === 'any' && !!tower) : mine);

/* le joueur tape dans un champ de box : on ne le redessine pas sous ses doigts. Un bouton cliqué garde le focus : il ne compte
   pas, sinon « Activer / Désactiver » restait sur son ancien texte jusqu'au clic suivant ailleurs (31/10/2026) */
export const typingIn = (box, el) => el?.tagName === 'INPUT' && box.contains(el);

/* carte des shrines (28/10/2026) : ceux du chef du groupe (ou les siens, seul). Actif : sessions restantes ; stèle chargée :
   activée ou non, et le bouton du chef (30/10) ; sinon le prix, ce qui est déjà donné, et pour chaque objet un champ
   + « Donner » (have : combien j'en ai). leaderName : null si c'est moi. */
export function shrinesHtml(list = [], { have = () => 0, leaderName = null, busy = false } = {}){
  const e = v => String(v).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const head = leaderName ? `<p class="mut small">Shrines de <b>${e(leaderName)}</b> (chef du groupe) : chacun peut donner.</p>` : '';   // le reste : « ? » du titre
  return head + list.map(sh => {
    const top = `<div class="shrineHead"><img src="textures/${e(sh.tex)}.png" alt="" width="32" height="32"><span><b>${e(sh.name)}</b><br><small>${e(sh.desc)}</small></span></div>`;
    if(sh.left > 0 && sh.tower) return `<div class="shrine on">${top}<p class="${sh.on ? 'ok' : 'mut'} small">${sh.on ? '✔ Chargée et activée' : 'Chargée, désactivée : la prochaine tour se joue sans elle'}. Consommée à la victoire, gardée sinon.</p>`+
      (leaderName ? '<p class="mut small">Seul le chef peut l\'activer ou la désactiver.</p>' : `<button data-stele-set="${e(sh.id)}" data-on="${sh.on ? 0 : 1}"${busy ? ' disabled' : ''}>${sh.on ? 'Désactiver' : 'Activer'}</button>`)+`</div>`;
    if(sh.left > 0) return `<div class="shrine on">${top}<p class="ok small">✔ Actif : encore <b>${sh.left}</b> session${sh.left > 1 ? 's' : ''} de mine.</p></div>`;
    const rows = Object.entries(sh.price).map(([item, q]) => {
      const got = sh.paid?.[item] ?? 0, need = q - got, mine = have(item);
      return `<div class="shrineRow"><span>${e(item)} : <b>${got} / ${q}</b> <small class="mut">(tu en as ${mine})</small></span>`+
        (need > 0 ? `<input type="number" min="1" max="${need}" value="${Math.max(1, Math.min(need, mine))}" data-shrine-qty="${e(sh.id)}|${e(item)}">`+
                    `<button data-shrine-give="${e(sh.id)}|${e(item)}"${busy || !mine ? ' disabled' : ''}>Donner</button>` : '<small class="ok">✔</small>')+`</div>`;
    }).join('');
    return `<div class="shrine">${top}${rows}<p class="mut small">Prix atteint : ${sh.tower ? 'une charge, consommée à la victoire' : `actif pour ${sh.sessions} mines`}.</p></div>`;
  }).join('');
}

/* « Who ? » (tour ouverte) : une ligne par joueur en ligne qui n'a pas encore fait la tour ; « Inviter » (par son ID)
   s'il n'est pas en session et pas déjà dans mon groupe. p = { id, displayId, name, status…, friend } */
export function whoRows(list, party, now = Date.now()){
  const inParty = new Set((party?.members ?? []).map(m => m.account));
  return (list?.players ?? []).map(p => ({ ...p, text: p.status === 'offline' ? seenText(p.lastSeenAt, now) : statusText(p),
                                           canInvite: canBeInvited(p) && !inParty.has(p.id) }));
}
/* joueur hors ligne de « Who ? » : « Hors ligne · vu il y a 3 h » (moins d'une heure : « il y a 25 min ») */
export function seenText(at, now = Date.now()){
  if(!Number.isFinite(at)) return 'Hors ligne';
  const min = Math.max(0, Math.round((now - at) / 60000));
  return `Hors ligne · vu il y a ${min < 60 ? `${Math.max(1, min)} min` : `${Math.round(min / 60)} h`}`;
}

/* Case « Prêt tout le temps » (31/10, Geoffrey) : réglage du compte, visible partout (seul, chef, en prison, en session),
   cochée selon le serveur. Elle garde prêt celui qui l'est, elle ne le rend pas prêt. */
export function alwaysReadyState({ account, offline, alwaysReady }){
  return { show: !offline && !!account, checked: !!alwaysReady };
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
   sauf la mine instantanée, le Bloc géant et les instances (on les regarde ; leur carte et le serveur refusent d'y entrer).
   Tours du Jugement : seulement quand elles sont ouvertes (judgment : vue du serveur, src/meta/judgment.js) ; grisées
   si le joueur les a déjà faites pendant cette ouverture. Mode dev : toujours là et jamais grisées (illimitées).
   Prison (29/10) : solo, grisée quand on est dans un groupe de plusieurs (size : joueurs du groupe) ; premier bouton
   (30/10, Geoffrey). */
export function mineModes(cur, locked = false, judgment = null, dev = false, size = 1){
  /* instances (27/10) : un seul bouton « Instances » pour toutes ; il ouvre l'instance choisie (la première sinon) */
  const curInst = MINE_MODES.find(m => m.id === cur)?.instance;
  const order = [...MINE_MODES].sort((a, b) => !!b.prison - !!a.prison);   // prison en premier (30/10)
  return order.filter(m => (!m.tower || dev || judgment?.sides?.[m.tower]?.open) && (!m.instance || m === MINE_MODES.find(x => x.instance))).map(m => {
    if(m.instance) return { id: curInst ? cur : m.id, label: '🗝 Instances', on: !!curInst, soon: false, done: false, disabled: false };   // aussi en session : on regarde la carte (Lancer reste grisé, 27/10)
    if(m.solo && size > 1) return { id:m.id, label:`${m.icon} ${m.label}`, on: m.id === cur, soon: false, done: false, disabled: true, title: 'Elle se joue seul : quitte ton groupe pour la lancer.' };
    const done = !dev && !!m.tower && !!judgment?.sides?.[m.tower]?.done;
    /* pendant une session, on peut encore regarder la mine instantanée et s'y inscrire (22/10), et regarder le Bloc géant
       (26/10 : scores, classement, récompenses ; « Entrer » y est grisé) */
    return { id:m.id, label:`${m.icon} ${m.label}`, on: m.id === cur, soon: !m.ready, done, disabled: (locked && !m.scheduled && !m.giant) || !m.ready || done };
  });
}

/* Menu du Lobby (31/10/2026, Geoffrey) : une ligne par activité, dans cet ordre. id : mode de lancement, 'jugement' pour
   les jauges, 'instances' pour le bouton unique des instances. */
const ACTIVITIES = [
  { id:'prison',    icon:'⛓', title:'Prison',           desc:'Farm solo et énergie' },
  { id:'mine',      icon:'⛏', title:'Mine',             desc:'Va de plus en plus profond avec ta team' },
  { id:'mi',        icon:'🌀', title:'Mine instantanée', desc:'Mine avec full minerais' },
  { id:'giant',     icon:'🌈', title:'Bloc géant',       desc:'Mine le plus vite possible' },
  { id:'jugement',  icon:'⚖', title:'Jugement',         desc:'Combat le jugement' },
  { id:'instances', icon:'🗝', title:'Instances',        desc:'Affronte un boss en équipe pour son coffre' },
];
/* lignes du menu d'après mineModes (grisées pareil, sauf la Mine : en session, on y regarde son groupe). Les tours ne sont
   pas dans le menu : on les choisit dans le Jugement. note : petit repère à droite (« tour ouverte », « en cours ») */
export function activityMenu(modes, { towerOpen = false, prisonOn = false } = {}){
  return ACTIVITIES.map(a => {
    if(a.id === 'jugement') return { ...a, kind:'view', note: towerOpen ? 'tour ouverte' : null };
    const m = a.id === 'instances' ? modes.find(x => MINE_MODES.find(d => d.id === x.id)?.instance) : modes.find(x => x.id === a.id);
    return { ...a, kind:'mode', mode:m.id, disabled: a.id === 'mine' ? !!m.soon : m.disabled, soon:m.soon, hint:m.title ?? null, note: a.id === 'prison' && prisonOn ? 'en cours' : null };
  });
}

/* Cartes du menu des activités (31/10/2026, Geoffrey) : l'équipe à droite, en solo comme en groupe ; un membre y a son
   « Je suis prêt », le chef et le joueur seul lancent depuis une activité */
export const menuCards = ({ party, account }) => ({ team: true, launch: !!party && party.members.length > 1 && party.leader !== account?.id });

/* Cartes visibles du lobby. view 'jugement' : les jauges et les sets à gauche, l'équipe à droite comme pour la Mine (25/10), mais
   rien ne se lance d'ici (pas de Lancer, de préférences ni de réglages dev). Mine instantanée : sa carte d'inscription
   à la place de l'équipe. dev : réglages dev permis (mode dev, celui qui lance, hors session). */
export function lobbyCards({ view, mode, dev = false }){
  const jv = view === 'jugement', def = MINE_MODES.find(m => m.id === mode), mi = !!def?.scheduled, tower = !!def?.tower, giant = !jv && !!def?.giant;
  const inst = !jv && !!def?.instance;
  /* Bloc géant : sa carte à la place de l'équipe (on y entre seul), ni Lancer ni préférences (26/10). Instances (27/10) :
     leur carte, l'équipe et Lancer ; pas de préférences (l'IA de l'instance ne les lit pas) */
  /* Prison (29/10) : l'équipe (soi), Lancer et les préférences (l'IA de la prison les lit) ; ni réglages dev ni shrines */
  const prison = !jv && !!def?.prison;
  return { judgment:jv, mi:!jv && mi, giant, inst, prison, team:(!mi && !giant) || jv, launch:!jv && !giant, prefs:!jv && !mi && !tower && !giant && !inst,
           dev:!jv && !mi && !giant && !prison && dev };
}

/* boutons du chef sur la place d'un autre membre : nommer chef (★) même pendant une session (25/10/2026 ; le serveur
   l'accepte, sauf pendant le lancement), retirer (×) seulement hors session */
export function slotButtons({ account, party, session }, slot){
  const leader = !!party && party.leader === account?.id && !slot.me && slot.kind !== 'free';
  return { promote: leader && slot.kind !== 'invited', kick: leader && !session };
}

/* h : { onLaunch(opts, { party }), onPrefs(prefs), onShowSession(), onMode(mode), onJudgment(), onPrisonStart(), onPrisonStop(), onShowPrison(), prisonProfile(), party: { create, join(code), invite(id), decline(code), leave, kick(id), ready(bool), alwaysReady(bool), promote(id), lfg(auto), lfgCancel } }
   Les fonctions du groupe renvoient l'état du groupe ou lèvent une erreur (message lisible). */
export function setupLobby(h){
  /* screen : 'menu' (les activités) ou 'stage' (l'activité ouverte : sets à gauche, sa carte à droite) */
  /* session : la session en cours ({ id }) ou null ; pendant une session, le lobby est en lecture seule */
  const st = { account:null, offline:false, info:null, prefs:null, busy:false, party:null, invites:[], inviteOpen:false, shrines:[],
               session:null, screen:'menu', mode:MINE_MODES[0].id, view:null, judgmentPending:false, who:null,     // view 'jugement' : jauges à la place de l'équipe
               lfg:null, lfgStart:0, lfgAuto:false, lfgWant:null,
               prison:null, energy:null, prisonProfile:null, prisonPrev:null, prisonSaved:null, prisonCompo:'current', prisonProfileAt:0 };   // contenu de la prison d'après les 10 dernières mines (29/10)   // prison (publicPrison) et énergie ({ value, max }) du serveur (29/10)   // lfgWant : sa recherche, à relancer si le serveur a redémarré
  /* compos de prison (30/10) : r = { profile (actuelle), previous (ancienne, mines 11 à 20), saved (enregistrée) } */
  const setCompos = r => {
    st.prisonProfile = r?.profile ?? null; st.prisonPrev = r?.previous ?? null; st.prisonSaved = r?.saved ?? null;
    if((st.prisonCompo === 'previous' && !st.prisonPrev) || (st.prisonCompo === 'saved' && !st.prisonSaved)) st.prisonCompo = 'current';
  };

  function render(){
    const { account, offline, info, party } = st;
    const locked = !!st.session;
    if(locked) st.inviteOpen = false;
    $('lobby').classList.toggle('locked', locked);
    $('lobbySession').hidden = !locked;
    $('teamTitle').textContent = locked ? 'Ton groupe' : 'Équipe de la prochaine session';
    /* Mine instantanée : pas d'équipe ni de Lancer (elle s'ouvre à heure fixe), sa carte d'inscription à la place */
    /* une tour choisie qui vient de fermer (ou déjà faite) : retour à la Mine */
    const modes = mineModes(st.mode, locked, st.judgment, !!st.info?.dev, party?.members.length ?? 1);
    if(!locked && !modes.some(m => m.id === st.mode && !m.done)) st.mode = MINE_MODES[0].id;
    const menu = st.screen === 'menu';
    const def = menu ? null : MINE_MODES.find(m => m.id === st.mode), mi = def?.scheduled, tower = def?.tower;   // menu : aucune activité choisie
    const jv = st.view === 'jugement';   // Jugement : on regarde les jauges (et son équipe), rien ne se lance d'ici
    $('lobbyMenu').hidden = !menu; $('lobbyStage').hidden = menu; $('lobbySetsCard').hidden = menu;
    $('lobby').classList.toggle('atMenu', menu);
    $('actTitle').textContent = jv ? 'Jugement' : def?.instance ? 'Instances' : def?.label ?? '';
    const cards = menu ? menuCards(st) : lobbyCards({ view:st.view, mode:st.mode, dev:!!info?.dev && !locked });
    $('judgmentCard').hidden = !cards.judgment;
    $('miCard').hidden = !cards.mi; $('teamCard').hidden = !cards.team; $('prefsCard').hidden = !cards.prefs;
    /* shrines : mine classique (28/10) ; lobby d'une tour : sa stèle seulement (30/10) ; prison : aucun (29/10) */
    const shrineList = menu || jv || cards.prison ? [] : shownShrines(st.shrines, { mine: cards.prefs, tower });
    $('shrinesCard').hidden = !shrineList.length;
    if(!$('shrinesCard').hidden){
      const leader = party && party.members.length > 1 && party.leader !== account?.id ? party.members.find(m => m.account === party.leader)?.name ?? 'le chef' : null;
      const html = shrinesHtml(shrineList, { have: item => h.keys?.(item) ?? 0, leaderName: leader, busy: st.busy });
      if($('shrinesBody')._html !== html && !typingIn($('shrinesBody'), document.activeElement)){ $('shrinesBody').innerHTML = html; $('shrinesBody')._html = html; }
    }
    $('instCard').hidden = !cards.inst;
    if(cards.inst) renderInstances();
    const giantWas = $('giantCard').hidden; $('giantCard').hidden = !cards.giant;
    if(giantWas && cards.giant) h.onMode?.('giant');   // la carte vient d'apparaître : elle se met à jour
    $('launchBtn').hidden = !cards.launch;
    $('mineModes').innerHTML = activityMenu(modes, { towerOpen: st.judgmentPending, prisonOn: prisonActive(st.prison) }).map(a =>
      `<button ${a.kind === 'view' ? 'data-view="jugement"' : `data-mode="${a.mode}"`} class="actBtn"${a.disabled ? ' disabled' : ''}${a.hint ? ` title="${esc(a.hint)}"` : ''}>`+
      `<span class="actIcon">${a.icon}</span><span class="actText"><b>${esc(a.title)}</b><small>${esc(a.desc)}</small></span>`+
      (a.note ? `<small class="jnew">● ${esc(a.note)}</small>` : a.soon ? '<small>bientôt</small>' : '')+`</button>`).join('');
    /* mode dev : les tours, même fermées (jeu normal : « Choisir la tour » de la carte du Jugement) */
    const devTowers = jv && !!info?.dev ? modes.filter(m => MINE_MODES.find(d => d.id === m.id)?.tower) : [];
    $('towerModes').hidden = !devTowers.length;
    $('towerModes').innerHTML = devTowers.map(m => `<button data-mode="${m.id}"${m.disabled ? ' disabled' : ''}>${esc(m.label)}</button>`).join('');
    const slots = lobbySlots(account, party, GAME.maxPlayers, st.myTree);
    $('lobbySlots').innerHTML = slots.map((s, i) => {
      if(s.kind === 'free')
        return `<div class="pslot free"><span class="av">${pxi('person')}</span><span><b>Place libre</b><small>Invite un ami</small></span></div>`;
      if(s.kind === 'invited')
        return `<div class="pslot free invited"><span class="av">${pxi('group')}</span><span><b>${esc(s.name)}</b><small>invité · en attente</small></span>`+
               (slotButtons(st, s).kick ? `<button class="x" data-kick="${esc(s.displayId)}" title="Annuler l'invitation">×</button>` : '')+`</div>`;
      const ready = party && !s.leader && !s.playing ? (s.ready ? (s.always ? '✔ prêt tout le temps' : '✔ prêt') : 'pas prêt') : null;   // le chef : lancer = prêt
      const gs = s.me ? h.gs?.() : s.gs;
      const tags = [s.me && 'Toi', s.leader && 'chef', ready, (s.playing || s.me && locked) && 'en session', s.playing && leftText(s.playingLeftMs), s.away && 'absent',
                    Number.isFinite(gs) && `${gs.toLocaleString('fr-FR')} GS`].filter(Boolean).join(' · ') || 'Prêt';
      return `<div class="pslot${s.me ? ' me' : ''}${s.away ? ' away' : ''}"><span class="av"><canvas width="16" height="16" data-slot="${i}"></canvas></span>`+
             `<span><b>${esc(s.name)}</b><small class="spec">${esc(s.me && st.myTree !== undefined ? specLabel(st.myTree, st.mySpec?.[st.myTree]?.level) : specLabel(s.tree, s.specLevel))}</small><small>${esc(tags)}</small></span>`+
             (slotButtons(st, s).promote ? `<button class="x promote" data-promote="${esc(s.displayId)}" title="Nommer chef">★</button>` : '')+
             (slotButtons(st, s).kick ? `<button class="x" data-kick="${esc(s.displayId)}" title="Retirer du groupe">×</button>` : '')+`</div>`;
    }).join('');
    /* sprite de chaque joueur, avec son équipement */
    $('lobbySlots').querySelectorAll('canvas').forEach(c => drawPortrait(c, portraitLook(slots[+c.dataset.slot], h.look?.() ?? {}), portraitAuras(slots[+c.dataset.slot], h.auras?.() ?? {})));

    const ls = def?.prison ? prisonLaunchState(st) : launchState(st);
    if(tower && ls.can) ls.label = ls.label.replace('la session', 'la tour').replace('Lancer à', 'Lancer la tour à');
    if(def?.instance && ls.can) ls.label = ls.label.replace('la session', 'l\'instance').replace('Lancer à', 'Lancer l\'instance à');
    $('launchBtn').disabled = !ls.can; $('launchBtn').innerHTML = pxi('arrow') + esc(ls.label.replace(/^[^\p{L}\d]+/u, ''));   // l'icône pixel remplace le « ▶ » du texte
    /* énergie (29/10) : coût possible à côté de « Lancer », mine classique seulement (pas en mode dev : rien n'est débité) */
    const cost = def === MINE_MODES[0] && !locked && !jv && !!account && !offline && !info?.dev && !(party && party.members.length > 1 && party.leader !== account.id);
    $('launchCost').hidden = !cost;
    $('launchCost').textContent = cost ? launchCostText(st.energy) : '';
    $('launchCost').classList.toggle('err', cost && /pas assez/.test($('launchCost').textContent));
    $('prisonStopLobby').hidden = !def?.prison || jv || !prisonActive(st.prison);
    /* contenu de la prison (29/10) : d'après les 10 dernières mines ; celui de la prison qui tourne, sinon relu au serveur
       en arrivant sur la prison (au plus une fois par minute) */
    if(def?.prison && !jv && account && !offline && !prisonActive(st.prison) && Date.now() - st.prisonProfileAt > 60e3){
      st.prisonProfileAt = Date.now();
      h.prisonProfile?.().then(r => { setCompos(r); render(); }).catch(() => { st.prisonProfileAt = 0; });
    }
    const ptxt = def?.prison && !jv ? (prisonActive(st.prison) ? prisonProfileText(st.prison.profile, true) : (st.prisonCompo === 'previous' ? prisonProfileText(st.prisonPrev, false, 'compo ancienne : tes mines 11 à 20') : st.prisonCompo === 'saved' ? prisonProfileText(st.prisonSaved, false, 'compo enregistrée') : prisonProfileText(st.prisonProfile))) : '';
    $('prisonProfileRow').hidden = !ptxt;
    $('prisonProfileRow').textContent = ptxt;
    /* choix de la compo (30/10) : actuelle (10 dernières mines du palier) ou précédente (le palier d'avant) */
    const showCompo = !!ptxt && !prisonActive(st.prison) && !!(st.prisonPrev || st.prisonSaved || st.prisonProfile?.n);
    $('prisonCompoRow').hidden = !showCompo;
    if(showCompo){
      for(const b of $('prisonCompoRow').querySelectorAll('[data-compo]')){
        b.classList.toggle('on', b.dataset.compo === st.prisonCompo);
        b.hidden = (b.dataset.compo === 'previous' && !st.prisonPrev) || (b.dataset.compo === 'saved' && !st.prisonSaved);
      }
      $('prisonCompoSave').hidden = st.prisonCompo === 'saved';   // enregistrer l'actuelle ou l'ancienne
    }
    /* modulation : seulement pour une tour, et pour celui qui lance (seul ou chef) */
    const mod = modulationState({ tower:!!tower, locked, party, account, slots, myGs: h.gs?.(), dev: !!st.info?.dev });
    $('modulationRow').hidden = !mod.show;
    $('devSteleRow').hidden = !(st.info?.dev && tower && !locked);   // stèle imposée en mode dev (30/10)
    $('devHeroicRow').hidden = $('devSteleRow').hidden;              // Shrine héroïque imposé en mode dev (31/10)
    const tl = def?.instance ? instanceLevelState({ instance: true, locked, party, account, cur: st.towerLevel, mode: st.mode })   // niveau d'instance (29/10)
      : { show: false, levels: [], level: null };
    st.towerLevel = tl.level;
    $('towerLevelRow').hidden = !tl.show;
    $('towerLevelRow').innerHTML = tl.show ? '<span>Niveau :</span>' + tl.levels.map(l =>
      `<button data-level="${l.level}" class="${l.level === tl.level ? 'on' : ''}"${l.done ? ' disabled title="Déjà fait pendant cette ouverture"' : ''}>Niveau ${l.level}${l.done ? ' <small>(fait)</small>' : ''}</button>`).join('') : '';
    $('modulationText').innerHTML = mod.text;
    if(!mod.show) $('modulation').checked = false;
    const ar = alwaysReadyState(st);
    $('alwaysReadyRow').hidden = !ar.show;
    $('alwaysReady').checked = !!ar.checked;
    $('inviteBtn').disabled = offline || !account || locked;
    $('inviteBtn').classList.toggle('on', st.inviteOpen);
    $('partyLeaveBtn').hidden = !party || party.members.length < 2;
    $('partyLeaveBtn').disabled = locked;
    /* « Pub LFG » (31/10/2026) : annonce son lobby dans le chat, tant qu'il reste une place */
    $('lobbyPubBtn').hidden = !h.onPub || offline || !account || locked || !def || def.solo || def.giant || def.scheduled || (party?.members.length ?? 1) >= (party?.max ?? Infinity);
    $('joinRow').hidden = offline || !account || locked || (party && party.members.length > 1);
    renderLfg();

    const dev = !!info?.dev, n = party?.members.length ?? 1;
    $('lobbyInfo').innerHTML = offline || (menu && !locked) ? ''
      : locked ? 'Le lobby est en lecture seule pendant la session : tu pourras relancer à la fin.'
      : jv ? 'Une tour ouverte se lance avec « Choisir la tour ».'
      : def?.giant ? ''
      : def?.prison ? (prisonActive(st.prison) ? 'Ta prison tourne, même page fermée. « Sortir de prison » verse le coffre du run en cours (pas ce que le mineur porte).'
          : 'Prison : seul, sans fin. Ton mineur mine une petite carte au contenu de ton area max ; à 80 % des minerais, il dépose et une carte neuve commence. '+
            'Chaque run est versé dans ton inventaire et recharge ton énergie. Lancer une mine, une tour ou une instance la termine.')
      : def?.instance ? `${esc(def.label)} : <b>${INSTANCE.duration / 60} min</b> de jeu pour casser les ${INSTANCE.ledges * 2} spawners et vaincre le ${esc(INSTANCE.boss.name)}. `+
                        `<b>Une clé par joueur</b>, utilisée seulement si le groupe gagne (échec ou départ : on la garde).`
      : tower ? `${esc(def.label)} : <b>${TOWER.duration / 60} min</b> de jeu pour traverser les ${TOWER.floors} étages (briques et mobs) et vaincre le boss sur le toit. `+
                `Victoire : un trésor pour chaque joueur présent. Une seule victoire par ouverture. `+
                `<button class="small${st.who?.side === def.tower ? ' on' : ''}" id="whoBtn" title="Joueurs en ligne qui n'ont pas encore fait cette tour">Who ?</button>`
      : (n > 1 ? `Session à <b>${n}</b> : même mine, coffre partagé à la fin. ` : '')+
        (dev ? 'Mode développeur : vitesse au choix pendant la session, fin libre.'
             : `Session de <b>${realLen(info?.speed ?? GAME.speed)}</b>. Elle continue même si tu fermes la page.`);
    renderWho(tower && !locked && !offline ? def.tower : null);
    if(offline) error('Serveur injoignable. Réessaie dans un instant.');
    $('devCard').hidden = !cards.dev;   // rien pour la MI
    $('devCard').classList.toggle('devMember', !!party && party.leader !== account?.id);   // un membre : les presets seulement
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
      if(r && 'alwaysReady' in r) st.alwaysReady = r.alwaysReady;
      if(r && 'lfg' in r) setLfg(r.lfg);
      done?.();
    } catch(e){ error(e.message); }
    render();
  }

  async function copy(text, el){
    try { await navigator.clipboard.writeText(text); el.classList.add('copied'); setTimeout(() => el.classList.remove('copied'), 1200); }
    catch { askText('Copie ce texte :', text, { readOnly:true }); }
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
    if(e.target.closest('button[data-view]')) return showJudgment();
    const b = e.target.closest('button[data-mode]');
    if(!b || b.disabled) return;
    pick(b.dataset.mode);
  };
  $('towerModes').onclick = e => { const b = e.target.closest('button[data-mode]'); if(b && !b.disabled) pick(b.dataset.mode); };
  /* ce que le lien de lobby annonce : l'activité affichée et son niveau */
  const pubContext = () => { const def = MINE_MODES.find(m => m.id === st.mode); return { mode: st.mode, level: def?.tower || def?.instance ? st.towerLevel : 1 }; };
  $('lobbyPubBtn').onclick = () => h.onPub?.(pubContext());
  function pick(mode){ st.screen = 'stage'; st.view = null; st.mode = mode; render(); scrollTo(0, 0); h.onMode?.(st.mode); }
  function showJudgment(){ st.screen = 'stage'; st.view = 'jugement'; render(); scrollTo(0, 0); h.onJudgment?.(); }
  /* retour : d'une tour au Jugement, sinon au menu */
  $('lobbyBack').onclick = () => {
    if(MINE_MODES.find(m => m.id === st.mode)?.tower && st.view !== 'jugement') return showJudgment();
    st.screen = 'menu'; st.view = null; render(); scrollTo(0, 0);
  };

  /* carte des instances : la liste (les pas prêtes grisées) et les clés du joueur pour l'instance choisie */
  function renderInstances(){
    const cur = INSTANCE.list.find(i => i.id === st.mode) ?? INSTANCE.list[0], n = cur.key ? (h.keys?.(cur.key) ?? 0) : 0;
    $('instBody').innerHTML = `<div class="instList">${INSTANCE.list.map(i =>
      `<button data-inst="${i.id}" class="${i.id === cur.id ? 'on' : ''}"${i.ready ? '' : ' disabled title="Bientôt disponible"'}>`+
      `<span><b>${esc(i.label)}</b>${i.sub ? `<br><small>${esc(i.sub)}</small>` : ''}</span>${i.ready ? '' : '<small>🔒 bientôt</small>'}</button>`).join('')}</div>`+
      (cur.key ? `<p class="instKeys"><span>🗝</span><span>Tes clés : <b class="${n ? 'ok' : 'err'}">${n} ${esc(cur.key)}</b></span> `+
        qhelp(`Clés d'instance\nChaque joueur du groupe doit avoir sa clé.\nElle n'est utilisée que si le groupe gagne : en cas d'échec, ou si tu quittes avant la fin, tu la gardes.\nOn la trouve dans les ${cur.keyFrom ?? 'Treasure T3 (20 %)'}.`)+`</p>`+
        (cur.chest === 'goblin' ? `<p class="small">🎁 Roi vaincu : un <b>Coffre du Roi Gobelin</b> (qualité R1 à R7) pour chaque joueur encore là. `+
          `<b>Niveau 2</b> : gobelins et roi bien plus solides ; un <b>Coffre du Roi Gobelin II</b> (× ${INSTANCE.levels[2].chest.res} ressources, × ${INSTANCE.levels[2].chest.drop} chances d'objets).</p>`
        : cur.chest === 'golbute' ? `<p class="small">🗿 Un golem de 5 × 5. Ses <b>avalanches</b> sonnent tout le monde : à ${INSTANCE.golbute.avalanche.deathStacks} stacks, mort. `+
          `<b>Prends de la ténacité</b> (elle esquive l'avalanche et les coups qui propulsent). 🎁 Golbute vaincu : un <b>Coffre du Golbute</b> (R1 à R7) pour chaque joueur encore là (son butin arrive bientôt).</p>` : '') : '');
  }
  $('instBody').onclick = e => { const b = e.target.closest('button[data-inst]'); if(b && !b.disabled) pick(b.dataset.inst); };
  $('lobbyToSession').onclick = () => h.onShowSession?.();
  $('prisonStopLobby').onclick = () => h.onPrisonStop?.();

  $('lfgBtn').onclick = () => act(() => st.lfg?.search?.mine ? h.party.lfgCancel() : h.party.lfg(st.lfgAuto));
  $('modulation').onchange = () => render();
  $('shrinesBody').onclick = e => {
    const t = e.target.closest('button[data-stele-set]');
    if(t && !t.disabled){
      st.busy = true;
      act(async () => { const r = await h.party.stele({ shrine: t.dataset.steleSet, on: t.dataset.on === '1' }); st.shrines = r.shrines; return r; }, () => { st.busy = false; }).finally(() => { st.busy = false; render(); });
      return;
    }
    const b = e.target.closest('button[data-shrine-give]'); if(!b || b.disabled) return;
    const [id, item] = b.dataset.shrineGive.split('|');
    const input = [...$('shrinesBody').querySelectorAll('input[data-shrine-qty]')].find(i => i.dataset.shrineQty === b.dataset.shrineGive);
    const qty = Math.floor(+input?.value || 0);
    if(qty < 1) return error('Quantité invalide.');
    st.busy = true;
    act(async () => { const r = await h.shrineGive(id, item, qty); st.shrines = r.shrines; if(r.activated) error(''); return r; }, () => { st.busy = false; }).finally(() => { st.busy = false; render(); });
  };
  $('towerLevelRow').onclick = e => { const b = e.target.closest('button[data-level]'); if(b && !b.disabled){ st.towerLevel = +b.dataset.level; render(); } };
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
    if(p){ ask("Lui donner ta place de chef ? C'est lui qui lancera les sessions.", { ok:'Donner ma place' }).then(yes => { if(yes) act(() => h.party.promote(p.dataset.promote)); }); return; }
    const b = e.target.closest('[data-kick]'); if(!b) return;
    act(() => h.party.kick(b.dataset.kick));
  };
  $('invitesList').onclick = e => {
    const a = e.target.closest('[data-accept]'), d = e.target.closest('[data-decline]');
    if(a) act(() => h.party.join(a.dataset.accept), () => { st.invites = st.invites.filter(i => i.code !== a.dataset.accept); });
    if(d) act(() => h.party.decline(d.dataset.decline), () => { st.invites = st.invites.filter(i => i.code !== d.dataset.decline); });
  };
  $('partyLeaveBtn').onclick = async () => {
    if(await ask('Quitter le groupe ? Tu te retrouves seul dans ton lobby.', { ok:'Quitter' })) act(() => h.party.leave(), () => { st.inviteOpen = false; });
  };
  $('joinForm').onsubmit = e => {
    e.preventDefault();
    act(() => h.party.join($('joinCode').value), () => { $('joinCode').value = ''; });
  };

  /* panneau dev : réglages appliqués à la session lancée (le serveur les vérifie et les borne) */
  $('devStats').innerHTML = DEV_TUNABLES.map(([obj, key, label, min, max]) =>
    `<span>${esc(label)}</span><input type="number" step="any" min="${min}" max="${max}" data-obj="${obj}" data-key="${key}" data-base="${TARGETS[obj][key]}" value="${TARGETS[obj][key]}">`).join('');
  /* preset de chaque mineur de test (src/shared/dev-presets.js) : stuff, arbre et glyphes, sorts ; sans preset, stats de base.
     copies : vrais joueurs copiés (data/presets/, envoyés par le serveur dans info.copies) ; les choix faits sont gardés */
  let shownCopies = null;
  const drawPresets = (copies = []) => {
    if(JSON.stringify(copies) === shownCopies) return;
    const keep = [...$('devPresets').querySelectorAll('select')].map(s => s.value);
    shownCopies = JSON.stringify(copies);
    const opts = SKILLS.trees.map(t => `<option value="${t.id}">${t.icon} ${esc(presetName(t.id))}</option>`).join('')+
      copies.map(w => `<option value="${esc(copyPresetId(w))}">👤 ${esc(copyName(w))} (copie)</option>`).join('');
    /* un preset par mineur (31/10/2026) : le pseudo d'un vrai joueur, ou la liste. Un joueur garde son nom et son compte */
    $('devPresets').innerHTML = Array.from({ length: GAME.maxPlayers }, (_, i) => `<div class="devMiner"><b data-place-name="${i}"></b>
      <select data-place="${i}"><option value="">Aucun</option>${opts}</select>
      <span class="devPick"><input data-pick="${i}" type="text" maxlength="32" placeholder="Pseudo d'un joueur"><button data-take="${i}">Prendre</button></span></div>`).join('');
    $('devPresets').querySelectorAll('select').forEach((s, j) => { if(keep[j] && [...s.options].some(o => o.value === keep[j])) s.value = keep[j]; });
  };
  drawPresets();
  const places = () => [...$('devPresets').querySelectorAll('[data-place]')].map(s => s.value || null);
  const inGroup = () => (st.party?.members.length ?? 0) > 1;
  /* dans un groupe, le choix est gardé par le serveur : chaque membre le voit, le chef le lance */
  const shareChoice = async () => { if(inGroup()) st.party = (await h.party.devPresets(places())).party; };
  /* noms des places (comme au lancement : le chef, les membres, puis les mineurs de test) et choix du groupe */
  function drawPlaces(){
    const members = [...(st.party?.members ?? [])].sort((a, b) => b.leader - a.leader);
    const names = members.length ? members.map(m => m.name) : [st.account?.displayName ?? st.account?.name ?? 'Toi'];
    $('devPresets').querySelectorAll('[data-place-name]').forEach((el, i) => { el.textContent = names[i] ?? `Mineur test ${i - names.length + 1}`; });
    if(!inGroup()) return;
    $('devPresets').querySelectorAll('[data-place]').forEach((s, i) => {
      const v = st.party.devPresets?.[i] ?? '';
      if(document.activeElement !== s && [...s.options].some(o => o.value === v)) s.value = v;
    });
  }
  async function takePlayer(i){
    const msg = $('devCopyMsg'), input = $('devPresets').querySelector(`[data-pick="${i}"]`);
    msg.hidden = false; msg.textContent = 'Copie…';
    try {
      const r = await h.devCopy(input.value);
      if(st.info) st.info.copies = r.copies;
      drawPresets(r.copies);
      $('devPresets').querySelector(`[data-place="${i}"]`).value = copyPresetId(r.who);
      await shareChoice();
      drawPlaces();
      msg.textContent = `${r.name} copié.`;
    } catch(e){ msg.textContent = e.message; }
  }
  $('devPresets').addEventListener('click', e => { const b = e.target.closest('[data-take]'); if(b) takePlayer(+b.dataset.take); });
  $('devPresets').addEventListener('keydown', e => { const inp = e.target.closest('[data-pick]'); if(inp && e.key === 'Enter') takePlayer(+inp.dataset.pick); });
  $('devPresets').addEventListener('change', e => { if(e.target.matches('[data-place]')) shareChoice().catch(err => { $('devCopyMsg').hidden = false; $('devCopyMsg').textContent = err.message; }); });
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
      : !rows.length ? '<p class="mut small">Personne d\'autre (en ligne, ou venu depuis 24 h) n\'a cette tour à faire.</p>'
      : `<p class="small"><b>${rows.length}</b> joueur${rows.length > 1 ? 's' : ''} sans cette tour (${rows.filter(p => p.status !== 'offline').length} en ligne, les autres venus depuis 24 h) :</p>`+
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
    return { seed: Number.isSafeInteger(seed) ? seed : undefined, bots: +$('devBots').value, overrides, devSpecs: devSpecs(), presets: places() };
  }

  for(const b of $('prisonCompoRow').querySelectorAll('[data-compo]')) b.onclick = () => { st.prisonCompo = b.dataset.compo; render(); };
  $('prisonCompoSave').onclick = async () => {   // « Enregistrer » (30/10) : la compo affichée devient l'enregistrée
    if(st.busy || st.prisonCompo === 'saved') return;
    st.busy = true; render();
    try { setCompos(await h.prisonSaveCompo?.(st.prisonCompo)); st.prisonCompo = 'saved'; }
    catch(e){ console.error(e); } finally { st.busy = false; render(); }
  };
  $('launchBtn').onclick = async () => {
    if(st.busy) return;
    if(MINE_MODES.find(m => m.id === st.mode)?.prison){   // prison (29/10) : la voir, ou y entrer
      const ps = prisonLaunchState(st);
      if(!ps.can) return;
      if(ps.action === 'view') return h.onShowPrison?.();
      st.busy = true; render();
      try { await h.onPrisonStart?.({ compo: st.prisonCompo }); } finally { st.busy = false; st.prisonProfileAt = 0; render(); }
      return;
    }
    const ls = launchState(st);
    if(ls.action === 'ready'){                                               // membre : prêt / plus prêt
      const q = ls.ready ? readyPrisonText({ prison: st.prison }) : '';      // sa prison tourne : le lancement la terminera
      if(q && !await ask(q, { ok:'Je suis prêt' })) return;
      return act(() => h.party.ready(ls.ready));
    }
    st.busy = true; render();
    const md = MINE_MODES.find(m => m.id === st.mode), tw = !!md?.tower;
    try { await h.onLaunch({ mode: st.mode, ...((tw || md?.instance) && st.towerLevel ? { level: st.towerLevel } : {}), ...(tw && $('modulation').checked ? { modulation: true } : {}), ...(tw && st.info?.dev && $('devStele').checked ? { stele: Object.keys(SHRINES.list).find(id => SHRINES.list[id].tower === md.tower) } : {}), ...(tw && st.info?.dev && $('devHeroic').checked ? { heroic: true } : {}), ...(st.info?.dev ? devOptions() : {}) }, { party: st.party }); }
    finally { st.busy = false; render(); }
  };

  return {
    pubContext,
    update(patch){
      const { lfg, ...rest } = patch;
      Object.assign(st, rest);
      if('lfg' in patch) setLfg(lfg);
      if(st.info?.dev){ drawPresets(Array.isArray(st.info.copies) ? st.info.copies : []); drawPlaces(); }
      render();
    },
    /* rejoindre par un code venu d'un lien d'invitation */
    join(code){ return act(() => h.party.join(code)); },
    /* afficher les jauges du Jugement (ancien onglet, lien #jugement) */
    showJudgment,
    /* retour au menu en cliquant sur l'onglet Lobby */
    showMenu(){ st.screen = 'menu'; st.view = null; render(); scrollTo(0, 0); },
    /* choisir un type de mine (ex. la tour ouverte, depuis le Jugement) s'il est proposé et pas déjà fait */
    pickMode(mode){ if(mineModes(st.mode, !!st.session, st.judgment, !!st.info?.dev).some(m => m.id === mode && !m.disabled)) pick(mode); },
    /* recherche de groupe depuis le Carreau (30/10, Jules) : l'état comme si la mine classique était choisie (lfgState),
       le nombre de joueurs en recherche et le début de la sienne */
    lfgView: () => ({ ...lfgState({ ...st, mode: MINE_MODES[0].id }), players: st.lfg?.players ?? 0, start: st.lfgStart }),
    /* lancer ou annuler sa recherche ; lancée, le lobby passe sur la mine classique (celle que la recherche remplit).
       Renvoie le message d'erreur, '' si tout va bien. */
    async toggleLfg(){
      const classic = MINE_MODES[0].id;
      if(st.lfg?.search?.mine) await act(() => h.party.lfgCancel());
      else await act(() => h.party.lfg(st.lfgAuto), () => { if(st.mode !== classic) pick(classic); });
      return $('lobbyErr').hidden ? '' : $('lobbyErr').textContent;
    },
    error,
  };
}
