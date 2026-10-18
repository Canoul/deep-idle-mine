/* Point d'entrée navigateur : relie simulation, rendu et interface, et fait tourner la boucle.
   L'accélération du temps n'est qu'un multiplicateur du nombre de ticks par frame. */
import { DT, DEFAULT_MINERS } from './config.js';
import { newSession, tick } from './sim/session.js';
import { createRenderer } from './render/canvas.js';
import { updateHUD, showEnd } from './ui/hud.js';
import { setupControls } from './ui/controls.js';
import { loadGlobal, addToGlobal } from './ui/storage.js';

const $ = id => document.getElementById(id);
const ui = { speed:1, paused:false, focus:0, global:loadGlobal() };
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

setupControls(ui, { newSession:start, getG:()=>G, onSession:f=>sessionHooks.push(f) });

/* paramètres d'adresse (reproduire un bug) : ?seed=123&miners=3&at=600 → cette partie, avancée à 10:00 */
const q = new URLSearchParams(location.search);
start(q.has('seed') ? (+q.get('seed'))|0 : undefined, q.has('miners') ? +q.get('miners') : DEFAULT_MINERS);
if(q.has('at')){ const n=Math.round(+q.get('at')/DT); for(let i=0;i<n && !G.over;i++) tick(G); }
if(q.has('focus')) ui.focus=+q.get('focus');

const MAX_TICKS_PER_FRAME = 900;
let last=performance.now(), acc=0, lastHud=0;
function frame(now){
  const dtr=Math.min(0.25,(now-last)/1000); last=now;
  if(!ui.paused && !G.over){
    acc+=dtr*ui.speed; let n=0;
    while(acc>=DT && n<MAX_TICKS_PER_FRAME){ tick(G); acc-=DT; n++; }
    if(n>=MAX_TICKS_PER_FRAME) acc=0;
    if(G.over){ addToGlobal(ui.global, G.summary.chest); showEnd(G, ()=>start(undefined, G.miners.length)); }
  }
  renderer.draw(G, ui.focus);
  if(now-lastHud>120){ updateHUD(G, ui); lastHud=now; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
