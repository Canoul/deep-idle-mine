/* Bandeau « Événement du jour » du Lobby (05/11/2026, Geoffrey ; DAILY, src/shared/daily.js). Le serveur l'envoie avec les
   jauges du Jugement (GET /api/game/judgment, champ daily : { id, name, icon, desc, endsAt } ou null). */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* « 5 h 12 » / « 12 min » avant la fin */
export function dailyLeft(ms){
  const m = Math.max(1, Math.ceil(ms / 60e3)), h = Math.floor(m / 60);
  return h ? `${h} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}
/* HTML du bandeau ('' sans événement) */
export function dailyBannerHtml(d, now){
  if(!d?.name) return '';
  return `<span class="dIcon">${esc(d.icon)}</span><span class="dText"><b>Événement du jour : ${esc(d.name)}</b><br>`+
    `<span>${esc(d.desc)}</span></span><span class="dLeft mut small">encore ${dailyLeft(d.endsAt - now)}</span>`;
}
export function renderDaily(el, d, now){
  if(!el) return;
  const html = dailyBannerHtml(d, now);
  el.hidden = !html;
  if(el.innerHTML !== html) el.innerHTML = html;
}
