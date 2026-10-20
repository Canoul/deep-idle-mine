/* Base PostgreSQL (en ligne, ex. Neon) : une seule table clé → valeur JSON, partagée par les comptes et le jeu.

     dim_data (ns, key, value)   ns = sorte d'objet : account, session, inventory, furnace, stuff, prefs, progress, skills, game_session

   Le serveur garde tout en mémoire (un seul serveur à la fois) : la base sert à ne rien perdre au redémarrage,
   au redéploiement ou à la mise en veille de l'hébergeur. Au démarrage on charge tout ; ensuite chaque modification
   écrit (ou efface) seulement les lignes concernées.
   - Les écritures passent dans une file : jamais deux en même temps, dans l'ordre où elles ont eu lieu.
   - Les lignes d'une même écriture sont enregistrées ensemble, en une seule requête (tout ou rien) : ex. inventaire
     + four, entre lesquels des objets passent (une coupure au milieu dupliquerait ou perdrait des objets).
   - Une écriture qui échoue (base en réveil, réseau) est retentée ; après plusieurs échecs on l'écrit dans le journal
     et on continue (la prochaine écriture du même objet le réenregistre en entier).
   La bibliothèque « pg » n'est chargée que si on utilise PostgreSQL : en local, le serveur reste sans dépendance.
   Réglage : variable d'environnement DATABASE_URL (adresse de connexion donnée par l'hébergeur de la base). */

export const DB_TABLE = 'dim_data';
const RETRIES = [1e3, 2e3, 5e3, 10e3, 20e3];      // attentes entre les essais d'une écriture (ms)

/* url : adresse de connexion. pool : réservé aux tests (objet { query, end }). */
export async function openDatabase(url, { pool, retries = RETRIES, log = console } = {}){
  if(!pool){
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: url, max: 3, idleTimeoutMillis: 30e3, connectionTimeoutMillis: 20e3 });
    /* une connexion inactive coupée par la base (mise en veille de Neon) ne doit pas arrêter le serveur */
    pool.on('error', e => log.warn(`PostgreSQL : connexion fermée (${e.message})`));
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS ${DB_TABLE} (
    ns text NOT NULL, key text NOT NULL, value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (ns, key))`);

  let queue = Promise.resolve();
  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function apply(rows){
    for(const r of rows.filter(r => r.json === null))
      await pool.query(`DELETE FROM ${DB_TABLE} WHERE ns = $1 AND key = $2`, [r.ns, r.key]);
    /* toutes les lignes à écrire en une seule requête : PostgreSQL l'applique entièrement ou pas du tout */
    const up = rows.filter(r => r.json !== null);
    if(!up.length) return;
    const values = up.map((_, i) => `($${3*i+1}, $${3*i+2}, $${3*i+3}::jsonb)`).join(', ');
    await pool.query(`INSERT INTO ${DB_TABLE} (ns, key, value) VALUES ${values}
                      ON CONFLICT (ns, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
                     up.flatMap(r => [r.ns, r.key, r.json]));
  }

  return {
    /* toutes les lignes des sortes demandées : { ns: { key: value } } */
    async load(nsList){
      const out = Object.fromEntries(nsList.map(ns => [ns, {}]));
      const { rows } = await pool.query(`SELECT ns, key, value FROM ${DB_TABLE} WHERE ns = ANY($1)`, [nsList]);
      for(const r of rows) out[r.ns][r.key] = r.value;
      return out;
    },

    /* enregistre des changements [{ ns, key, value (null = supprimé) }]. La valeur est figée tout de suite (une
       modification de l'objet après l'appel ne change pas ce qui est écrit). Résolue une fois écrit (ou abandonné). */
    write(changes){
      const rows = (changes ?? []).map(c => ({ ns: c.ns, key: String(c.key), json: c.value == null ? null : JSON.stringify(c.value) }));
      if(!rows.length) return queue;
      queue = queue.then(async () => {
        for(let attempt = 0; ; attempt++){
          try { return await apply(rows); }
          catch(e){
            if(attempt >= retries.length){
              log.error(`PostgreSQL : écriture abandonnée (${rows.map(r => r.ns + '/' + r.key).join(', ')}) : ${e.message}`);
              return;
            }
            await wait(retries[attempt]);
          }
        }
      });
      return queue;
    },

    /* attend la fin des écritures en cours */
    flush(){ return queue; },
    async close(){ await queue; await pool.end(); },
  };
}
