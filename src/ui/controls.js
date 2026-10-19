/* Contrôles de la session en cours : vitesse et pause (mode développeur seulement), quitter, mineur suivi.
   En jeu normal, la vitesse est fixée par le serveur (GAME.speed) et la session ne se met pas en pause :
   elle avance au rythme du temps réel, même page fermée. */
const $ = id => document.getElementById(id);

/* ui : état de l'interface ({ speed, paused, focus }) ; h : { onLeave() } */
export function setupRunControls(ui, h){
  $('pauseBtn').onclick = () => { ui.paused = !ui.paused; $('pauseBtn').textContent = ui.paused ? '▶ Reprendre' : '⏸ Pause'; };
  $('leaveBtn').onclick = () => h.onLeave();
  // clic sur un mineur de l'équipe : la caméra le suit
  $('teamBody').onclick = e => { const r = e.target.closest('[data-i]'); if(r) ui.focus = +r.dataset.i; };
}

/* boutons de vitesse : en dev, toutes les vitesses ; en normal, l'unique vitesse affichée pour information */
export function renderSpeeds(ui, info){
  const box = $('speedBtns');
  box.innerHTML = '';
  $('pauseBtn').hidden = !info.dev;
  if(!info.dev){ box.innerHTML = `<span class="mut">Vitesse ×${info.speed}</span>`; return; }
  for(const s of info.speeds){
    const b = document.createElement('button'); b.textContent = 'x'+s; b.dataset.s = s; if(s === ui.speed) b.className = 'on';
    b.onclick = () => { ui.speed = s; box.querySelectorAll('button').forEach(x => x.className = (+x.dataset.s === s) ? 'on' : ''); };
    box.appendChild(b);
  }
}
