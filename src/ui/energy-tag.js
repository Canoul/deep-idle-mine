/* Énergie affichée à côté d'un joueur (31/10/2026) : Social, panneaux Équipe de la session (mine, tours, instances), équipe du Lobby. */
import { ENERGY } from '../config.js';

/* « ⚡ 42/100 », en rouge s'il ne peut plus lancer de mine classique ; rien si inconnue. sep : ce qui suit le texte */
export function energyHTML(e, sep = ' · '){
  if(!Number.isFinite(e?.value)) return '';
  const low = e.value < ENERGY.cost.min;
  return `<span class="fenergy${low ? ' low' : ''}" title="${low ? 'Pas assez d\'énergie pour lancer une mine classique' : 'Énergie'}">⚡ ${e.value}/${e.max}</span>${sep}`;
}

/* jauge de l'équipe du Lobby (01/11/2026) : barre et « 42 / 100 », en rouge sous le coût d'une mine classique ; rien si inconnue */
export function energyGauge(e){
  if(!Number.isFinite(e?.value)) return '';
  const max = e.max || ENERGY.max, low = e.value < ENERGY.cost.min, v = Math.round(e.value);
  return `<span class="pslotEnergy${low ? ' low' : ''}" title="${low ? 'Pas assez d\'énergie pour lancer une mine classique' : 'Énergie'}">`+
         `<span class="bar"><i style="width:${Math.max(0, Math.min(100, e.value / max * 100))}%"></i></span><span>⚡ ${v} / ${max}</span></span>`;
}

/* énergies du groupe de la session : { compte: { value, max } }, reçues avec chaque vue (server/game/service.js, view) */
let team = {};
export const setTeamEnergies = e => { team = e && typeof e === 'object' ? e : {}; };
export const teamEnergyHTML = (account, sep = '') => energyHTML(team[account], sep);
