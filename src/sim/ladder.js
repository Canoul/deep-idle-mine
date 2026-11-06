/* Qui pose l'échelle (06/11/2026, Geoffrey) : quand plusieurs mineurs doivent poser une échelle sur la même case, c'est
   le plus rapide à monter qui la pose (temps par case d'échelle : Échelle de 2 du logisticien, Glyphe), pas le premier
   arrivé. Celui qui posait déjà et qui est moins rapide s'arrête ; à vitesse égale, le premier garde la main.
   Règle commune à TOUS les modes (mine, raid, instances, tours, et les suivants) : appeler ladderTurn avant de lancer
   une pose. G.miners : les mineurs de la partie ; une pose en cours : m.action.type === 'ladder' sur la case du mineur. */
import { ladderTime } from './mineur.js';

/* secondes par case d'échelle (l'Échelle de 2 en pose deux d'un coup) */
export const ladderCellTime = m => ladderTime(m) * (m.skill?.tall_ladder ? 0.5 : 1);
/* a pose mieux que b : plus rapide (strictement) */
export const betterLadder = (a, b) => ladderCellTime(a) < ladderCellTime(b) - 1e-9;

const placing = (o, x, y) => o.action?.type === 'ladder' && o.x === x && o.y === y && !o.dead && o.left == null;

/* m veut poser une échelle en (x, y) : 'go' (il la pose ; les poseurs moins rapides de cette case s'arrêtent) ou 'wait'
   (un autre aussi rapide ou plus rapide la pose déjà) */
export function ladderTurn(G, m, x = m.x, y = m.y){
  const rivals = (G.miners || []).filter(o => o !== m && placing(o, x, y));
  if(rivals.some(o => !betterLadder(m, o))) return 'wait';
  for(const o of rivals){ o.action = null; o.status = `Laisse ${m.name} poser l'échelle`; }
  return 'go';
}
