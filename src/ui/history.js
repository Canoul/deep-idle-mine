/* Onglet Historique : les sessions terminées du joueur (le serveur les garde 30 jours), la plus récente en haut.
   Pour chacune : date, durée, joueurs, seed (pour la rejouer ou signaler un bug), areas, profondeur, et SA part du butin
   (rien s'il est parti avant la fin). Lecture seule : load() demande la liste au serveur. */
import { icon } from './craft.js';
import { rname } from './rarity.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const two = n => String(n).padStart(2, '0');
export const when = ms => { const d = new Date(ms); return `${two(d.getDate())}/${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`; };
export const lasted = (a, b) => (a && b) ? `${Math.max(1, Math.round((b - a) / 60000))} min` : '';

/* une session : HTML de sa carte */
export function sessionCard(s){
  const items = Object.entries(s.bag || {});
  const loot = s.left ? '<span class="err">Parti avant la fin : rien reçu</span>'
    : items.length ? items.map(([k, q]) => `<span class="hItem">${icon(k)}<b>${num(q)}</b> ${rname(k)}</span>`).join('')
    : '<span class="mut">Rien rapporté</span>';
  return `<div class="hCard"><div class="hTop"><b>${when(s.startedAt)}</b>`+
    `<span class="mut small">${esc(lasted(s.startedAt, s.endedAt))}${s.dev ? ' · dev' : ''} · ${s.players.length > 1 ? esc(s.players.join(', ')) : 'solo'}</span>`+
    `<span class="hSeed" title="Seed de la session">🌱 ${esc(s.seed)}</span></div>`+
    /* prison (29/10) : ses runs, son area et l'énergie gagnée */
    (s.prison ? `<div class="mut small">⛓ Prison · area ${esc(s.prison.area ?? '?')} · ${s.prison.runs} run${s.prison.runs > 1 ? 's' : ''} · +${num(Math.round(s.prison.energy))} ⚡</div>` : '')+
    `<div class="mut small">${s.areas != null ? `${s.areas} area${s.areas > 1 ? 's' : ''} débloquée${s.areas > 1 ? 's' : ''}` : ''}`+
    `${s.depth != null ? ` · profondeur ${s.depth}` : ''}${s.xp ? ` · +${num(s.xp)} XP` : ''}</div>`+
    `<div class="hLoot">${loot}</div></div>`;
}

/* load() → promesse de { sessions } */
export function setupHistory({ load }){
  let busy = false;
  async function refresh(){
    if(busy) return;
    busy = true;
    try {
      const { sessions } = await load();
      $('histBody').innerHTML = sessions.length ? sessions.map(sessionCard).join('')
        : '<p class="mut">Aucune session terminée pour l\'instant.</p>';
    } catch(e){ $('histBody').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    finally { busy = false; }
  }
  return { refresh };
}
