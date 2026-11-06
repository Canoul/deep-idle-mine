/* Raid 1 : Cerbère, la partie complète (04/11/2026, Geoffrey ; spec docs/superpowers/specs/2026-11-04-raid-cerbere-design.md).
   Trois phases, une seule horloge (RAID.duration de temps de jeu au total) :
     'mine'  : les areas (0,0) et (0,−1), une mine dans le noir (src/sim/session.js, opts.raid) où trouver les Indices
               cachés (RAID.mine.clues ; pods, oxygène, allers-retours comme la mine ; pas de mobs) ;
     'door'  : tous les Indices trouvés : les vivants se rassemblent devant la grande porte (RAID.mine.gather s) ;
     'boss'  : l'arène (1,−1), Cerbère (src/sim/raid/cerbere.js), avec le temps qui reste.
   G.mine / G.boss : la partie de la phase (null avant / après). Ce module ne fait qu'enchaîner : chaque phase garde ses règles. */
import { RAID, DT, BLOCKS, AREA_Y0, AREA_H, W } from '../../config.js';
import { newSession, tick as tickMine, leaveSession } from '../session.js';
import { newCerbere, tickCerbere, leaveCerbere, endCerbere } from './cerbere.js';

export const RAID_TICKS = Math.round(RAID.duration / DT);
export const isRaid = G => G?.mode === 'raid';

/* Indices encore à trouver (04/11, Geoffrey 14:48 : à la place de « tout miner ») */
export const cluesLeft = M => Math.max(0, RAID.mine.clues - (M.chest?.Indice || 0));   // rapportés au coffre
/* blocs de terrain encore dans les areas du raid (ancien objectif, gardé pour les essais) */
export function terrainLeft(M){
  let c = 0;
  for(let y = AREA_Y0; y < AREA_Y0 + RAID.mine.areas * AREA_H; y++) for(let x = 0; x < W; x++){
    const t = M.tiles[y]?.[x]; if(t && BLOCKS[t].type === 'terrain') c++;
  }
  return c;
}

/* opts.miners : specs (minerSpecs) ; opts.id ; opts.hp (essais) */
export function newRaid(seed, opts = {}){
  seed = seed ?? ((Math.random() * 2**31) | 0);
  const specs = opts.miners ?? [{}];
  const M = newSession(seed, { miners: specs, raid: true, id: opts.id });
  const G = { mode: 'raid', phase: 'mine', seed, id: M.id, t: 0, ticks: 0, over: false, specs, hp: opts.hp ?? null,
              mine: M, boss: null, doorAt: null, mineT: null, total: RAID.mine.clues, left: null, gone: new Set(), summary: null };
  G.left = G.total;
  return G;
}

export function tickRaid(G){
  if(G.over) return;
  G.ticks++; G.t = G.ticks * DT;
  if(G.phase === 'mine'){
    tickMine(G.mine);
    if(G.mine.over) return endRaid(G, false);                       // tout le monde est parti
    if(G.ticks % 10 === 0){ G.left = cluesLeft(G.mine); if(G.left === 0){ G.phase = 'door'; G.doorAt = G.t; G.mineT = G.t; } }
  } else if(G.phase === 'door'){
    if(G.t + 1e-9 >= G.doorAt + RAID.mine.gather) openArena(G);
  } else if(G.phase === 'boss'){
    tickCerbere(G.boss);
    if(G.boss.over) return endRaid(G, G.boss.summary.success);
  }
  if(!G.over && G.ticks >= RAID_TICKS){ if(G.boss) endCerbere(G.boss, false); endRaid(G, false); }
}

/* la grande porte s'ouvre : les mineurs encore là entrent dans l'arène, avec le temps qui reste */
function openArena(G){
  const here = G.specs.filter((s, i) => G.mine.roster[i] && G.mine.roster[i].left == null);
  G.boss = newCerbere(G.seed, { miners: here, id: G.id, hp: G.hp ?? undefined, ticks: Math.max(1, RAID_TICKS - G.ticks) });
  G.phase = 'boss';
  G.mine.over = true;                                               // la mine ne tourne plus
}

/* un joueur quitte : retiré de la phase en cours. Idempotent. */
export function leaveRaid(G, account){
  if(G.over || G.gone.has(account)) return false;
  G.gone.add(account);
  if(G.phase === 'boss') leaveCerbere(G.boss, account);
  else leaveSession(G.mine, account);
  if(G.phase !== 'boss' && G.mine.over && G.phase === 'mine') endRaid(G, false);
  return true;
}

export function endRaid(G, success){
  if(G.summary) return;
  G.over = true;
  const B = G.boss, roster = G.mine.roster;
  G.summary = {
    mode: 'raid', id: G.id, seed: G.seed, success: !!success, t: G.t, phase: G.phase, mineT: G.mineT,
    blocksLeft: G.left, blocksTotal: G.total, clues: true, bossHp: B ? Math.ceil(B.boss.hp) : null, bossMax: B ? B.boss.maxhp : null,
    deaths: B ? B.stats.deaths : 0, loot: {},
    shares: roster.map((m, i) => {
      const b = B?.roster.find(o => o.account != null && o.account === m.account) ?? (B && m.account == null ? B.roster[i] : null);
      return { miner: m.name, color: m.color, account: m.account, left: G.gone.has(m.account) || m.left != null, bag: {},
               stats: { mined: m.stats.mined || 0, clues: m.stats.clues || 0, bossDmg: Math.round(b?.stats.bossDmg || 0), bitten: b?.stats.bitten || 0,
                        stoned: b?.stats.stoned || 0, freed: b?.stats.freed || 0, dead: !!b?.dead } };
    }),
  };
}

export function runRaid(seed, opts = {}){
  const G = newRaid(seed, opts);
  while(!G.over) tickRaid(G);
  return G;
}
