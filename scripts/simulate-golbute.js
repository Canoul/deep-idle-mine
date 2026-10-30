/* Instance II, le Golbute : équilibrage (30/10/2026). Compo de référence (Geoffrey) : 1 mineur et 2 barbares, arbre au
   maximum avec ses sorts, armure en mithril, pioche et épée en fer avec 20 % de stats en plus. Mesure : victoires, temps
   passé à miner le cristal (part des 10 min), PV restants, morts.
   Usage : npm run simulate:golbute -- [--count 20] [--seed 1] [--hp 10000] [--crystal 600] [--tenacity 0] [--verbose] */
import { DEV_PRESETS, INSTANCE, DT } from '../src/config.js';
import { minerSpecs } from '../src/shared/game.js';
import { newGolbute, tickGolbute } from '../src/sim/instance/golbute.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : (args[i + 1] ?? true); };
const COUNT = +opt('count', 20), SEED0 = +opt('seed', 1), VERBOSE = args.includes('--verbose');
if(opt('hp', null) != null) INSTANCE.golbute.boss.hp = +opt('hp');
if(opt('crystal', null) != null) INSTANCE.golbute.crystal.hp = +opt('crystal');
const TEN = +opt('tenacity', 0);

/* mineurs de référence : presets (arbre au max, sorts de la spé) avec le stuff de référence ; outils en fer + 20 % */
DEV_PRESETS.gear = ['Casque en mithril', 'Plastron en mithril', 'Jambes en mithril', 'Bottes en mithril', 'Pioche en fer', 'Épée en fer'];
export function refMiners(tenacity = TEN){
  const specs = minerSpecs({ players: [], bots: 3, botPresets: ['mineur', 'barbare', 'barbare'] });
  return specs.map(s => ({ ...s, carac: { ...s.carac, mineSpeed: s.carac.mineSpeed + 0.4 * 0.2, damage: s.carac.damage + 14 * 0.2,
                                          tenacity: (s.carac.tenacity || 0) + tenacity } }));
}

if(process.argv[1]?.endsWith('simulate-golbute.js')) main();
function main(){
const miners = refMiners();
if(VERBOSE) for(const m of miners) console.log(`${m.name} : minage ${m.carac.mineSpeed.toFixed(2)} (+${m.carac.mineSpeedPct || 0} %), dégâts ${m.carac.damage.toFixed(1)} (+${m.carac.damagePct || 0} %), vitesse d'attaque ${m.carac.attackSpeed} %, ténacité ${m.carac.tenacity || 0} %, recul ${m.carac.knockRes || 0} %, sorts ${m.spells.join(', ')}`);
let wins = 0, mineT = 0, deaths = 0, hpLeft = 0, tWin = 0, phases = [0, 0, 0], splits = 0;
for(let s = SEED0; s < SEED0 + COUNT; s++){
  const G = newGolbute(s, { miners });
  while(!G.over) tickGolbute(G);
  if(G.summary.success){ wins++; tWin += G.t; }
  mineT += G.stats.mineT / G.miners.length;
  deaths += G.stats.deaths; hpLeft += G.boss.hp / G.boss.maxhp; phases[Math.min(2, G.boss.phase)]++; splits += G.timeline.splits.length;
  if(VERBOSE) console.log(`seed ${s} : ${G.summary.success ? `victoire en ${Math.round(G.t)} s` : `échec (${Math.round(G.boss.hp)} PV, ${G.stats.deaths} mort${G.stats.deaths > 1 ? 's' : ''})`}, minage ${Math.round(G.stats.mineT / G.miners.length)} s/mineur, divisions ${G.timeline.splits.length}, cristaux ${G.timeline.crystals.map(t => Math.round(t)).join('/')}, rage ${G.timeline.rage == null ? '—' : Math.round(G.timeline.rage)}`);
}
console.log(`Golbute ${INSTANCE.golbute.boss.hp} PV, cristal ${INSTANCE.golbute.crystal.hp} coups, ténacité +${TEN} % : ${wins}/${COUNT} victoires`
  + (wins ? ` (en ${Math.round(tWin / wins)} s en moyenne)` : '')
  + ` · minage ${Math.round(mineT / COUNT)} s par mineur (${Math.round(mineT / COUNT / INSTANCE.duration * 100)} % des 10 min)`
  + ` · ${(deaths / COUNT).toFixed(1)} mort(s) par partie · PV restants ${Math.round(hpLeft / COUNT * 100)} %`
  + ` · paliers franchis ${phases.join('/')} · ${(splits / COUNT).toFixed(1)} division(s)`);
}
