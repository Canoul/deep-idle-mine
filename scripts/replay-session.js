#!/usr/bin/env node
/* Rejoue en local, à l'identique, une session enregistrée par le serveur (fichier sorti par scripts/export-session.js)
   et cherche ce qui cloche : blocages (détecteur des simulations), et moments où un mineur reste au même endroit sans
   rien miner (≥ --still s, combat et étourdissement exclus). Même rejeu que le serveur (replayRecord) : mêmes départs,
   mêmes changements de focus, mêmes réglages dev.
   Usage :
     node scripts/replay-session.js data/replays/222945787-S12.json
     node scripts/replay-session.js <fichier> --miner Bob --from 1200 --to 1300   → chaque changement de ce mineur
     node scripts/replay-session.js <fichier> --still 20                            → seuil « sur place » (30 s par défaut)
   Affiche : les mineurs (spécialisation, préférences, stats principales), le résultat, les blocages, les « sur place ». */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildSession, applyDueEvents, applyOverrides } from '../src/shared/game.js';
import { tick, endSession } from '../src/sim/session.js';
import { stuckDetector } from '../src/sim/diagnostics.js';

/* rejoue record ; watch = { miner, from, to } pour suivre un mineur pas à pas ; still = seuil « sur place » (s) */
export function replayTrace(record, { still = 30, watch = null, maxTicks = Infinity } = {}){
  applyOverrides(record.overrides);
  try {
    const G = buildSession(record), det = stuckDetector(), spots = new Map(), stills = [], trace = [];
    const busy = m => m.action?.type === 'attack' || m.action?.type === 'stun';
    let i = 0;
    while(!G.over && G.ticks < maxTicks){
      applyDueEvents(G, record); tick(G); det.onTick(G, i++);
      for(const m of G.miners){
        /* « sur place » : même case (à 1 près), rien miné, ni combat ni étourdissement, sous terre */
        let s = spots.get(m.id);
        const moved = s && (Math.abs(m.x - s.x) > 1 || Math.abs(m.y - s.y) > 1);
        if(!s || moved || m.stats.mined !== s.mined || busy(m) || m.y <= 0){
          if(s && G.t - s.t0 >= still) stills.push({ miner:m.name, t:Math.round(s.t0), dur:Math.round(G.t - s.t0), x:s.x, y:s.y, statuses:[...s.statuses] });
          spots.set(m.id, s = { x:m.x, y:m.y, mined:m.stats.mined, t0:G.t, statuses:new Set() });
        }
        s.statuses.add(m.status);
        if(watch && m.name === watch.miner && G.t >= watch.from && G.t <= watch.to){
          const line = `${m.status} | ${m.mode} | (${m.x},${m.y}) | ${m.action?.type ?? '-'}`;
          if(trace[trace.length-1]?.line !== line) trace.push({ t:+G.t.toFixed(1), line });
        }
      }
    }
    for(const m of G.miners){ const s = spots.get(m.id); if(s && G.t - s.t0 >= still) stills.push({ miner:m.name, t:Math.round(s.t0), dur:Math.round(G.t - s.t0), x:s.x, y:s.y, statuses:[...s.statuses] }); }
    if(!G.over) endSession(G);
    return { G, stuck:det.result(), stills, trace };
  } finally {
    applyOverrides(null);
  }
}

if(import.meta.url === pathToFileURL(process.argv[1]).href){
  const args = process.argv.slice(2);
  const opt = (name, def) => { const i = args.indexOf('--'+name); return i < 0 ? def : (args[i+1] ?? def); };
  const file = args.find(a => a.endsWith('.json'));
  if(!file){ console.error('Usage : node scripts/replay-session.js <fichier.json> [--miner Nom --from s --to s] [--still s]'); process.exit(1); }
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if((record.mode ?? 'mine') !== 'mine'){ console.error(`Session ${record.mode} : seul le rejeu de la mine normale est prévu.`); process.exit(1); }
  const watch = opt('miner', null) ? { miner:opt('miner'), from:+opt('from', 0), to:+opt('to', Infinity) } : null;
  const t0 = Date.now();
  const { G, stuck, stills, trace } = replayTrace(record, { still:+opt('still', 30), watch });
  console.log(`Session ${record.id} : seed ${record.seed}, ${G.roster?.length ?? G.miners.length} mineur(s), rejouée en ${((Date.now()-t0)/1000).toFixed(1)} s`);
  for(const m of G.roster ?? G.miners){
    const c = m.carac;
    console.log(`  ${m.name} : ${m.skillTree ?? 'sans spé'} | prefs ${JSON.stringify(m.prefs)} | vitesse ${c.speed} montée ${c.climbSpeed} minage ${c.mineSpeed} lumière ${c.light} pods ${c.pods} O2 ${c.oxygenMax}`);
  }
  console.log(`  Résultat : ${G.unlockedAreas} areas, profondeur ${G.stats.maxDepth}, ${G.stats.trips} allers-retours${G.winch ? `, treuil jusqu'à ${G.winch.bottom}` : ''}`);
  console.log(`Blocages (${stuck.length}) :`); for(const s of stuck) console.log('  ', JSON.stringify(s));
  console.log(`Sur place sans rien miner (${stills.length}) :`);
  for(const s of stills) console.log(`   ${s.miner} t${s.t} pendant ${s.dur} s en (${s.x},${s.y}) : ${s.statuses.join(' / ')}`);
  if(watch){ console.log(`Suivi de ${watch.miner} :`); for(const l of trace) console.log(`   t${l.t} ${l.line}`); }
}
