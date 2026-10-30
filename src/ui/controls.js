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
   Zoomer (30/10) : pincer à deux doigts, ou Ctrl + molette (et pincer sur un pavé tactile) ; zoomée, on glisse aussi
   à l'horizontale. Double appui / double clic : retour au zoom ×1.
   La caméra ne suit plus personne quand on la glisse ; « Suivre » (ou Début, ou un mineur de l'équipe) la ramène.
   cam : { pan(rows), panPixels(dy, dx), zoomAt(f, x, y), follow() } (le rendu) ; isActive() : la session est affichée */
export function setupCamera(cv, cam, isActive){
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    if(e.ctrlKey){ cam.zoomAt(Math.exp(-e.deltaY * CAMERA.wheelZoom * (e.deltaMode === 1 ? 30 : 1)), e.clientX, e.clientY); return; }
    const rows = e.deltaMode === 1 ? e.deltaY : e.deltaMode === 2 ? e.deltaY * 30 : e.deltaY / 100;   // lignes, pages ou pixels
    cam.pan(rows * CAMERA.wheelRows);
  }, { passive:false });
  const pts = new Map();   // doigts (ou souris) posés : id → { x, y }
  let pinch = null;        // distance entre les deux doigts au dernier mouvement
  const two = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x)/2, y: (a.y + b.y)/2 }; };
  cv.addEventListener('pointerdown', e => {
    if(e.pointerType === 'mouse' && e.button !== 0) return;
    pts.set(e.pointerId, { x:e.clientX, y:e.clientY }); cv.setPointerCapture(e.pointerId); cv.classList.add('dragging');
    pinch = pts.size === 2 ? two() : null;
  });
  cv.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if(!p) return;
    if(pts.size >= 2){
      p.x = e.clientX; p.y = e.clientY;
      if(pts.size !== 2) return;
      const now = two();
      if(pinch && pinch.d > 0 && now.d > 0) cam.zoomAt(now.d / pinch.d, now.x, now.y);
      if(pinch) cam.panPixels(now.y - pinch.y, now.x - pinch.x);
      pinch = now; return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if(dx || dy) cam.panPixels(dy, dx);
  });
  const end = e => {
    if(!pts.delete(e.pointerId)) return;
    pinch = pts.size === 2 ? two() : null;
    if(!pts.size) cv.classList.remove('dragging');
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('dblclick', e => { e.preventDefault(); cam.zoomAt(0, e.clientX, e.clientY); });   // f = 0 : retour au ×1
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
