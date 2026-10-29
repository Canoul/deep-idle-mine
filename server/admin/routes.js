/* Routes d'administration (/api/admin/…) : réservées aux créateurs du jeu, depuis le serveur lui-même.
   Exemple sur le VPS (la clé est dans /etc/deep-idle-mine.env, DIM_ADMIN_TOKEN) :
     curl -X POST http://127.0.0.1:8000/api/admin/give -H "Authorization: Bearer CLÉ" \
          -H "Content-Type: application/json" -d '{"name":"crousti","item":"Treasure T3","qty":1}'
     (« quality »: 1 à 7, facultatif : une pièce de stuff déjà identifiée dans cette qualité)
   POST /api/admin/take {"name":"crousti","item":"Glyphe Ruée","qty":1} : retire un objet (inventaire, ou glyphe posé) (scripts/take-item.js).
   POST /api/admin/judgment {"side":"demon","count":175} : règle une jauge du Jugement (scripts/set-judgment.js).
   POST /api/admin/stats {} : lignes du tableau de bord (scripts/dashboard.js).
   POST /api/admin/khole {"name":"crousti","map":2} : ouvre un k hole dans sa session en cours (scripts/force-khole.js).
   POST /api/admin/party-move {"name":"crousti","to":"canoul"} : met crousti dans le lobby de canoul (scripts/move-to-lobby.js).
   POST /api/admin/party-ready {"name":"crousti","ready":true,"always":true} : prêt / prêt tout le temps (scripts/set-ready.js).

   Une requête n'est acceptée que si les TROIS conditions sont réunies, sinon la route répond « Route inconnue » (404),
   comme si elle n'existait pas :
   1. une clé est réglée (DIM_ADMIN_TOKEN, 32 caractères au moins) et la requête porte exactement la même ;
   2. la connexion vient de la machine elle-même (127.0.0.1 ou ::1) ;
   3. elle n'est pas passée par un relais : aucun en-tête X-Forwarded-For / Forwarded / X-Real-IP (Caddy en ajoute
      toujours un : une requête venue d'internet est donc refusée même si elle connaît la clé).
   Le dépôt est public : la clé n'est jamais dans git. */
import crypto from 'node:crypto';
import { HttpError } from '../http/http.js';
import { nameKey } from '../../src/shared/account.js';

export const ADMIN_TOKEN_MIN = 32;
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const RELAY_HEADERS = ['x-forwarded-for', 'forwarded', 'x-real-ip'];
const hidden = () => new HttpError(404, 'not_found', 'Route inconnue.');

/* même clé ? (comparaison à temps constant, sur les empreintes : pas de fuite de longueur) */
function sameToken(given, token){
  const h = s => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(h(given), h(token));
}
/* la requête a-t-elle le droit d'administrer ? */
export function adminAllowed(req, token){
  if(typeof token !== 'string' || token.length < ADMIN_TOKEN_MIN) return false;
  if(!LOOPBACK.has(req.socket?.remoteAddress ?? '')) return false;
  if(RELAY_HEADERS.some(h => req.headers[h] !== undefined)) return false;
  const m = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''));
  return !!m && sameToken(m[1], token);
}

/* accounts : le stockage des comptes (findAccountByName) ; game : le service de jeu (adminGive, adminTake, adminJudgment) ;
   party : le service des groupes (adminMove, adminReady), facultatif */
export function adminRoutes({ accounts, game, party = null, token }){
  const guard = ctx => { if(!adminAllowed(ctx.req, token)) throw hidden(); };
  /* compte désigné par son pseudo (champ `field` du corps) */
  const byName = async (ctx, field = 'name') => {
    const name = ctx.body?.[field];
    if(typeof name !== 'string' || !name.trim()) throw new HttpError(400, 'bad_request', `${field} : le pseudo du joueur.`);
    const acc = await accounts.findAccountByName(nameKey(name));
    if(!acc) throw new HttpError(404, 'no_account', `Aucun compte « ${name} ».`);
    return acc;
  };
  const noParty = () => { if(!party) throw new HttpError(503, 'no_party_service', 'Groupes indisponibles sur ce serveur.'); };
  const members = r => r.party.members.map(m => `${m.name}${m.leader ? ' (chef)' : m.always ? ' (prêt tout le temps)' : m.ready ? ' (prêt)' : ''}`).join(', ');
  return {
    /* lobbies (29/10/2026, Geoffrey) : déplacer un joueur dans le lobby d'un autre, le mettre prêt */
    'POST /api/admin/party-move': async ctx => {
      guard(ctx); noParty();
      const acc = await byName(ctx), host = await byName(ctx, 'to');
      const r = await party.adminMove(acc, host);
      console.log(`Admin : ${acc.name} (${acc.id}) ${r.moved ? 'mis' : 'déjà'} dans le lobby de ${host.name} (${r.party.code}) : ${members(r)}`);
      return { account: acc.name, host: host.name, ...r };
    },
    'POST /api/admin/party-ready': async ctx => {
      guard(ctx); noParty();
      const acc = await byName(ctx);
      const r = await party.adminReady(acc, { ready: ctx.body?.ready, always: ctx.body?.always });
      console.log(`Admin : prêt pour ${acc.name} (${acc.id}), lobby ${r.party.code} : ${members(r)}`);
      return { account: acc.name, ...r };
    },
    'POST /api/admin/give': async ctx => {
      guard(ctx);
      const { name, item, quality } = ctx.body ?? {}, qty = ctx.body?.qty ?? 1;
      if(typeof name !== 'string' || !name.trim()) throw new HttpError(400, 'bad_request', 'name : le pseudo du joueur.');
      const acc = await accounts.findAccountByName(nameKey(name));
      if(!acc) throw new HttpError(404, 'no_account', `Aucun compte « ${name} ».`);
      const r = await game.adminGive(acc.id, item, qty, quality);
      console.log(`Admin : +${r.qty} ${r.item}${r.quality ? ` R${r.quality}` : ''} pour ${acc.name} (${acc.id}) : ${r.before} → ${r.after}`);
      return { account: acc.name, ...r };
    },
    'POST /api/admin/take': async ctx => {
      guard(ctx);
      const { name } = ctx.body ?? {}, qty = ctx.body?.qty ?? 1;
      if(typeof name !== 'string' || !name.trim()) throw new HttpError(400, 'bad_request', 'name : le pseudo du joueur.');
      const acc = await accounts.findAccountByName(nameKey(name));
      if(!acc) throw new HttpError(404, 'no_account', `Aucun compte « ${name} ».`);
      const r = await game.adminTake(acc.id, ctx.body?.item, qty);
      console.log(`Admin : -${r.qty} ${r.item} pour ${acc.name} (${acc.id}) : ${r.before} → ${r.after}${r.fromSkill ? ' (retiré de son skill)' : ''}`);
      return { account: acc.name, ...r };
    },
    'POST /api/admin/khole': async ctx => {
      guard(ctx);
      const { name } = ctx.body ?? {}, map = ctx.body?.map ?? 0;
      if(typeof name !== 'string' || !name.trim()) throw new HttpError(400, 'bad_request', 'name : le pseudo du joueur.');
      const acc = await accounts.findAccountByName(nameKey(name));
      if(!acc) throw new HttpError(404, 'no_account', `Aucun compte « ${name} ».`);
      const r = await game.adminKhole(acc.id, map);
      console.log(`Admin : k hole (${r.map}) dans la session ${r.session} de ${acc.name} (${acc.id}), tick ${r.tick}`);
      return { account: acc.name, ...r };
    },
    /* tableau de bord de l'équipe : lignes de stats des mines classiques (scripts/dashboard.js) */
    'POST /api/admin/stats': async ctx => {
      guard(ctx);
      return { rows: await game.adminStats() };
    },
    'POST /api/admin/judgment': async ctx => {
      guard(ctx);
      const r = await game.adminJudgment(ctx.body?.side, ctx.body?.count);
      console.log(`Admin : jauge ${r.side} ${r.before} → ${r.after} / ${r.cap}${r.open ? ' (tour ouverte)' : ''}`);
      return r;
    },
  };
}
