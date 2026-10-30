#!/usr/bin/env node
/* Prison d'un VRAI joueur (30/10/2026, Geoffrey) : sa prison telle que le serveur la lancerait (son stuff, ses skills, ses
   sorts, le profil de ses 10 dernières mines), jouée --runs runs à la suite, ramenée au gain par heure de jeu et comparée
   à ce que ses 10 dernières VRAIES mines lui ont rapporté par heure (sa part du butin, une mine = 1 h de jeu).

     node scripts/simulate-prison-profile.js --preset data/presets/presets-canoul-mus.json --who canoul \
          --history data/presets/history-canoul.json [--runs 50] [--seed 1] [--oremul 0.3] [--chains 1]

   --preset : fichier des codes navigateur (docs/debug.md, « Codes navigateur ») : { canoul: { stuff, skills, spells, progress } }
   --history : /api/game/history du joueur ({ sessions }) ; facultatif si --preset contient une clé « history » (code
   navigateur « prison » de docs/debug.md : un seul fichier) · --who : la clé du joueur dans --preset
   --chains : les runs sont répartis en autant de prisons (seeds seed, seed+1…) ; défaut 1 = une prison de --runs runs.
   Sans --preset : preset acier (arbre mineur) ; sans --history : pas de profil (contenu de l'area PRISON.fallbackArea).
   Cible de la spec : prison ≈ 50 % des minerais (en poids) d'une mine, par heure de jeu. */
import { readFileSync } from 'node:fs';
import { newPrisonRun, tickPrison } from '../src/sim/prison.js';
import { minerSpecs } from '../src/shared/game.js';
import { prisonProfile, lastMines } from '../src/meta/prison-profile.js';
import { importedSessions } from './dev-history.js';
import { PRISON, ENERGY, BLOCKS, SESSION_LEN } from '../src/config.js';
import { itemW } from '../src/sim/mule.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : (args[i + 1] ?? true); };
const RUNS = +opt('runs', 50), SEED0 = +opt('seed', 1), CHAINS = Math.max(1, +opt('chains', 1)), WHO = String(opt('who', 'canoul'));
if(opt('oremul', null) != null) PRISON.oreMul = +opt('oremul');
const ACC = 'acc-' + WHO;

const ORES = new Set(Object.values(BLOCKS).filter(b => b.type === 'ore').map(b => b.name));
const weigh = (bag, only) => Object.entries(bag || {}).reduce((s, [k, n]) => !only || only.has(k) ? s + n * itemW(k) : s, 0);
const count = (bag, only) => Object.entries(bag || {}).reduce((s, [k, n]) => !only || only.has(k) ? s + n : s, 0);
const add = (acc, bag) => { for(const [k, n] of Object.entries(bag || {})) acc[k] = (acc[k] || 0) + n; return acc; };
const fmt = (v, d = 0) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('fr-FR');

/* ---- le mineur (comme le serveur : minerSpecs, mode prison) ---- */
const presetFile = opt('preset', null);
const presetJson = presetFile ? JSON.parse(readFileSync(presetFile, 'utf8')) : null;
const snap = presetJson ? presetJson[WHO] : null;
if(presetFile && !snap) throw new Error(`« ${WHO} » absent de ${presetFile}`);
const miner = minerSpecs(snap
  ? { mode: 'prison', players: [], bots: 1, botPresets: ['copy:' + WHO], botCopies: [snap] }
  : { mode: 'prison', players: [], bots: 1, botPresets: ['mineur'] })[0];
if(snap && !miner.carac) throw new Error('Copie refusée par le jeu (stuff ou skills invalides)');

/* ---- profil et référence : ses 10 dernières mines ---- */
/* l'historique : --history, ou la clé « history » du fichier --preset (code navigateur du 30/10 : un seul fichier) */
const histFile = opt('history', null);
const histJson = histFile ? JSON.parse(readFileSync(histFile, 'utf8')) : presetJson?.history ?? null;
const sessions = histJson ? importedSessions(histJson, ACC, WHO) : [];
const profile = histJson ? prisonProfile(sessions, ACC) : null;
const mines = lastMines(sessions, ACC);
const ref = mines.reduce((r, m) => { add(r.bag, m.bag); r.n++; return r; }, { bag: {}, n: 0 });

/* ---- prison : RUNS runs ---- */
const tot = { bag: {}, t: 0, xp: 0, runs: 0, capped: 0 }, ok = { bag: {}, t: 0 }, stuck = [];
const perChain = Math.ceil(RUNS / CHAINS);
for(let c = 0; c < CHAINS && tot.runs < RUNS; c++){
  for(let run = 1; run <= perChain && tot.runs < RUNS; run++){
    const G = newPrisonRun(SEED0 + c, { miner, areaMax: profile?.area ?? PRISON.fallbackArea, profile, run, account: ACC });
    while(!G.over) tickPrison(G);
    const s = G.summary, share = s.shares[0];
    add(tot.bag, share.bag); tot.t += s.t; tot.xp += share.xp || 0; tot.runs++;
    if(s.t >= PRISON.runMax - 1){ tot.capped++; stuck.push({ chain: c, run, seed: SEED0 + c, mined: G.areas[0].oreMined, goal: Math.ceil(PRISON.resetAt * G.areas[0].oreTotal), y: G.miners[0]?.y, status: G.miners[0]?.status }); }
    else { add(ok.bag, share.bag); ok.t += s.t; }
    if(args.includes('--verbose')) console.log(`  run ${run} : ${Math.round(s.t / 60)} min, ${fmt(weigh(share.bag, ORES))} de minerais (poids)`);
  }
}

/* ---- résultat ---- */
const h = tot.t / 3600, refH = ref.n * SESSION_LEN / 3600;
const row = (label, prisonV, refV, d = 0) => console.log(`${label.padEnd(26)} ${fmt(prisonV, d).padStart(9)} ${ref.n ? fmt(refV, d).padStart(9) + '   ' + (refV ? Math.round(100 * prisonV / refV) + ' %' : '—').padStart(5) : ''}`);
console.log(`Prison de ${snap ? WHO : 'preset acier (mineur)'} · oreMul ${PRISON.oreMul} · ${tot.runs} runs en ${CHAINS} prison(s) · ${fmt(h, 1)} h de jeu · run moyen ${fmt(tot.t / tot.runs / 60, 1)} min` +
  (tot.capped ? ` · ⚠ ${tot.capped} run(s) arrêtés à runMax` : ''));
console.log(profile ? `Profil (${profile.n} mines) : area ${profile.area} · minerais ${JSON.stringify(Object.fromEntries(Object.entries(profile.ores || {}).map(([k, v]) => [k, Math.round(v * 100) + ' %'])))}`
                    : `Pas d'historique : contenu de l'area ${PRISON.fallbackArea}, sans profil`);
console.log(`\n${'Par heure de jeu'.padEnd(26)} ${'prison'.padStart(9)} ${ref.n ? 'ses mines'.padStart(9) + '   ' + 'ratio'.padStart(5) : ''}`);
row('Minerais (poids)', weigh(tot.bag, ORES) / h, weigh(ref.bag, ORES) / refH);
row('Minerais (nombre)', count(tot.bag, ORES) / h, count(ref.bag, ORES) / refH);
row('Tout le butin (pods)', weigh(tot.bag) / h, weigh(ref.bag) / refH);
for(const k of [...ORES].filter(k => tot.bag[k] || ref.bag[k])) row('  ' + k, (tot.bag[k] || 0) / h, (ref.bag[k] || 0) / refH, 1);
for(const k of Object.keys({ ...tot.bag, ...ref.bag }).filter(k => /^Treasure T/.test(k)).sort()) row('  ' + k, (tot.bag[k] || 0) / h, (ref.bag[k] || 0) / refH, 2);
console.log(`XP ${fmt(tot.xp / h)} /h · énergie ${ENERGY.prisonPerHour}/h de jeu (${fmt(ENERGY.prisonPerHour * h)} pour ces ${fmt(h, 1)} h)`);
if(stuck.length){
  console.log(`\n⚠ Runs arrêtés à runMax (${PRISON.runMax / 3600} h) : ${stuck.length} sur ${tot.runs}, ${Math.round(100 * stuck.length * PRISON.runMax / tot.t)} % du temps de jeu`);
  for(const r of stuck) console.log(`   prison ${r.seed} run ${r.run} : ${r.mined}/${r.goal} minerais au bout de 3 h, mineur en y ${r.y} (« ${r.status} »)`);
  if(ok.t > 0 && ref.n) console.log(`   Sans ces runs : ${fmt(weigh(ok.bag, ORES) / (ok.t / 3600))} minerais (poids) /h, soit ${Math.round(100 * weigh(ok.bag, ORES) / (ok.t / 3600) / (weigh(ref.bag, ORES) / refH))} % de ses mines`);
}
if(ref.n) console.log(`\nCible : 50 % des minerais (poids). oreMul pour l'atteindre ≈ ${fmt(PRISON.oreMul * 0.5 / (weigh(tot.bag, ORES) / h / (weigh(ref.bag, ORES) / refH)), 2)} (règle de trois : approximatif, à revérifier par une simulation)`);
