#!/usr/bin/env node
/* Sort de la base en ligne l'enregistrement d'une session (seed, joueurs, stuff, skills, préférences, focus, départs),
   pour la rejouer à l'identique en local (scripts/replay-session.js). LECTURE SEULE : un seul SELECT, rien n'est écrit
   ni créé dans la base. Les sessions terminées sont gardées 30 jours (server/config.js, keepEnded).
   Usage :
     DATABASE_URL=postgresql://… node scripts/export-session.js --seed 222945787
     DATABASE_URL=postgresql://… node scripts/export-session.js --seed 222945787,1562880641 --out data/replays
   Écrit un fichier <seed>-<id>.json par session trouvée dans --out (par défaut data/replays, ignoré par git : les
   enregistrements contiennent des pseudos et des ID de compte, ils ne vont jamais dans le dépôt). */
import fs from 'node:fs';
import path from 'node:path';
import { DB_TABLE } from '../server/db/postgres.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--'+name); return i < 0 ? def : (args[i+1] ?? def); };
const seeds = String(opt('seed', '')).split(',').filter(Boolean).map(Number);
const out = opt('out', 'data/replays');
const url = process.env.DATABASE_URL;

if(!seeds.length || seeds.some(s => !Number.isSafeInteger(s))){ console.error('Usage : node scripts/export-session.js --seed <seed>[,<seed>…]'); process.exit(1); }
if(!url){ console.error('DATABASE_URL manquant (adresse de la base, dans le .env du serveur).'); process.exit(1); }

const { default: pg } = await import('pg');
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 20e3 });
await client.connect();
try {
  await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');   // ceinture et bretelles : aucune écriture possible
  const { rows } = await client.query(
    `SELECT key, value FROM ${DB_TABLE} WHERE ns = 'game_session' AND (value->>'seed')::bigint = ANY($1::bigint[])`, [seeds]);
  fs.mkdirSync(out, { recursive: true });
  for(const seed of seeds){
    const found = rows.filter(r => Number(r.value.seed) === seed);
    if(!found.length){ console.log(`${seed} : aucune session (plus de 30 jours, ou seed mal recopiée)`); continue; }
    for(const { key, value } of found){
      const file = path.join(out, `${seed}-${key}.json`);
      fs.writeFileSync(file, JSON.stringify(value, null, 1));
      const who = (value.players || []).map(p => p.name).join(', ');
      console.log(`${seed} : ${value.mode ?? 'mine'}, ${value.status}, ${who}${value.bots ? ` + ${value.bots} bot(s)` : ''} → ${file}`);
    }
  }
} finally {
  await client.end();
}
