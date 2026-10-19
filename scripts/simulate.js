#!/usr/bin/env node
/* Simule des sessions complètes (1 h de jeu) sans navigateur, en quelques secondes.
   Usage :
     node scripts/simulate.js                     → 8 seeds de référence, 1 mineur
     node scripts/simulate.js --miners 3          → 3 mineurs sur la même carte
     node scripts/simulate.js --seeds 42,1234     → seeds choisies
     node scripts/simulate.js --count 30          → 30 seeds de référence
     node scripts/simulate.js --json              → sortie JSON (pour comparer deux versions)
   Affiche : areas débloquées, profondeur max, coffre, allers-retours, coffres au trésor ouverts / enfouis
   (dans les areas générées), et un détecteur de blocage. */
import { runSession } from '../src/sim/session.js';
import { stuckDetector } from '../src/sim/diagnostics.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i=args.indexOf('--'+name); return i<0 ? def : (args[i+1] ?? true); };
const miners = +opt('miners', 1);
const count  = +opt('count', 8);
const seeds  = opt('seeds', null) ? String(opt('seeds')).split(',').map(Number) : Array.from({length:count},(_,i)=>(i+1)*7919);
const json   = args.includes('--json');

const t0 = Date.now(), rows = [];
for(const seed of seeds){
  const det = stuckDetector();
  const G = runSession(seed, { miners, onTick: det.onTick });
  rows.push({
    seed, areas: G.unlockedAreas, depth: G.stats.maxDepth, trips: G.stats.trips, falls: G.stats.falls,
    mined: G.stats.mined, kills: G.stats.kills, treasures: G.stats.treasures,
    treasuresHidden: G.areas.filter(a=>a.treasure).length,
    ore: G.areas.map(a=>a.oreMined+'/'+a.oreTotal), chest: G.chest,
    miners: G.miners.map(m=>({ name:m.name, ...m.stats, chest:G.chestBy[m.id]||{} })),
    stuck: det.result(),
  });
}

if(json){ console.log(JSON.stringify(rows, null, 1)); process.exit(0); }

for(const r of rows){
  console.log(`seed ${String(r.seed).padStart(10)} | areas débloquées ${r.areas-1} | prof max ${String(r.depth).padStart(3)} | allers-retours ${String(r.trips).padStart(2)} | trésors ${r.treasures}/${r.treasuresHidden} | minerai ${r.ore.join(' ')}` +
    (r.stuck.length ? `  ⚠ BLOQUÉ ${JSON.stringify(r.stuck[0])}` : ''));
  if(miners>1) for(const m of r.miners)
    console.log(`    ${m.name.padEnd(9)} minés ${String(m.mined).padStart(4)} (minerai ${String(m.ore).padStart(3)}) | allers-retours ${String(m.trips).padStart(2)} | prof ${String(m.maxDepth).padStart(3)} | mobs ${String(m.kills).padStart(3)} | tacles ${m.tackled}`);
}
const avg = k => (rows.reduce((s,r)=>s+r[k],0)/rows.length).toFixed(1);
const stuck = rows.filter(r=>r.stuck.length).length;
console.log(`\n${rows.length} sessions, ${miners} mineur(s) | moyenne : areas ${(avg('areas')-1).toFixed(1)}, profondeur ${avg('depth')}, allers-retours ${avg('trips')}, trésors ouverts ${avg('treasures')}/${avg('treasuresHidden')} | bloquées : ${stuck} | ${((Date.now()-t0)/1000).toFixed(1)} s`);
process.exitCode = stuck ? 1 : 0;
