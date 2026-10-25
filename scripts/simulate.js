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
     node scripts/simulate.js --skills mixed --no-mule → pareil, sans le skill Mule (comparer le sac)
     node scripts/simulate.js --khole 1           → chance de k hole par area (KHOLE.chance) : nombre de k holes,
                                                    blocs minés dans la dimension, coût d'un tick (mine / dimension)
     node scripts/simulate.js --skills mixed --glyphs winch → avec le Glyphe Treuil (ascenseur) sur le logisticien
     node scripts/simulate.js --skills mineur --spells illumination,dynamite → sorts équipés (SPELLS) : ceux de la
                                                    spécialisation du mineur, 2 au plus (comme en session)
   Affiche : areas débloquées, profondeur max, coffre, allers-retours, coffres au trésor ouverts / enfouis
   (dans les areas générées), et un détecteur de blocage. */
import { runSession } from '../src/sim/session.js';
import { stuckDetector } from '../src/sim/diagnostics.js';
import { setFocus } from '../src/sim/focus.js';
import { SKILLS, KHOLE } from '../src/config.js';
import { itemW } from '../src/sim/mule.js';
import { sanitizeSkills, skillEffects, withSkillStats } from '../src/meta/skills.js';
import { sessionSpells } from '../src/meta/spells.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i=args.indexOf('--'+name); return i<0 ? def : (args[i+1] ?? true); };
const miners = +opt('miners', 1);
const count  = +opt('count', 8);
const seeds  = opt('seeds', null) ? String(opt('seeds')).split(',').map(Number) : Array.from({length:count},(_,i)=>(i+1)*7919);
const json   = args.includes('--json');
const skills = opt('skills', null);
const noMule = args.includes('--no-mule');
const spells = opt('spells', null) ? String(opt('spells')).split(',') : null;
if(opt('khole', null) != null) KHOLE.chance = +opt('khole');
/* k hole : temps de calcul d'un tick dans la mine et dans la dimension (ms), cumulés sur toutes les sessions */
const cost = { mine: { ms:0, n:0 }, khole: { ms:0, n:0 } };
let tickStart = 0;
/* --glyphs winch,mule… : glyphes posés (GLYPHS) sur les mineurs dont l'arbre (--skills) a ce skill, au rang max */
const glyphs = opt('glyphs', null) ? String(opt('glyphs')).split(',') : [];
/* arbre de skills complet (tous les rangs) pour un mineur : mêmes effets qu'en session (src/shared/game.js) */
function giveTree(m, tree){
  const t = SKILLS.trees.find(x => x.id === tree); if(!t) throw new Error('arbre inconnu : ' + tree);
  const st = sanitizeSkills({ tree, ranks:Object.fromEntries(t.nodes.map(n => [n.id, n.max])) });
  m.skill = { ...m.skill, ...skillEffects(st) }; m.skillTree = tree;
  if(noMule) m.skill.mule = 0;
  for(const g of glyphs) if(t.nodes.some(n => n.id === g)) m.skill['glyph_' + g] = 1;
  m.carac = withSkillStats(m.carac, m.skill);   // mêmes stats qu'en session (multiplicateurs, ténacité…)
}
const focus  = opt('focus', null) ? Object.fromEntries(String(opt('focus')).split(',').map(p => p.split(':'))
  .map(([k, v]) => [k, k === 'area' ? +v : v])) : null;

const t0 = Date.now(), rows = [];
for(const seed of seeds){
  const det = stuckDetector();
  const kh = { entered:0, mined:0, wasIn:false };
  const G = runSession(seed, { miners, onTick: (G,i) => {
    const now = performance.now(), c = cost[G.khole ? 'khole' : 'mine'];
    if(i > 0){ c.ms += now - tickStart; c.n++; }
    if(G.khole && !kh.wasIn){ kh.entered++; kh.mined0 = G.stats.mined; }
    if(!G.khole && kh.wasIn) kh.mined += G.stats.mined - kh.mined0;
    kh.wasIn = !!G.khole;
    if(i===0 && focus) for(const m of G.miners) setFocus(G, m, focus);
    if(i===0 && skills) G.miners.forEach((m, k) => giveTree(m, skills === 'mixed' ? SKILLS.trees[k % 3].id : skills));
    if(i===0 && spells) for(const m of G.miners) m.spells = sessionSpells(spells, m.skillTree);
    det.onTick(G,i);
    tickStart = performance.now();
  } });
  rows.push({
    seed, khole: { ...kh, hidden: (G.kholes || []).length }, areas: G.unlockedAreas, depth: G.stats.maxDepth, trips: G.stats.trips, falls: G.stats.falls, stuns: G.stats.stuns,
    mined: G.stats.mined, kills: G.stats.kills, treasures: G.stats.treasures, glyphs: G.stats.glyphs || 0,   // glyphes trouvés (drop)
    treasuresHidden: G.areas.filter(a=>a.treasure).length,
    ore: G.areas.map(a=>a.oreMined+'/'+a.oreTotal), chest: G.chest,
    chestPods: Math.round(Object.entries(G.chest).reduce((s,[k,n])=>s+n*itemW(k),0)),   // poids total rapporté au coffre
    focusLeft: G.miners.map(m=>JSON.stringify(m.prefs.focus)).join(' '), focusDropped: G.miners.some(m=>m.focusNotice),
    miners: G.miners.map(m=>({ name:m.name, ...m.stats, chest:G.chestBy[m.id]||{} })),
    stuck: det.result(),
    mule: { deposits: G.stats.muleDeposits||0, pods: G.stats.mulePods||0, emptied: G.stats.muleEmptied||0,
            lost: G.mule ? G.mule.load : 0, placed: !!G.mule?.placed },
    dungeons: G.dungeons.filter(d=>d.k<G.unlockedAreas).map(d=>`area ${d.k} ${d.cleared ? 'vaincu' : d.found ? 'découvert' : 'pas vu'}`),
  });
}

if(json){ console.log(JSON.stringify(rows, null, 1)); process.exit(0); }

for(const r of rows){
  console.log(`seed ${String(r.seed).padStart(10)} | areas débloquées ${r.areas-1} | prof max ${String(r.depth).padStart(3)} | allers-retours ${String(r.trips).padStart(2)} | treasures ${r.treasures}/${r.treasuresHidden} | étourdi ${r.stuns}× | minerai ${r.ore.join(' ')}` +
    (r.stuck.length ? `  ⚠ BLOQUÉ ${JSON.stringify(r.stuck[0])}` : ''));
  if(r.mule.deposits || r.mule.emptied || r.mule.lost) console.log(`    sac (Mule) : ${r.mule.deposits} dépôts, ${Math.round(r.mule.pods)} pods déposés, ${Math.round(r.mule.emptied)} vidés au coffre, ${Math.round(r.mule.lost)} perdus`);
  if(r.dungeons.length) console.log(`    donjon ${r.dungeons.join(' | ')}`);
  if(r.khole.hidden) console.log(`    k hole : ${r.khole.entered} pris / ${r.khole.hidden} enfoui(s), ${r.khole.mined} blocs minés dans la dimension`);
  if(focus) console.log(`    coffre ${JSON.stringify(r.chest)} | focus en fin ${r.focusLeft}${r.focusDropped ? ' (abandonné en cours de route)' : ''}`);
  if(miners>1) for(const m of r.miners)
    console.log(`    ${m.name.padEnd(9)} minés ${String(m.mined).padStart(4)} (minerai ${String(m.ore).padStart(3)}) | allers-retours ${String(m.trips).padStart(2)} | prof ${String(m.maxDepth).padStart(3)} | mobs ${String(m.kills).padStart(3)} | tacles ${m.tackled} | volés ${m.stolen}${m.resisted ? ` | résisté ${m.resisted}` : ''}`);
}
const avg = k => (rows.reduce((s,r)=>s+r[k],0)/rows.length).toFixed(1);
const stuck = rows.filter(r=>r.stuck.length).length;
console.log(`\n${rows.length} sessions, ${miners} mineur(s) | moyenne : areas ${(avg('areas')-1).toFixed(1)}, profondeur ${avg('depth')}, allers-retours ${avg('trips')}, treasures ouverts ${avg('treasures')}/${avg('treasuresHidden')}, coffre ${avg('chestPods')} pods, étourdissements ${avg('stuns')}, glyphes trouvés ${rows.reduce((s, r) => s + r.glyphs, 0)} | bloquées : ${stuck} | ${((Date.now()-t0)/1000).toFixed(1)} s`);
process.exitCode = stuck ? 1 : 0;
if(cost.khole.n) console.log(`k hole : ${rows.reduce((s, r) => s + r.khole.entered, 0)} pris | coût d'un tick : mine ${(cost.mine.ms/cost.mine.n).toFixed(3)} ms, dimension ${(cost.khole.ms/cost.khole.n).toFixed(3)} ms`);
