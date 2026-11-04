#!/usr/bin/env node
/* Raid Cerbère : équilibrage (04/11/2026, Geoffrey). Équipe de référence : 10 mineurs, 4 barbares, 4 mineurs, 2 logisticiens,
   arbre de leur spé au maximum (preset dev), stuff T4.5 identifié R4, amélioré +5, une rune R4 sur chaque pièce (lignes
   tirées au hasard). Joue le minage des 2 areas, puis Cerbère avec le temps qui reste (RAID.duration).
     node scripts/simulate-raid.js [--runs 10] [--hp 60000] [--mine-only] [--boss-only] [--seed 1]
   --boss-only : saute le minage (temps restant = --left minutes, 15 par défaut). */
import { newSession, tick } from '../src/sim/session.js';
import { newCerbere, tickCerbere } from '../src/sim/raid/cerbere.js';
import { minerSpecs } from '../src/shared/game.js';
import { buildPreset } from '../src/shared/dev-presets.js';
import { rollRune, isPlain, canIdentify } from '../src/meta/piece.js';
import { mulberry32 } from '../src/core/rng.js';
import { RAID, BLOCKS, AREA_Y0, AREA_H, W, DT } from '../src/config.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const RUNS = +opt('runs', 10), HP = opt('hp', null) == null ? null : +opt('hp'), SEED0 = +opt('seed', 1);

/* stuff de référence par spé (choix de Claude : la meilleure pièce T4.5, sinon T4, par case) */
const ARMOR = { barbare: 'thorium', mineur: 'cobalt', logisticien: 'cobalt' };
const gearFor = tree => [
  ...['Casque', 'Plastron', 'Jambes', 'Bottes'].map(p => `${p} en ${ARMOR[tree]}`),
  'Némésis du Golbute', 'Masse du Roi Gobelin', 'Cape inclusive', 'Âme du Golbute', 'Ceinture golémique', 'Gants de boucher',
];
const RINGS = ['Anneau en pierre', 'Anneau du lion'];
const TEAM = [...Array(4).fill('barbare'), ...Array(4).fill('mineur'), ...Array(2).fill('logisticien')];

function snapOf(tree, i, rnd){
  const p = buildPreset(tree, { keys: 0 });
  const stuff = {};
  let uid = 1000 * (i + 1);
  for(const item of gearFor(tree)){
    const piece = { uid: uid++, item };
    if(canIdentify(item)){ const r = rollRune(4, rnd); piece.q = 4; piece.lines = r.lines; piece.s = r.s; }
    if(!isPlain(item)){ piece.plus = 5; piece.rune = rollRune(4, rnd); }
    stuff[slotOf(item)] = piece;
  }
  RINGS.forEach((item, k) => { stuff['anneau' + (k + 1)] = { uid: uid++, item }; });
  return { stuff, skills: p.skills, spells: p.spells, progress: p.progress };
}
import { ITEMS } from '../src/config.js';
const slotOf = item => ITEMS[item].slot;

function team(seed){
  const rnd = mulberry32(seed * 7919 + 13);
  const copies = TEAM.map((t, i) => snapOf(t, i, rnd));
  const specs = minerSpecs({ mode: 'mine', players: [], bots: TEAM.length, botPresets: TEAM.map((_, i) => 'copy:ref' + i), botCopies: copies });
  specs.forEach((s, i) => { s.name = `${TEAM[i].slice(0, 3)}${i}`; s.skillTree = s.skillTree ?? TEAM[i]; });
  return specs;
}

const terrainLeft = G => { let c = 0; for(let y = AREA_Y0; y < AREA_Y0 + RAID.mine.areas * AREA_H; y++) for(let x = 0; x < W; x++){ const t = G.tiles[y][x]; if(t && BLOCKS[t].type === 'terrain') c++; } return c; };

function mine(seed, specs){
  const G = newSession(seed, { miners: specs, raid: true });
  const max = Math.round(RAID.duration / DT);
  while(G.ticks < max){ tick(G); if(G.ticks % 50 === 0 && terrainLeft(G) === 0) break; }
  return { t: G.t, left: terrainLeft(G) };
}

const spec0 = team(SEED0)[0];
console.log(`Équipe : ${TEAM.join(', ')} · ex. ${spec0.name} : minage ${spec0.carac.mineSpeed.toFixed(2)} (+${spec0.carac.mineSpeedPct || 0} %), dégâts ${spec0.carac.damage.toFixed(1)} (+${spec0.carac.damagePct || 0} %), vit. attaque ${spec0.carac.attackSpeed}, ténacité ${spec0.carac.tenacity}, pods ${spec0.carac.pods}, oxygène ${spec0.carac.oxygenMax}`);
let wins = 0; const mines = [], left = [];
for(let r = 0; r < RUNS; r++){
  const seed = SEED0 + r, specs = team(seed);
  let tLeft = +(opt('left', 15)) * 60;
  if(!args.includes('--boss-only')){
    const m = mine(seed, specs);
    mines.push(m.t);
    tLeft = RAID.duration - m.t - RAID.mine.gather;
    console.log(`run ${r + 1} : minage ${(m.t / 60).toFixed(1)} min${m.left ? ` (reste ${m.left} blocs)` : ''}`);
    if(args.includes('--mine-only') || m.left) continue;
  }
  const B = newCerbere(seed, { miners: specs, hp: HP ?? RAID.cerbere.boss.hp, ticks: Math.round(Math.max(0, tLeft) / DT) });
  while(!B.over) tickCerbere(B);
  if(B.summary.success) wins++;
  left.push(B.summary.bossHp / B.summary.bossMax);
  console.log(`   boss : ${B.summary.success ? 'VICTOIRE' : 'défaite'} en ${(B.t / 60).toFixed(1)} min · PV restants ${Math.round(100 * B.summary.bossHp / B.summary.bossMax)} % · morts ${B.stats.deaths} · durcis ${B.stats.stoned} · morsures ${B.stats.bitten}/${B.stats.bites} · dégâts/s ${(B.stats.bossDmg / Math.max(1, B.t)).toFixed(0)}`);
}
if(mines.length) console.log(`Minage : moyenne ${(mines.reduce((a, b) => a + b, 0) / mines.length / 60).toFixed(1)} min`);
if(left.length) console.log(`Boss (PV ${HP ?? RAID.cerbere.boss.hp}) : ${wins}/${left.length} victoires · PV restants moyens ${Math.round(100 * left.reduce((a, b) => a + b, 0) / left.length)} %`);
