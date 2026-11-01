#!/usr/bin/env node
/* Simule des visites de He's coming (src/sim/hescoming/) sans navigateur : points par visite selon le stuff, Fear, reculs, recharges.
   Usage : node scripts/simulate-hescoming.js [--count 20] */
import { HES_COMING as HC, STATS } from '../src/config.js';
import { VISIT_TICKS } from '../src/sim/giant/session.js';
import { newLucifer, joinLucifer, tickLucifer } from '../src/sim/hescoming/session.js';

const args = process.argv.slice(2), i0 = args.indexOf('--count'), count = i0 < 0 ? 20 : +args[i0 + 1];
/* dégâts : mains nues 5, épée en fer 14, en acier 18 environ ; portée : lance +0,25 */
const PROFILES = [
  ['Mains nues',             { damage:5 }],
  ['Épée en fer',            { damage:14 }],
  ['Épée en acier',          { damage:18 }],
  ['Acier, crit 20 %',       { damage:18, crit:20 }],
  ['Acier, ténacité 25 %',   { damage:18, tenacity:25 }],
  ['Acier, ténacité 50 %',   { damage:18, tenacity:50 }],
  ['Acier, vitesse +30 %',   { damage:18, attackSpeed:130 }],
  ['Acier, résist. recul 50 %', { damage:18, knockRes:50 }],
  ['Arc de l\'Admin (20 dég.)', { damage:20, reach:8, knockback:2 }],
];
const avg = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
console.log(`He's coming : visite de ${HC.visit} s, ${count} seeds, un mineur seul. Palier le plus haut : ${HC.tiers.at(-1).min.toLocaleString('fr-FR')}`);
console.log('profil                        points (min / moy / max)   reculs  recharges  visites pour le 1er / dernier palier');
for(const [label, carac] of PROFILES){
  const pts = [], knocks = [], refills = [];
  for(let i = 1; i <= count; i++){
    const G = newLucifer(i * 7919);
    joinLucifer(G, { account:'A', name:'A', carac:{ ...STATS, ...carac } });
    for(let k = 0; k <= VISIT_TICKS; k++) tickLucifer(G);
    const v = G.done[0];
    pts.push(v.points); knocks.push(v.knocks); refills.push(v.refills);
  }
  const a = avg(pts);
  console.log(`${label.padEnd(28)}  ${`${Math.min(...pts).toFixed(0)} / ${a.toFixed(0)} / ${Math.max(...pts).toFixed(0)}`.padStart(22)}   ${avg(knocks).toFixed(1).padStart(6)}  ${avg(refills).toFixed(2).padStart(9)}  ${String(Math.ceil(HC.tiers[0].min / a)).padStart(8)} / ${Math.ceil(HC.tiers.at(-1).min / a)}`);
}
