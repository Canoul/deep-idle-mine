/* Paquet du jeu de l'appli mobile (02/11/2026, mises à jour à chaud) : les fichiers que l'appli embarque, et leur manifeste.
   UNE seule recette pour la copie embarquée à la fabrication (mobile/scripts/copy-web.js) et pour le paquet que le serveur
   publie aux applis installées (server/app-update/routes.js) : même commit = même paquet = même version.

   Le site n'est pas touché : la page de l'appli est une copie de index.html, réécrite ici. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from '../config.js';
import { APP_UPDATE } from '../../src/config.js';

export const API_URL = 'https://deepmineidle.fr';
export const MANIFEST = 'bundle.json';     // manifeste rangé avec les fichiers : l'appli y lit sa propre version

/* page de l'appli : polices dans l'appli (pas de Google Fonts au démarrage), pas de zoom, bord à bord, adresse du serveur avant le
   jeu, gardien des mises à jour (src/app/guard.js) avant src/main.js */
export function appIndex(html){
  return html
    .replace(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n?/g, '')
    .replace('<link rel="stylesheet" href="src/ui/style.css">', '<link rel="stylesheet" href="fonts/fonts.css">\n<link rel="stylesheet" href="src/ui/style.css">')
    .replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">')
    .replace(/<title>[^<]*<\/title>/, '<title>Deep Mine Idle MMO</title>')
    .replace('<script src="src/boot-check.js"></script>', '<script src="app-config.js"></script>\n<script src="src/boot-check.js"></script>\n<script type="module" src="src/app/guard.js"></script>');
}

export const appConfig = api => `/* écrit par server/app-update/bundle.js */\nwindow.DIM_APP = { api: ${JSON.stringify(api)} };\n`;

/* fichiers d'un dossier, chemins relatifs en / */
function walk(dir, rel, out, skip){
  for(const e of fs.readdirSync(dir, { withFileTypes: true })){
    const r = rel ? `${rel}/${e.name}` : e.name;
    if(skip(r)) continue;
    if(e.isDirectory()) walk(path.join(dir, e.name), r, out, skip);
    else if(e.isFile()) out.set(r, fs.readFileSync(path.join(dir, e.name)));
  }
}

/* contenu du paquet : Map chemin → octets, triée. src/wiki : le wiki s'ouvre dans le navigateur du téléphone */
export function bundleFiles({ root = ROOT, api = API_URL } = {}){
  const files = new Map();
  walk(path.join(root, 'src'), 'src', files, r => r === 'src/wiki');
  walk(path.join(root, 'textures'), 'textures', files, () => false);
  walk(path.join(root, 'mobile', 'assets', 'fonts'), 'fonts', files, () => false);
  files.set('index.html', Buffer.from(appIndex(fs.readFileSync(path.join(root, 'index.html'), 'utf8'))));
  files.set('app-config.js', Buffer.from(appConfig(api)));
  return new Map([...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

export const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

/* version = empreinte du contenu : un commit qui ne touche ni le jeu ni ses fichiers (doc, serveur) ne déclenche aucun téléchargement */
export function manifestOf(files, { minNative = APP_UPDATE.minNative } = {}){
  const hashes = Object.fromEntries([...files].map(([p, b]) => [p, sha256(b)]));
  const version = sha256(Object.entries(hashes).map(([p, h]) => `${p} ${h}\n`).join('')).slice(0, 16);
  return { version, minNative, files: hashes };
}
