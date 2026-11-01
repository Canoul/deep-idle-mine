/* Raffle (31/10/2026, Geoffrey) : tirage au sort annoncé dans le chat global. Ici, la logique pure : créneau horaire, prochain
   raffle, tirage du lot, état enregistré. Le déroulé est dans server/social/raffle.js. */
import { RAFFLE, UPGRADE } from '../config.js';
import { rollChestQuality } from '../meta/piece.js';

const hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone: RAFFLE.timeZone, hour: 'numeric', hourCycle: 'h23' });
/* heure de t (ms) dans le fuseau du jeu, de 0 à 23 */
export const localHour = t => +hourFormat.format(t);
/* un raffle peut-il partir à l'instant t ? (de openHour à closeHour, à cheval sur minuit) */
export function raffleOpen(t){
  const h = localHour(t);
  return h >= RAFFLE.openHour || h < RAFFLE.closeHour;
}
/* heure du prochain raffle ; tombée dans le créneau fermé : un moment au hasard après la réouverture */
export function nextRaffleAt(now, random){
  let t = now + RAFFLE.everyMin + random() * (RAFFLE.everyMax - RAFFLE.everyMin);
  if(raffleOpen(t)) return t;
  while(!raffleOpen(t)) t += 60e3;        // minute par minute : juste aussi les jours de changement d'heure
  return t + random() * RAFFLE.lateMax;
}

/* lot tiré dans RAFFLE.lots ; une rune reçoit sa qualité tout de suite (chances de l'identification), pour être annoncée */
export function rollLot(random){
  let r = random(), lot = RAFFLE.lots.at(-1);
  for(const l of RAFFLE.lots){ if(r < l.chance){ lot = l; break; } r -= l.chance; }
  const { chance: _chance, ...out } = lot;
  return out.rune ? { ...out, q: rollChestQuality(random) } : out;
}
/* « 100 Chitine », « 10 énergie », « 1 Rune R5 » */
export const lotLabel = lot => lot.energy ? `${lot.energy} énergie` : lot.rune ? `1 ${lot.rune} R${lot.q}` : `${lot.qty} ${lot.item}`;
export const lotPlural = lot => !lot.rune && (lot.energy ?? lot.qty) > 1;

/* !join, tel que le joueur l'a tapé (espaces et majuscules ignorés) */
export const isRaffleJoin = text => typeof text === 'string' && text.trim().toLowerCase() === RAFFLE.command;

const validLot = lot => !!lot && RAFFLE.lots.some(l => l.item === lot.item && l.qty === lot.qty && l.energy === lot.energy && l.rune === lot.rune)
  && (!lot.rune || UPGRADE.qualities.some(d => d.q === lot.q));
/* état enregistré, relu et revérifié : { nextAt, current: null | { id, lot, endsAt, players:[{ id, name }], winner? } } */
export function sanitizeRaffle(raw){
  const c = raw?.current;
  const ok = c && typeof c.id === 'string' && Number.isFinite(c.endsAt) && validLot(c.lot) && Array.isArray(c.players);
  const seen = new Set();
  const players = ok ? c.players.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && !seen.has(p.id) && seen.add(p.id)) : [];
  return { nextAt: Number.isFinite(raw?.nextAt) ? raw.nextAt : null,
           current: ok ? { id: c.id, lot: c.lot, endsAt: c.endsAt, players, ...(players.some(p => p.id === c.winner?.id) ? { winner: c.winner } : {}) } : null };
}
