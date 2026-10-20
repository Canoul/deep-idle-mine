#!/usr/bin/env node
/* Simule des sessions complètes (1 h de jeu) sans navigateur, en quelques secondes.
   Usage :
     node scripts/simulate.js                     → 8 seeds de référence, 1 mineur
     node scripts/simulate.js --miners 3          → 3 mineurs sur la même carte
     node scripts/simulate.js --seeds 42,1234     → seeds choisies
     node scripts/simulate.js --count 30          → 30 seeds de référence
     node scripts/simulate.js --json              → sortie JSON (pour comparer deux versions)
     node scripts/simulate.js --focus iron:only   → focus minerai de tous les mineurs dès le départ
                                                    (clé:mode séparés par des virgules ; modes target / only)
     node scripts/simulate.js --focus area:0      → focus d'area (combinable : area:1,coal:only)
     node scripts/simulate.js --skills barbare    → chaque mineur a l'arbre complet (mineur, logisticien, barbare) ;
                                                     mixed = un arbre différent par mineur (1er mineur, 2e logisticien, 3e barbare)
   Affiche : areas débloquées, profondeur max, coffre, allers-retours, coffres au trésor ouverts / enfouis
   (dans les areas générées), et un détecteur de blocage. */
import { runSession } from '../src/sim/session.js';
import { stuckDetector } from '../src/sim/diagnostics.js';
import { setFocus } from '../src/sim/focus.js';
import { SKILLS } from '../src/config.js';
import { sanitizeSkills, skillEffects } from '../src/meta/skills.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i=args.indexOf('--'+name); return i<0 ? def : (args[i+1] ?? true); };
const miners = +opt('miners', 1);
const count  = +opt('count', 8);
const seeds  = opt('seeds', null) ? String(opt('seeds')).split(',').map(Number) : Array.from({length:count},(_,i)=>(i+1)*7919);
const json   = args.includes('--json');
const skills = opt('skills', null);
/* arbre de skills complet (tous les rangs) pour un mineur : mêmes effets qu'en session (src/shared/game.js) */
function giveTree(m, tree){
  const t = SKILLS.trees.find(x => x.id === tree); if(!t) throw new Error('arbre inconnu : ' + tree);
  const st = sanitizeSkills({ tree, ranks:Object.fromEntries(t.nodes.map(n => [n.id, n.max])) });
  m.skill = { ...m.skill, ...skillEffects(st) }; m.skillTree = tree;
  m.carac.mineSpeed *= 1 + m.skill.mine_speed; m.carac.damage *= 1 + m.skill.damage;
}
const focus  = opt('focus', null) ? Object.fromEntries(String(opt('focus')).split(',').map(p => p.split(':'))
  .map(([k, v]) => [k, k === 'area' ? +v : v])) : null;

const t0 = Date.now(), rows = [];
for(const seed of seeds){
  const det = stuckDetector();
  const G = runSession(seed, { miners, onTick: (G,i) => {
    if(i===0 && focus) for(const m of G.miners) setFocus(G, m, focus);
    if(i===0 && skills) G.miners.forEach((m, k) => giveTree(m, skills === 'mixed' ? SKILLS.trees[k % 3].id : skills));
    det.onTick(G,i);
  } });
  rows.push({
    seed, areas: G.unlockedAreas, depth: G.stats.maxDepth, trips: G.stats.trips, falls: G.stats.falls, stuns: G.stats.stuns,
    mined: G.stats.mined, kills: G.stats.kills, treasures: G.stats.treasures,
    treasuresHidden: G.areas.filter(a=>a.treasure).length,
    ore: G.areas.map(a=>a.oreMined+'/'+a.oreTotal), chest: G.chest,
    focusLeft: G.miners.map(m=>JSON.stringify(m.prefs.focus)).join(' '), focusDropped: G.miners.some(m=>m.focusNotice),
    miners: G.miners.map(m=>({ name:m.name, ...m.stats, chest:G.chestBy[m.id]||{} })),
    stuck: det.result(),
  });
}

if(json){ console.log(JSON.stringify(rows, null, 1)); process.exit(0); }

for(const r of rows){
  console.log(`seed ${String(r.seed).padStart(10)} | areas débloquées ${r.areas-1} | prof max ${String(r.depth).padStart(3)} | allers-retours ${String(r.trips).padStart(2)} | treasures ${r.treasures}/${r.treasuresHidden} | étourdi ${r.stuns}× | minerai ${r.ore.join(' ')}` +
    (r.stuck.length ? `  ⚠ BLOQUÉ ${JSON.stringify(r.stuck[0])}` : ''));
  if(focus) console.log(`    coffre ${JSON.stringify(r.chest)} | focus en fin ${r.focusLeft}${r.focusDropped ? ' (abandonné en cours de route)' : ''}`);
  if(miners>1) for(const m of r.miners)
    console.log(`    ${m.name.padEnd(9)} minés ${String(m.mined).padStart(4)} (minerai ${String(m.ore).padStart(3)}) | allers-retours ${String(m.trips).padStart(2)} | prof ${String(m.maxDepth).padStart(3)} | mobs ${String(m.kills).padStart(3)} | tacles ${m.tackled} | volés ${m.stolen}`);
}
const avg = k => (rows.reduce((s,r)=>s+r[k],0)/rows.length).toFixed(1);
const stuck = rows.filter(r=>r.stuck.length).length;
console.log(`\n${rows.length} sessions, ${miners} mineur(s) | moyenne : areas ${(avg('areas')-1).toFixed(1)}, profondeur ${avg('depth')}, allers-retours ${avg('trips')}, treasures ouverts ${avg('treasures')}/${avg('treasuresHidden')}, étourdissements ${avg('stuns')} | bloquées : ${stuck} | ${((Date.now()-t0)/1000).toFixed(1)} s`);
process.exitCode = stuck ? 1 : 0;
