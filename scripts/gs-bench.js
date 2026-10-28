/* GS expérimental par bancs d'essai (28/10/2026, Geoffrey ; branche geoffrey/gs-bancs). Voir src/sim/bench.js.
     node scripts/gs-bench.js               → parts de temps (10 sessions, équipe des 3 presets acier) puis GS
     node scripts/gs-bench.js --count 3     → moins de sessions pour les parts de temps
     node scripts/gs-bench.js --knock 1     → recul du mannequin (défaut BENCH.dummyKnock)
     node scripts/gs-bench.js --json out    → écrit aussi les chiffres bruts dans out.json
   1) Part du temps par groupe : sessions complètes (1 h) d'une équipe Mineur / Logisticien / Barbare avec les presets du
      mode dev (stuff acier, arbre complet, glyphes, sorts) ; chaque tick, l'action de chaque mineur est classée (bench.classify).
   2) Bancs (10 min chacun) sur les stats de base, puis sur le stuff à mesurer.
   3) GS = Σ groupes part × 3 600 × (rendement ÷ rendement de base − 1) + stats hors des bancs × leur prix actuel (statPrice).
   Une pièce : GS du mineur de base qui ne porte qu'elle. Un joueur : GS de tout son stuff d'un coup (les stats se
   multiplient entre elles, donc ce n'est pas la somme des pièces). */
import { writeFileSync } from 'node:fs';
import { CFG, STATS, STUFF, DEV_PRESETS } from '../src/config.js';
import { buildSession } from '../src/shared/game.js';
import { tick } from '../src/sim/session.js';
import { BENCH, GROUPS, benchStats, runBenches, classify } from '../src/sim/bench.js';
import { equippedStats } from '../src/meta/stuff.js';
import { statPrice, pieceGS, gearScore } from '../src/meta/gearscore.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : (args[i + 1] ?? true); };
const count = +opt('count', 10);
if(opt('knock', null) != null) BENCH.dummyKnock = +opt('knock');
const TREES = ['mineur', 'logisticien', 'barbare'];
const t0 = Date.now();

/* ---- 1) parts de temps ---- */
const time = { all: {} }, byTree = Object.fromEntries(TREES.map(t => [t, {}]));
for(let s = 0; s < count; s++){
  const G = buildSession({ id: 'gs' + s, seed: 7919 * (s + 1), players: [], bots: 3, botPresets: TREES });
  while(!G.over){
    tick(G);
    for(const m of G.miners){
      const k = classify(m), tr = m.skillTree || 'aucun';
      time.all[k] = (time.all[k] || 0) + 1;
      (byTree[tr] ??= {})[k] = (byTree[tr][k] || 0) + 1;
    }
  }
}
const pct = o => { const n = Object.values(o).reduce((a, b) => a + b, 0); return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / n])); };
const shares = pct(time.all);
console.log(`Parts de temps (${count} sessions, 3 presets acier) : ` + ['fight', 'mine', 'walk', 'climb', 'other'].map(k => `${k} ${(100 * (shares[k] || 0)).toFixed(1)} %`).join(' · '));
for(const t of TREES){ const p = pct(byTree[t]); console.log(`  ${t.padEnd(12)} ` + ['fight', 'mine', 'walk', 'climb', 'other'].map(k => `${k} ${(100 * (p[k] || 0)).toFixed(1)} %`).join(' · ')); }

/* ---- 2) bancs ---- */
CFG.darkSlow = 1;   // bancs en pleine lumière : on mesure les stats, pas l'obscurité
const base = runBenches({});
console.log(`\nBancs de base (10 min, mannequin qui repousse de ${BENCH.dummyKnock}) : dégâts ${base.fight}, blocs ${base.mine}, cases à pied ${base.walk}, cases montées ${base.climb}`);

/* ---- 3) GS ---- */
export function benchGS(items){
  const carac = equippedStats(items), perf = runBenches(carac), groups = {};
  for(const g of Object.keys(GROUPS)) groups[g] = (shares[g] || 0) * 3600 * (perf[g] / base[g] - 1);
  let other = 0;
  for(const k of Object.keys(STATS)) if(!benchStats.has(k) && Number.isFinite(carac[k])) other += (carac[k] - STATS[k]) * statPrice(k);
  const total = Object.values(groups).reduce((a, b) => a + b, 0) + other;
  return { total, groups, other, perf };
}
const row = (name, r, old) => console.log(`${name.padEnd(30)} ${String(Math.round(r.total)).padStart(6)}  (fight ${Math.round(r.groups.fight)}, mine ${Math.round(r.groups.mine)}, walk ${Math.round(r.groups.walk)}, climb ${Math.round(r.groups.climb)}, autres ${Math.round(r.other)})  | GS actuel ${old}`);
const out = { shares, byTree: Object.fromEntries(TREES.map(t => [t, pct(byTree[t])])), base, knock: BENCH.dummyKnock, pieces: {}, sets: {} };

console.log('\nGS des pièces (seules sur le mineur de base) :');
const pieces = Object.keys(STUFF.items).filter(n => !/anneau|Anneau/.test(n) && STUFF.items[n].slot !== 'anneau');
for(const n of pieces){ const r = benchGS([n]); out.pieces[n] = r; row(n, r, pieceGS(n)); }

console.log('\nGS de stuffs complets :');
const SETS = {
  'Chitine (4) + pierre': ['Casque en chitine', 'Plastron en chitine', 'Jambes en chitine', 'Bottes en chitine', 'Pioche en pierre', 'Épée en pierre'],
  'Fer (6)': ['Casque en fer', 'Plastron en fer', 'Jambes en fer', 'Bottes en fer', 'Pioche en fer', 'Épée en fer'],
  'Acier (preset dev)': DEV_PRESETS.gear,
};
for(const [n, g] of Object.entries(SETS)){ const r = benchGS(g); out.sets[n] = r; row(n, r, gearScore(g)); }
console.log(`\n${Math.round((Date.now() - t0) / 1000)} s`);
if(opt('json', null)) writeFileSync(String(opt('json')) + '.json', JSON.stringify(out, null, 1));
