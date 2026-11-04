/* Raid 1 : Cerbère (04/11/2026, Geoffrey ; spec docs/superpowers/specs/2026-11-04-raid-cerbere-design.md) : règles
   partagées par le jeu et le serveur (logique pure). RAID (src/config.js).
   - mode de session 'raid' : lancé seulement depuis le lobby de raid de la guilde (server/guild/raid.js), jamais depuis
     le lobby normal (pas dans MINE_MODES) ;
   - durée réelle de la session (RAID.duration de temps de jeu, à la vitesse du serveur) ;
   - construction et rejeu de la partie depuis l'enregistrement du serveur (seed, joueurs, stuff, skills, sorts, départs),
     comme une instance (src/shared/instances.js). */
import { RAID, GAME } from '../config.js';
import { instanceSpecs } from './instances.js';
import { groupRings } from './game.js';
import { newRaid, tickRaid, leaveRaid, endRaid, RAID_TICKS } from '../sim/raid/session.js';

export const RAID_MODE = 'raid';
export const isRaidMode = mode => mode === RAID_MODE;
export const raidDurationMs = (speed = GAME.speed) => RAID.duration / speed * 1000;
export { RAID_TICKS };

/* groupe d'un joueur du raid : 1..RAID.groups, sinon null */
export const cleanGroup = g => Number.isInteger(g) && g >= 1 && g <= RAID.groups ? g : null;
/* groupes valides : chacun au plus RAID.groupSize joueurs */
export const groupsOk = players => { const n = {}; for(const p of players){ const g = cleanGroup(p.group); if(g == null) return false; n[g] = (n[g] || 0) + 1; }
  return Object.values(n).every(k => k <= RAID.groupSize); };

/* mineurs : un par joueur, stuff, skills et sorts figés au lancement (comme une instance). 2 groupes (04/11) : chaque
   mineur porte son groupe (m.group) et les anneaux ne vont qu'aux membres de son groupe ; un raid sans groupes
   (enregistré avant) : un seul groupe, comme avant */
export function raidSpecs(record){
  const players = record.players || [];
  if(!players.some(p => cleanGroup(p.group) != null)) return instanceSpecs({ ...record, raidMode: true });   // Mineur tout terrain (04/11)
  const gOf = p => cleanGroup(p.group) ?? 1, cache = {};
  return players.map((p, i) => {
    const g = gOf(p);
    cache[g] ??= instanceSpecs({ ...record, raidMode: true, rings: groupRings({ ...record, players: players.filter(q => gOf(q) === g) }) });
    return { ...cache[g][i], group: g };
  });
}
export const buildRaid = record => newRaid(record.seed, { miners: raidSpecs(record), id: record.id });
export { tickRaid };
export const endRaidNow = G => endRaid(G, false);

/* départs dont le moment est venu ; renvoie le nombre appliqué (leaveRaid est idempotent) */
export function applyDueRaidLeaves(G, record){
  let n = 0;
  for(const l of record.leaves || [])
    if(l.tick <= G.ticks && !G.gone.has(l.account) && G.mine.roster.some(m => m.account === l.account) && leaveRaid(G, l.account)) n++;
  return n;
}
