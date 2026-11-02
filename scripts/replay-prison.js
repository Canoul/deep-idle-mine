#!/usr/bin/env node
/* Rejouer la prison d'un vrai joueur à l'identique (02/11/2026, Geoffrey) : enregistrement téléchargé depuis le tableau de
   bord de la prison (compte admin, lien 📥 à côté du pseudo : GET /api/game/admin/prison/record?name=…).
     node scripts/replay-prison.js --file prison-minologue.json [--from 1] [--to <run actuel>] [--trace <run>]
   Pour chaque run : durée, minerais, et les passages « en rond » : 30 changements de case de suite sans miner ni tuer,
   en repassant sur moins de la moitié de cases différentes (circuit), ou 150 s sans miner ni tuer.
   --trace N : le détail du run N (une ligne toutes les 2 s : position, action, mode, raison, statut, cible). */
import { readFileSync } from 'node:fs';
import { runRecord, buildPrisonRun, sanitizePrison } from '../src/shared/prison.js';
import { tickPrison } from '../src/sim/prison.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const raw = JSON.parse(readFileSync(opt('file'), 'utf8'));
const p = sanitizePrison(raw.prison ?? raw);
if(!p) throw new Error('Enregistrement de prison illisible');
const from = +opt('from', 1), to = +opt('to', p.run), trace = opt('trace', null) == null ? null : +opt('trace');
console.log(`Prison de ${p.specs?.name} · seed ${p.seed} · run actuel ${p.run} · area ${p.areaMax} · runs ${from} à ${to}`);

for(let run = from; run <= to; run++){
  const G = buildPrisonRun(runRecord({ ...p, run })), m = G.miners[0];
  let w = null; const loops = [];
  while(!G.over){
    tickPrison(G);
    if(trace === run && G.ticks % 20 === 0)
      console.log(`  t=${Math.round(G.t)}s (${m.x},${m.y}) ${m.action?.type ?? '-'} mode=${m.mode} ${m.reason || ''} « ${m.status} » cible=${m.target ? m.target.x + ',' + m.target.y : '-'} pods ${Math.round(m.load)}/${m.carac.pods} O2 ${Math.round(m.ox)}`);
    const prog = m.stats.mined + (m.stats.kills || 0), c = m.x + ',' + m.y;
    if(!w || w.prog !== prog || m.action?.type === 'attack'){ w = { prog, t: G.t, last: c, ch: 0, seen: new Set([c]), path: [c] }; continue; }
    if(c !== w.last){ w.last = c; w.ch++; w.seen.add(c); w.path.push(c); }
    if(!w.rep && ((w.ch >= 30 && w.seen.size * 2 < w.ch) || G.t - w.t > 150)){
      w.rep = true; loops.push(`à ${Math.round(w.t)} s : ${w.seen.size} cases pour ${w.ch} pas, « ${m.status} », trajet ${w.path.slice(-30).join(' ')}`);
    }
  }
  console.log(`run ${run} : ${Math.round(G.summary.t / 60)} min${loops.length ? ' · ⚠ EN ROND' : ''}`);
  for(const l of loops) console.log('   ' + l);
}
