/* Instances : règles partagées par le jeu et le serveur (logique pure). INSTANCE (src/config.js).
   - modes de lancement : les id de INSTANCE.list ('instance_1'…), présents dans MINE_MODES (instance: true) ;
   - clé d'une instance (une par joueur, consommée au lancement), durée ;
   - construction et rejeu de la partie depuis l'enregistrement du serveur (seed, joueurs, stuff, skills, sorts,
     départs), comme les tours. */
import { INSTANCE, GAME } from '../config.js';
import { minerSpecs } from './game.js';
import { newInstance, leaveInstance, INSTANCE_TICKS, INSTANCE_LEVELS, instanceLevel } from '../sim/instance/session.js';
import { countOf } from '../meta/inventory.js';

export const instanceDef = mode => INSTANCE.list.find(i => i.id === mode) ?? null;
export const isInstanceMode = mode => !!instanceDef(mode);
export const instanceDurationMs = (speed = GAME.speed) => INSTANCE.duration / speed * 1000;
export { INSTANCE_TICKS, INSTANCE_LEVELS, instanceLevel };

/* qui n'a pas sa clé : players [{ account, name }], invOf(compte) → inventaire ; renvoie les joueurs sans clé */
export function missingKeys(mode, players, invOf){
  const key = instanceDef(mode)?.key;
  return key ? players.filter(p => countOf(invOf(p.account), key) < 1) : players;
}

/* mineurs : un par joueur, stuff, skills et sorts figés au lancement (comme une tour) */
export function instanceSpecs(record){
  const players = record.players || [];
  return minerSpecs(record).map((s, i) => ({ ...s, account: players[i]?.account ?? null }));
}
export const buildInstanceGame = record => newInstance(record.seed, { miners: instanceSpecs(record), id: record.id, instance: record.mode, level: record.level });   // niveau (29/10) : 1 par défaut

/* départs dont le moment est venu ; renvoie le nombre appliqué */
export function applyDueInstanceLeaves(G, record){
  let n = 0;
  for(const l of record.leaves || [])
    if(l.tick <= G.ticks && G.miners.some(m => m.account === l.account) && leaveInstance(G, l.account)) n++;
  return n;
}
