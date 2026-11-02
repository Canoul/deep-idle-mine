/* Copie les fichiers du jeu DANS l'appli (mobile/www) : l'appli s'ouvre sans réseau et seuls les appels au serveur y passent.
   Le contenu vient de server/app-update/bundle.js, la recette que le serveur utilise aussi pour publier les mises à jour à chaud :
   l'appli fabriquée et le serveur du même commit ont la même version du jeu. Fichier généré, jamais dans git.

     node scripts/copy-web.js                    pour l'appli (serveur : https://deepmineidle.fr)
     node scripts/copy-web.js --api http://…     autre serveur (essais)   ·  --out dossier : autre destination */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_URL, MANIFEST, bundleFiles, manifestOf } from '../../server/app-update/bundle.js';

export { API_URL, appIndex } from '../../server/app-update/bundle.js';
const MOBILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function copyWeb({ out = path.join(MOBILE, 'www'), api = API_URL } = {}){
  fs.rmSync(out, { recursive: true, force: true });
  const files = bundleFiles({ api });
  for(const [rel, data] of files){
    fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
    fs.writeFileSync(path.join(out, rel), data);
  }
  fs.writeFileSync(path.join(out, MANIFEST), JSON.stringify(manifestOf(files)));
  return out;
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
  console.log(`Jeu copié dans ${copyWeb({ out: arg('out') && path.resolve(arg('out')), api: arg('api') })}`);
}
