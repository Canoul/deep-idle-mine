#!/usr/bin/env node
/* Simule des mines instantanées complètes (5 min de jeu) sans navigateur.
   Usage :
     node scripts/simulate-instant.js                 → 5 seeds, 20 mineurs
     node scripts/simulate-instant.js --miners 3      → 3 mineurs
     node scripts/simulate-instant.js --count 10      → 10 seeds
     node scripts/simulate-instant.js --seeds 42,1234 → seeds choisies
     node scripts/simulate-instant.js --mine-speed 1.5 → vitesse de minage de tous les mineurs (stuff)
     node scripts/simulate-instant.js --no-crowd      → sans pénalité de foule (pour comparer)
   Affiche : part de la mine vidée, blocs disputés, blocs par mineur (min / moyenne / max), butin moyen par mineur,
   plumes, fuites (changements de zone), temps inactif le plus long (blocage), temps de calcul. */
import { INSTANT_MINE as MI } from '../src/config.js';
import { runInstant } from '../src/sim/instant/session.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--'+name); return i < 0 ? def : (args[i+1] ?? true); };
const miners = +opt('miners', 20), count = +opt('count', 5);
const seeds = opt('seeds', null) ? String(opt('seeds')).split(',').map(Number) : Array.from({ length:count }, (_, i) => (i+1)*7919);
const mineSpeed = +opt('mine-speed', 1);
if(args.includes('--no-crowd')){ MI.crowdWeight = 0; MI.takenPenalty = 0; }

const avg = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const t0 = Date.now(), loot = {};
console.log(`Mine instantanée : ${miners} mineur(s), ${seeds.length} seed(s)${mineSpeed !== 1 ? `, vitesse de minage ${mineSpeed}` : ''}`);
console.log('seed      vidée  disputés  blocs/mineur (min/moy/max)  plumes  fuites  inactif max  calcul');
for(const seed of seeds){
  let flees = 0;
  const c0 = Date.now();
  const G = runInstant(seed, {
    miners:Array.from({ length:miners }, (_, i) => ({ name:'M'+i, account:'a'+i, carac:{ mineSpeed } })),
    onTick: g => { for(const m of g.miners) if(m.flee && m.flee.since !== m.flee.until){ m.flee.since = m.flee.until; flees++; } },
  });
  const ms = Date.now() - c0, sh = G.summary.shares, per = sh.map(s => s.stats.mined);
  for(const s of sh) for(const [k, n] of Object.entries(s.bag)) loot[k] = (loot[k] || 0) + n / (sh.length * seeds.length);
  console.log(`${String(seed).padEnd(9)} ${(100*G.stats.mined/(G.w*G.h)).toFixed(0).padStart(4)} %  ${String(G.stats.contested).padStart(8)}  `
    + `${`${Math.min(...per)} / ${avg(per).toFixed(0)} / ${Math.max(...per)}`.padStart(26)}  ${String(G.stats.feathers).padStart(6)}  `
    + `${String(flees).padStart(6)}  ${Math.max(...sh.map(s => s.stats.idle)).toFixed(1).padStart(9)} s  ${ms} ms`);
}
console.log('Butin moyen par mineur : ' + Object.entries(loot).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n.toFixed(1)}`).join(', '));
console.log(`Total : ${Date.now() - t0} ms`);
