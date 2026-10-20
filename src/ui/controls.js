/* Contrôles de la session en cours : vitesse et pause (mode développeur seulement), quitter, mineur suivi.
   La partie tourne sur le serveur : en jeu normal, elle avance au rythme du temps réel (GAME.speed), même page
   fermée ; en dev, la vitesse et la pause sont demandées au serveur (h.onClock). */
const $ = id => document.getElementById(id);

/* ui : état de l'interface ({ speed, paused, focus }) ; h : { onLeave(), onClock({ speed?, paused? }) } */
export function setupRunControls(ui, h){
  $('pauseBtn').onclick = () => h.onClock({ paused: !ui.paused });
  $('leaveBtn').onclick = () => h.onLeave();
  // clic sur un mineur de l'équipe : la caméra le suit
  $('teamBody').onclick = e => { const r = e.target.closest('[data-i]'); if(r) ui.focus = +r.dataset.i; };
}

/* boutons de vitesse : en dev, toutes les vitesses (onSpeed : demandée au serveur) ; en normal, l'unique vitesse
   affichée pour information. À rappeler quand le serveur annonce une autre vitesse ou la pause. */
export function renderSpeeds(ui, info, onSpeed){
  $('pauseBtn').textContent = ui.paused ? '▶ Reprendre' : '⏸ Pause';
  const box = $('speedBtns');
  box.innerHTML = '';
  $('pauseBtn').hidden = !info.dev;
  if(!info.dev){ box.innerHTML = `<span class="mut">Vitesse ×${info.speed}</span>`; return; }
  for(const s of info.speeds){
    const b = document.createElement('button'); b.textContent = 'x'+s; b.dataset.s = s; if(s === ui.speed) b.className = 'on';
    b.onclick = () => onSpeed?.(s);
    box.appendChild(b);
  }
}
