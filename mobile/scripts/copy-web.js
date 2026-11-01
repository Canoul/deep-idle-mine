/* Copie les fichiers du jeu DANS l'appli (mobile/www) : l'appli s'ouvre sans réseau et seuls les appels au serveur y passent.
   Le site n'est pas touché : la page de l'appli est une copie de index.html, réécrite ici. Fichier généré, jamais dans git.

     node scripts/copy-web.js                    pour l'appli (serveur : https://deepmineidle.fr)
     node scripts/copy-web.js --api http://…     autre serveur (essais)   ·  --out dossier : autre destination */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), MOBILE = path.resolve(HERE, '..'), ROOT = path.resolve(MOBILE, '..');
export const API_URL = 'https://deepmineidle.fr';

/* page de l'appli : polices dans l'appli (pas de Google Fonts au démarrage), pas de zoom, bord à bord, adresse du serveur avant le jeu */
export function appIndex(html){
  return html
    .replace(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n?/g, '')
    .replace('<link rel="stylesheet" href="src/ui/style.css">', '<link rel="stylesheet" href="fonts/fonts.css">\n<link rel="stylesheet" href="src/ui/style.css">')
    .replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">')
    .replace(/<title>[^<]*<\/title>/, '<title>Deep Mine Idle MMO</title>')
    .replace('<script src="src/boot-check.js"></script>', '<script src="app-config.js"></script>\n<script src="src/boot-check.js"></script>');
}

export function copyWeb({ out = path.join(MOBILE, 'www'), api = API_URL } = {}){
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  /* src/wiki : le wiki s'ouvre dans le navigateur du téléphone */
  fs.cpSync(path.join(ROOT, 'src'), path.join(out, 'src'), { recursive: true, filter: f => !f.includes(`${path.sep}src${path.sep}wiki`) });
  fs.cpSync(path.join(ROOT, 'textures'), path.join(out, 'textures'), { recursive: true });
  fs.cpSync(path.join(MOBILE, 'assets', 'fonts'), path.join(out, 'fonts'), { recursive: true });
  fs.writeFileSync(path.join(out, 'index.html'), appIndex(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));
  fs.writeFileSync(path.join(out, 'app-config.js'), `/* écrit par mobile/scripts/copy-web.js */\nwindow.DIM_APP = { api: ${JSON.stringify(api)} };\n`);
  return out;
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
  console.log(`Jeu copié dans ${copyWeb({ out: arg('out') && path.resolve(arg('out')), api: arg('api') })}`);
}
