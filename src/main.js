/* Point d'entrée navigateur : relie le serveur, la simulation, le rendu et l'interface.

   Le SERVEUR fait foi : il crée la session (seed, joueurs, préférences, heure de départ), décide quand elle est
   finie, la rejoue lui-même et verse les parts dans les inventaires. Le navigateur construit la même partie depuis
   l'enregistrement du serveur (src/shared/game.js) et l'affiche :
   - jeu normal : la partie suit le temps réel à la vitesse du serveur (×2) ; page fermée, elle continue, et au retour
     le navigateur rattrape le temps écoulé ;
   - mode développeur : vitesses libres et pause ; le navigateur dit au serveur quand c'est fini. */
import { DT, GAME } from './config.js';
import { tick } from './sim/session.js';
import { buildSession, applyDueLeaves, applyOverrides, tickAt } from './shared/game.js';
import { createRenderer } from './render/canvas.js';
import { updateHUD, showEnd, showSettling, updateNavSession, fmt } from './ui/hud.js';
import { setupRunControls, renderSpeeds } from './ui/controls.js';
import { setupLobby } from './ui/lobby.js';
import { renderInventory } from './ui/inventory.js';
import { setupNav } from './ui/nav.js';
import { createAccountUI, bootAccount, renderNavAccount } from './ui/account.js';
import { gameApi, ApiError } from './net/api.js';

const $ = id => document.getElementById(id);
const ui = { speed:1, paused:false, focus:0, inv:{ slots:[] }, fresh:new Set(), tab:'mine' };
const acct = { account:null, offline:false };          // compte connecté (offline : pas de serveur de jeu)
let info = { dev:false, speed:GAME.speed, speeds:[GAME.speed], maxPlayers:GAME.maxPlayers };
let rec = null;            // session en cours (enregistrement du serveur)
let G = null;              // partie affichée, construite depuis rec
let clockOffset = 0;       // heure du serveur − heure locale (ms)
let waiting = false;       // fin de session signalée, résultat du serveur attendu
const serverNow = () => Date.now() + clockOffset;
const renderer = createRenderer($('cv'));

/* ancienne sauvegarde d'inventaire dans le navigateur : l'inventaire est maintenant sur le serveur */
try { for(const k of Object.keys(localStorage)) if(k.startsWith('deepIdleMine.inventory') || k === 'deepIdleMine.global') localStorage.removeItem(k); } catch {}

/* ---------- navigation ---------- */
let nav;   // l'onglet de départ est ouvert pendant setupNav, avant que nav soit assigné
nav = setupNav($('nav'), $('views'), id => {
  if(ui.tab==='inventaire' && id!=='inventaire') ui.fresh.clear();   // les nouveautés ont été vues
  ui.tab = id;
  if(id==='inventaire'){ renderInventory(ui.inv, ui.fresh); nav?.badge('inventaire', false); }
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
  rec = null; G = null; waiting = false;
  $('run').hidden = true; $('lobby').hidden = false;
  lobby.update({ account:acct.account, offline:acct.offline, info });
}

/* ---------- session ---------- */
setupRunControls(ui, { onLeave: leave });

function enterSession(session){
  rec = session; waiting = false;
  clockOffset = session.now - Date.now();
  applyOverrides(session.overrides);       // réglages dev de cette session (aucun en jeu normal)
  G = buildSession(session);
  window.G = G;                             // pour le débogage depuis la console (F12)
  ui.focus = 0; ui.paused = false; ui.speed = info.dev ? (ui.speed || 1) : session.speed;
  renderSpeeds(ui, info);
  $('seedLbl').textContent = info.dev ? `seed ${session.seed}` : '';
  $('end').hidden = true; $('lobby').hidden = true; $('run').hidden = false;
}

async function leave(){
  if(!G || G.over) return;
  if(!confirm('Quitter la session ?\nTu ne recevras rien de cette session : le coffre ira aux joueurs restants.')) return;
  try { await gameApi.leave(info.dev ? { tick:G.ticks } : {}); }
  catch(e){ if(!(e instanceof ApiError) || e.code !== 'no_session'){ alert(e.message); return; } }
  showLobby();
}

/* la partie affichée est finie : on prévient le serveur et on attend son résultat (c'est lui qui fait foi) */
async function finish(){
  waiting = true;
  showSettling();
  try { await gameApi.finish(); }
  catch(e){
    if(e instanceof ApiError && e.code === 'too_early'){        // horloge locale un peu en avance : on réessaie
      setTimeout(finish, Math.max(1, e.retryAfter) * 1000); return;
    }
    if(!(e instanceof ApiError) || e.code !== 'no_session') console.warn(e);   // déjà terminée côté serveur
  }
  pollResult();
}

async function pollResult(){
  if(!waiting) return;
  try {
    const st = await gameApi.state();
    if(st.ended){ return showResult(st); }
    if(!st.session){ return showLobby(); }                    // plus rien à attendre (abandonnée)
  } catch(e){ console.warn(e); }
  setTimeout(pollResult, 2000);
}

/* résultat du serveur : bilan + inventaire relu depuis le serveur */
function showResult(st){
  const ended = st.ended;
  setInventory(st.inventory, ended.result.shares.find(p => p.account === acct.account?.id)?.bag);
  rec = null; G = null; waiting = false;
  const done = () => gameApi.ack(ended.id).catch(() => {});
  showEnd(ended, acct.account?.id,
    () => { done(); $('end').hidden = true; showLobby(); },
    () => { done(); $('end').hidden = true; showLobby(); nav.show('inventaire'); });
}

/* inventaire envoyé par le serveur ; bag : objets qui viennent d'arriver (mis en évidence) */
function setInventory(inv, bag){
  ui.inv = { slots: inv?.slots ?? [] };
  if(bag) ui.inv.slots.forEach((s, i) => { if(s && bag[s.item]) ui.fresh.add(i); });
  if(ui.tab==='inventaire') renderInventory(ui.inv, ui.fresh);
  else if(ui.fresh.size) nav.badge('inventaire', true);
}

/* état complet depuis le serveur : inventaire, préférences, session en cours, résultat pas encore vu */
async function refresh(){
  const st = await gameApi.state();
  setInventory(st.inventory);
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

/* ---------- boucle ---------- */
const FRAME_BUDGET_MS = 25;   // temps de calcul max par image : le rattrapage d'une longue absence se fait en accéléré
let last = performance.now(), acc = 0, lastHud = 0;
function frame(now){
  const dtr = Math.min(0.25, (now - last) / 1000); last = now;
  if(G && !G.over && !waiting){
    const t0 = performance.now();
    /* jusqu'où avancer : jeu normal → le temps réel écoulé (heure du serveur) ; dev → la vitesse choisie */
    let target;
    if(info.dev){ if(!ui.paused) acc += dtr * ui.speed; target = G.ticks + Math.floor(acc / DT); }
    else target = tickAt(serverNow() - rec.startedAt, rec.speed);
    while(G.ticks < target && !G.over && performance.now() - t0 < FRAME_BUDGET_MS){
      applyDueLeaves(G, rec); tick(G);
      if(info.dev) acc -= DT;
    }
    if(info.dev && acc > 5) acc = 5;      // en retard de plus de 5 s de jeu : on n'accumule pas sans fin
    if(G.over) finish();
  }
  if(G && ui.tab==='mine') renderer.draw(G, ui.focus);
  if(now - lastHud > 120){
    if(G && ui.tab==='mine'){
      updateHUD(G, ui);
      const behind = !info.dev && G.ticks + 50 < tickAt(serverNow() - rec.startedAt, rec.speed);
      $('realLeft').textContent = info.dev ? '' : behind ? 'rattrapage…' : `fin dans ${fmt(Math.max(0, (rec.finishAt - serverNow()) / 1000))}`;
    }
    updateNavSession(G, waiting);
    lastHud = now;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
