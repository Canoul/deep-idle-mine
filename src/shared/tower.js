/* Tours de l'Ange et du Démon : règles partagées par le jeu et le serveur (logique pure).
   - mode de lancement : 'tower_angel' / 'tower_demon' (MINE_MODES) → camp 'angel' / 'demon' ;
   - construction et rejeu de la partie depuis l'enregistrement du serveur (seed, joueurs, stuff, skills, départs). */
import { MINE_MODES, TOWER, BLOCKS } from '../config.js';
import { minerSpecs } from './game.js';
import { newTower, leaveTower, TOWER_TICKS, TOWER_LEVELS, towerLevel } from '../sim/tower/session.js';

/* camp d'un mode de lancement ('tower_angel' → 'angel'), null si ce n'est pas une tour */
export const towerSide = mode => MINE_MODES.find(m => m.id === mode)?.tower ?? null;
export const isTowerMode = mode => !!towerSide(mode);
/* durée réelle d'une tour (ms) à la vitesse speed */
export const towerDurationMs = speed => TOWER.duration / speed * 1000;
export { TOWER_TICKS, TOWER_LEVELS, towerLevel };

/* mineurs : un par joueur, stuff (qualité, niveau, rune) et skills figés au lancement, comme une session normale ; les
   mineurs de test (mode dev seulement : le serveur met bots à 0 sinon) viennent ensuite, sans compte (25/10) */
export function towerSpecs(record){
  const players = record.players || [];
  return minerSpecs(record).map((s, i) => ({ ...s, account: players[i]?.account ?? null }));
}

export const buildTower = record => newTower(record.seed, { side: towerSide(record.mode), level: towerLevel(record.level), miners: towerSpecs(record), id: record.id });

/* départs dont le moment est venu ; renvoie le nombre appliqué */
export function applyDueTowerLeaves(G, record){
  let n = 0;
  for(const l of record.leaves || [])
    if(l.tick <= G.ticks && G.miners.some(m => m.account === l.account) && leaveTower(G, l.account)) n++;
  return n;
}

/* butin d'une tour réussie (pods, 26/10/2026) : loot = { objet: quantité } de la partie (coffre + sacs des présents),
   partagé en n parts égales ; le reste de chaque objet va à des joueurs tirés au hasard (random dans [0, 1[ : le
   serveur), un de plus chacun. La somme des parts = loot (rien de créé). Seule la stonebrick de la tour (side) est
   acceptée, en quantité entière de 1 à TOWER.chest.max ; le reste est ignoré. */
export function splitTowerLoot(loot, n, side, random = Math.random){
  const parts = Array.from({ length: Math.max(0, n | 0) }, () => ({}));
  if(!parts.length) return parts;
  const brick = BLOCKS[TOWER.sides[side]?.brick]?.name;
  for(const [item, q] of Object.entries(loot || {})){
    if(item !== brick || !Number.isSafeInteger(q) || q <= 0 || q > TOWER.chest.max) continue;
    const base = Math.floor(q / parts.length), extra = q - base * parts.length;
    const order = parts.map((_, i) => i);
    for(let i = order.length - 1; i > 0; i--){ const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    order.forEach((k, i) => { const v = base + (i < extra ? 1 : 0); if(v) parts[k][item] = v; });
  }
  return parts;
}
