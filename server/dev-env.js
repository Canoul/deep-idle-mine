/* Réglages du serveur de développeur (31/10/2026) : .env du dépôt, puis ~/.dim-dev.env (commun à tous les worktrees). Une
   valeur déjà définie n'est pas remplacée. DATABASE_URL présent : refus de démarrer, le serveur dev écrit comme un vrai
   serveur et abîmerait la base en ligne. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';

export function loadDevEnv({ env = process.env, files = [path.join(process.cwd(), '.env'), path.join(os.homedir(), '.dim-dev.env')] } = {}){
  for(const f of files){
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    for(const [k, v] of Object.entries(parseEnv(text))) env[k] ??= v;
  }
  if(env.DATABASE_URL) throw new Error("DATABASE_URL présent : le serveur dev n'écrit jamais dans la base en ligne. Retire-le (DIM_DEV_COPY_URL suffit pour copier un joueur).");
  return env;
}
