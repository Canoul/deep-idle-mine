/* Niveau requis par une activité (03/11/2026, Geoffrey ; MINE_MODES[].minLevel) : Mine instantanée niveau 3, Bloc géant
   et He's coming niveau 10. Logique pure, partagée par le lobby (activité scellée, cadenas) et le serveur (refus). */
import { MINE_MODES } from '../config.js';

/* niveau requis par ce mode, ou 0 */
export const minLevelOf = mode => MINE_MODES.find(m => m.id === mode)?.minLevel ?? 0;
/* niveau requis s'il manque au joueur, sinon 0 ; niveau inconnu (pas encore reçu du serveur) : rien de scellé */
export const sealedBelow = (mode, level) => Number.isFinite(level) && level < minLevelOf(mode) ? minLevelOf(mode) : 0;
/* texte du refus (serveur) et de la bulle (lobby) */
export const levelLockText = (mode, level) => `Niveau ${minLevelOf(mode)} requis${Number.isFinite(level) ? ` (tu es niveau ${level})` : ''}.`;
