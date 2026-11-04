/* Mises à jour à chaud de l'appli mobile (02/11/2026) : le serveur publie le paquet du jeu de SON commit (server/app-update/bundle.js),
   l'appli le récupère au démarrage (src/app/updater.js). Le site n'utilise rien de tout ça.

     GET  /api/app/update?have=<version>   manifeste { version, minNative, files: { chemin: sha256 } } ; { same: true } sans la
                                           liste si l'appli a déjà cette version
     GET  /app-bundle/<version>/<chemin>   un fichier du paquet en cours (version périmée : 404, l'appli réessaiera plus tard)
     POST /api/app/rollback                une nouvelle version n'a pas démarré sur un téléphone : une ligne dans le journal
     GET  /api/app/latest                  { android, ios } : dernière appli sur les stores (04/11, server/app-update/latest.js)

   Les fichiers sont lus une fois, au démarrage du serveur (1,8 Mo en mémoire) : rien n'est servi depuis le disque ici. */
import { APP_UPDATE, ADMIN_VIEW } from '../../src/config.js';
import { nameKey } from '../../src/shared/account.js';
import { API_URL, bundleFiles, manifestOf } from './bundle.js';

export function createAppUpdate({ files, api = API_URL, minNative = APP_UPDATE.minNative } = {}){
  const content = files ?? bundleFiles({ api, published: true });   // index.html marqué (03/11, bundle.js)
  const manifest = manifestOf(content, { minNative });
  /* relevé (03/11/2026, diagnostic des mises à jour, compte admin) : en mémoire, perdu au redémarrage ; ni IP ni compte */
  const trace = { since: Date.now(), checks: [], files: {}, rollbacks: [] };
  return { manifest, trace, file: (version, p) => version === manifest.version ? content.get(p) ?? null : null };
}
const TRACE_MAX = 100;
const pushMax = (list, e) => { list.unshift(e); if(list.length > TRACE_MAX) list.length = TRACE_MAX; };
const shortUa = ua => String(ua ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, 160);
const isAdmin = ctx => !!ctx.me && !ctx.me.guest && ADMIN_VIEW.names.some(n => nameKey(n) === nameKey(String(ctx.me.name ?? '')));

const ID = /^[\w.-]{1,40}$/;     // version, nom de plateforme : rien d'autre ne va dans le journal
const clean = v => typeof v === 'string' && ID.test(v) ? v : '?';

export function appUpdateRoutes(update, { log = console.log, now = Date.now, perHour = APP_UPDATE.rollbacksPerHour } = {}){
  let hour = 0, logged = 0;
  return {
    'GET /api/app/update': async ctx => {
      const have = new URL(ctx.req.url, 'http://x').searchParams.get('have');
      const { version, minNative } = update.manifest;
      if(update.trace) pushMax(update.trace.checks, { at: now(), have: clean(have ?? ''), answer: have === version ? 'même version' : 'mise à jour proposée',
        origin: shortUa(ctx.req.headers.origin ?? '—').slice(0, 60), ua: shortUa(ctx.req.headers['user-agent']) });
      return have === version ? { version, minNative, same: true } : update.manifest;
    },
    'GET /api/app/latest': async () => update.latest ? update.latest.get() : { ...APP_UPDATE.latest },
    /* n'importe qui peut appeler cette route : rien n'est gardé, le journal est plafonné */
    'POST /api/app/rollback': async ctx => {
      const h = Math.floor(now() / 3600e3);
      if(h !== hour){ hour = h; logged = 0; }
      if(++logged <= perHour){
        const b = ctx.body ?? {};
        log(`Appli : retour en arrière ${clean(b.from)} → ${clean(b.to)} (${clean(b.why)}, ${clean(b.platform)}, coque ${clean(b.native)})`);
        if(update.trace) pushMax(update.trace.rollbacks, { at: now(), from: clean(b.from), to: clean(b.to), why: clean(b.why), platform: clean(b.platform), native: clean(b.native),
          ...(typeof b.detail === 'string' ? { detail: shortUa(b.detail).slice(0, 200) } : {}) });
      }
      return [204];
    },
    /* relevé des demandes (03/11/2026) : comptes de l'équipe seulement (ADMIN_VIEW) ; les autres : « route inconnue » */
    'GET /api/app/update/trace': async ctx => {
      if(!isAdmin(ctx)){ const e = new Error('Route inconnue.'); e.status = 404; e.code = 'not_found'; throw e; }
      const { version, minNative } = update.manifest;
      return { version, minNative, fileCount: Object.keys(update.manifest.files).length, ...(update.trace ?? {}) };
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
  const t = update.trace;
  if(t){ const v = cut > 0 ? clean(p.slice(0, cut)) : '?', f = (t.files[v] ??= { ok: 0, missing: 0, last: 0 }); f[data ? 'ok' : 'missing']++; f.last = Date.now(); }
  if(!data){ res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end('Introuvable'); return true; }
  /* octet-stream : l'appli vérifie l'empreinte et range le fichier, un navigateur ne l'exécute jamais depuis cette adresse */
  res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'public, max-age=31536000, immutable' });
  res.end(req.method === 'HEAD' ? undefined : data);
  return true;
}
