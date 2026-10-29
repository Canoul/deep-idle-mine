/* Butin de la prison (29/10/2026, Geoffrey) : ce que les runs versés ont rapporté depuis l'entrée en prison (totals de
   publicPrison, calculés par le serveur). Le panneau « Butin de la prison » de la vue de la prison, et la fenêtre
   montrée en sortant de prison (la même chose figure ensuite dans l'Historique). */
import { icon } from './craft.js';
import { rname } from './rarity.js';
import { prisonTotalsLine } from './prison.js';

const $ = id => document.getElementById(id);
const num = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* objets du butin, les plus nombreux d'abord */
const itemsHtml = bag => {
  const items = Object.entries(bag || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  return items.length ? `<div class="lootList">${items.map(([k, n]) => `<div class="lootRow">${icon(k)}${rname(k)}<b>× ${num(n)}</b></div>`).join('')}</div>`
                      : '<p class="mut small">Rien pour l\'instant : le butin arrive à la fin de chaque run.</p>';
};

/* contenu du panneau, pendant la prison ; live : secondes de jeu du run en cours (compteur de temps) */
export const prisonLootHtml = (t, live = 0) => `<div class="row"><span class="mut small">${prisonTotalsLine(t, live)}</span></div>${itemsHtml(t?.bag)}`;

/* fenêtre de sortie : tout ce que la prison a rapporté (onClose : à la fermeture) */
export function showPrisonRecap(p, onClose){
  const t = p?.totals, box = $('loot');
  if(!t || !box) return;
  box.querySelector('.box').innerHTML = `<h3>⛓ Sortie de prison</h3>`+
    `<p>${prisonTotalsLine(t)}</p>${itemsHtml(t.bag)}`+
    `<p class="mut small">Tout est déjà dans ton inventaire. Ce bilan reste dans l'Historique.</p>`+
    `<p style="text-align:right"><button class="on" id="prisonRecapOk">OK</button></p>`;
  box.hidden = false;
  $('prisonRecapOk').onclick = () => { box.hidden = true; onClose?.(); };
}
