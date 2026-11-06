#!/usr/bin/env node
/* Poids d'un objet (06/11/2026, Geoffrey) : son x (valeur en mine, itemValue), son GS (gear score) et son xc (valeur de
   combat : % de DPS sur le mineur de référence de son tier, src/meta/combatvalue.js). Ne change rien.
     npm run poids -- "Épée en acier"            un objet (sans lignes, +0)
     npm run poids -- "Épée en acier" --plus 5   amélioré +5
     npm run poids -- --slot epee                tous les objets d'un emplacement
     npm run poids -- --tier 3                   tous les objets d'un tier */
import { ITEMS } from '../src/config.js';
import { itemValue, tierOf, isPlain } from '../src/meta/piece.js';
import { pieceGS } from '../src/meta/gearscore.js';
import { pieceXC } from '../src/meta/combatvalue.js';

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf('--' + k); return i < 0 ? null : args[i + 1]; };
const names = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const plus = +(opt('plus') ?? 0);
const gear = Object.entries(ITEMS).filter(([, d]) => d.slot).map(([n]) => n);
let list = names.length ? names : gear;
if(opt('slot')) list = list.filter(n => ITEMS[n].slot === opt('slot'));
if(opt('tier')) list = list.filter(n => String(tierOf(n)) === opt('tier'));
const unknown = list.filter(n => !ITEMS[n]);
if(unknown.length){ console.error(`Objet inconnu : ${unknown.join(', ')}`); process.exit(1); }

const fr = v => (Math.round(v * 10) / 10).toLocaleString('fr-FR');
const rows = list.map(n => { const piece = plus && !isPlain(n) ? { item: n, plus } : n;
  return { n, slot: ITEMS[n].slot ?? '—', tier: tierOf(n) ?? '—', x: itemValue(n), gs: pieceGS(piece), xc: pieceXC(piece) }; });
const w = Math.max(5, ...rows.map(r => r.n.length));
console.log(`${'Objet'.padEnd(w)}  ${'Empl.'.padEnd(9)} Tier      x      GS     xc (% DPS)${plus ? `   (+${plus})` : ''}`);
for(const r of rows) console.log(`${r.n.padEnd(w)}  ${String(r.slot).padEnd(9)} ${String(r.tier).padEnd(4)} ${fr(r.x).padStart(6)} ${fr(r.gs).padStart(7)} ${fr(r.xc).padStart(8)}`);
