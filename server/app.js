/* Application HTTP : l'API (/api/…) et les fichiers du jeu. Ne démarre rien elle-même (voir server/main.js),
   ce qui permet de la tester sur un port libre avec un stockage en mémoire.

   Une route est une fonction async (ctx) → réponse :
     objet          → 200 + JSON
     [statut, obj]  → ce statut + JSON (obj absent = corps vide) */
import { nameBanned } from './moderation/filter.js';
import { MODERATION } from '../src/config.js';
import { SERVER } from './config.js';
import { HttpError, sendJson, sendError, readJson, parseCookies, sessionCookie, clientIp } from './http/http.js';
import { serveStatic } from './http/static.js';
import { createAccountService, AccountError } from './accounts/service.js';
import { accountRoutes } from './accounts/routes.js';
import { gameRoutes } from './game/routes.js';
import { partyRoutes } from './party/routes.js';
import { instantRoutes } from './instant/routes.js';
import { socialRoutes } from './social/routes.js';
import { guildRoutes } from './guild/routes.js';
import { giantRoutes } from './giant/routes.js';
import { townRoutes } from './town/routes.js';
import { adminRoutes } from './admin/routes.js';

/* game : service des sessions de jeu (server/game/service.js) ; sans lui, seules les routes de comptes existent.
   party : service des groupes (server/party/service.js) ; il prend en charge « Lancer la session ».
   instant : inscriptions à la mine instantanée (server/instant/service.js) ; social : amis (server/social/service.js) ;
   giant : Bloc géant (server/giant/service.js) ; town : le Carreau, ville du spawn (server/town/service.js). */
/* « 31/10 à 14:05 », heure de Paris */
const banDate = t => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  .format(new Date(t)).replace(' ', ' à ');

export function createApp({ store, root, config = SERVER, service, game, party, instant, social, guild, giant, town, moderation } = {}){
  const accounts = service ?? createAccountService({ store });
  /* les futures routes (sauvegarde…) s'ajoutent ici, chacune dans son module */
  const routes = { ...accountRoutes(accounts, { onRename: (id, name) => party?.rename(id, name) }), ...(game ? gameRoutes(game) : {}), ...(party ? partyRoutes(party) : {}),
                   ...(instant ? instantRoutes(instant) : {}), ...(social ? socialRoutes(social) : {}), ...(guild ? guildRoutes(guild) : {}), ...(giant ? giantRoutes(giant) : {}),
                   ...(town ? townRoutes(town) : {}),
                   /* administration : depuis le serveur lui-même, avec la clé DIM_ADMIN_TOKEN (server/admin/routes.js) */
                   ...(game && store ? adminRoutes({ accounts: store, game, party, moderation, social, token: config.adminToken }) : {}),
                   /* modération du chat (30/10) : ses avertissements et son ban, vus par le joueur */
                   ...(moderation ? { 'GET /api/moderation/me': async ctx => ctx.me ? moderation.status(ctx.me.id) : { warnings: 0, max: 0, bannedUntil: 0 } } : {}) };
  let proxyChecked = !config.logProxyCheck;

  /* une fois par démarrage : l'adresse retenue et l'en-tête reçu, pour vérifier le réglage des relais en ligne */
  function logProxyCheck(req, ip){
    if(proxyChecked) return;
    proxyChecked = true;
    console.log(`Contrôle proxy : adresse retenue ${ip} · X-Forwarded-For « ${req.headers['x-forwarded-for'] ?? ''} » `+
                `· relais de confiance ${config.trustProxy}`);
  }

  async function handleApi(req, res, pathname){
    const route = routes[`${req.method} ${pathname}`];
    if(!route){
      const exists = Object.keys(routes).some(k => k.endsWith(' ' + pathname));
      return exists ? sendError(res, 405, 'bad_request', 'Méthode non autorisée.')
                    : sendError(res, 404, 'not_found', 'Route inconnue.');
    }
    const cookies = [];
    const token = parseCookies(req.headers.cookie)[config.cookie.name];
    const auth = token ? await accounts.authenticate(token) : null;
    if(token && !auth) cookies.push(sessionCookie(config.cookie, '', 0));                      // jeton périmé : on l'efface
    if(auth?.renewed) cookies.push(sessionCookie(config.cookie, token, auth.renewed));          // connexion prolongée

    const ip = clientIp(req, config.trustProxy);
    logProxyCheck(req, ip);
    const ctx = {
      req, ip, me: auth?.account ?? null, body: {},
      login: r => { cookies.length = 0; cookies.push(sessionCookie(config.cookie, r.token, r.maxAge)); },
      logout: async () => { await accounts.logout(token); cookies.length = 0; cookies.push(sessionCookie(config.cookie, '', 0)); },
    };
    try {
      /* joueur banni (modération du chat, 30/10) : plus aucune action (POST), sauf son compte (connexion, déconnexion…) et
         l'administration ; lire reste permis (le jeu s'affiche, avec le message du ban) */
      if(moderation && ctx.me && req.method === 'POST' && !pathname.startsWith('/api/account/') && !pathname.startsWith('/api/admin/')){
        const until = await moderation.bannedUntil(ctx.me.id);
        if(until) throw new HttpError(403, 'banned', `Tu es banni du jeu jusqu'au ${banDate(until)} (${MODERATION.warnings} avertissements pour langage interdit dans le chat).`);
      }
      /* pseudo interdit (31/10/2026) : plus aucune action tant qu'il n'est pas changé ; lire reste permis */
      if(ctx.me && req.method === 'POST' && !pathname.startsWith('/api/account/') && !pathname.startsWith('/api/admin/') && nameBanned(ctx.me.name))
        throw new HttpError(403, 'must_rename', 'Change ton pseudo pour continuer.');
      if(req.method === 'POST') ctx.body = await readJson(req, config.maxBodyBytes);
      const out = await route(ctx);
      const [status, data] = Array.isArray(out) ? out : [200, out];
      const headers = cookies.length ? { 'Set-Cookie': cookies } : {};
      if(data === undefined){ res.writeHead(status, { 'Cache-Control':'no-store', ...headers }); return res.end(); }
      sendJson(res, status, data, headers);
    } catch(e){
      e.cookies = cookies;    // un jeton périmé est effacé même quand la route répond par une erreur
      throw e;
    }
  }

  return async function handler(req, res){
    for(const [k, v] of Object.entries(config.securityHeaders ?? {})) res.setHeader(k, v);
    if(config.cookie?.secure && config.hsts) res.setHeader('Strict-Transport-Security', config.hsts);
    const pathname = req.url.split('?')[0];
    try {
      if(pathname === '/api' || pathname.startsWith('/api/')) return await handleApi(req, res, pathname);
      return await serveStatic(req, res, root, config.publicPaths);
    } catch(e){
      if(res.headersSent) return res.end();
      if(e instanceof AccountError || e instanceof HttpError || e.status){
        const headers = {};
        if(e.retryAfter) headers['Retry-After'] = String(e.retryAfter);
        if(e.cookies?.length) headers['Set-Cookie'] = e.cookies;
        return sendError(res, e.status, e.code, e.message, headers);
      }
      console.error(e);
      sendError(res, 500, 'server_error', 'Erreur du serveur.');
    }
  };
}
