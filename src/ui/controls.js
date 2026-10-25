/* Contrôles de la session en cours : vitesse et pause (mode développeur seulement), quitter, mineur suivi.
   La partie tourne sur le serveur : en jeu normal, elle avance au rythme du temps réel (GAME.speed), même page
   fermée ; en dev, la vitesse et la pause sont demandées au serveur (h.onClock). */
import { CAMERA } from '../config.js';

const $ = id => document.getElementById(id);

/* ui : état de l'interface ({ speed, paused, follow }) ; h : { onLeave(), onClock({ speed?, paused? }), onFollow(id) } */
export function setupRunControls(ui, h){
  for(const b of document.querySelectorAll('.pauseBtn')) b.onclick = () => h.onClock({ paused: !ui.paused });
  $('leaveBtn').onclick = () => h.onLeave();
  /* appui sur un mineur de l'équipe : la caméra le suit. Sur l'appui et pas sur le clic : la liste est redessinée
     plusieurs fois par seconde, et un clic dont l'appui et le relâchement tombent sur deux versions de la liste
     était perdu (le bouton « suivre » ne marchait qu'une fois sur deux) */
  $('teamBody').onpointerdown = e => { const r = e.target.closest('[data-id]'); if(r && e.button === 0) h.onFollow(+r.dataset.id); };
}

/* Se déplacer dans la mine : molette, glisser (souris ou doigt), flèches ↑ ↓ et PageUp / PageDown.
   La caméra ne suit plus personne ; « Suivre » (ou Début, ou un mineur de l'équipe) la ramène.
   cam : { pan(rows), panPixels(px), follow() } (le rendu) ; isActive() : la session est affichée */
export function setupCamera(cv, cam, isActive){
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const rows = e.deltaMode === 1 ? e.deltaY : e.deltaMode === 2 ? e.deltaY * 30 : e.deltaY / 100;   // lignes, pages ou pixels
    cam.pan(rows * CAMERA.wheelRows);
  }, { passive:false });
  let drag = null;
  cv.addEventListener('pointerdown', e => {
    if(e.button !== 0) return;
    drag = { id:e.pointerId, y:e.clientY }; cv.setPointerCapture(e.pointerId); cv.classList.add('dragging');
  });
  cv.addEventListener('pointermove', e => {
    if(!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y; drag.y = e.clientY;
    if(dy) cam.panPixels(dy);
  });
  const end = e => { if(drag && e.pointerId === drag.id){ drag = null; cv.classList.remove('dragging'); } };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  document.addEventListener('keydown', e => {
    if(!isActive() || e.target.closest?.('input, textarea, select')) return;
    const rows = { ArrowUp:-1, ArrowDown:1, PageUp:-3, PageDown:3 }[e.key];
    if(rows){ e.preventDefault(); cam.pan(rows * CAMERA.keyRows); }
    else if(e.key === 'Home'){ e.preventDefault(); cam.follow(); }
  });
  $('followBtn').onclick = () => cam.follow();
}

/* boutons de vitesse : en dev, toutes les vitesses (onSpeed : demandée au serveur) ; en normal, l'unique vitesse
   affichée pour information. À rappeler quand le serveur annonce une autre vitesse ou la pause. */
/* boutons de vitesse et pause : la barre de la mine et celle de la tour (25/10 : la tour n'en avait pas en dev) */
export function renderSpeeds(ui, info, onSpeed){
  for(const p of document.querySelectorAll('.pauseBtn')){ p.textContent = ui.paused ? '▶ Reprendre' : '⏸ Pause'; p.hidden = !info.dev; }
  for(const box of document.querySelectorAll('.speedBtns')){
    box.innerHTML = '';
    if(!info.dev){ box.innerHTML = `<span class="mut">Vitesse ×${info.speed}</span>`; continue; }
    for(const s of info.speeds){
      const b = document.createElement('button'); b.textContent = 'x'+s; b.dataset.s = s; if(s === ui.speed) b.className = 'on';
      b.onclick = () => onSpeed?.(s);
      box.appendChild(b);
    }
  }
}
