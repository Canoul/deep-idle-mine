#!/usr/bin/env node
/* Importance des stats en prison par rapport à la mine (30/10/2026, Geoffrey).
   Mineur réel (--preset, clé --who) ; pour chaque stat : +--bump (20 %) de sa valeur, mêmes seeds.
   Gain = minerais (poids) par heure de jeu, en mine solo (--seeds sessions) et en prison (--runs runs, profil --history).
   Ratio = gain prison / gain mine : > 1 = la stat compte plus en prison qu'en mine.
     node scripts/stat-weights-prison.js --preset P.json --history H.json --who canoul [--seeds 4] [--runs 20] [--bump 0.2] */
import { fork } from 'node:child_process';
import { cpus } from 'node:os';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runSession } from '../src/sim/session.js';
import { newPrisonRun, tickPrison } from '../src/sim/prison.js';
import { minerSpecs } from '../src/shared/game.js';
import { prisonProfile } from '../src/meta/prison-profile.js';
import { importedSessions } from './dev-history.js';
import { BLOCKS, PRISON } from '../src/config.js';
import { itemW } from '../src/sim/mule.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const SEEDS = +opt('seeds', 4), RUNS = +opt('runs', 20), BUMP = +opt('bump', 0.2), WHO = opt('who', 'canoul');
const STATS = (opt('stats', null)?.split(',')) ?? ['mineSpeed','speed','climbSpeed','pods','oxygenMax','damage','attackSpeed','crit','fortune','light','discoverMax','torchRadius'];
const INT = new Set(['discoverMax','torchRadius','light','compass']);
const ORES = new Set(Object.values(BLOCKS).filter(b => b.type === 'ore').map(b => b.name));
const ore = bag => Object.entries(bag || {}).reduce((s, [k, n]) => ORES.has(k) ? s + n * itemW(k) : s, 0);

if(process.env.SWP_STAT){
  const k = process.env.SWP_STAT;
  const snap = JSON.parse(readFileSync(opt('preset'), 'utf8'))[WHO];
  const hist = JSON.parse(readFileSync(opt('history'), 'utf8'));
  const sessions = importedSessions(hist, 'acc-' + WHO, WHO), profile = prisonProfile(sessions, 'acc-' + WHO);
  const spec = mode => {
    const s = minerSpecs({ mode, players: [], bots: 1, botPresets: ['copy:' + WHO], botCopies: [snap] })[0];
    if(k !== 'base'){ const o = s.carac[k] || 0; s.carac[k] = INT.has(k) ? Math.max(o + 1, Math.round(o * (1 + BUMP))) : o * (1 + BUMP); }
    return s;
  };
  let mine = 0, mineT = 0;
  for(let i = 1; i <= SEEDS; i++){ const G = runSession(i * 7919, { miners: [spec('mine')] }); mine += ore(G.chest); mineT += G.t; }
  let pr = 0, prT = 0; const miner = spec('prison');
  for(let c = 0; c < 2; c++) for(let run = 1; run <= RUNS / 2; run++){
    const G = newPrisonRun(100 + c, { miner, areaMax: profile?.area ?? PRISON.fallbackArea, profile, run, account: 'acc-' + WHO });
    while(!G.over) tickPrison(G);
    pr += ore(G.summary.shares[0].bag); prT += G.summary.t;
  }
  const s0 = spec('mine');
  process.send({ k, from: k === 'base' ? null : minerSpecs({ mode:'mine', players:[], bots:1, botPresets:['copy:'+WHO], botCopies:[snap] })[0].carac[k], to: s0.carac[k], mine: mine / (mineT / 3600), prison: pr / (prT / 3600) });
  process.exit(0);
}

const list = ['base', ...STATS], res = {}, q = [...list], t0 = Date.now();
await new Promise(done => { let n = 0; const next = () => { if(!q.length){ if(!n) done(); return; } const k = q.shift(); n++;
  const c = fork(fileURLToPath(import.meta.url), args, { env: { ...process.env, SWP_STAT: k } });
  c.on('message', r => { res[r.k] = r; process.stderr.write(`${r.k} `); }); c.on('exit', () => { n--; next(); }); };
  for(let i = 0; i < Math.min(cpus().length, list.length); i++) next(); });
const b = res.base, pct = v => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + ' %';
console.log(`\n\nMineur ${WHO} · +${BUMP * 100} % par stat · mine solo ${SEEDS} sessions : ${b.mine.toFixed(0)} minerais (poids)/h · prison ${RUNS} runs : ${b.prison.toFixed(0)}/h\n`);
console.log('stat          valeur → +bump   | gain mine | gain prison | prison / mine');
for(const k of STATS){ const r = res[k]; if(!r){ console.log(k, 'échec'); continue; }
  const gm = r.mine / b.mine - 1, gp = r.prison / b.prison - 1;
  console.log(`${k.padEnd(13)} ${String(+(+r.from).toFixed(2)).padStart(6)} → ${String(+(+r.to).toFixed(2)).padEnd(7)}| ${pct(gm).padStart(9)} | ${pct(gp).padStart(11)} | ${Math.abs(gm) < 0.01 ? '(gain mine ≈ 0)' : (gp / gm).toFixed(2)}`); }
console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)} s · bruit : un gain sous ±3 % n'est pas fiable`);
