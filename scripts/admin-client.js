/* Partie commune des outils d'administration (give-item.js, set-judgment.js) : lit la clé DIM_ADMIN_TOKEN et le port
   dans le fichier de réglages du VPS, puis appelle une route /api/admin/… du jeu qui tourne (server/admin/routes.js).
   Options communes : --env (défaut /etc/deep-idle-mine.env, lisible avec sudo) · --url (défaut http://127.0.0.1:PORT,
   la machine elle-même : la route refuse tout le reste). */
import fs from 'node:fs';

export const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
export const fail = msg => { console.error(msg); process.exit(1); };

/* réglages au format systemd (KEY=valeur, # commentaires) ; l'environnement déjà défini l'emporte */
function readEnv(file){
  const out = {};
  if(!fs.existsSync(file)) return out;
  for(const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)){
    if(line.trim().startsWith('#')) continue;
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if(m) out[m[1]] = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }
  return out;
}

/* POST sur une route d'administration ; renvoie la réponse (JSON) si elle est acceptée, sinon s'arrête avec le message */
export async function adminPost(route, body){
  const envFile = arg('env', '/etc/deep-idle-mine.env');
  let env;
  try { env = { ...readEnv(envFile), ...process.env }; }
  catch(e){ fail(`Impossible de lire ${envFile} (${e.code ?? e.message}) : lance la commande avec sudo.`); }
  const token = env.DIM_ADMIN_TOKEN;
  if(!token) fail(`Pas de clé DIM_ADMIN_TOKEN (${envFile}) : ajoute-la, puis redémarre le jeu une fois (voir docs/deploiement-ovh.md).`);
  const url = arg('url', `http://127.0.0.1:${env.PORT || 8000}`);

  let res;
  try {
    res = await fetch(url + route, { method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  } catch(e){ fail(`Le jeu ne répond pas sur ${url} (${e.cause?.code ?? e.message}). Est-il lancé ?`); }
  const data = await res.json().catch(() => null);
  if(res.ok) return data;
  if(res.status === 404 && data?.error?.code === 'not_found')
    fail('Administration fermée : la clé ne correspond pas, ou le jeu n\'a pas été redémarré depuis l\'ajout de DIM_ADMIN_TOKEN.');
  fail(data?.error?.message ?? `Erreur ${res.status}.`);
}
