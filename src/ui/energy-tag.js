/* Énergie affichée à côté d'un joueur (31/10/2026) : Social, panneaux Équipe de la session (mine, tours, instances). */
import { ENERGY } from '../config.js';

/* « ⚡ 42/100 », en rouge s'il ne peut plus lancer de mine classique ; rien si inconnue. sep : ce qui suit le texte */
export function energyHTML(e, sep = ' · '){
  if(!Number.isFinite(e?.value)) return '';
  const low = e.value < ENERGY.cost.min;
  return `<span class="fenergy${low ? ' low' : ''}" title="${low ? 'Pas assez d\'énergie pour lancer une mine classique' : 'Énergie'}">⚡ ${e.value}/${e.max}</span>${sep}`;
}

/* énergies du groupe de la session : { compte: { value, max } }, reçues avec chaque vue (server/game/service.js, view) */
let team = {};
export const setTeamEnergies = e => { team = e && typeof e === 'object' ? e : {}; };
export const teamEnergyHTML = (account, sep = '') => energyHTML(team[account], sep);
