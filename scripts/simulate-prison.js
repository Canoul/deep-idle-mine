#!/usr/bin/env node
/* Rendement de la Prison (29/10/2026) : MINERAIS (poids des items de type « ore », pods affichés à titre d'information) rapportés par heure de jeu en prison, comparés à la part d'UN joueur dans
   une mine classique à 3 (même stuff, mêmes skills). Sert à régler PRISON.oreMul : cible prison / (mine à 3, part d'un joueur) ≈ 0,5, en poids de minerais (les pods comptent aussi pierre et terre : le sac se remplit au même rythme, oreMul y pèse peu).
   Défauts rapides (~2,5 min) : 1 référence, 3 chaînes de 3 h, stuff acier, arbre mineur. Mesure complète (long, ~10 min) :
   --count 3 --chains 10 --gears base,fer,acier --areas 1,3,5 --cache refs.json.
   Usage : npm run simulate:prison -- [--count 5] [--hours 4] [--seed 1] [--gears base,fer,acier] [--trees mineur,logisticien,barbare]
                                      [--areas 1,3,5] [--oremul 1.5] [--chains 12] [--cache refs.json] [--verbose]
   Une prison = une chaîne de runs (run 1, 2, …, une carte chacun) jusqu'à --hours heures de jeu ; --chains chaînes (défaut : count ;
   seeds seed…seed+count-1). Référence : --count sessions d'1 h à 3 mineurs ; l'area max de chaque preset en prison
   (--cache : garde les références, ~1 min chacune, pour régler oremul sans les refaire)
   est celle que la mine à 3 atteint en médiane avec lui (« réf. »), plus les areas fixes de --areas (information). */
import { runSession } from '../src/sim/session.js';
import { newPrisonRun, tickPrison } from '../src/sim/prison.js';
import { minerSpecs } from '../src/shared/game.js';
import { DEV_PRESETS, PRISON, ENERGY, BLOCKS } from '../src/config.js';
import { itemW } from '../src/sim/mule.js';
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : (args[i + 1] ?? true); };
const COUNT = +opt('count', 1), HOURS = +opt('hours', 3), SEED0 = +opt('seed', 1), CHAINS = +opt('chains', 3), VERBOSE = args.includes('--verbose');
const list = (k, d) => String(opt(k, d)).split(',').filter(Boolean);
const GEARS = list('gears', 'acier'), TREES = list('trees', 'mineur'), FIXED = list('areas', '').map(Number);
if(opt('oremul', null) != null) PRISON.oreMul = +opt('oremul');

const IRON = ['Casque en fer', 'Plastron en fer', 'Jambes en fer', 'Bottes en fer', 'Pioche en fer', 'Épée en fer'];
const GEAR = { base: [], fer: IRON, acier: [...DEV_PRESETS.gear] };
const avg = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const pods = bag => Object.entries(bag).reduce((s, [k, n]) => s + n * itemW(k), 0);
/* poids des seuls minerais (blocs BLOCKS de type « ore ») : c'est LA mesure du rendement (décision du 29/10) */
const ORES = new Set(Object.values(BLOCKS).filter(b => b.type === 'ore').map(b => b.name));
const ores = bag => Object.entries(bag).reduce((s, [k, n]) => ORES.has(k) ? s + n * itemW(k) : s, 0);

/* mineur(s) du preset (mêmes caractéristiques qu'une session dev) */
function specs(gear, tree, n){
  const saved = DEV_PRESETS.gear; DEV_PRESETS.gear = GEAR[gear];
  try { return minerSpecs({ players: [], bots: n, botPresets: Array(n).fill(tree) }); } finally { DEV_PRESETS.gear = saved; }
}

/* mine à 3 : pods d'un joueur par session d'1 h (moyenne des parts), area max atteinte */
function reference(gear, tree){
  const key = `v2/${gear}/${tree}/${COUNT}/${SEED0}`, CACHE = opt('cache', null);
  let cached = {}; try { cached = JSON.parse(readFileSync(CACHE, 'utf8')); } catch {}
  if(CACHE && cached[key]) return cached[key];
  const r = computeReference(gear, tree);
  if(CACHE){ try { cached = JSON.parse(readFileSync(CACHE, 'utf8')); } catch {} cached[key] = r; writeFileSync(CACHE, JSON.stringify(cached)); }
  return r;
}
function computeReference(gear, tree){
  const rows = [];
  for(let i = 0; i < COUNT; i++){
    const G = runSession(SEED0 + i, { miners: specs(gear, tree, 3) });
    rows.push({ pods: avg(G.summary.shares.map(s => pods(s.bag))), ores: avg(G.summary.shares.map(s => ores(s.bag))), area: G.summary.areasUnlocked });
  }
  return { pods: avg(rows.map(r => r.pods)), ores: avg(rows.map(r => r.ores)), area: median(rows.map(r => r.area)) };
}

/* prison : chaîne de runs jusqu'à HOURS heures de jeu ; un run ne s'interrompt pas (le dernier finit) */
function prison(gear, tree, areaMax){
  const out = { pods: 0, ores: 0, t: 0, runs: 0 };
  for(let i = 0; i < CHAINS; i++){
    let t = 0, run = 1;
    while(t < HOURS * 3600){
      const G = newPrisonRun(SEED0 + i, { miner: specs(gear, tree, 1)[0], areaMax, run });
      while(!G.over) tickPrison(G);
      const bag = G.summary.shares[0].bag, p = pods(bag);
      if(VERBOSE) console.log(`    seed ${SEED0 + i} run ${run} : ${Math.round(G.summary.t)} s, ${Math.round(p)} pods, minerais ${G.areas[0].oreMined}/${G.areas[0].oreTotal}`);
      t += G.summary.t; out.pods += p; out.ores += ores(bag); out.runs++; run++;
    }
    out.t += t;
  }
  const h = out.t / 3600;
  return { podsH: out.pods / h, oresH: out.ores / h, runsH: out.runs / h, avgRun: out.t / out.runs };
}

if(CHAINS < 10) console.log(`⚠ ${CHAINS} chaînes (< 10) : mesure bruitée, à lire à ±0,1 près`);
console.log(`oreMul ${PRISON.oreMul} · ${CHAINS} chaînes de ≥ ${HOURS} h · énergie : recharge ${ENERGY.prisonPerHour}/h de jeu en prison (aucun coût d'énergie dans un run)`);
const summary = [];
for(const gear of GEARS) for(const tree of TREES){
  const ref = reference(gear, tree);
  console.log(`\n${gear} / ${tree} — mine à 3 : ${Math.round(ref.pods)} pods (dont ${Math.round(ref.ores)} de minerais) par joueur et par heure, area max médiane ${ref.area}`);
  const tests = [...new Set([ref.area, ...FIXED])];
  for(const a of tests){
    const p = prison(gear, tree, a), ratio = p.oresH / ref.ores;
    console.log(`  areaMax ${a}${a === ref.area ? ' (réf.)' : '      '} : ${Math.round(p.oresH)} minerais/h (${Math.round(p.podsH)} pods/h) · ${p.runsH.toFixed(2)} runs/h · run moyen ${Math.round(p.avgRun / 60)} min · ratio ${ratio.toFixed(2)}`);
    if(a === ref.area) summary.push({ gear, tree, ratio });
  }
}
console.log('\nRatio minerais prison / (mine à 3, part d\'un joueur) à l\'area de référence : ' + summary.map(s => `${s.gear}/${s.tree} ${s.ratio.toFixed(2)}`).join(' · '));
