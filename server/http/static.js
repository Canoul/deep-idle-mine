/* Fichiers du jeu (page, modules, textures). Liste blanche : seuls les chemins publics sont servis,
   jamais le dossier data/ (comptes) ni le code du serveur. */
import fs from 'node:fs/promises';
import path from 'node:path';

const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.png':'image/png', '.json':'application/json; charset=utf-8', '.md':'text/markdown; charset=utf-8',
  '.svg':'image/svg+xml', '.ico':'image/x-icon' };

/* chemin d'adresse → fichier sur disque, ou null s'il n'est pas public */
export function resolvePublic(root, publicPaths, urlPath){
  let p;
  try { p = decodeURIComponent(urlPath); } catch { return null; }
  if(p === '/') p = '/index.html';
  if(p.includes('\0')) return null;
  const file = path.resolve(root, '.' + path.posix.normalize(p));
  if(!file.startsWith(root + path.sep)) return null;
  const rel = '/' + path.relative(root, file).split(path.sep).join('/');
  const ok = publicPaths.some(pub => pub.endsWith('/') ? rel.startsWith(pub) : rel === pub);
  return ok ? file : null;
}

export async function serveStatic(req, res, root, publicPaths){
  if(req.method !== 'GET' && req.method !== 'HEAD'){ res.writeHead(405); return res.end(); }
  const file = resolvePublic(root, publicPaths, req.url.split('?')[0]);
  if(!file){ res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); return res.end('Introuvable'); }
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); res.end('Introuvable');
  }
}
