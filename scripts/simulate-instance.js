#!/usr/bin/env node
/* Simule l'Instance I (src/sim/instance/) sans navigateur, pour des groupes de 1 à 3 au stuff standard.
   Usage :
     node scripts/simulate-instance.js              → 10 seeds par profil et par taille de groupe
     node scripts/simulate-instance.js --count 30   → 30 seeds
     node scripts/simulate-instance.js --size 3     → seulement les groupes de 3
   Affiche, par profil (gear score) et taille de groupe : réussites, temps moyen d'une réussite, spawners cassés et PV du
   roi restants quand c'est raté, gobelins vivants au plus fort, mineur bloqué (détecteur), temps de calcul.
   Pas de skills ni de sorts : c'est le stuff seul (les skills aident en plus). */
import { STATS, INSTANCE } from '../src/config.js';
import { equippedStats } from '../src/meta/stuff.js';
import { gearScore } from '../src/meta/gearscore.js';
import { newInstance, tickInstance } from '../src/sim/instance/session.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : (args[i + 1] ?? true); };
const count = +opt('count', 10), only = opt('size', null);
const extras = ['Boussole en or', 'Gants d\'ouvrier', 'Cape de Naingui'];
const PROFILES = [
  ['Fer', ['Casque en fer', 'Plastron en fer', 'Jambes en fer', 'Bottes en fer', 'Pioche en fer', 'Épée en fer', ...extras]],
  ['Fer + acier', ['Casque en fer', 'Plastron en acier', 'Jambes en fer', 'Bottes en fer', 'Pioche en acier', 'Épée en acier', ...extras]],
  ['Acier', ['Casque en acier', 'Plastron en acier', 'Jambes en acier', 'Bottes en acier', 'Pioche en acier', 'Épée en acier', ...extras]],
];
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
const mmss = s => Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '—';

console.log(`Instance I : ${count} seeds, ${INSTANCE.duration / 60} min au plus`);
console.log('profil (GS)            groupe  réussites  temps moyen   ratées : spawners / PV du roi   gobelins max  bloqué  calcul');
for(const [label, gear] of PROFILES){
  const carac = { ...STATS, ...equippedStats(gear) }, gs = gearScore(gear);
  for(const size of [1, 2, 3]){
    if(only && +only !== size) continue;
    const wins = [], fails = [];
    let maxGob = 0, blocked = 0;
    const t0 = Date.now();
    for(let i = 1; i <= count; i++){
      const G = newInstance(i * 7919, { miners: Array.from({ length: size }, (_, k) => ({ name: 'M' + k, account: 'a' + k, carac })) });
      while(!G.over){ tickInstance(G); if(G.ticks % 50 === 0) maxGob = Math.max(maxGob, G.goblins.filter(o => o.hp > 0).length); }
      blocked += G.stats.blocked;
      (G.summary.success ? wins : fails).push(G.summary);
      if(G.summary.success) wins.at(-1).time = G.t;
    }
    const ms = Date.now() - t0;
    const failTxt = fails.length ? `${avg(fails.map(f => f.spawners)).toFixed(1)} / ${Math.round(avg(fails.map(f => f.bossHp)))}` : '—';
    console.log(`${`${label} (${gs})`.padEnd(22)} ${String(size).padStart(6)}  ${`${wins.length}/${count}`.padStart(9)}  ${mmss(avg(wins.map(w => w.time))).padStart(11)}   `
      + `${failTxt.padStart(28)}  ${String(maxGob).padStart(12)}  ${String(blocked).padStart(6)}  ${ms} ms`);
  }
}
