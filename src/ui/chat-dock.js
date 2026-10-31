/* Chat global permanent (31/10/2026, Geoffrey) : à gauche et en bas de l'écran, quel que soit l'onglet. Hauteur réglable
   en tirant sa barre du haut (CHAT.dock : part de la hauteur de l'écran), repliable ; les deux sont gardés dans ce
   navigateur. Petit écran : replié au départ, il recouvrirait le contenu. */
import { CHAT } from '../config.js';

const KEY = 'deepIdleMine.chatDock';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };

/* part de l'écran permise ; une valeur illisible redonne la hauteur de départ */
export function dockShare(v){
  return Number.isFinite(v) ? Math.min(CHAT.dock.max, Math.max(CHAT.dock.min, v)) : CHAT.dock.share;
}

/* onChange() : hauteur ou pliage changé (le chat se remet sur les derniers messages, relit s'il vient d'être déplié) */
export function setupChatDock({ dock, grip, fold, onChange = () => {} }){
  const saved = load();
  let share = dockShare(saved.share), folded = typeof saved.folded === 'boolean' ? saved.folded : innerWidth <= 1170;
  const remember = () => save({ share, folded });
  function apply(){
    document.documentElement.style.setProperty('--chat-h', `${share * 100}dvh`);
    dock.classList.toggle('folded', folded);
    fold.textContent = folded ? '+' : '–';
    document.body.classList.toggle('chatOn', !dock.hidden && !folded);
    onChange();
  }
  grip.addEventListener('pointerdown', e => {
    if(folded) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    const move = ev => { share = dockShare((innerHeight - ev.clientY) / innerHeight); apply(); };
    const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); remember(); };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
  });
  fold.addEventListener('click', e => { e.preventDefault(); folded = !folded; remember(); apply(); });
  return {
    get folded(){ return folded; },
    show(on){ dock.hidden = !on; apply(); },
  };
}
