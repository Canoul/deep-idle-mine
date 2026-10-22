/* Point d'entrée navigateur : relie le serveur, le rendu et l'interface.

   Le SERVEUR fait foi et fait tourner LA partie : une seule copie, sur le serveur (server/game/live.js). Le navigateur
   ne calcule rien : il reçoit régulièrement la partie (src/shared/view.js) et l'affiche. Il envoie seulement les
   choix du joueur (lancer, quitter, focus ; en dev : vitesse et pause), que le serveur applique tout de suite.
   - onglets : le Lobby prépare et lance (lecture seule pendant une session) ; l'onglet Session montre la partie, puis
     le bilan (« Tu n'es pas en session » sinon). Au lancement, tout le groupe bascule sur l'onglet Session ;
   - jeu normal : la partie suit le temps réel à la vitesse du serveur (×2) ; page fermée, elle continue sur le serveur ;
   - à plusieurs : tout le monde voit la même partie, puisqu'il n'y en a qu'une ;
   - fin : le serveur termine la partie au dernier tick, partage le coffre et verse les parts ; le navigateur affiche
     le bilan ;
   - mine instantanée (session mode 'mi') : inscription dans le Lobby, rappels depuis tous les onglets
     (src/ui/instant-lobby.js) ; à l'heure, le serveur l'ouvre et le navigateur bascule sur Session, où elle a son
     propre affichage (src/render/instant.js, src/ui/instant-hud.js). */
import { applyRarityColors } from './ui/rarity.js';
import { GAME, PARTY, SESSION_LEN, INSTANT_MINE, STATS, SOCIAL, CAMERA, JUDGMENT, TOWER, MINE_MODES } from './config.js';
import { emptyView, applyView } from './shared/view.js';
import { applyInstantView } from './shared/instant-view.js';
import { createInstantRenderer, MI_TILE } from './render/instant.js';
import { setupInstantLobby } from './ui/instant-lobby.js';
import { updateInstantHUD, showInstantEnd } from './ui/instant-hud.js';
import { updateTowerHUD, showTowerEnd } from './ui/tower-hud.js';
import { createTowerRenderer } from './render/tower.js';
import { applyTowerView } from './shared/tower-view.js';
import { isTowerMode } from './shared/tower.js';
import { tickAt, resultChoice } from './shared/game.js';
import { joinCodeFromHash } from './shared/party.js';
import { createRenderer, TILE } from './render/canvas.js';
import { followedMiner } from './render/camera.js';
import { drawPortrait, lookOf } from './render/portrait.js';
import { setupOrbs } from './ui/orbs.js';
import { fitCanvas, fitMine, fitInstant, clearDock } from './ui/fit.js';
import { pxi } from './ui/pxicons.js';
import { updateHUD, showEnd, showSettling, updateNavSession, fmt } from './ui/hud.js';
import { setupRunControls, setupCamera, renderSpeeds } from './ui/controls.js';
import { setupLobby } from './ui/lobby.js';
import { renderLevel, levelUpText } from './ui/level.js';
import { setupFocusPanel } from './ui/focus.js';
import { setupChat } from './ui/chat.js';
import { renderInventory as drawInventory, showLoot, lootError } from './ui/inventory.js';
import { setupNav } from './ui/nav.js';
import { setupFurnace } from './ui/furnace.js';
import { setupCrusher } from './ui/crusher.js';
import { setupResearch } from './ui/research.js';
import { setupSkills } from './ui/skills.js';
import { setupHistory } from './ui/history.js';
import { setupCraft } from './ui/craft.js';
import { setupStuff } from './ui/stuff.js';
import { setupUpgrade } from './ui/upgrade.js';
import { setupTooltips } from './ui/tooltip.js';
import { setupSocial } from './ui/social.js';
import { setupJudgment } from './ui/judgment.js';
import { setupNotify } from './ui/notify.js';
import { createAccountUI, bootAccount, renderNavAccount } from './ui/account.js';
import { gameApi, partyApi, instantApi, socialApi, ApiError } from './net/api.js';

const $ = id => document.getElementById(id);
const ui = { speed:1, paused:false, follow:null, inv:{ slots:[] }, fresh:new Set(), tab:'lobby' };
const acct = { account:null, offline:false };          // compte connecté (offline : pas de serveur de jeu)
let info = { dev:false, speed:GAME.speed, speeds:[GAME.speed], maxPlayers:GAME.maxPlayers };
let rec = null;            // session en cours (enregistrement du serveur)
let G = null;              // copie d'affichage de la partie du serveur (src/shared/view.js)
let clockOffset = 0;       // heure du serveur − heure locale (ms)
let waiting = false;       // partie finie, résultat du serveur attendu
let waitingFor = null;     // … celui de cette session (id)
let pendingJoin = joinCodeFromHash(location.hash);   // lien d'invitation (#rejoindre=CODE), lu avant que la barre change l'adresse
const serverNow = () => Date.now() + clockOffset;
const renderer = createRenderer($('cv'));
const miRenderer = createInstantRenderer($('cvMi'));
const isMi = () => rec?.mode === 'mi';
const twRenderer = createTowerRenderer($('cvTw'));
const isTw = () => isTowerMode(rec?.mode);   // tour de l'Ange ou du Démon : même principe d'affichage que la MI

/* ancienne sauvegarde d'inventaire dans le navigateur : l'inventaire est maintenant sur le serveur */
try { for(const k of Object.keys(localStorage)) if(k.startsWith('deepIdleMine.inventory') || k === 'deepIdleMine.global') localStorage.removeItem(k); } catch {}

/* ---------- inventaire ---------- */
const renderInventory = (inv, fresh) => drawInventory(inv, fresh, { onOpen:openTreasure, onLearn:useBlueprint, onEquip:equipFromInventory, onUnlock:unlockFurnace, worn:() => stuff.worn(), furnaces:() => furnace.state() });

/* identifiant de demande (getRandomValues : randomUUID n'existe pas hors HTTPS / localhost) */
const newOpId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');

/* ouvrir un treasure : le serveur tire le butin et renvoie l'inventaire à jour */
async function openTreasure(item){
  try {
    const r = await gameApi.open(item, newOpId());
    ui.fresh.clear();
    setInventory(r.inventory, r.loot);
    showLoot(item, r.loot);
  } catch(e){ lootError(e.message); }
}

/* utiliser un blueprint : le serveur le consomme et débloque sa recette (onglet Craft) */
async function useBlueprint(item){
  try {
    const r = await gameApi.learn(item, newOpId());
    setInventory(r.inventory);
    $('invInfo').innerHTML = `<span class="okmsg">✔ Recette débloquée : ${r.recipe.replace(/[&<>]/g, '')}. Elle est dans l'onglet Craft.</span>`;
  } catch(e){ lootError(e.message); }
}

/* utiliser un objet de four (Four en fer) : le serveur le consomme et ouvre le four suivant (onglet Four) */
async function unlockFurnace(item){
  try {
    const r = await gameApi.furnace({ action:'unlock', item, opId: newOpId() });
    furnace.set(r.furnaces); setInventory(r.inventory);
    $('invInfo').innerHTML = `<span class="okmsg">✔ Four ${r.furnaces.list.length} débloqué : il t'attend dans l'onglet Four.</span>`;
  } catch(e){ lootError(e.message); }
}

/* équiper depuis l'inventaire : même demande que l'onglet Stuff (l'ancienne pièce de la case revient dans l'inventaire) */
async function equipFromInventory(slot, uid){
  try {
    const item = ui.inv.slots.find(s => s?.uid === uid)?.item ?? 'La pièce';
    const r = await gameApi.stuff({ action:'equip', slot, uid, opId: newOpId() });
    setInventory(r.inventory); stuff.set(r.stuff);
    $('invInfo').innerHTML = `<span class="okmsg">✔ ${item.replace(/[&<>]/g, '')} équipé.</span>`;
  } catch(e){ lootError(e.message); }
}

/* ---------- four : chaque action est faite par le serveur, qui renvoie fours et inventaire ---------- */
/* amélioration : le serveur tire le hasard (identification, réussite) et renvoie la pièce et l'inventaire à jour */
const upgradeUI = setupUpgrade({
  onOp: async op => { const r = await gameApi.upgrade({ ...op, opId: newOpId() }); setInventory(r.inventory); return r; },
});

/* craft et stuff : même principe, le serveur fait l'action et renvoie l'inventaire (et le stuff) à jour */
const craft = setupCraft({
  onCraft: async item => { setInventory((await gameApi.craft(item, newOpId())).inventory); },
});
const stuff = setupStuff({
  onOp: async op => { const r = await gameApi.stuff({ ...op, opId: newOpId() }); setInventory(r.inventory); stuff.set(r.stuff); },
});

const furnace = setupFurnace({
  onOp: async op => {
    const r = await gameApi.furnace({ ...op, opId: newOpId() });
    setInventory(r.inventory);
    furnace.set(r.furnaces);
    return r;
  },
});

/* concasseur : le serveur concasse et tire le butin ; l'onglet redemande l'état à la fin de chaque cycle */
const crusher = setupCrusher({
  onOp: async op => { const r = await gameApi.crusher({ ...op, opId: newOpId() }); setInventory(r.inventory); crusher.set(r.crusher); },
  onSync: async () => { const r = await gameApi.crusherState(); setInventory(r.inventory); crusher.set(r.crusher); },
});

/* table de recherche : le serveur tire le blueprint (ou les parts) et renvoie l'inventaire */
const research = setupResearch({
  onOp: async op => { const r = await gameApi.research({ ...op, opId: newOpId() }); setInventory(r.inventory); return r; },
});

/* skills : le serveur vérifie et enregistre ; reset refusé pendant une session */
const skills = setupSkills({
  onOp: op => gameApi.skills({ ...op, opId: newOpId() }),
  inSession: () => !!G && !G.over,
  onChange: s => { stuff.setSkills(s); lobby.update({ myTree: s?.tree ?? null }); },   // Stuff : bonus des skills ; lobby : sa spécialisation
});

applyRarityColors();   // couleurs des raretés (config)
setupTooltips();   // bulles d'info (effets du stuff) : survol, ou toucher sur mobile

/* ---------- navigation ---------- */
const historyTab = setupHistory({ load: () => gameApi.history() });
let nav;   // l'onglet de départ est ouvert pendant setupNav, avant que nav soit assigné
let wantJudgment = /^#jugement$/i.test(location.hash);   // ancien onglet Jugement : ouvre le Lobby sur les jauges
nav = setupNav($('nav'), $('views'), id => {
  if(ui.tab==='inventaire' && id!=='inventaire') ui.fresh.clear();   // les nouveautés ont été vues
  ui.tab = id;
  if(id==='inventaire'){ renderInventory(ui.inv, ui.fresh); nav?.badge('inventaire', false); }
  if(id==='skills') skills?.refresh();   // le bouton reset suit la session en cours
  if(id==='historique') historyTab?.refresh();
  if(id==='lobby' && wantJudgment){ wantJudgment = false; setTimeout(() => lobby.showJudgment()); }   // différé : le lobby n'est pas encore créé au tout début
});

/* orbes de la barre d'action : temps de session et XP ; pendant une session, oxygène et pods du mineur suivi */
const orbs = setupOrbs($('orbL'), $('orbR'));
function updateOrbs(shown, mi, len = mi ? INSTANT_MINE.duration : SESSION_LEN){
  const m = shown && !mi && !shown.over ? followedMiner(shown.miners, ui.follow) : null;
  if(m){
    const oxMax = m.carac?.oxygenMax ?? STATS.oxygenMax, pods = m.carac?.pods ?? STATS.pods;
    orbs.set(0, m.ox / oxMax * 100, 'o2', `${Math.round(m.ox)}/${oxMax}`, 'Oxygène');
    orbs.set(1, m.load / pods * 100, m.load >= pods * 0.9 ? 'full' : 'pods', `${Math.round(m.load)}/${pods}`, 'Pods');
    return;
  }
  orbs.set(0, shown ? shown.t / len * 100 : 0, shown ? 'time' : 'off', shown ? fmt(shown.t) : '—', 'Session');
  const p = progress, pct = p?.need ? p.into / p.need * 100 : 100;
  orbs.set(1, p ? pct : 0, p ? 'xp' : 'off', p ? `Niv. ${p.level}` : '—', p?.need ? `${Math.floor(pct)} % XP` : 'XP');
}

/* ---------- compte ---------- */
const accountUI = createAccountUI($('account'), acct, {
  onChange: () => { renderNavAccount($('navAccount'), acct); lobby.update({ account:acct.account }); startInstant(); pollSocial(); pollJudgment(); },
  confirmLeave: () => confirm([
    acct.account?.guest && 'Compte invité : sans pseudo ni mot de passe, tu ne pourras plus jamais y revenir.',
    G && !G.over && 'Ta session continue sur le serveur : tu la retrouveras en te reconnectant.',
    'Se déconnecter quand même ?'].filter(Boolean).join('\n')),
});

/* ---------- lobby ---------- */
const lobby = setupLobby({
  party: partyApi,
  look: () => lookOf(stuff.worn()),
  onPrefs: prefs => gameApi.prefs(prefs).catch(e => lobby.error(e.message)),
  onShowSession: () => nav.show('session'),
  onMode: mode => { if(mode === 'mi') instantLobby.refresh(); },
  onJudgment: () => pollJudgment(),
  onLaunch: async opts => {
    lobby.error('');
    try { enterSession((await gameApi.start(opts)).session); nav.show('session'); instantLobby.refresh(); }   // lancer désinscrit du MI
    catch(e){
      if(e instanceof ApiError && e.code === 'session_running') return refresh();
      lobby.error(e.message);
    }
  },
});

/* mine instantanée : carte d'inscription du lobby et rappels, aussi pendant une session normale (on peut s'inscrire en
   session dans les 30 dernières minutes, 22/10) ; pas pendant la mine instantanée elle-même. Inscrit, le lobby s'ouvre
   sur « Mine instantanée » */
let miModeShown = false;
const instantLobby = setupInstantLobby({
  api: instantApi,
  canNotify: () => !isMi(),
  inSession: () => !!rec && !isMi(),
  onJoined: () => { lobby.update({ mode:'mi' }); nav.show('lobby'); },
  onState: st => { if(st.registered && !miModeShown){ miModeShown = true; lobby.update({ mode:'mi' }); } },
  onOpened: () => pollLobby(),                       // mode dev : la session est là, le lobby la voit et bascule
});
function startInstant(){ if(acct.account && !acct.offline) instantLobby.start(); else instantLobby.stop(); }
window.MI = instantLobby;                            // pour le débogage depuis la console (F12) : MI._notice(30)

/* plus de session : l'onglet Session affiche « Tu n'es pas en session », le lobby redevient utilisable */
function showNoSession(){
  rec = null; G = null; waiting = false; clearTimeout(viewTimer); chat.stop();
  $('run').hidden = true; $('miRun').hidden = true; $('twRun').hidden = true; $('noSession').hidden = false;
  lobby.update({ account:acct.account, offline:acct.offline, info, session:null });
  pollLobby();
}
$('toLobbyBtn').onclick = () => nav.show('lobby');
$('miLeaveBtn').onclick = () => leave();
$('twLeaveBtn').onclick = () => leave();
const navSession = document.querySelector('.navSession');
navSession.onclick = () => { if(rec) nav.show('session'); };

/* lobby : groupe, invitations ; le chef a lancé → tout le groupe passe à l'onglet Session. Continue pendant la session
   (plus lentement) pour que le lobby, en lecture seule, montre le groupe ; sert aussi de signe de vie au groupe,
   y compris pendant le bilan (le groupe reste après une session : le chef peut relancer pendant qu'on le lit). */
let lobbyTimer = null, endAck = null;
async function pollLobby(){
  clearTimeout(lobbyTimer);
  if(acct.offline || !acct.account || waiting) return;
  try {
    if(pendingJoin && !rec){ const code = pendingJoin; pendingJoin = null; nav.show('lobby'); await lobby.join(code); }
    const st = await partyApi.state();
    if(st.session && st.session !== rec?.id){          // lancée par le chef (ou relancée pendant le bilan : il est lu)
      endAck?.(); await refresh(); return nav.show('session');
    }
    lobby.update({ party:st.party, invites:st.invites, lfg:st.lfg });
    setLfgFound(st.lfg?.found);
  } catch(e){ console.warn(e); }
  lobbyTimer = setTimeout(pollLobby, rec ? PARTY.pollInSession : PARTY.poll);
}
/* ---------- amis (onglet Social) et pop-ups ----------
   La liste d'amis est redemandée régulièrement dans tous les onglets, même caché ou en session : c'est aussi le signe
   de vie qui fait apparaître le joueur « en ligne » chez ses amis. Elle apporte les demandes d'ami et les invitations de
   groupe, affichées en pop-up en haut à gauche. */
const notify = setupNotify($('notifs'));
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let socialTimer = null, lastSocial = null, lfgFound = null;
/* recherche de groupe : « groupe trouvé » en pop-up (l'état vient du lobby) */
function setLfgFound(found){
  if((found?.at ?? null) === (lfgFound?.at ?? null)) return;
  lfgFound = found ?? null;
  syncNotifs();
}
function setSocial(st){
  if(!st?.friends) return st;
  social.set(st);
  nav.badge('social', st.incoming.length > 0);
  lastSocial = st;
  syncNotifs();
  return st;
}
function syncNotifs(){
  const st = lastSocial ?? { partyInvites: [], incoming: [] };
  notify.sync([
    ...(lfgFound && !lfgFound.error && !G ? [{ key: 'lfg:' + lfgFound.at, icon: pxi('group'),
      text: `Groupe trouvé : <b>${esc(lfgFound.names.join(', '))}</b>`,
      actions: [{ label: 'Voir le lobby', primary: true, run: async () => nav.show('lobby') }] }] : []),
    ...st.partyInvites.map(i => ({ key: 'p:' + i.code, icon: pxi('group'), text: `<b>${esc(i.from)}</b> vous a invité dans son lobby${i.full ? ' <span class="mut">(complet)</span>' : ''}`,
      actions: [{ label: 'Rejoindre', primary: true, run: () => joinParty(() => partyApi.join(i.code)) },
                { label: 'Décliner', run: async () => { await partyApi.decline(i.code); pollSocial(); } }] })),
    ...st.incoming.map(r => ({ key: 'f:' + r.id, icon: pxi('person'), text: `<b>${esc(r.name)}</b> vous a envoyé une demande d'ami`,
      actions: [{ label: 'Accepter', primary: true, run: async () => setSocial(await socialApi.accept(r.id)) },
                { label: 'Refuser', run: async () => setSocial(await socialApi.refuse(r.id)) }] })),
  ]);
}
async function pollSocial(){
  clearTimeout(socialTimer);
  if(acct.offline || !acct.account){ lastSocial = null; lfgFound = null; notify.sync([]); return; }
  try { setSocial(await socialApi.state()); } catch(e){ console.warn(e); }
  socialTimer = setTimeout(pollSocial, document.hidden ? SOCIAL.hiddenPoll : SOCIAL.poll);
}
/* entrer dans un groupe (invitation acceptée, ami rejoint) : on va à l'onglet Lobby */
async function joinParty(fn){
  if(G) throw new Error('Tu es dans une session : termine-la ou quitte-la d\'abord.');
  const r = await fn();
  lobby.update({ party: r.party });
  nav.show('lobby'); pollLobby(); pollSocial();
  return r;
}
const social = setupSocial({
  request: async name => setSocial(await socialApi.request(name)),
  accept:  async id => setSocial(await socialApi.accept(id)),
  refuse:  async id => setSocial(await socialApi.refuse(id)),
  remove:  async id => setSocial(await socialApi.remove(id)),
  invite:  async id => { setSocial(await socialApi.invite(id)); pollLobby(); },
  join:    id => joinParty(() => socialApi.join(id)),
  profile: id => socialApi.profile(id),
});

/* ---------- Jugement (dans le Lobby, « Où miner ») : jauges Ange / Démon (communes à tous) ----------
   Redemandées toutes les JUDGMENT.poll ms tant que la page est visible ; le badge signale une tour ouverte pas encore faite. */
const judgment = setupJudgment($('judgmentBody'), { onTower: side => lobby.pickMode(MINE_MODES.find(m => m.tower === side)?.id) });
let judgmentTimer = null;
async function pollJudgment(){
  clearTimeout(judgmentTimer);
  if(acct.offline || !acct.account) return;
  try { judgment.set(await gameApi.judgment()); nav.badge('lobby', judgment.pending()); lobby.update({ judgment: judgment.view(), judgmentPending: judgment.pending() }); }
  catch(e){ console.warn(e); }
  judgmentTimer = setTimeout(pollJudgment, document.hidden ? JUDGMENT.poll * 4 : JUDGMENT.poll);
}

/* lien d'invitation ouvert alors que la page l'est déjà (la barre a déjà remplacé l'adresse : on lit newURL) */
addEventListener('hashchange', e => {
  const code = joinCodeFromHash(e.newURL);
  if(!code) return;
  if(rec){ alert('Tu es dans une session : termine-la ou quitte-la pour rejoindre ce groupe.'); return; }
  pendingJoin = code; pollLobby();
});

/* ---------- session ---------- */
setupRunControls(ui, { onLeave: leave, onClock: setClock, onFollow: id => { ui.follow = id; renderer.follow(); } });
setupCamera($('cv'), renderer, () => !!G?.ready && ui.tab === 'session');

/* focus : le serveur l'applique tout de suite dans la partie (et l'enregistre avec son tick) */
const focusPanel = setupFocusPanel({
  onChange: async focus => {
    try { return (await gameApi.focus(focus)).event; }
    catch(e){ alert(e.message); throw e; }
  },
});

/* chat des joueurs de la session (mine classique) : le serveur vérifie qui écrit, le texte et la cadence */
const chat = setupChat({ get: after => gameApi.chat(after), post: text => gameApi.say(text), meId: () => acct.account?.id });

/* dev : vitesse et pause sont l'horloge de la session, sur le serveur */
async function setClock(opts){
  try { applyClock((await gameApi.clock(opts)).session.clock); } catch(e){ alert(e.message); }
}
function applyClock(c){
  if(!c || !info.dev) return;
  if(c.speed === ui.speed && c.paused === ui.paused) return;
  ui.speed = c.speed; ui.paused = c.paused;
  renderSpeeds(ui, info, s => setClock({ speed:s }));
}

function enterSession(session){
  rec = session; waiting = false;
  clockOffset = session.now - Date.now();
  const mi = session.mode === 'mi', tw = isTowerMode(session.mode);
  G = mi ? { mode:'mi', ready:false, miners:[] } : tw ? { mode:'tower', ready:false, miners:[] } : emptyView();   // MI et tour : remplacées en entier à chaque envoi
  window.G = G;                             // pour le débogage depuis la console (F12)
  /* la caméra suit son propre mineur ; les mineurs portent le nom de leur joueur */
  ui.names = Object.fromEntries(session.players.map(p => [p.account, p.name]));
  ui.follow = null; ui.followSet = false; renderer.follow();
  ui.speed = info.dev ? session.clock?.speed ?? 1 : session.speed; ui.paused = !!session.clock?.paused;
  renderSpeeds(ui, info, s => setClock({ speed:s }));
  $('seedLbl').textContent = info.dev ? `seed ${session.seed}` : '';
  $('end').hidden = true; $('noSession').hidden = true; $('run').hidden = mi || tw; $('miRun').hidden = !mi; $('twRun').hidden = !tw;
  if(mi || tw) chat.stop(); else chat.start();
  lobby.update({ session:{ id:session.id } });   // lobby en lecture seule
  pollView();
  pollLobby();                                   // le lobby continue de montrer le groupe
}

/* reçoit la partie du serveur : la première fois en entier, ensuite seulement ce qui a changé */
const VIEW_EVERY = 250, VIEW_HIDDEN = 1500;   // ms (onglet caché : moins souvent)
let viewTimer = null, lastView = 0;
async function pollView(){
  clearTimeout(viewTimer);
  if(!G || !rec || waiting) return;
  const id = rec.id;
  try {
    const r = await gameApi.view(G.ready ? G.ticks : null);
    if(!G || rec?.id !== id || waiting) return;
    clockOffset = r.now - Date.now();
    applyClock(r.clock);
    if(r.view?.mode === 'mi'){ G = applyInstantView(r.view); G.ready = true; window.G = G; lastView = performance.now(); }
    else if(r.view?.mode === 'tower'){ G = applyTowerView(r.view); G.ready = true; window.G = G; lastView = performance.now(); }
    else if(r.view){
      applyView(G, r.view); lastView = performance.now();
      if(!ui.followSet && G.miners.length){                  // une fois : suivre son propre mineur
        ui.follow = (G.miners.find(m => m.account === acct.account?.id) ?? G.miners[0]).id; ui.followSet = true;
      }
    }
    if(!r.view || G.over) return ended();
  } catch(e){
    if(e instanceof ApiError && e.code === 'no_session') return refresh();   // quittée (autre onglet) ou déjà finie
    console.warn(e);
  }
  viewTimer = setTimeout(pollView, document.hidden ? VIEW_HIDDEN : VIEW_EVERY);
}
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'visible' && G && !waiting) pollView();
  if(document.visibilityState === 'visible' && !G) pollLobby();
  if(document.visibilityState === 'visible') pollSocial();
});

/* entre deux envois, les actions en cours avancent à l'écran (affichage seulement : le prochain envoi fait foi) */
function smooth(dtr){
  if(!G?.ready || G.over) return;
  const rate = info.dev ? (ui.paused ? 0 : ui.speed) : rec.speed;
  if(performance.now() - lastView > 3000) return;              // plus de nouvelles : on n'invente rien
  for(const m of G.miners){ const a = m.action; if(a) a.t = Math.min(a.dur, a.t + dtr * rate); }
}

async function leave(){
  if(!G || G.over) return;
  if(!confirm(isTw() ? 'Quitter la tour ?\nTu ne recevras pas de trésor.' : isMi() ? 'Quitter la mine instantanée ?\nTu ne recevras rien de ce que tu as miné.'
                     : 'Quitter la session ?\nTu ne recevras rien de cette session : le coffre ira aux joueurs restants.')) return;
  try { await gameApi.leave(); }
  catch(e){ if(!(e instanceof ApiError) || e.code !== 'no_session'){ alert(e.message); return; } }
  showNoSession(); nav.show('lobby');
}

/* la partie du serveur est finie : on attend son résultat (partage et versement, quelques instants) */
function ended(){
  waiting = true; waitingFor = rec?.id ?? null; clearTimeout(viewTimer);
  showSettling(isMi());
  pollResult();
}

async function pollResult(){
  if(!waiting) return;
  try {
    const st = await gameApi.state();
    const what = resultChoice(st.ended, waitingFor);
    if(what === 'show') return showResult(st);
    if(what === 'stale') gameApi.ack(st.ended.id).catch(() => {});   // ancien bilan jamais vu : pas celui de cette session
    if(!st.session){ return showNoSession(); }                // plus rien à attendre (abandonnée)
  } catch(e){ console.warn(e); }
  setTimeout(pollResult, 1000);
}

/* résultat du serveur : bilan + inventaire relu depuis le serveur */
function showResult(st){
  const ended = st.ended;
  setInventory(st.inventory, ended.result.shares.find(p => p.account === acct.account?.id)?.bag);
  rec = null; G = null; waiting = false; chat.stop();
  lobby.update({ session:null });            // on peut relancer depuis le lobby pendant qu'on lit le bilan
  const up = setProgress(st.progress);       // XP versée par le serveur : nouveau niveau ?
  skills.set(st.skills);                     // … et donc peut-être de nouveaux points de skill
  const done = endAck = () => { endAck = null; gameApi.ack(ended.id).catch(() => {}); };
  const back = () => { done(); $('end').hidden = true; showNoSession(); nav.show('lobby'); };
  const toInv = () => { done(); $('end').hidden = true; showNoSession(); nav.show('inventaire'); };
  if(ended.mode === 'mi') showInstantEnd(ended, acct.account?.id, back, toInv);
  else if(isTowerMode(ended.mode)) showTowerEnd(ended, acct.account?.id, back, toInv);
  else showEnd(ended, acct.account?.id, back, toInv, up);
  pollLobby();                               // signe de vie au groupe pendant le bilan
}

/* inventaire envoyé par le serveur ; bag : objets qui viennent d'arriver (mis en évidence) */
function setInventory(inv, bag){
  ui.inv = { slots: inv?.slots ?? [], unlocked: inv?.unlocked ?? [] };
  furnace.setInventory(ui.inv); crusher.setInventory(ui.inv); craft.setInventory(ui.inv); stuff.setInventory(ui.inv); research.setInventory(ui.inv); upgradeUI.setInventory(ui.inv);
  if(bag) ui.inv.slots.forEach((s, i) => { if(s && bag[s.item]) ui.fresh.add(i); });
  if(ui.tab==='inventaire') renderInventory(ui.inv, ui.fresh);
  else if(ui.fresh.size) nav.badge('inventaire', true);
}

/* état complet depuis le serveur : inventaire, préférences, session en cours, résultat pas encore vu */
/* niveau du mineur : relu au serveur avec l'état ; montée de niveau annoncée au bilan */
let progress = null;
function setProgress(p){
  const up = levelUpText(progress, p); progress = p ?? null;
  renderLevel($('levelBody'), progress); renderLevel($('stuffLevelBody'), progress);   // lobby et onglet Stuff
  return up;
}

async function refresh(){
  const st = await gameApi.state();
  setInventory(st.inventory);
  if(!st.ended || st.session) setProgress(st.progress);
  furnace.set(st.furnaces);
  crusher.set(st.crusher);
  stuff.set(st.stuff);
  skills.set(st.skills);
  lobby.update({ prefs: st.prefs });
  if(st.session) enterSession(st.session);
  else showNoSession();
  if(st.ended && !st.session) showResult(st);
}

/* ---------- démarrage ---------- */
Object.assign(acct, await bootAccount(accountUI));
renderNavAccount($('navAccount'), acct);
$('navAccount').onclick = () => accountUI.openProfile();
if(acct.offline) showNoSession();
else {
  try { info = await gameApi.info(); await refresh(); }
  catch(e){ acct.offline = true; showNoSession(); }
}
startInstant();
pollSocial();
pollJudgment();
if(globalThis.DIM_BOOT) DIM_BOOT.started = true;   // démarrage réussi : src/boot-check.js n'affiche plus rien

/* ---------- boucle d'affichage (la partie, elle, tourne sur le serveur) ---------- */
let last = performance.now(), lastHud = 0;
function frame(now){
  const dtr = Math.min(0.25, (now - last) / 1000); last = now;
  smooth(dtr);
  const shown = G?.ready ? G : null, mi = shown?.mode === 'mi', tw = shown?.mode === 'tower';
  if(shown && ui.tab==='session') tw ? twRenderer.draw(shown, acct.account?.id) : mi ? miRenderer.draw(shown, acct.account?.id) : renderer.draw(shown, ui.follow);
  if(now - lastHud > 120){
    if(tw && ui.tab==='session') updateTowerHUD(shown, acct.account?.id, rec.finishAt ? Math.max(0, (rec.finishAt - serverNow()) / 1000) : null);
    else if(mi && ui.tab==='session') updateInstantHUD(shown, acct.account?.id, Math.max(0, (rec.finishAt - serverNow()) / 1000));
    else if(shown && ui.tab==='session'){
      updateHUD(shown, ui);
      focusPanel.update(shown, acct.account?.id);
      $('followBtn').hidden = !renderer.free;               // caméra déplacée par le joueur : bouton pour revenir
      const late = !info.dev && rec && G.ticks + 50 < tickAt(serverNow() - rec.startedAt, rec.speed);
      $('realLeft').textContent = late ? 'connexion…' : info.dev ? '' : `fin dans ${fmt(Math.max(0, (rec.finishAt - serverNow()) / 1000))}`;
    }
    updateNavSession(shown, waiting, tw ? TOWER.duration : mi ? INSTANT_MINE.duration : SESSION_LEN);
    updateOrbs(shown, mi || tw, tw ? TOWER.duration : undefined);
    if(ui.tab==='session'){
      tw ? fitCanvas($('cvTw'), $('cvTwWrap')) : mi ? fitInstant($('cvMi'), $('cvMiWrap'), miRenderer, MI_TILE) : fitMine($('cv'), $('cvWrap'), renderer, CAMERA, TILE);   // la mine remplit la place libre
      document.querySelectorAll('.runL, .runR, .runGrid.mi > aside').forEach(c => clearDock(c, $('nav')));   // colonnes jusqu'en bas si possible
    }
    const face = $('navAccount').querySelector('canvas');
    if(face) drawPortrait(face, lookOf(stuff.worn()));                  // portrait : le mineur avec son stuff
    navSession.classList.toggle('live', !!rec);
    if(rec && ui.tab==='lobby')                                // bandeau du lobby : temps restant
      $('lobbySessLeft').textContent = waiting ? '· résultat…' : !shown ? '' : info.dev ? `· ${fmt(shown.t)} de jeu`
        : `· fin dans ${fmt(Math.max(0, (rec.finishAt - serverNow()) / 1000))}`;
    lastHud = now;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
