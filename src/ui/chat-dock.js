/* Chat global permanent (31/10/2026, Geoffrey) : à gauche et en bas de l'écran, quel que soit l'onglet. Il flotte par-dessus : sa taille
   ne décale jamais le reste. Hauteur et largeur réglables en tirant sa bordure, en haut, à droite ou dans le coin (CHAT.dock) ;
   la largeur s'arrête au bord de l'interface centrale. Repliable ; tout est gardé dans ce navigateur. Petit écran : replié au départ, il recouvrirait le contenu. */
import { CHAT } from '../config.js';

const KEY = 'deepIdleMine.chatDock2';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };

/* part de l'écran permise ; une valeur illisible redonne la hauteur de départ */
export function dockShare(v){
  return Number.isFinite(v) ? Math.min(CHAT.dock.max, Math.max(CHAT.dock.min, v)) : CHAT.dock.share;
}

/* largeur en px permise ; null (illisible) : celle de départ (CHAT.dock.startWidth) */
export function dockWidth(v, screen = innerWidth){
  return Number.isFinite(v) ? Math.min(screen * CHAT.dock.maxWidth, Math.max(CHAT.dock.minWidth, v)) : null;
}

/* largeur affichée : celle voulue, arrêtée au bord de l'interface centrale (limit), jamais sous minWidth */
export const dockFit = (want, limit) => Math.max(CHAT.dock.minWidth, Math.min(want ?? CHAT.dock.startWidth, limit));

/* bord gauche de l'interface centrale de l'onglet ouvert : la mine elle-même en session (pas sa zone, plus large), sinon son contenu (même largeur partout) */
function centralLeft(){
  const seen = el => el.getClientRects().length > 0;
  const view = document.querySelector('.view:not([hidden])');
  if(!view) return Infinity;
  const el = [...view.querySelectorAll('#cv, #cvMi, #cvTw, #cvGt, #cvIn')].find(seen) ?? view.querySelector('.lobbyWrap, .invWrap, .furnWrap');
  if(!el) return Infinity;
  const pad = el.matches('.lobbyWrap, .invWrap, .furnWrap') ? (parseFloat(getComputedStyle(el).paddingLeft) || 0) * 0.9 : 0;
  return el.getBoundingClientRect().left + pad;
}

/* edges : bordures à tirer (data-edge : h hauteur, w largeur, hw les deux) ; onChange() : taille ou pliage changé (le chat
   se remet sur les derniers messages, relit s'il vient d'être déplié) */
export function setupChatDock({ dock, edges, fold, onChange = () => {} }){
  const saved = load();
  let share = dockShare(saved.share), width = dockWidth(saved.width), folded = typeof saved.folded === 'boolean' ? saved.folded : innerWidth <= 1170;
  const remember = () => save({ share, width, folded });
  function fit(){
    const w = dockFit(width, centralLeft());
    document.body.style.setProperty('--chat-w', `${w}px`);
    dock.classList.toggle('overNav', w > (document.querySelector('.dock .orb')?.getBoundingClientRect().left ?? Infinity));
  }
  /* le bord de l'interface centrale bouge avec l'onglet, l'écran du Lobby et la taille de la fenêtre */
  if(typeof ResizeObserver !== 'undefined'){
    const ro = new ResizeObserver(fit);
    for(const el of document.querySelectorAll('#views, #lobbyMenu, #lobbyStage, #run, #miRun, #twRun, #gtRun, #inRun, #cv, #cvMi, #cvTw, #cvGt, #cvIn')) ro.observe(el);
  }
  addEventListener('resize', fit);
  function apply(){
    document.documentElement.style.setProperty('--chat-h', `${share * 100}dvh`);
    fit();
    dock.classList.toggle('folded', folded);
    fold.textContent = folded ? '+' : '–';
    document.body.classList.toggle('chatOn', !dock.hidden && !folded);
    onChange();
  }
  for(const edge of edges) edge.addEventListener('pointerdown', e => {
    if(folded) return;
    e.preventDefault();
    edge.setPointerCapture(e.pointerId);
    const move = ev => {
      if(edge.dataset.edge.includes('h')) share = dockShare((innerHeight - ev.clientY) / innerHeight);
      if(edge.dataset.edge.includes('w')) width = dockWidth(ev.clientX);
      apply();
    };
    const up = () => { edge.removeEventListener('pointermove', move); edge.removeEventListener('pointerup', up); edge.removeEventListener('pointercancel', up); remember(); };
    edge.addEventListener('pointermove', move); edge.addEventListener('pointerup', up); edge.addEventListener('pointercancel', up);
  });
  fold.addEventListener('click', e => { e.preventDefault(); folded = !folded; remember(); apply(); });
  return {
    get folded(){ return folded; },
    show(on){ dock.hidden = !on; apply(); },
  };
}
