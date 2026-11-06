/* Mine géante (5 joueurs) (06/11/2026, Geoffrey ; config GEANTE) : règles partagées par le jeu et le serveur. */
import { GEANTE, GAME, MINE_MODES } from '../config.js';
import { dayOf } from './giant.js';

export const isGeante = mode => mode === GEANTE.mode;
/* places du lobby pour cette activité : 5 pour la Mine géante, sinon GAME.maxPlayers */
export const maxPlayersOf = mode => MINE_MODES.find(m => m.id === mode)?.players ?? GAME.maxPlayers;
/* lancements de Mine géante de ce joueur aujourd'hui (jour de Paris), parmi ses sessions [{ mode, startedAt }] */
export const geanteToday = (sessions, now) => (sessions || []).filter(s => isGeante(s?.mode) && Number.isFinite(s.startedAt)
  && dayOf(s.startedAt) === dayOf(now)).length;
export const geanteLeft = (sessions, now) => Math.max(0, GEANTE.perDay - geanteToday(sessions, now));
