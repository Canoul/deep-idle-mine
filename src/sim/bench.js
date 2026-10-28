/* Bancs d'essai du GS expérimental (28/10/2026, Geoffrey ; branche geoffrey/gs-bancs, à titre d'expérience).
   Idée : GS = secondes de travail gagnées par heure de session, par groupe de stats, pondérées par le % du temps que les
   mineurs passent à faire ce que mesure le groupe en mine normale.
     GS groupe = part de temps × 3 600 × (rendement avec le stuff ÷ rendement de base − 1)
   Quatre bancs de BENCH.secs secondes, mineur seul, sans skills, toute la lumière (CFG.darkSlow neutralisé par l'appelant) :
   - Fight : un mannequin aux PV infinis, qui tacle, frappe toutes les MOBS.hitEvery s et repousse de BENCH.dummyKnock
     (le recul du mineur le repousse aussi, il revient) → dégâts faits. Mesure dégâts, vitesse d'attaque, double attaque,
     critique, portée, recul, résistance au recul. IA de combat complète (tick normal).
   - Mine : une mine géante de pierre, galerie en serpentin, sac et oxygène illimités → blocs cassés par seconde passée à
     miner (la marche a son banc), × secs (minage, minage %, coup unique, perçage).
   - Walk : un couloir plat, aller-retour → cases parcourues (marche).
   - Climb : un puits d'échelles, on remonte → cases montées (montée).
   Les trois derniers sont pilotés par un petit pilote (pas l'IA) qui fait avancer les actions comme la session. Logique
   pure, sans DOM. */
import { W, DT, IDS, MOBS, STATS } from '../config.js';
import { newSession, tick } from './session.js';
import { startAction } from './mineur.js';
import { stepDir, finishAction } from './actions.js';

export const BENCH = { secs: 600, dummyKnock: 0.5, dummyHp: 1e12, seed: 4242 };

/* une mine dessinée : rows = lignes de caractères (' ' vide, '#' pierre, 'H' échelle sur du vide), ligne 0 = surface */
function world(rows, carac, seed = BENCH.seed){
  const G = newSession(seed, { miners: [{ carac }] });
  G.tiles = []; G.ladder = []; G.seen = []; G.mobs = []; G.dungeons = []; G.traps = []; G.veil = new Set();
  G.treasures = new Map(); G.torches = []; G.light = new Map(); G.spawnTimer = Infinity;
  rows.forEach((line, y) => {
    const t = new Uint8Array(W).fill(y === 0 ? 0 : IDS.stone), l = new Uint8Array(W);
    for(let x = 0; x < W; x++){ const c = x < line.length ? line[x] : (y === 0 ? ' ' : '#'); t[x] = c === '#' ? IDS.stone : 0; if(c === 'H') l[x] = 1; }
    G.tiles.push(t); G.ladder.push(l); G.seen.push(new Uint8Array(W).fill(1));
  });
  G.areas[0].oreMined = 0; G.areas[0].oreTotal = 1e9;   // pas de déblocage
  const m = G.miners[0];
  m.carac.oxygenMax = 1e9; m.ox = 1e9; m.carac.pods = 1e9;
  return { G, m };
}

/* pilote : fait avancer les actions du mineur pendant secs secondes, comme la session (budget de temps par tick),
   decide(G, m) choisit l'action suivante ; onDone(a) après chaque action finie */
function drive(G, m, secs, decide, onDone){
  const ticks = Math.round(secs / DT);
  for(let i = 0; i < ticks; i++){
    G.ticks++; G.t = G.ticks * DT;
    let budget = DT, guard = 0;
    while(budget > 1e-9 && guard++ < 30){
      if(!m.action){ decide(G, m); if(!m.action) break; }
      const a = m.action, need = a.dur - a.t;
      if(budget >= need){ budget -= need; m.action = null; finishAction(G, m, a); onDone?.(a); }
      else { a.t += budget; budget = 0; }
    }
  }
}

/* Fight : dégâts faits au mannequin en secs secondes (IA complète, mannequin de type bestiole aux PV infinis qui repousse) */
export function fightBench(carac, secs = BENCH.secs){
  const { G, m } = world(['', '#'.repeat(50), '#' + ' '.repeat(40) + '#', '#'.repeat(50)], carac);
  m.x = 10; m.y = 2; m.prefs = { ...m.prefs, fightMobs: true };
  const knock0 = MOBS.knock.bestiole;
  MOBS.knock.bestiole = BENCH.dummyKnock;
  const o = { id: G.mobId++, type: 'bestiole', x: 11, y: 2, hp: BENCH.dummyHp, maxhp: BENCH.dummyHp, cd: 1 };
  G.mobs.push(o);
  try {
    for(let i = 0, n = Math.round(secs / DT); i < n; i++){
      m.ox = 1e9; tick(G);
      /* couloir sans fin : près d'un bord, mineur et mannequin sont recentrés ensemble (même écart), sinon le mineur
         repoussé finit contre le mur du bout, où le recul ne fait plus rien */
      if(!m.action?.type?.startsWith('mov') && (Math.min(m.x, o.x) <= 3 || Math.max(m.x, o.x) >= 37)){
        const d = 20 - Math.round((m.x + o.x) / 2); m.x += d; o.x += d;
      }
    }
  } finally { MOBS.knock.bestiole = knock0; }
  return BENCH.dummyHp - o.hp;
}

/* Mine : blocs cassés en secs secondes dans une mine géante de pierre (galerie en serpentin, de bord à bord) */
export function mineBench(carac, secs = BENCH.secs){
  const rows = [''];
  for(let y = 1; y < 900; y++) rows.push(y === 1 ? ' ' + '#'.repeat(49) : '#'.repeat(50));
  const { G, m } = world(rows, carac);
  m.x = 0; m.y = 1; let dir = 1, mining = 0;
  drive(G, m, secs, (G, m) => {
    if(G.tiles[m.y + 1]?.[m.x] === 0){ stepDir(G, m, 0, 1); dir = -dir; return; }   // le bloc du dessous est cassé : on descend
    const nx = m.x + dir;
    if(nx >= 0 && nx < W){ stepDir(G, m, dir, 0); return; }
    stepDir(G, m, 0, 1);                                                               // bord : on casse le bloc du dessous
  }, a => { if(a.type === 'mine') mining += a.dur; });
  /* blocs par seconde passée à MINER, ramenés à secs : la marche dans la galerie a son propre banc (Walk) */
  return mining > 0 ? G.stats.mined / mining * secs : 0;
}

/* Walk : cases parcourues en secs secondes dans un couloir plat (aller-retour) */
export function walkBench(carac, secs = BENCH.secs){
  const { G, m } = world(['', ' '.repeat(50), '#'.repeat(50)], carac);
  m.x = 0; m.y = 1; let dir = 1, n = 0;
  drive(G, m, secs, (G, m) => { if(m.x + dir < 0 || m.x + dir >= W) dir = -dir; stepDir(G, m, dir, 0); },
    a => { if(a.type === 'move') n++; });
  return n;
}

/* Climb : cases montées en secs secondes dans un puits d'échelles (revenu en bas sans temps à chaque arrivée en haut) */
export function climbBench(carac, secs = BENCH.secs){
  const H = 200, rows = [''];
  for(let y = 1; y <= H; y++) rows.push('#H' + '#'.repeat(48));
  rows.push('#'.repeat(50));
  const { G, m } = world(rows, carac);
  m.x = 1; m.y = H; let n = 0;
  drive(G, m, secs, (G, m) => { if(m.y <= 1) m.y = H; stepDir(G, m, 0, -1); },
    a => { if(a.type === 'move') n++; });
  return n;
}

export const BENCHES = { fight: fightBench, mine: mineBench, walk: walkBench, climb: climbBench };
/* groupes de stats de chaque banc ; les autres stats gardent leur prix actuel (statPrice) */
export const GROUPS = {
  fight: ['damage', 'damagePct', 'attackSpeed', 'doubleAttack', 'crit', 'reach', 'knockback', 'knockRes'],
  mine: ['mineSpeed', 'mineSpeedPct', 'oneTap', 'piercing'],
  walk: ['speed'],
  climb: ['climbSpeed'],
};
export const benchStats = new Set(Object.values(GROUPS).flat());

/* rendements de tous les bancs pour ces caractéristiques (base + stuff) */
export const runBenches = carac => Object.fromEntries(Object.entries(BENCHES).map(([k, f]) => [k, f({ ...STATS, ...carac })]));

/* Part du temps en mine normale : temps passé par action, sur toutes les sessions données (G finies, avec onTick de
   classify à chaque tick). fight = coups ; mine = minage ; walk = pas à l'horizontale ; climb = montée / descente par
   échelle ou par le seau du treuil ; le reste (chutes, échelles posées, dépôts, attente, étourdi) = other. */
export function classify(m){
  const a = m.action; if(!a) return 'other';
  if(a.type === 'attack') return 'fight';
  if(a.type === 'mine') return 'mine';
  if(a.type === 'move'){
    if(a.data.fall) return 'other';
    if(a.data.y !== m.y) return 'climb';
    return 'walk';
  }
  return 'other';
}
