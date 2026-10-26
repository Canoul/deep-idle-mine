#!/usr/bin/env node
/* Simule des visites du Bloc géant (src/sim/giant/) sans navigateur.
   Usage :
     node scripts/simulate-giant.js                → 20 seeds, profils de stuff standard, un mineur à la fois
     node scripts/simulate-giant.js --count 50     → 50 seeds
     node scripts/simulate-giant.js --crowd 30     → en plus : 30 mineurs ensemble pendant 1 h (coût de calcul)
   Affiche, par profil : points par visite (min / moyenne / max), reculs, recharges d'oxygène, plus longue pause sans
   miner (détecteur de blocage), et le nombre de visites pour chaque palier de récompense. */
import { GIANT, STATS, DT } from '../src/config.js';
import { newGiant, joinGiant, tickGiant, runGiant, VISIT_TICKS } from '../src/sim/giant/session.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : (args[i + 1] ?? true); };
const count = +opt('count', 20), crowd = +opt('crowd', 0);

const PROFILES = [
  ['Sans stuff',                 {}],
  ['Pioche en fer + skills (1,3)', { mineSpeed: 1.3 }],
  ['Pioche en acier + skills (1,6)', { mineSpeed: 1.6 }],
  ['Vitesse 2, ténacité 20 %',   { mineSpeed: 2, tenacity: 20 }],
  ['Vitesse 1,3, résistance 50 %', { mineSpeed: 1.3, knockRes: 50 }],
];
const avg = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);

console.log(`Bloc géant : visite de ${GIANT.visit} s, ${count} seeds par profil`);
console.log('profil                            points (min / moy / max)   reculs  recharges  pause max   1 000   10 000');
for(const [label, carac] of PROFILES){
  const pts = [], knocks = [], refills = [];
  let pause = 0;
  for(let i = 1; i <= count; i++){
    const G = newGiant(i * 7919);
    const m = joinGiant(G, { account: 'A', name: 'A', carac: { ...STATS, ...carac } });
    let still = 0;
    for(let k = 0; k < VISIT_TICKS; k++){
      const before = m.points;
      tickGiant(G);
      still = m.points > before || m.status !== 'Frappe le bloc géant' ? (m.points > before ? 0 : still + DT) : still + DT;
      pause = Math.max(pause, still);
    }
    const v = G.done[0];
    pts.push(v.points); knocks.push(v.knocks); refills.push(v.refills);
  }
  const a = avg(pts);
  console.log(`${label.padEnd(32)}  ${`${Math.min(...pts).toFixed(0)} / ${a.toFixed(0)} / ${Math.max(...pts).toFixed(0)}`.padStart(22)}   `
    + `${avg(knocks).toFixed(1).padStart(6)}  ${avg(refills).toFixed(2).padStart(9)}  ${pause.toFixed(1).padStart(7)} s  `
    + `${Math.ceil(1000 / a).toString().padStart(5)}  ${Math.ceil(10000 / a).toString().padStart(7)}`);
}
console.log('(1 000 / 10 000 : visites qu\'il faut à ce rythme pour atteindre le palier)');

if(crowd > 0){
  const t0 = Date.now();
  const visits = [];
  for(let s = 0; s < 3600; s += GIANT.visit / crowd) visits.push({ at: s, spec: { account: 'P' + visits.length, name: 'P' + visits.length, carac: { ...STATS } } });
  const G = runGiant(1, visits, 3600 + GIANT.visit);
  const ms = Date.now() - t0;
  console.log(`\n${crowd} mineurs en continu pendant 1 h de jeu : ${G.done.length} visites, ${(G.stats.points).toFixed(0)} points, `
    + `${ms} ms de calcul (${(ms / (G.ticks) * 1000).toFixed(1)} µs par tick)`);
}
