/* Mode dev : copier un vrai joueur depuis la base en ligne (31/10/2026). Lecture seule, par un compte qui ne voit que la
   vue COPY_VIEW (stuff, skills, sorts, progression et pseudo, jamais la table : docs/debug.md), réglé par DIM_DEV_COPY_URL.
   La copie est rangée dans data/presets/ comme les autres (server/game/dev-copies.js), et reste après un redémarrage.
   read(pseudo) → { who, name, refused? } ou null si aucun joueur ne porte ce pseudo. */
import fs from 'node:fs';
import path from 'node:path';
import { nameKey } from '../../src/shared/account.js';
import { copyMiner } from '../../src/shared/dev-presets.js';

export const COPY_VIEW = 'dim_dev_copie';

async function openPool(url){
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 20e3, allowExitOnIdle: true });
  pool.on('error', e => console.warn(`Copie de joueur : connexion fermée (${e.message})`));
  return pool;
}

/* pool : réservé aux tests (objet { query }) */
export function createLiveCopies({ url, dir, pool = null }){
  return {
    async read(name){
      const key = nameKey(name);
      pool ??= await openPool(url);
      const { rows } = await pool.query(`SELECT name, ns, value FROM ${COPY_VIEW} WHERE name_key = $1`, [key]);
      if(!rows.length) return null;
      const by = Object.fromEntries(rows.map(r => [r.ns, r.value]));
      const who = key.replace(/[^\w-]/g, '_').slice(0, 24), { tree, ranks, glyphs } = by.skills ?? {};
      const snap = { name: rows[0].name, stuff: by.stuff?.worn ?? {}, skills: by.skills ? { tree, ranks, glyphs } : null,
                     spells: by.spells, progress: by.progress };
      if(!copyMiner(who, snap)) return { who, name: snap.name, refused: true };
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `base-${who}.json`), JSON.stringify({ [who]: snap }));
      return { who, name: snap.name };
    },
  };
}
