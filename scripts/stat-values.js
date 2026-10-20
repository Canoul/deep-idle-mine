#!/usr/bin/env node
/* Valeur standard des stats. Unité : x = 1 seconde de travail du mineur.
   Chaque stat « gouverne » un temps de la session (T_stat) : minage, marche, montée, combat, allers-retours…
   Un bonus b sur une stat de base B fait gagner  T_stat × b / (B + b)  secondes par session
   (le temps gouverné est inversement proportionnel à la stat). Pour un petit bonus : 1 point ≈ T_stat / B.
   Usage : node scripts/stat-values.js [--count 5]   (1 mineur, mêmes seeds que simulate.js) */
import { runSession } from '../src/sim/session.js';
import { STATS, CFG, BLOCKS, DT, SESSION_LEN } from '../src/config.js';

const args = process.argv.slice(2);
const count = +(args[args.indexOf('--count')+1] || 5) || 5;
const seeds = Array.from({length:count}, (_,i)=>(i+1)*7919);
const VAL = Object.fromEntries(Object.values(BLOCKS).filter(b=>b.type==='ore' && b.val).map(b=>[b.name, b.val]));

const T = {}, add = (k,v)=>T[k]=(T[k]||0)+v/count;
let value = 0;
for(const seed of seeds){
  let trip=null, prevMode='work';
  const G = runSession(seed, { miners:1, onTick:G=>{
    const m=G.miners[0], a=m.action;
    /* aller-retour : de la décision de remonter jusqu'à la reprise du travail sous terre */
    if(m.mode==='return' && prevMode!=='return') trip={ reason:m.reason, phase:'up' };
    if(trip){
      if(trip.phase==='up' && m.y===0) trip.phase='surf';
      if(trip.phase==='surf' && m.y>0) trip.phase='down';
      if(trip.phase==='down' && a && a.type!=='move') trip=null;
      else add('trip:'+trip.reason, DT);
    }
    prevMode=m.mode;
    if(m.y===0) return add('surface', DT);
    if(!a) return add('rien', DT);
    if(a.type==='move') add(a.data.fall ? 'chute' : (a.data.y!==a.data.fy ? 'montée' : 'marche'), DT);
    else add(a.type, DT);
  }});
  for(const [n,q] of Object.entries(G.chest)) if(VAL[n]) value += q*VAL[n]/count;
}

const rows = [
  ['Vitesse de minage', 'mineSpeed',  T.mine,                 'temps de minage'],
  ['Vitesse (marche)',  'speed',      T.marche,               'temps de marche'],
  ['Vitesse de montée', 'climbSpeed', T['montée'],            'temps sur échelle'],
  ['Pods',              'pods',       T['trip:pods pleins'],  'allers-retours dus aux pods'],
  ['Oxygène',           'oxygenMax',  T['trip:oxygène'],      'allers-retours dus à l\'oxygène'],
  ['Dégâts',            'damage',     T.attack,               'temps de combat'],
  ['Rayon des torches', 'torchRadius',T.torch,                'temps de pose des torches'],
  ['Torches (nombre)',  'torches',    T['trip:plus de torches'], 'allers-retours faute de torches'],
];
console.log(`${count} sessions, 1 mineur. Unité x = 1 s de travail. Valeur rapportée : ${value.toFixed(0)} → 1 point de valeur ≈ ${(SESSION_LEN/value).toFixed(1)} x\n`);
console.log('Stat                 base   T_stat (s)  1 point =   +10 % =   temps gouverné');
for(const [name,k,t=0,what] of rows){
  const B=STATS[k], one=t/B, ten=t*0.1/1.1;
  console.log(`${name.padEnd(19)} ${String(B).padStart(5)} ${t.toFixed(0).padStart(10)}  ${(one<10?one.toFixed(1):one.toFixed(0)).padStart(8)} x ${ten.toFixed(0).padStart(7)} x   ${what}`);
}
console.log(`\nAutres temps (s/session) : pose d'échelles ${(T.ladder||0).toFixed(0)} (ladderTime ${CFG.ladderTime} s), passerelles ${(T.bridge||0).toFixed(0)}, ` +
  `surface ${(T.surface||0).toFixed(0)}, chutes ${(T.chute||0).toFixed(0)}, fin de session ${(T['trip:fin de session']||0).toFixed(0)}, inactif ${(T.rien||0).toFixed(0)}`);
console.log('Découverte, vision, boussole, passerelles : effet indirect (sur les choix de l\'IA), à mesurer avec npm run weights.');
