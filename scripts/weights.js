#!/usr/bin/env node
/* Poids des stats : combien de secondes de travail rapporte +1 point de chaque stat, sur une session.
   Unité : 1 = une seconde de travail du mineur de base. Une session vaut SESSION_LEN (3600).
   Méthode : sessions de référence, puis mêmes seeds avec UNE stat augmentée de --bump (+20 % par défaut).
   Gain de valeur (minerais au coffre × val) → converti en secondes : poids = gain relatif × 3600 / points ajoutés.
   Usage :
     node scripts/weights.js                         → 5 seeds, 1 mineur, +20 %
     node scripts/weights.js --count 5 --bump 0.2 --miners 1 --stats speed,climbSpeed
   Une stat par processus (utilise tous les cœurs). */
import { fork } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runSession } from '../src/sim/session.js';
import { STATS, BLOCKS, SESSION_LEN } from '../src/config.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i=args.indexOf('--'+name); return i<0 ? def : args[i+1]; };
const count = +opt('count', 5), bump = +opt('bump', 0.2), miners = +opt('miners', 1);
const seeds = Array.from({length:count}, (_,i)=>(i+1)*7919);
/* stats mesurées par défaut (les stats entières sont arrondies, au moins +1) */
const DEFAULT = ['oxygenMax','speed','climbSpeed','mineSpeed','pods','damage','discoverMax','light','compass','torchRadius','torches','bridges'];
const INTEGER = new Set(['discoverMax','torchRadius','compass','torches','bridges']);
const VAL = Object.fromEntries(Object.values(BLOCKS).filter(b=>b.type==='ore' && b.val).map(b=>[b.name, b.val]));

/* ---- processus fils : mesure une stat (ou la référence) ---- */
if(process.env.WEIGHTS_STAT){
  const k = process.env.WEIGHTS_STAT; let added = 0;
  if(k !== 'base'){
    const o = STATS[k];
    STATS[k] = INTEGER.has(k) ? Math.max(o+1, Math.round(o*(1+bump))) : o*(1+bump);
    added = STATS[k]-o;
  }
  const runs = seeds.map(seed => {
    const G = runSession(seed, { miners });
    let v = 0; for(const [n,q] of Object.entries(G.chest)) if(VAL[n]) v += q*VAL[n];
    return { v, depth:G.stats.maxDepth, areas:G.unlockedAreas-1 };
  });
  process.send({ k, added, runs }); process.exit(0);
}

/* ---- processus principal ---- */
const list = ['base', ...(opt('stats', null)?.split(',') ?? DEFAULT)];
const t0 = Date.now(), results = {}, queue = [...list];
await new Promise(done => {
  let running = 0;
  const next = () => {
    if(!queue.length){ if(!running) done(); return; }
    const k = queue.shift(); running++;
    const c = fork(fileURLToPath(import.meta.url), args, { env:{ ...process.env, WEIGHTS_STAT:k } });
    c.on('message', r => { results[r.k] = r; });
    c.on('exit', () => { running--; next(); });
  };
  for(let i=0; i<Math.min(cpus().length, list.length); i++) next();
});

const mean = a => a.reduce((s,x)=>s+x,0)/a.length;
const base = results.base, bv = mean(base.runs.map(r=>r.v));
console.log(`Référence : ${count} sessions, ${miners} mineur(s) | valeur ${bv.toFixed(0)} (≈ ${(SESSION_LEN/bv).toFixed(1)} s par point de valeur)` +
  ` | profondeur ${mean(base.runs.map(r=>r.depth)).toFixed(0)} | areas ${mean(base.runs.map(r=>r.areas)).toFixed(1)}\n`);
console.log('stat          base    +ajout  | gain valeur  (min…max par seed) | poids (s/session par point) | s/session pour +10 %');
for(const k of list.slice(1)){
  const r = results[k]; if(!r){ console.log(k.padEnd(12), 'échec'); continue; }
  const per = r.runs.map((x,i)=>x.v/base.runs[i].v-1), g = mean(r.runs.map(x=>x.v))/bv-1;
  const w = g*SESSION_LEN/r.added, w10 = w*STATS[k]*0.1;
  console.log(`${k.padEnd(12)} ${String(STATS[k]).padStart(5)}  ${('+'+(+r.added.toFixed(2))).padStart(7)}  | ${((g*100).toFixed(1)+' %').padStart(8)}  (${(Math.min(...per)*100).toFixed(0)}…${(Math.max(...per)*100).toFixed(0)} %)`.padEnd(66) +
    `| ${w.toFixed(1).padStart(10)}                  | ${w10.toFixed(0).padStart(6)}`);
}
console.log(`\n${((Date.now()-t0)/1000).toFixed(0)} s. Bruit : avec ${count} seeds, un écart de ±3 % est dans le bruit.`);
