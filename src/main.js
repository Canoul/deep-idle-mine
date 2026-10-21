/* Point d'entrée navigateur : relie le serveur, le rendu et l'interface.

   Le SERVEUR fait foi et fait tourner LA partie : une seule copie, sur le serveur (server/game/live.js). Le navigateur
   ne calcule rien : il reçoit régulièrement la partie (src/shared/view.js) et l'affiche. Il envoie seulement les
   choix du joueur (lancer, quitter, focus ; en dev : vitesse et pause), que le serveur applique tout de suite.
   - jeu normal : la partie suit le temps réel à la vitesse du serveur (×2) ; page fermée, elle continue sur le serveur ;
   - à plusieurs : tout le monde voit la même partie, puisqu'il n'y en a qu'une ;
   - fin : le serveur termine la partie au dernier tick, partage le coffre et verse les parts ; le navigateur affiche
     le bilan. */
import { applyRarityColors } from './ui/rarity.js';
import { GAME, PARTY } from './config.js';
import { emptyView, applyView } from './shared/view.js';
import { tickAt } from './shared/game.js';
import { joinCodeFromHash } from './shared/party.js';
import { createRenderer } from './render/canvas.js';
import { updateHUD, showEnd, showSettling, updateNavSession, fmt } from './ui/hud.js';
import { setupRunControls, setupCamera, renderSpeeds } from './ui/controls.js';
import { setupLobby } from './ui/lobby.js';
import { renderLevel, levelUpText } from './ui/level.js';
import { setupFocusPanel } from './ui/focus.js';
import { renderInventory as drawInventory, showLoot, lootError } from './ui/inventory.js';
import { setupNav } from './ui/nav.js';
import { setupFurnace } from './ui/furnace.js';
import { setupResearch } from './ui/research.js';
import { setupSkills } from './ui/skills.js';
import { setupHistory } from './ui/history.js';
import { setupCraft } from './ui/craft.js';
import { setupStuff } from './ui/stuff.js';
import { setupTooltips } from './ui/tooltip.js';
import { createAccountUI, bootAccount, renderNavAccount } from './ui/account.js';
import { gameApi, partyApi, ApiError } from './net/api.js';

const $ = id => document.getElementById(id);
const ui = { speed:1, paused:false, follow:null, inv:{ slots:[] }, fresh:new Set(), tab:'mine' };
const acct = { account:null, offline:false };          // compte connecté (offline : pas de serveur de jeu)
let info = { dev:false, speed:GAME.speed, speeds:[GAME.speed], maxPlayers:GAME.maxPlayers };
let rec = null;            // session en cours (enregistrement du serveur)
let G = null;              // copie d'affichage de la partie du serveur (src/shared/view.js)
let clockOffset = 0;       // heure du serveur − heure locale (ms)
let waiting = false;       // partie finie, résultat du serveur attendu
let pendingJoin = joinCodeFromHash(location.hash);   // lien d'invitation (#rejoindre=CODE), lu avant que la barre change l'adresse
const serverNow = () => Date.now() + clockOffset;
const renderer = createRenderer($('cv'));

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
    $('invInfo').innerHTML = `<span class="okmsg">✔ ${item.replace(/[&<>]/g, '')} équipé (onglet Stuff pour voir les stats du mineur).</span>`;
  } catch(e){ lootError(e.message); }
}

/* ---------- four : chaque action est faite par le serveur, qui renvoie fours et inventaire ---------- */
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
  },
});

/* table de recherche : le serveur tire le blueprint (ou les parts) et renvoie l'inventaire */
const research = setupResearch({
  onOp: async op => { const r = await gameApi.research({ ...op, opId: newOpId() }); setInventory(r.inventory); return r; },
});

/* skills : le serveur vérifie et enregistre ; reset refusé pendant une session */
const skills = setupSkills({
  onOp: op => gameApi.skills({ ...op, opId: newOpId() }),
  inSession: () => !!G && !G.over,
  onChange: s => stuff.setSkills(s),   // l'onglet Stuff affiche aussi les bonus des skills
});

applyRarityColors();   // couleurs des raretés (config)
setupTooltips();   // bulles d'info (effets du stuff) : survol, ou toucher sur mobile

/* ---------- navigation ---------- */
const historyTab = setupHistory({ load: () => gameApi.history() });
let nav;   // l'onglet de départ est ouvert pendant setupNav, avant que nav soit assigné
nav = setupNav($('nav'), $('views'), id => {
  if(ui.tab==='inventaire' && id!=='inventaire') ui.fresh.clear();   // les nouveautés ont été vues
  ui.tab = id;
  if(id==='inventaire'){ renderInventory(ui.inv, ui.fresh); nav?.badge('inventaire', false); }
  if(id==='skills') skills?.refresh();   // le bouton reset suit la session en cours
  if(id==='historique') historyTab?.refresh();
});

/* ---------- compte ---------- */
const accountUI = createAccountUI($('account'), acct, {
  onChange: () => { renderNavAccount($('navAccount'), acct); lobby.update({ account:acct.account }); },
  confirmLeave: () => confirm([
    acct.account?.guest && 'Compte invité : sans pseudo ni mot de passe, tu ne pourras plus jamais y revenir.',
    G && !G.over && 'Ta session continue sur le serveur : tu la retrouveras en te reconnectant.',
    'Se déconnecter quand même ?'].filter(Boolean).join('\n')),
});

/* ---------- lobby ---------- */
const lobby = setupLobby({
  party: partyApi,
  onPrefs: prefs => gameApi.prefs(prefs).catch(e => lobby.error(e.message)),
  onLaunch: async opts => {
    lobby.error('');
    try { enterSession((await gameApi.start(opts)).session); }
    catch(e){
      if(e instanceof ApiError && e.code === 'session_running') return refresh();
      lobby.error(e.message);
    }
  },
});

function showLobby(){
  rec = null; G = null; waiting = false; clearTimeout(viewTimer);
  $('run').hidden = true; $('lobby').hidden = false;
  lobby.update({ account:acct.account, offline:acct.offline, info });
  pollLobby();
}

/* lobby : groupe, invitations ; le chef a lancé → on passe à la session. Sert aussi de signe de vie au groupe,
   y compris pendant le bilan (le groupe reste après une session : le chef peut relancer pendant qu'on le lit). */
let lobbyTimer = null, endAck = null;
async function pollLobby(){
  clearTimeout(lobbyTimer);
  if(acct.offline || !acct.account || G || waiting) return;
  try {
    if(pendingJoin){ const code = pendingJoin; pendingJoin = null; nav.show('mine'); await lobby.join(code); }
    const st = await partyApi.state();
    if(st.session){ endAck?.(); return refresh(); }      // relancé pendant le bilan : il est lu, on y va
    lobby.update({ party:st.party, invites:st.invites });
  } catch(e){ console.warn(e); }
  lobbyTimer = setTimeout(pollLobby, PARTY.poll);
}
/* lien d'invitation ouvert alors que la page l'est déjà (la barre a déjà remplacé l'adresse : on lit newURL) */
addEventListener('hashchange', e => {
  const code = joinCodeFromHash(e.newURL);
  if(!code) return;
  if(G){ alert('Tu es dans une session : termine-la ou quitte-la pour rejoindre ce groupe.'); return; }
  pendingJoin = code; pollLobby();
});

/* ---------- session ---------- */
setupRunControls(ui, { onLeave: leave, onClock: setClock, onFollow: id => { ui.follow = id; renderer.follow(); } });
setupCamera($('cv'), renderer, () => !!G?.ready && ui.tab === 'mine');

/* focus : le serveur l'applique tout de suite dans la partie (et l'enregistre avec son tick) */
const focusPanel = setupFocusPanel({
  onChange: async focus => {
    try { return (await gameApi.focus(focus)).event; }
    catch(e){ alert(e.message); throw e; }
  },
});

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
  clearTimeout(lobbyTimer);
  rec = session; waiting = false;
  clockOffset = session.now - Date.now();
  G = emptyView();
  window.G = G;                             // pour le débogage depuis la console (F12)
  /* la caméra suit son propre mineur ; les mineurs portent le nom de leur joueur */
  ui.names = Object.fromEntries(session.players.map(p => [p.account, p.name]));
  ui.follow = null; ui.followSet = false; renderer.follow();
  ui.speed = info.dev ? session.clock?.speed ?? 1 : session.speed; ui.paused = !!session.clock?.paused;
  renderSpeeds(ui, info, s => setClock({ speed:s }));
  $('seedLbl').textContent = info.dev ? `seed ${session.seed}` : '';
  $('end').hidden = true; $('lobby').hidden = true; $('run').hidden = false;
  pollView();
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
    if(r.view){
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
  if(!confirm('Quitter la session ?\nTu ne recevras rien de cette session : le coffre ira aux joueurs restants.')) return;
  try { await gameApi.leave(); }
  catch(e){ if(!(e instanceof ApiError) || e.code !== 'no_session'){ alert(e.message); return; } }
  showLobby();
}

/* la partie du serveur est finie : on attend son résultat (partage et versement, quelques instants) */
function ended(){
  waiting = true; clearTimeout(viewTimer);
  showSettling();
  pollResult();
}

async function pollResult(){
  if(!waiting) return;
  try {
    const st = await gameApi.state();
    if(st.ended){ return showResult(st); }
    if(!st.session){ return showLobby(); }                    // plus rien à attendre (abandonnée)
  } catch(e){ console.warn(e); }
  setTimeout(pollResult, 1000);
}

/* résultat du serveur : bilan + inventaire relu depuis le serveur */
function showResult(st){
  const ended = st.ended;
  setInventory(st.inventory, ended.result.shares.find(p => p.account === acct.account?.id)?.bag);
  rec = null; G = null; waiting = false;
  const up = setProgress(st.progress);       // XP versée par le serveur : nouveau niveau ?
  skills.set(st.skills);                     // … et donc peut-être de nouveaux points de skill
  const done = endAck = () => { endAck = null; gameApi.ack(ended.id).catch(() => {}); };
  showEnd(ended, acct.account?.id,
    () => { done(); $('end').hidden = true; showLobby(); },
    () => { done(); $('end').hidden = true; showLobby(); nav.show('inventaire'); }, up);
  pollLobby();                               // signe de vie au groupe pendant le bilan
}

/* inventaire envoyé par le serveur ; bag : objets qui viennent d'arriver (mis en évidence) */
function setInventory(inv, bag){
  ui.inv = { slots: inv?.slots ?? [], unlocked: inv?.unlocked ?? [] };
  furnace.setInventory(ui.inv); craft.setInventory(ui.inv); stuff.setInventory(ui.inv); research.setInventory(ui.inv);
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
  stuff.set(st.stuff);
  skills.set(st.skills);
  lobby.update({ prefs: st.prefs });
  if(st.session) enterSession(st.session);
  else showLobby();
  if(st.ended && !st.session) showResult(st);
}

/* ---------- démarrage ---------- */
Object.assign(acct, await bootAccount(accountUI));
renderNavAccount($('navAccount'), acct);
$('navAccount').onclick = () => accountUI.openProfile();
if(acct.offline) showLobby();
else {
  try { info = await gameApi.info(); await refresh(); }
  catch(e){ acct.offline = true; showLobby(); }
}

/* ---------- boucle d'affichage (la partie, elle, tourne sur le serveur) ---------- */
let last = performance.now(), lastHud = 0;
function frame(now){
  const dtr = Math.min(0.25, (now - last) / 1000); last = now;
  smooth(dtr);
  const shown = G?.ready ? G : null;
  if(shown && ui.tab==='mine') renderer.draw(shown, ui.follow);
  if(now - lastHud > 120){
    if(shown && ui.tab==='mine'){
      updateHUD(shown, ui);
      focusPanel.update(shown, acct.account?.id);
      $('followBtn').hidden = !renderer.free;               // caméra déplacée par le joueur : bouton pour revenir
      const late = !info.dev && rec && G.ticks + 50 < tickAt(serverNow() - rec.startedAt, rec.speed);
      $('realLeft').textContent = late ? 'connexion…' : info.dev ? '' : `fin dans ${fmt(Math.max(0, (rec.finishAt - serverNow()) / 1000))}`;
    }
    updateNavSession(shown, waiting);
    lastHud = now;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
