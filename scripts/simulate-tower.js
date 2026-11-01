/* Simulation des tours de l'Ange et du Démon : taux de victoire par composition d'équipe.
   Usage : npm run simulate:tower -- [--count 20] [--seed 1] [--level 1] [--stele] [--verbose]   (--stele : stèle du camp, phase 2)   (--level : niveau de tour, TOWER.levels)
   Compositions (demande de Geoffrey, 23/10) : stats de base ; minage 1,1 + 10 dégâts avec un barbare ; deux barbares
   à 15 dégâts et un mineur à 1,3 de minage. Les barbares n'ont aucun rang de skill (arbre seulement). d) : b) avec un
   logisticien qui a le skill Treuil (treuil de la tour, 25/10). */
import { runTower } from '../src/sim/tower/session.js';
import { TOWER } from '../src/config.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] ?? true); };
const COUNT = +arg('count', 20), SEED0 = +arg('seed', 1), LEVEL = +arg('level', 1), VERBOSE = process.argv.includes('--verbose'), STELE = process.argv.includes('--stele');

const M = (name, carac = {}, skillTree = null, skills = {}) => ({ name, account: name, carac, skillTree, skills });
export const COMPOS = {
  'a) 3 mineurs de base': [M('A'), M('B'), M('C')],
  'b) 2 mineurs 1,1/10 + 1 barbare 1,1/10': [M('A', { mineSpeed: 1.1, damage: 10 }), M('B', { mineSpeed: 1.1, damage: 10 }),
                                              M('Barb', { mineSpeed: 1.1, damage: 10 }, 'barbare')],
  'c) 2 barbares 15 dégâts + 1 mineur 1,3': [M('Barb1', { damage: 15 }, 'barbare'), M('Barb2', { damage: 15 }, 'barbare'),
                                              M('Min', { mineSpeed: 1.3 })],
  /* comme b), un logisticien (skill Treuil) à la place d'un mineur : l'écart avec b) = le treuil de la tour (25/10) */
  'd) b) avec un logisticien (Treuil) à la place d’un mineur': [M('A', { mineSpeed: 1.1, damage: 10 }),
                                              M('Logi', { mineSpeed: 1.1, damage: 10 }, 'logisticien', { winch: 1 }),
                                              M('Barb', { mineSpeed: 1.1, damage: 10 }, 'barbare')],
  /* équipe forte (30/10, pour la phase 2 des stèles) : repère « 2,5 minage / 40 dégâts » des niveaux */
  'e) 3 mineurs 2,5 / 40 (dont 1 barbare)': [M('A', { mineSpeed: 2.5, damage: 40 }), M('B', { mineSpeed: 2.5, damage: 40 }),
                                              M('Barb', { mineSpeed: 2.5, damage: 40 }, 'barbare')],
};

const fmt = s => s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;

for(const [label, team] of Object.entries(COMPOS)){
  const runs = [];
  for(let i = 0; i < COUNT; i++){
    const seed = SEED0 + i, G = runTower(seed, { side: i % 2 ? 'demon' : 'angel', level: LEVEL, miners: team, ...(STELE ? { stele: i % 2 ? 'exorcisme' : 'pacte' } : {}) });
    runs.push(G);
    if(VERBOSE) console.log(`  seed ${seed} ${G.summary.success ? 'VICTOIRE' : 'échec'} t=${fmt(G.t)} étage=${G.summary.floor} boss=${G.summary.bossHp} toit=${fmt(G.timeline.roof)} projections=${G.stats.knocks} chutes=${G.stats.falls} bloqué=${G.stats.blocked}`);
  }
  const wins = runs.filter(G => G.summary.success);
  const roof = runs.filter(G => G.timeline.roof != null);
  const floors = Array.from({ length: TOWER.floors }, (_, k) => avg(runs.map(G => G.timeline.floors[k]).filter(v => v != null)));
  console.log(`\n${label} — ${wins.length}/${COUNT} victoires (${Math.round(wins.length / COUNT * 100)} %)`);
  console.log(`  durée moyenne d'une victoire : ${fmt(avg(wins.map(G => G.t)))} · toit atteint ${roof.length}/${COUNT} à ${fmt(avg(roof.map(G => G.timeline.roof)))} en moyenne`);
  if(STELE){ const p2 = runs.filter(G => G.phase2);
    console.log(`  stèle : 1er boss tué ${p2.length}/${COUNT} (à ${fmt(avg(p2.map(G => G.timeline.phase2)))} en moyenne) · 2e boss : PV restants moyens en cas d'échec ${Math.round(avg(p2.filter(G => !G.summary.success).map(G => G.summary.bossHp)) ?? 0)} · mobs de la phase 2 encore en vie ${avg(p2.map(G => G.mobs.filter(o => o.stele && o.hp > 0).length))?.toFixed(1) ?? '—'}`); }
  console.log(`  arrivée moyenne par étage : ${floors.map((v, k) => `${k}:${fmt(v)}`).join(' ')}`);
  console.log(`  boss : PV restants moyens en cas d'échec ${Math.round(avg(runs.filter(G => !G.summary.success).map(G => G.summary.bossHp)) ?? 0)} · projections ${avg(runs.map(G => G.stats.knocks)).toFixed(1)} · tombés de la tour ${avg(runs.map(G => G.stats.falls)).toFixed(1)} · attentes « bloqué » ${avg(runs.map(G => G.stats.blocked)).toFixed(1)}`);
}
