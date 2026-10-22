/* Tours de l'Ange et du Démon : règles partagées par le jeu et le serveur (logique pure).
   - mode de lancement : 'tower_angel' / 'tower_demon' (MINE_MODES) → camp 'angel' / 'demon' ;
   - construction et rejeu de la partie depuis l'enregistrement du serveur (seed, joueurs, stuff, skills, départs). */
import { MINE_MODES, TOWER } from '../config.js';
import { minerSpecs } from './game.js';
import { newTower, leaveTower, TOWER_TICKS } from '../sim/tower/session.js';

/* camp d'un mode de lancement ('tower_angel' → 'angel'), null si ce n'est pas une tour */
export const towerSide = mode => MINE_MODES.find(m => m.id === mode)?.tower ?? null;
export const isTowerMode = mode => !!towerSide(mode);
/* durée réelle d'une tour (ms) à la vitesse speed */
export const towerDurationMs = speed => TOWER.duration / speed * 1000;
export { TOWER_TICKS };

/* mineurs : un par joueur, stuff (qualité, niveau, rune) et skills figés au lancement, comme une session normale */
export function towerSpecs(record){
  const players = record.players || [];
  return minerSpecs({ ...record, bots: 0 }).map((s, i) => ({ ...s, account: players[i]?.account ?? null }));
}

export const buildTower = record => newTower(record.seed, { side: towerSide(record.mode), miners: towerSpecs(record), id: record.id });

/* départs dont le moment est venu ; renvoie le nombre appliqué */
export function applyDueTowerLeaves(G, record){
  let n = 0;
  for(const l of record.leaves || [])
    if(l.tick <= G.ticks && G.miners.some(m => m.account === l.account) && leaveTower(G, l.account)) n++;
  return n;
}
