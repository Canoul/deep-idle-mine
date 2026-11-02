/* Mises à jour à chaud de l'appli mobile (02/11/2026) : le serveur publie le paquet du jeu de SON commit (server/app-update/bundle.js),
   l'appli le récupère au démarrage (src/app/updater.js). Le site n'utilise rien de tout ça.

     GET  /api/app/update?have=<version>   manifeste { version, minNative, files: { chemin: sha256 } } ; { same: true } sans la
                                           liste si l'appli a déjà cette version
     GET  /app-bundle/<version>/<chemin>   un fichier du paquet en cours (version périmée : 404, l'appli réessaiera plus tard)
     POST /api/app/rollback                une nouvelle version n'a pas démarré sur un téléphone : une ligne dans le journal

   Les fichiers sont lus une fois, au démarrage du serveur (1,8 Mo en mémoire) : rien n'est servi depuis le disque ici. */
import { APP_UPDATE } from '../../src/config.js';
import { API_URL, bundleFiles, manifestOf } from './bundle.js';

export function createAppUpdate({ files, api = API_URL, minNative = APP_UPDATE.minNative } = {}){
  const content = files ?? bundleFiles({ api });
  const manifest = manifestOf(content, { minNative });
  return { manifest, file: (version, p) => version === manifest.version ? content.get(p) ?? null : null };
}

const ID = /^[\w.-]{1,40}$/;     // version, nom de plateforme : rien d'autre ne va dans le journal
const clean = v => typeof v === 'string' && ID.test(v) ? v : '?';

export function appUpdateRoutes(update, { log = console.log, now = Date.now, perHour = APP_UPDATE.rollbacksPerHour } = {}){
  let hour = 0, logged = 0;
  return {
    'GET /api/app/update': async ctx => {
      const have = new URL(ctx.req.url, 'http://x').searchParams.get('have');
      const { version, minNative } = update.manifest;
      return have === version ? { version, minNative, same: true } : update.manifest;
    },
    /* n'importe qui peut appeler cette route : rien n'est gardé, le journal est plafonné */
    'POST /api/app/rollback': async ctx => {
      const h = Math.floor(now() / 3600e3);
      if(h !== hour){ hour = h; logged = 0; }
      if(++logged <= perHour){
        const b = ctx.body ?? {};
        log(`Appli : retour en arrière ${clean(b.from)} → ${clean(b.to)} (${clean(b.why)}, ${clean(b.platform)}, coque ${clean(b.native)})`);
      }
      return [204];
    },
  };
}

/* GET /app-bundle/<version>/<chemin> ; true si la requête a été traitée */
export function serveBundleFile(req, res, update, pathname){
  if(!pathname.startsWith('/app-bundle/')) return false;
  if(req.method !== 'GET' && req.method !== 'HEAD'){ res.writeHead(405); res.end(); return true; }
  let p;
  try { p = decodeURIComponent(pathname.slice('/app-bundle/'.length)); } catch { p = ''; }
  const cut = p.indexOf('/');
  const data = cut > 0 ? update.file(p.slice(0, cut), p.slice(cut + 1)) : null;
  if(!data){ res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end('Introuvable'); return true; }
  /* octet-stream : l'appli vérifie l'empreinte et range le fichier, un navigateur ne l'exécute jamais depuis cette adresse */
  res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'public, max-age=31536000, immutable' });
  res.end(req.method === 'HEAD' ? undefined : data);
  return true;
}
