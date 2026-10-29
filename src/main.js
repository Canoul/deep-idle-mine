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
import { GAME, PARTY, SESSION_LEN, INSTANT_MINE, STATS, SOCIAL, CAMERA, JUDGMENT, TOWER, MINE_MODES, INSTANCE, GUIDE } from './config.js';
import { emptyView, applyView } from './shared/view.js';
import { applyInstantView } from './shared/instant-view.js';
import { createInstantRenderer, MI_TILE } from './render/instant.js';
import { setupInstantLobby } from './ui/instant-lobby.js';
import { setupGiant } from './ui/giant.js';
import { updateInstantHUD, showInstantEnd } from './ui/instant-hud.js';
import { updateTowerHUD, showTowerEnd } from './ui/tower-hud.js';
import { updateInstanceHUD, showInstanceEnd } from './ui/instance-hud.js';
import { createInstanceRenderer } from './render/instance.js';
import { applyInstanceView } from './shared/instances-view.js';
import { isInstanceMode } from './shared/instances.js';
import { createTowerRenderer } from './render/tower.js';
import { applyTowerView } from './shared/tower-view.js';
import { createPerf, perfText } from './ui/perf.js';
import { isTowerMode } from './shared/tower.js';
import { tickAt, resultChoice } from './shared/game.js';
import { joinCodeFromHash } from './shared/party.js';
import { createRenderer, TILE } from './render/canvas.js';
import { followedMiner } from './render/camera.js';
import { drawPortrait, lookOf } from './render/portrait.js';
import { aurasOf } from './meta/aura.js';
import { setupOrbs } from './ui/orbs.js';
import { fitCanvas, fitMine, fitInstant, clearDock } from './ui/fit.js';
import { pxi } from './ui/pxicons.js';
import { updateHUD, showEnd, showSettling, updateNavSession, fmt, showSpellBar, placeSpellBar } from './ui/hud.js';
import { setupRunControls, setupCamera, renderSpeeds } from './ui/controls.js';
import { setupLobby } from './ui/lobby.js';
import { gearScore } from './meta/gearscore.js';
import { renderLevel, levelUpText } from './ui/level.js';
import { setupFocusPanel } from './ui/focus.js';
import { setupChat } from './ui/chat.js';
import { renderInventory as drawInventory, showLoot, lootError } from './ui/inventory.js';
import { setupNav } from './ui/nav.js';
import { setupFurnace } from './ui/furnace.js';
import { setupCrusher } from './ui/crusher.js';
import { setupResearch } from './ui/research.js';
import { setupSkills } from './ui/skills.js';
import { setupSpells } from './ui/spells.js';
import { setupSets } from './ui/sets.js';
import { setupHistory } from './ui/history.js';
import { setupCraft } from './ui/craft.js';
import { setupStuff } from './ui/stuff.js';
import { setupUpgrade } from './ui/upgrade.js';
import { createBackdrop, enterPanels, leavePanels } from './ui/backdrop.js';
import { setupTooltips } from './ui/tooltip.js';
import { createEffectsBar, placeEffectsBar } from './ui/effects.js';
import { fillHelp } from './ui/help.js';
import { setupGuide } from './ui/guide.js';
import { setupSocial } from './ui/social.js';
import { setupJudgment } from './ui/judgment.js';
import { setupNotify } from './ui/notify.js';
import { setupObtained } from './ui/obtained.js';
import { recipeOf } from './meta/craft.js';
import { createAccountUI, bootAccount, renderNavAccount } from './ui/account.js';
import { gameApi, partyApi, instantApi, socialApi, giantApi, ApiError } from './net/api.js';
import { ask, tell } from './ui/dialog.js';

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
const inRenderer = createInstanceRenderer($('cvIn'));
const SESSION_CV = { mine:'cv', mi:'cvMi', tower:'cvTw', instance:'cvIn' };
const backdrop = createBackdrop($('bgSession'), { sessionCanvas: mode => $(SESSION_CV[mode]) });   // fond : la session en cours, hors onglet Session
const isIn = () => isInstanceMode(rec?.mode);   // instance (27/10) : même principe d'affichage que les tours
const isTw = () => isTowerMode(rec?.mode);   // tour de l'Ange ou du Démon : même principe d'affichage que la MI

/* ancienne sauvegarde d'inventaire dans le navigateur : l'inventaire est maintenant sur le serveur */
try { for(const k of Object.keys(localStorage)) if(k.startsWith('deepIdleMine.inventory') || k === 'deepIdleMine.global') localStorage.removeItem(k); } catch {}

/* ---------- inventaire ---------- */
const renderInventory = (inv, fresh) => drawInventory(inv, fresh, { onOpen:openTreasure, onLearn:useBlueprint, onEquip:equipFromInventory, onUnlock:unlockFurnace, onSort:() => arrangeInventory({ action:'sort' }), onMove:op => arrangeInventory({ action:'move', ...op }), onRecycle:recyclePiece, setsOf:uid => setsUI.setsOf(uid), worn:() => stuff.worn(), furnaces:() => furnace.state() });

/* identifiant de demande (getRandomValues : randomUUID n'existe pas hors HTTPS / localhost) */
const newOpId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');

/* ouvrir un treasure : le serveur tire le butin et renvoie l'inventaire à jour */
async function openTreasure(item, all = false){   // all : « Ouvrir tout », le butin de tous les exemplaires additionné
  try {
    const r = await gameApi.open(item, newOpId(), all);
    ui.fresh.clear();
    setInventory(r.inventory, r.loot);
    showLoot(item, r.loot, undefined, r.count ?? 1);
  } catch(e){ lootError(e.message); }
}

/* ranger l'inventaire (trier, glisser un objet) : le serveur range et renvoie l'inventaire ; s'il refuse (l'objet n'était
   plus à sa place), on recharge l'inventaire du serveur */
async function arrangeInventory(op){
  ui.fresh.clear();                // les slots changent de place : plus rien à mettre en évidence
  try { setInventory((await gameApi.inventory(op)).inventory); }
  catch(e){ try { setInventory((await gameApi.state()).inventory); } catch(_){} lootError(e.message); }
}

/* recycler une pièce (confirmée dans la fenêtre de l'inventaire) : le serveur la détruit et rend les ingrédients */
async function recyclePiece(uid){
  try {
    const r = await gameApi.recycle(uid);
    ui.fresh.clear();
    setInventory(r.inventory, r.refund);
    const got = Object.entries(r.refund).map(([k, n]) => `${n} ${k}`).join(', ').replace(/[&<>]/g, '');
    $('invInfo').innerHTML = `<span class="okmsg">♻ ${r.item.replace(/[&<>]/g, '')} recyclé${got ? ` : ${got}` : ' (rien à récupérer)'}.</span>`;
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
/* amélioration : le serveur tire le hasard (identification, réussite) et renvoie la pièce, l'inventaire et le stuff à
   jour (une pièce portée peut être choisie ; sacrifiée, sa case se vide) */
/* pop-up « Tu as obtenu » : objet crafté, blueprint, pièce identifiée, améliorée ou enchantée, fragment de rune */
const obtained = setupObtained($('obtained'));
const UPGRADE_TITLES = { identify:'Pièce identifiée', upgrade:'Amélioration réussie', enchant:'Pièce enchantée', unenchant:'Tu as obtenu' };
const upgradeUI = setupUpgrade({
  onOp: async op => {
    const r = await gameApi.upgrade({ ...op, opId: newOpId() });
    if(r.stuff) stuff.set(r.stuff);
    setInventory(r.inventory);
    if(r.success !== false) obtained.show({ title: UPGRADE_TITLES[op.action] ?? 'Tu as obtenu', entry: r.fragment ?? r.piece });
    return r;
  },
  worn: () => stuff.worn(),
});

/* craft et stuff : même principe, le serveur fait l'action et renvoie l'inventaire (et le stuff) à jour */
const craft = setupCraft({
  onCraft: async item => {
    setInventory((await gameApi.craft(item, newOpId())).inventory);
    obtained.show({ title:'Tu as obtenu', entry: item, qty: recipeOf(item)?.qty ?? 1 });
  },
});
let setsUI = null;   // sets (créés plus bas) : les onglets Stuff, Skills et Sorts rafraîchissent la ligne « Set équipé »
const stuff = setupStuff({
  onOp: async op => { const r = await gameApi.stuff({ ...op, opId: newOpId() }); setInventory(r.inventory); stuff.set(r.stuff); },
  onWorn: () => { upgradeUI.refresh(); setsUI?.refresh(); },   // sets : la ligne « Set équipé » (29/10)
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
  onOp: async op => {
    const r = await gameApi.research({ ...op, opId: newOpId() });
    setInventory(r.inventory);
    if(op.action === 'research') obtained.show({ title:'Tu as obtenu', entry: r.item });
    return r;
  },
});

/* skills : le serveur vérifie et enregistre ; reset refusé pendant une session */
const skills = setupSkills({
  onOp: op => gameApi.skills({ ...op, opId: newOpId() }),
  inSession: () => !!G && !G.over,
  inventory: () => ui.inv,                                   // glyphes possédés (case de glyphe)
  onChange: (s, r) => { ui.skills = s; if(r?.inventory) setInventory(r.inventory); stuff.setSkills(s); lobby.update({ myTree: s?.tree ?? null }); spells.setContext({ tree: s?.tree ?? null }); setsUI?.refresh(); },   // Stuff : bonus des skills ; lobby et Sorts : sa spécialisation
});

/* sorts : le serveur vérifie et enregistre ; un parchemin appris quitte l'inventaire */
const spells = setupSpells({
  onOp: op => gameApi.spells({ ...op, opId: newOpId() }),
  onInventory: inv => setInventory(inv),
  onChange: () => setsUI?.refresh(),   // ligne « Set équipé » (29/10)
});

/* sets (Stuff, Skills, Sorts) : équiper change l'inventaire, le stuff, les skills et les sorts d'un coup */
setsUI = setupSets({
  onOp: op => gameApi.sets({ ...op, opId: newOpId() }),
  onLoadout: r => { setInventory(r.inventory); stuff.set(r.stuff); skills.set(r.skills); spells.set(r.spells); },
  inSession: () => !!rec,
  current: () => ui.skills ? { worn: stuff.worn(), skills: ui.skills, spells: spells.slots() } : null,
});

applyRarityColors();   // couleurs des raretés (config)
setupTooltips();   // bulles d'info (effets du stuff) : survol, ou toucher sur mobile
fillHelp();        // « ? » d'aide des pages (src/ui/help.js)

/* ---------- navigation ---------- */
const historyTab = setupHistory({ load: () => gameApi.history() });
let nav;   // l'onglet de départ est ouvert pendant setupNav, avant que nav soit assigné
let giantUI = null;   // Bloc géant (créé plus bas) : sa visite occupe l'onglet Session
let guide = null;     // guide « Premiers pas » (créé au démarrage, une fois l'état du joueur lu)
let gchat = null;     // chat global du Lobby (créé plus bas)
let wantJudgment = /^#jugement$/i.test(location.hash);   // ancien onglet Jugement : ouvre le Lobby sur les jauges
nav = setupNav($('nav'), $('views'), id => {
  if(ui.tab==='inventaire' && id!=='inventaire') ui.fresh.clear();   // les nouveautés ont été vues
  const from = ui.tab;
  ui.tab = id;
  /* transition avec l'onglet Session (src/ui/backdrop.js) : la mine du fond rétrécit ou s'agrandit, les panneaux glissent */
  const sessView = document.querySelector('.view[data-view="session"]');
  if(backdrop.switchTab(from, id, rec && G?.ready ? G : null)) id==='session' ? enterPanels(sessView) : leavePanels(sessView, $('views'), () => ui.tab==='session');
  if(id==='inventaire'){ renderInventory(ui.inv, ui.fresh); nav?.badge('inventaire', false); }
  if(id==='skills') skills?.refresh();   // le bouton reset suit la session en cours
  if(id==='historique') historyTab?.refresh();
  guide?.refresh();                      // « Regarde ton butin » : l'inventaire vient d'être ouvert
  if(id==='lobby') gchat?.poke();        // chat global : relu seulement Lobby ouvert, tout de suite en y revenant
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
  confirmLeave: () => ask([
    acct.account?.guest && 'Compte invité : sans pseudo ni mot de passe, tu ne pourras plus jamais y revenir.',
    G && !G.over && 'Ta session continue sur le serveur : tu la retrouveras en te reconnectant.',
    'Se déconnecter quand même ?'].filter(Boolean).join('\n'), { ok:'Se déconnecter' }),
  options: () => [{ key:'bgSession', label:'Session en cours en fond d\'écran', title:'Pendant une session, la mine s\'affiche en fond, assombrie, derrière les autres onglets.', on: backdrop.on }],
  setOption: (key, v) => { if(key === 'bgSession') backdrop.set(v); },
});

/* ---------- lobby ---------- */
const lobby = setupLobby({
  party: partyApi,
  /* don à un shrine (28/10) : l'inventaire revient du serveur */
  shrineGive: async (shrine, item, qty) => { const r = await partyApi.shrine({ shrine, item, qty, opId: newOpId() }); if(r.inventory) setInventory(r.inventory); return r; },
  look: () => lookOf(stuff.worn()),
  auras: () => aurasOf(stuff.worn()),
  gs: () => gearScore(stuff.worn()),
  keys: item => (ui.inv?.slots ?? []).reduce((n, s) => n + (s?.item === item ? s.qty || 1 : 0), 0),   // clés d'instance (27/10)
  towerWho: side => socialApi.towerWho(side),
  onPrefs: prefs => gameApi.prefs(prefs).catch(e => lobby.error(e.message)),
  onShowSession: () => nav.show('session'),
  onMode: mode => { if(mode === 'mi') instantLobby.refresh(); if(mode === 'giant') giantUI?.shown(); },
  onJudgment: () => pollJudgment(),
  onLaunch: async opts => {
    lobby.error('');
    try {
      enterSession((await gameApi.start(opts)).session); nav.show('session'); instantLobby.refresh();
      if(isInstanceMode(opts.mode)) gameApi.state().then(st => setInventory(st.inventory)).catch(() => {});   // clé consommée au lancement
    }   // lancer désinscrit du MI
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
function startInstant(){ if(acct.account && !acct.offline){ instantLobby.start(); giantUI?.refresh(); } else instantLobby.stop(); }

/* Bloc géant : carte du lobby (« Où miner »), visite dans l'onglet Session, écran de fin (src/ui/giant.js) */
giantUI = setupGiant({ api: giantApi, nav, onInventory: (inv, bag) => setInventory(inv, bag), session: () => !!rec, me: () => acct.account?.id });

/* Session et visite au Bloc géant en même temps (27/10/2026, Geoffrey) : l'onglet Session montre l'une OU l'autre, une
   barre permet de passer de l'une à l'autre. Ce qui vient de commencer passe devant. Chaque partie garde ses propres
   hidden (#run, #gtRun…) ; seules les classes de l'onglet décident de ce qui est caché quand il y a les deux. */
const sessionView = document.querySelector('.view[data-view="session"]');
let pane = 'session', hadSession = false, hadGiant = false;
function updatePanes(){
  const sess = !!rec || !$('end').hidden, gt = !!giantUI?.active();
  if(sess && !hadSession) pane = 'session';
  if(gt && !hadGiant) pane = 'giant';
  hadSession = sess; hadGiant = gt;
  const both = sess && gt;
  sessionView.classList.toggle('both', both);
  sessionView.classList.toggle('paneGiant', pane === 'giant');
  sessionView.classList.toggle('paneSession', pane !== 'giant');
  $('sessSwitch').hidden = !both;
  for(const b of $('sessSwitch').querySelectorAll('button')) b.classList.toggle('on', b.dataset.pane === pane);
}
$('sessSwitch').onclick = e => { const b = e.target.closest('button'); if(b){ pane = b.dataset.pane; updatePanes(); } };
setInterval(updatePanes, 300);
window.MI = instantLobby;                            // pour le débogage depuis la console (F12) : MI._notice(30)

/* plus de session : l'onglet Session affiche « Tu n'es pas en session », le lobby redevient utilisable */
function showNoSession(){
  rec = null; G = null; waiting = false; clearTimeout(viewTimer); chat.stop();
  setsUI.refresh(); sessionFlag();   // sets de nouveau disponibles
  $('run').hidden = true; $('miRun').hidden = true; $('twRun').hidden = true; $('inRun').hidden = true; $('noSession').hidden = !!giantUI?.active();   // une visite au Bloc géant garde l'onglet
  lobby.update({ account:acct.account, offline:acct.offline, info, session:null });
  pollLobby();
}
$('toLobbyBtn').onclick = () => nav.show('lobby');
$('miLeaveBtn').onclick = () => leave();
$('twLeaveBtn').onclick = () => leave();
$('inLeaveBtn').onclick = () => leave();
const navSession = document.querySelector('.navSession');
navSession.onclick = () => { if(rec || giantUI?.active()) nav.show('session'); };

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
    lobby.update({ party:st.party, invites:st.invites, lfg:st.lfg, shrines:st.shrines ?? [] });
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
    ...st.partyInvites.map(i => ({ key: 'p:' + i.code + ':' + i.at, icon: pxi('group'), text: `<b>${esc(i.from)}</b> vous a invité dans son lobby${i.full ? ' <span class="mut">(complet)</span>' : ''}`,
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
  online:  () => socialApi.online(),
  leaderboard: board => socialApi.leaderboard(board),
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
  if(rec){ tell('Tu es dans une session : termine-la ou quitte-la pour rejoindre ce groupe.'); return; }
  pendingJoin = code; pollLobby();
});

/* ---------- session ---------- */
setupRunControls(ui, { onLeave: leave, onClock: setClock, onFollow: id => { ui.follow = id; renderer.follow(); } });
setupCamera($('cv'), renderer, () => !!G?.ready && ui.tab === 'session');

/* focus : le serveur l'applique tout de suite dans la partie (et l'enregistre avec son tick) */
const focusPanel = setupFocusPanel({
  onChange: async focus => {
    try { return (await gameApi.focus(focus)).event; }
    catch(e){ tell(e.message); throw e; }
  },
});

/* chat des joueurs de la session (mine classique) : le serveur vérifie qui écrit, le texte et la cadence */
const chat = setupChat({ get: after => gameApi.chat(after), post: text => gameApi.say(text), meId: () => acct.account?.id });
/* chat global du Lobby (28/10) : tous les joueurs, même en session ; relu seulement quand l'onglet Lobby est ouvert */
gchat = setupChat({ prefix:'gchat', get: after => socialApi.chat(after), post: text => socialApi.say(text), meId: () => acct.account?.id,
                    paused: () => ui.tab !== 'lobby', time: true });

/* dev : vitesse et pause sont l'horloge de la session, sur le serveur */
async function setClock(opts){
  try { applyClock((await gameApi.clock(opts)).session.clock); } catch(e){ tell(e.message); }
}
function applyClock(c){
  if(!c || !info.dev) return;
  if(c.speed === ui.speed && c.paused === ui.paused) return;
  ui.speed = c.speed; ui.paused = c.paused;
  renderSpeeds(ui, info, s => setClock({ speed:s }));
}

/* classe sessionOn sur la page : Stuff, Skills et Sorts affichent « comptera à la prochaine session » (src/ui/style.css).
   Pas « inSession » : c'est le bandeau du lobby, toute la page en prendrait le style. */
function sessionFlag(){ document.body.classList.toggle('sessionOn', !!rec); }

function enterSession(session){
  rec = session; waiting = false;
  setsUI.refresh(); sessionFlag();   // sets indisponibles pendant la session
  clockOffset = session.now - Date.now();
  const mi = session.mode === 'mi', tw = isTowerMode(session.mode), ins = isInstanceMode(session.mode);
  G = mi ? { mode:'mi', ready:false, miners:[] } : tw ? { mode:'tower', ready:false, miners:[] } : ins ? { mode:'instance', ready:false, miners:[] } : emptyView();   // MI et tour : remplacées en entier à chaque envoi
  window.G = G;                             // pour le débogage depuis la console (F12)
  /* la caméra suit son propre mineur ; les mineurs portent le nom de leur joueur */
  ui.names = Object.fromEntries(session.players.map(p => [p.account, p.name]));
  ui.follow = null; ui.followSet = false; renderer.follow();
  ui.speed = info.dev ? session.clock?.speed ?? 1 : session.speed; ui.paused = !!session.clock?.paused;
  renderSpeeds(ui, info, s => setClock({ speed:s }));
  $('seedLbl').textContent = info.dev ? `seed ${session.seed}` : '';
  $('end').hidden = true; $('noSession').hidden = true; $('run').hidden = mi || tw || ins; $('miRun').hidden = !mi; $('twRun').hidden = !tw; $('inRun').hidden = !ins;
  if(mi || tw || ins) chat.stop(); else chat.start();
  lobby.update({ session:{ id:session.id } });   // lobby en lecture seule
  pollView();
  pollLobby();                                   // le lobby continue de montrer le groupe
}

/* reçoit la partie du serveur : la première fois en entier, ensuite seulement ce qui a changé */
const VIEW_EVERY = 250, VIEW_HIDDEN = 1500;   // ms (onglet caché : moins souvent)
let viewTimer = null, lastView = 0;
/* mesures d'affichage, seulement avec ?perf dans l'adresse (src/ui/perf.js) */
const perf = createPerf(), perfOn = new URLSearchParams(location.search).has('perf');
for(const el of document.querySelectorAll('.perfBox')) el.hidden = !perfOn;
async function pollView(){
  clearTimeout(viewTimer);
  if(!G || !rec || waiting) return;
  const id = rec.id;
  try {
    const t0 = performance.now();
    const r = await gameApi.view(G.ready ? G.ticks : null);
    if(perfOn) perf.view(t0, performance.now(), r.view?.tick);
    if(!G || rec?.id !== id || waiting) return;
    clockOffset = r.now - Date.now();
    applyClock(r.clock);
    if(r.view?.mode === 'mi'){ G = applyInstantView(r.view, G?.mode === 'mi' ? G : null); G.ready = true; window.G = G; lastView = performance.now(); }
    else if(r.view?.mode === 'instance'){ G = applyInstanceView(r.view, G?.mode === 'instance' ? G : null); G.ready = true; window.G = G; lastView = performance.now(); }
    else if(r.view?.mode === 'tower'){ G = applyTowerView(r.view, G?.mode === 'tower' ? G : null); G.ready = true; window.G = G; lastView = performance.now(); }
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
  if(!await ask(isIn() ? 'Quitter l\'instance ?\nTu ne recevras pas de coffre. Si le groupe gagne sans toi, ta clé est perdue (elle est rendue si le groupe perd).' : isTw() ? 'Quitter la tour ?\nTu ne recevras pas de trésor.' : isMi() ? 'Quitter la mine instantanée ?\nTu ne recevras rien de ce que tu as miné.'
                     : 'Quitter la session ?\nTu ne recevras rien de cette session : le coffre ira aux joueurs restants.', { ok:'Quitter', danger:true })) return;
  try { await gameApi.leave(); }
  catch(e){ if(!(e instanceof ApiError) || e.code !== 'no_session'){ tell(e.message); return; } }
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
  setsUI.refresh(); sessionFlag();
  lobby.update({ session:null });            // on peut relancer depuis le lobby pendant qu'on lit le bilan
  const up = setProgress(st.progress);       // XP versée par le serveur : nouveau niveau ?
  skills.set(st.skills);                     // … et donc peut-être de nouveaux points de skill
  const done = endAck = () => { endAck = null; gameApi.ack(ended.id).catch(() => {}); };
  const back = () => { done(); $('end').hidden = true; showNoSession(); nav.show('lobby'); };
  const toInv = () => { done(); $('end').hidden = true; showNoSession(); nav.show('inventaire'); };
  if(ended.mode === 'mi') showInstantEnd(ended, acct.account?.id, back, toInv);
  else if(isTowerMode(ended.mode)) showTowerEnd(ended, acct.account?.id, back, toInv);
  else if(isInstanceMode(ended.mode)) showInstanceEnd(ended, acct.account?.id, back, toInv);
  else showEnd(ended, acct.account?.id, back, toInv, up);
  pollLobby();                               // signe de vie au groupe pendant le bilan
}

/* inventaire envoyé par le serveur ; bag : objets qui viennent d'arriver (mis en évidence) */
function setInventory(inv, bag){
  ui.inv = { slots: inv?.slots ?? [], unlocked: inv?.unlocked ?? [] };
  furnace.setInventory(ui.inv); crusher.setInventory(ui.inv); craft.setInventory(ui.inv); stuff.setInventory(ui.inv); research.setInventory(ui.inv); upgradeUI.setInventory(ui.inv);
  spells.setInventory(ui.inv); skills?.refresh();   // skills : la case de glyphe dépend de l'inventaire
  lobby.update({});                                  // carte des instances : les clés du joueur (27/10)
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
  skills.setSpec(progress?.spec); lobby.update({ mySpec: progress?.spec ?? null });    // niveaux de spécialisation
  spells.setContext({ spec: Object.fromEntries(Object.entries(progress?.spec ?? {}).map(([t, s]) => [t, s.level])) });
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
  spells.set(st.spells);
  setsUI.set(st.sets);
  lobby.update({ prefs: st.prefs });
  if(st.session) enterSession(st.session);
  else showNoSession();
  if(st.ended && !st.session) showResult(st);
}

/* ---------- démarrage ---------- */
Object.assign(acct, await bootAccount(accountUI));
renderNavAccount($('navAccount'), acct);
lobby.update({ account:acct.account, offline:acct.offline });   // tout de suite : une page ouverte pendant une session ne passe par showNoSession qu'en quittant le bilan (27/10)
$('navAccount').onclick = () => accountUI.openProfile();
if(acct.offline) showNoSession();
else {
  try { info = await gameApi.info(); await refresh(); }
  catch(e){ acct.offline = true; showNoSession(); }
}
startInstant();
pollSocial();
pollJudgment();
if(acct.account && !acct.offline) gchat.start();   // une déconnexion recharge la page : démarré une fois

/* guide « Premiers pas » : relit l'état du joueur (déjà dans la page) et coche ses étapes toutes seules */
guide = setupGuide($('guide'), {
  facts: () => ({ ready: progress !== null && !acct.offline, account: acct.account?.id ?? null, tab: ui.tab, inSession: !!rec,
                  played: (progress?.xp ?? 0) > 0 || ui.inv.slots.some(Boolean), inv: ui.inv, worn: stuff.worn(),
                  skillsSpent: ui.skills?.spent ?? 0, unlocked: (ui.inv.unlocked ?? []).length }),
  go: id => nav.show(id),
  highlight: id => nav.highlight(id),
});
guide.refresh(); setInterval(guide.refresh, GUIDE.refreshMs);
if(globalThis.DIM_BOOT) DIM_BOOT.started = true;   // démarrage réussi : src/boot-check.js n'affiche plus rien

/* états du mineur du joueur en haut à droite de la mine (28/10, src/ui/effects.js) : un par mode de jeu */
const fxBars = { mine: [createEffectsBar($('fxBar')), $('fxBar'), $('cv'), $('cvWrap'), $('followBtn')],
                 mi: [createEffectsBar($('fxBarMi')), $('fxBarMi'), $('cvMi'), $('cvMiWrap')],
                 tower: [createEffectsBar($('fxBarTw')), $('fxBarTw'), $('cvTw'), $('cvTwWrap')],
                 instance: [createEffectsBar($('fxBarIn')), $('fxBarIn'), $('cvIn'), $('cvInWrap')] };
function updateEffects(G){
  const key = !G ? null : G.mode === 'mi' || G.mode === 'tower' || G.mode === 'instance' ? G.mode : 'mine';
  for(const [k, [update, bar, cv, wrap, below]] of Object.entries(fxBars)){
    if(k !== key){ if(!bar.hidden) update(null); continue; }
    update(G.miners.find(m => m.account === acct.account?.id) ?? G.miners[0] ?? null);   // son propre mineur (spec du 28/10)
    if(!bar.hidden) placeEffectsBar(bar, cv, wrap, below);
  }
}
/* barre des sorts des tours et de l'instance (29/10) : celle de son propre mineur ; la mine classique a la sienne (src/ui/hud.js) */
const spellBars = { tower: [$('spellBarTw'), $('cvTw'), $('cvTwWrap')], instance: [$('spellBarIn'), $('cvIn'), $('cvInWrap')] };
function updateSpellBars(G){
  for(const [k, [el, cv, wrap]] of Object.entries(spellBars)){
    showSpellBar(el, G && G.mode === k ? G.miners.find(m => m.account === acct.account?.id) ?? null : null, G?.t ?? 0);
    placeSpellBar(el, cv, wrap);
  }
}

/* ---------- boucle d'affichage (la partie, elle, tourne sur le serveur) ---------- */
let last = performance.now(), lastHud = 0;
function frame(now){
  const dtr = Math.min(0.25, (now - last) / 1000); last = now;
  if(perfOn) perf.frame(now);
  smooth(dtr);
  const shown = G?.ready ? G : null, mi = shown?.mode === 'mi', tw = shown?.mode === 'tower', ins = shown?.mode === 'instance';
  backdrop.draw(rec ? shown : null, ui.tab !== 'session', acct.account?.id, ui.follow);
  if(shown && ui.tab==='session') ins ? inRenderer.draw(shown, acct.account?.id) : tw ? twRenderer.draw(shown, acct.account?.id) : mi ? miRenderer.draw(shown, acct.account?.id) : renderer.draw(shown, ui.follow);
  if(now - lastHud > 120){
    if(perfOn){ const t = perfText(perf.stats()); for(const el of document.querySelectorAll('.perfBox')) el.textContent = t; }
    if(ins && ui.tab==='session') updateInstanceHUD(shown, acct.account?.id, rec.finishAt ? Math.max(0, (rec.finishAt - serverNow()) / 1000) : null);
    else if(tw && ui.tab==='session') updateTowerHUD(shown, acct.account?.id, rec.finishAt ? Math.max(0, (rec.finishAt - serverNow()) / 1000) : null);
    else if(mi && ui.tab==='session') updateInstantHUD(shown, acct.account?.id, Math.max(0, (rec.finishAt - serverNow()) / 1000));
    else if(shown && ui.tab==='session'){
      updateHUD(shown, ui);
      focusPanel.update(shown, acct.account?.id);
      $('followBtn').hidden = !renderer.free;               // caméra déplacée par le joueur : bouton pour revenir
      const late = !info.dev && rec && G.ticks + 50 < tickAt(serverNow() - rec.startedAt, rec.speed);
      $('realLeft').textContent = late ? 'connexion…' : info.dev ? '' : `fin dans ${fmt(Math.max(0, (rec.finishAt - serverNow()) / 1000))}`;
    }
    updateEffects(ui.tab==='session' ? shown : null);
    updateSpellBars(ui.tab==='session' ? shown : null);
    updateNavSession(shown, waiting, ins ? INSTANCE.duration : tw ? TOWER.duration : mi ? INSTANT_MINE.duration : SESSION_LEN);
    updateOrbs(shown, mi || tw || ins, ins ? INSTANCE.duration : tw ? TOWER.duration : undefined);
    if(ui.tab==='session'){
      ins ? fitCanvas($('cvIn'), $('cvInWrap')) : tw ? fitCanvas($('cvTw'), $('cvTwWrap')) : mi ? fitInstant($('cvMi'), $('cvMiWrap'), miRenderer, MI_TILE) : fitMine($('cv'), $('cvWrap'), renderer, CAMERA, TILE);   // la mine remplit la place libre
      if(shown) backdrop.measure(ins ? 'instance' : tw ? 'tower' : mi ? 'mi' : 'mine', $(SESSION_CV[ins ? 'instance' : tw ? 'tower' : mi ? 'mi' : 'mine']), mi ? miRenderer.rows : renderer.rows);   // le fond reprend cette place et cette échelle
      document.querySelectorAll('.runL, .runR, .runGrid.mi > aside').forEach(c => clearDock(c, $('nav')));   // colonnes jusqu'en bas si possible
    }
    const face = $('navAccount').querySelector('canvas');
    if(face) drawPortrait(face, lookOf(stuff.worn()), aurasOf(stuff.worn()));                  // portrait : le mineur avec son stuff
    navSession.classList.toggle('live', !!rec);
    if(rec && ui.tab==='lobby')                                // bandeau du lobby : temps restant
      $('lobbySessLeft').textContent = waiting ? '· résultat…' : !shown ? '' : info.dev ? `· ${fmt(shown.t)} de jeu`
        : `· fin dans ${fmt(Math.max(0, (rec.finishAt - serverNow()) / 1000))}`;
    lastHud = now;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
