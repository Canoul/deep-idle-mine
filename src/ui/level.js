/* Niveau du mineur (carte du lobby et stats de l'onglet Stuff) : niveau, barre d'XP (pourcentage et XP / XP requise),
   points de skill. Lit l'état envoyé par le serveur. */
const fmtN = n => Math.round(n).toLocaleString('fr-FR');

/* progress : { xp, level, into, need, talentPoints } (server/game/service.js) */
export function renderLevel(el, progress){
  if(!el) return;
  if(!progress){ el.innerHTML = '<span class="mut">—</span>'; return; }
  const { level, into, need, talentPoints, xp } = progress;
  const pct = need ? Math.min(100, into / need * 100) : 100;
  /* au niveau max, il n'y a plus d'XP à gagner : pas de « x / 0 XP » */
  const prog = need ? `<b>${Math.floor(pct)} %</b> · ${fmtN(into)} / ${fmtN(need)} XP` : 'Niveau max';
  el.innerHTML = `<div class="row"><b class="lvl">Niveau ${level}</b><span class="mut">${prog}</span></div>`+
    `<div class="bar"><i style="width:${pct}%;background:var(--o2)"></i></div>`+
    `<div class="row small" style="margin-top:6px"><span class="mut">XP totale ${fmtN(xp)}</span>`+
    `<span>${talentPoints} point${talentPoints > 1 ? 's' : ''} de skill</span></div>`;
}

/* texte de montée de niveau entre deux états (null s'il n'y en a pas) */
export function levelUpText(before, after){
  if(!before || !after || after.level <= before.level) return null;
  const n = after.level - before.level, pts = after.talentPoints - before.talentPoints;
  return `Niveau ${after.level} atteint${n > 1 ? ` (+${n} niveaux)` : ''} ! +${pts} point${pts > 1 ? 's' : ''} de skill (onglet Skills)`;
}
