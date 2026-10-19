/* Point d'entrée navigateur : relie simulation, rendu et interface, et fait tourner la boucle.
   L'accélération du temps n'est qu'un multiplicateur du nombre de ticks par frame. */
import { DT, DEFAULT_MINERS } from './config.js';
import { newSession, tick } from './sim/session.js';
import { createRenderer } from './render/canvas.js';
import { updateHUD, showEnd, updateNavSession } from './ui/hud.js';
import { setupControls } from './ui/controls.js';
import { loadInventory, saveInventory } from './ui/storage.js';
import { addAll } from './meta/inventory.js';
import { renderInventory } from './ui/inventory.js';
import { setupNav } from './ui/nav.js';

const $ = id => document.getElementById(id);
const ui = { speed:1, paused:false, focus:0, inv:loadInventory(), fresh:new Set(), tab:'mine' };
const renderer = createRenderer($('cv'));
const sessionHooks = [];
let G;

function start(seed, miners=DEFAULT_MINERS){
  G = newSession(seed, { miners });
  ui.focus = 0;
  $('seedIn').value = G.seed;
  $('minersSel').value = String(miners);
  $('end').hidden = true;
  for(const f of sessionHooks) f();
  window.G = G;   // pour le débogage depuis la console (F12)
}

let nav;   // l'onglet de départ est ouvert pendant setupNav, avant que nav soit assigné
nav = setupNav($('nav'), $('views'), id => {
  if(ui.tab==='inventaire' && id!=='inventaire') ui.fresh.clear();   // les nouveautés ont été vues
  ui.tab = id;
  if(id==='inventaire'){ renderInventory(ui.inv, ui.fresh); nav?.badge('inventaire', false); }
});
setupControls(ui, { newSession:start, getG:()=>G, onSession:f=>sessionHooks.push(f) });

/* paramètres d'adresse (reproduire un bug) : ?seed=123&miners=3&at=600 → cette partie, avancée à 10:00 */
const q = new URLSearchParams(location.search);
start(q.has('seed') ? (+q.get('seed'))|0 : undefined, q.has('miners') ? +q.get('miners') : DEFAULT_MINERS);
if(q.has('at')){ const n=Math.round(+q.get('at')/DT); for(let i=0;i<n && !G.over;i++) tick(G); }
if(q.has('focus')) ui.focus=+q.get('focus');

/* fin de session : le coffre commun est versé dans l'inventaire global */
function endSession(){
  for(const i of addAll(ui.inv, G.summary.chest)) ui.fresh.add(i);
  saveInventory(ui.inv);
  if(ui.tab==='inventaire') renderInventory(ui.inv, ui.fresh);
  else if(ui.fresh.size) nav.badge('inventaire', true);
  showEnd(G, ()=>start(undefined, G.miners.length), ()=>{ $('end').hidden=true; nav.show('inventaire'); });
}

const MAX_TICKS_PER_FRAME = 900;
let last=performance.now(), acc=0, lastHud=0;
function frame(now){
  const dtr=Math.min(0.25,(now-last)/1000); last=now;
  if(!ui.paused && !G.over){
    acc+=dtr*ui.speed; let n=0;
    while(acc>=DT && n<MAX_TICKS_PER_FRAME){ tick(G); acc-=DT; n++; }
    if(n>=MAX_TICKS_PER_FRAME) acc=0;
    if(G.over) endSession();
  }
  // la simulation tourne quel que soit l'onglet ; on ne dessine la mine que si elle est visible
  if(ui.tab==='mine') renderer.draw(G, ui.focus);
  if(now-lastHud>120){
    if(ui.tab==='mine') updateHUD(G, ui);
    updateNavSession(G);
    lastHud=now;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
