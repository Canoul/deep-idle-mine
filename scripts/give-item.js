/* Outil d'administration : donne un objet du jeu à un joueur (ex. un Treasure T3), SANS redémarrer le jeu.
   Le script demande au serveur qui tourne de le faire (route /api/admin/give, server/admin/routes.js) : le joueur le
   voit tout de suite, même en pleine session. Réservé aux créateurs du jeu, sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/give-item.js --name crousti --item "Treasure T3" --qty 1

   --name : pseudo du compte (majuscules et accents ignorés) · --item : nom exact d'un objet du jeu ·
   --qty : 1 à 1000 (1 par défaut) · --env : fichier de réglages (défaut /etc/deep-idle-mine.env, lisible avec sudo),
   d'où viennent la clé DIM_ADMIN_TOKEN et le port PORT (8000 par défaut) · --url : adresse du jeu (défaut
   http://127.0.0.1:PORT, la machine elle-même : la route refuse tout le reste). */
import fs from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const fail = msg => { console.error(msg); process.exit(1); };

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

const name = arg('name'), item = arg('item'), qty = Number(arg('qty', '1'));
if(!name) fail('--name : le pseudo du joueur.');
if(!item) fail('--item : le nom exact de l\'objet (ex. "Treasure T3").');
if(!Number.isSafeInteger(qty) || qty < 1 || qty > 1000) fail('--qty : un entier de 1 à 1000.');
const envFile = arg('env', '/etc/deep-idle-mine.env');
let env;
try { env = { ...readEnv(envFile), ...process.env }; }
catch(e){ fail(`Impossible de lire ${envFile} (${e.code ?? e.message}) : lance la commande avec sudo.`); }
const token = env.DIM_ADMIN_TOKEN;
if(!token) fail(`Pas de clé DIM_ADMIN_TOKEN (${envFile}) : ajoute-la, puis redémarre le jeu une fois (voir docs/deploiement-ovh.md).`);
const url = arg('url', `http://127.0.0.1:${env.PORT || 8000}`);

let res;
try {
  res = await fetch(url + '/api/admin/give', { method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ name, item, qty }) });
} catch(e){ fail(`Le jeu ne répond pas sur ${url} (${e.cause?.code ?? e.message}). Est-il lancé ?`); }
const data = await res.json().catch(() => null);
if(res.ok) console.log(`+${data.qty} ${data.item} pour « ${data.account} » (${data.before} → ${data.after}). Aucun redémarrage nécessaire.`);
else if(res.status === 404 && data?.error?.code === 'not_found')
  fail('Administration fermée : la clé ne correspond pas, ou le jeu n\'a pas été redémarré depuis l\'ajout de DIM_ADMIN_TOKEN.');
else fail(data?.error?.message ?? `Erreur ${res.status}.`);
