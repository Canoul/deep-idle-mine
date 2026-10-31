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

/* bord gauche de l'interface centrale de l'onglet ouvert : la mine en session, sinon ses cartes, sinon son contenu */
function centralLeft(){
  const seen = el => el.getClientRects().length > 0, left = el => el.getBoundingClientRect().left;
  const view = document.querySelector('.view:not([hidden])');
  if(!view) return Infinity;
  const canvas = [...view.querySelectorAll('#cvWrap, #cvMiWrap, #cvTwWrap, #cvGtWrap, #cvInWrap')].find(seen);
  if(canvas) return left(canvas);
  const cards = [...view.querySelectorAll('.card')].filter(seen).map(left);
  if(cards.length) return Math.min(...cards);
  const wrap = view.querySelector('.invWrap, .furnWrap') ?? view;
  return left(wrap) + (parseFloat(getComputedStyle(wrap).paddingLeft) || 0);
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
    for(const el of document.querySelectorAll('#views, #lobbyMenu, #lobbyStage, #run, #miRun, #twRun, #gtRun, #inRun')) ro.observe(el);
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
