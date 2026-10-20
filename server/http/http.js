/* Petits outils HTTP sans dépendance : JSON, cookies, adresse du client. */

export class HttpError extends Error {
  constructor(status, code, message){ super(message); this.status = status; this.code = code; }
}

export function sendJson(res, status, data, headers = {}){
  const body = data === undefined ? '' : JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

export function sendError(res, status, code, message, headers = {}){
  sendJson(res, status, { error: { code, message } }, headers);
}

/* Lit un corps JSON. Exiger « application/json » protège des formulaires piégés d'autres sites (CSRF) :
   un site tiers ne peut pas envoyer ce type de requête vers le jeu sans y être autorisé. */
export function readJson(req, maxBytes){
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] ?? '');
    if(!type.toLowerCase().startsWith('application/json'))
      return reject(new HttpError(415, 'bad_request', 'Requête invalide (JSON attendu).'));
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if(size > maxBytes){ reject(new HttpError(413, 'bad_request', 'Requête trop grosse.')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if(!text) return resolve({});
      try {
        const v = JSON.parse(text);
        if(v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error();
        resolve(v);
      } catch { reject(new HttpError(400, 'bad_request', 'Requête invalide (JSON illisible).')); }
    });
    req.on('error', reject);
  });
}

export function parseCookies(header){
  const out = {};
  for(const part of String(header ?? '').split(';')){
    const i = part.indexOf('=');
    if(i < 0) continue;
    const k = part.slice(0, i).trim();
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* cookie illisible : ignoré */ }
  }
  return out;
}

/* Cookie de connexion : HttpOnly (le JavaScript de la page ne peut pas le lire, donc pas le voler),
   SameSite=Strict (jamais envoyé depuis un autre site). maxAge en ms ; 0 = suppression. */
export function sessionCookie({ name, secure }, token, maxAge){
  return [`${name}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict',
          `Max-Age=${Math.floor(maxAge / 1000)}`, ...(secure ? ['Secure'] : [])].join('; ');
}

/* Adresse du joueur. hops = nombre de relais de confiance devant le serveur (0 = adresse de la connexion).
   Chaque relais ajoute à droite de X-Forwarded-For l'adresse qu'il voit : on prend la hops-ième en partant de la
   droite. Le début de l'en-tête peut venir du joueur (falsifié pour changer d'adresse et contourner les limites
   de tentatives) : il n'est jamais lu tant que l'en-tête est assez long. (true = 1, ancien réglage) */
export function clientIp(req, hops){
  const n = hops === true ? 1 : Math.max(0, Math.floor(+hops || 0));
  if(n > 0){
    const header = req.headers['x-forwarded-for'];
    const list = (Array.isArray(header) ? header.join(',') : String(header ?? ''))
      .split(',').map(s => s.trim()).filter(Boolean);
    if(list.length) return normalizeIp(list[Math.max(0, list.length - n)]);
  }
  return normalizeIp(req.socket?.remoteAddress ?? '');
}

/* « ::ffff:1.2.3.4 » (IPv4 vue en IPv6) → « 1.2.3.4 » : une même adresse = une même clé de limite */
export function normalizeIp(ip){
  const s = String(ip).trim();
  return s.toLowerCase().startsWith('::ffff:') && s.includes('.') ? s.slice(7) : s;
}
