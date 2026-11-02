/* Routes d'administration (/api/admin/…) : réservées aux créateurs du jeu, depuis le serveur lui-même.
   Exemple sur le VPS (la clé est dans /etc/deep-idle-mine.env, DIM_ADMIN_TOKEN) :
     curl -X POST http://127.0.0.1:8000/api/admin/give -H "Authorization: Bearer CLÉ" \
          -H "Content-Type: application/json" -d '{"name":"crousti","item":"Treasure T3","qty":1}'
     (« quality »: 1 à 7, facultatif : une pièce de stuff déjà identifiée dans cette qualité)
   POST /api/admin/moderation {"name":"crousti","action":"show"} : avertissements et bans (unban, forgive, recent) (scripts/moderation.js).
   Modération (01/11/2026), « name » = pseudo ou ID de compte (un invité n'a pas de pseudo), « by » = qui agit, pour le journal :
   POST /api/admin/reports {"name":"crousti","open":true} : signalements ; {"action":"close","id":12} : traité (scripts/reports.js).
   POST /api/admin/chat-recent {"name":"crousti"} : derniers messages du chat global ; POST /api/admin/chat-delete {"id":42} : le supprime (scripts/delete-message.js).
   POST /api/admin/mute {"name":"crousti","hours":24} : plus de chat ; {"off":true} : levé (scripts/mute.js).
   POST /api/admin/ban {"name":"crousti","days":7,"reason":"…"} : compte suspendu, sans days = définitif ; {"off":true} : levé (scripts/ban.js).
   POST /api/admin/rename {"name":"crousti","to":"Nouveau"} : force un pseudo (scripts/rename.js).
   POST /api/admin/mod-log {"limit":50} : journal de ces actions (scripts/reports.js --log).
   POST /api/admin/delete-account {"name":"crousti"} : dit quel compte serait supprimé ; avec "confirm":true, le supprime (scripts/delete-account.js).
   POST /api/admin/take {"name":"crousti","item":"Glyphe Ruée","qty":1} : retire un objet (inventaire, ou glyphe posé) (scripts/take-item.js).
   POST /api/admin/judgment {"side":"demon","count":175} : règle une jauge du Jugement (scripts/set-judgment.js).
   POST /api/admin/stats {} : lignes du tableau de bord (scripts/dashboard.js).
   POST /api/admin/prison-stats {} : rendement de la prison par joueur (scripts/dashboard-prison.js).
   POST /api/admin/khole {"name":"crousti","map":2} : ouvre un k hole dans sa session en cours (scripts/force-khole.js).
   POST /api/admin/party-move {"name":"crousti","to":"canoul"} : met crousti dans le lobby de canoul (scripts/move-to-lobby.js).
   POST /api/admin/end-session {"name":"crousti"} : le sort de sa session en cours, sans butin (scripts/end-session.js).
   POST /api/admin/prison {"name":"crousti"} : l'envoie en prison, hors de son groupe (scripts/send-to-prison.js).
   POST /api/admin/session-speed {"name":"crousti","speed":300} : vitesse de sa session, donc de son lobby (scripts/session-speed.js).
   POST /api/admin/party-launch {"name":"crousti"} : lance le lobby de crousti dans la mine, prêts ou pas (scripts/launch-lobby.js).
   POST /api/admin/party-lead {"name":"crousti"} : crousti devient chef de son lobby (scripts/set-leader.js).
   POST /api/admin/party-ready {"name":"crousti","ready":true,"always":true} : prêt / prêt tout le temps (scripts/set-ready.js).
   POST /api/admin/raffle {} : lance un raffle tout de suite, à toute heure (scripts/force-raffle.js).

   Une requête n'est acceptée que si les TROIS conditions sont réunies, sinon la route répond « Route inconnue » (404),
   comme si elle n'existait pas :
   1. une clé est réglée (DIM_ADMIN_TOKEN, 32 caractères au moins) et la requête porte exactement la même ;
   2. la connexion vient de la machine elle-même (127.0.0.1 ou ::1) ;
   3. elle n'est pas passée par un relais : aucun en-tête X-Forwarded-For / Forwarded / X-Real-IP (Caddy en ajoute
      toujours un : une requête venue d'internet est donc refusée même si elle connaît la clé).
   Le dépôt est public : la clé n'est jamais dans git. */
import crypto from 'node:crypto';
import { HttpError } from '../http/http.js';
import { nameKey, parseAccountId, displayName, formatAccountId } from '../../src/shared/account.js';
import { MODERATION } from '../../src/config.js';

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
   party : le service des groupes (adminMove, adminReady), facultatif ; social : raffle, facultatif */
export function adminRoutes({ accounts, service = null, game, party = null, moderation = null, social = null, reports = null, eraser = null, token }){
  const guard = ctx => { if(!adminAllowed(ctx.req, token)) throw hidden(); };
  /* compte désigné par son pseudo (champ `field` du corps) */
  const byName = async (ctx, field = 'name') => {
    const name = ctx.body?.[field];
    if(typeof name !== 'string' || !name.trim()) throw new HttpError(400, 'bad_request', `${field} : le pseudo du joueur.`);
    const acc = await accounts.findAccountByName(nameKey(name));
    if(!acc) throw new HttpError(404, 'no_account', `Aucun compte « ${name} ».`);
    return acc;
  };
  /* comme byName, ou par ID de compte : un invité écrit dans le chat sans avoir de pseudo */
  const byNameOrId = async ctx => {
    const text = ctx.body?.name, id = typeof text === 'string' ? parseAccountId(text) : null;
    const acc = id && !await accounts.findAccountByName(nameKey(text)) ? await accounts.getAccount(id) : null;
    return acc ?? byName(ctx);
  };
  const noMod = () => { if(!moderation) throw new HttpError(503, 'no_moderation', 'Modération indisponible sur ce serveur.'); };
  const label = acc => displayName(acc) || formatAccountId(acc.id);
  /* qui agit (le script donne son nom de session) et trace de l'action */
  const adminName = ctx => typeof ctx.body?.by === 'string' && ctx.body.by.trim() ? ctx.body.by.trim().slice(0, 40) : 'admin';
  const journal = async (ctx, action, target, detail = '') => {
    const by = adminName(ctx);
    await moderation?.log({ by, action, target, detail });
    console.log(`Admin (${by}) : ${action} ${target ?? ''} ${detail}`.trim());
    return by;
  };
  /* entier de 1 à max, sinon 400 */
  const count = (v, max, what) => { if(!Number.isSafeInteger(v) || v < 1 || v > max) throw new HttpError(400, 'bad_request', `${what} : un entier de 1 à ${max}.`); return v; };
  const noParty = () => { if(!party) throw new HttpError(503, 'no_party_service', 'Groupes indisponibles sur ce serveur.'); };
  const members = r => r.party.members.map(m => `${m.name}${m.leader ? ' (chef)' : m.ready ? (m.always ? ' (prêt tout le temps)' : ' (prêt)') : ''}`).join(', ');
  return {
    /* ---- modération (01/11/2026, exigence des stores) ---- */
    'POST /api/admin/reports': async ctx => {
      guard(ctx);
      if(!reports) throw new HttpError(503, 'no_reports', 'Signalements indisponibles sur ce serveur.');
      if(ctx.body?.action === 'close'){
        const report = await reports.close(count(ctx.body?.id, Number.MAX_SAFE_INTEGER, 'id'), adminName(ctx));
        await journal(ctx, 'report-close', report.targetName, `n° ${report.id}`);
        return { report };
      }
      const account = ctx.body?.name ? (await byNameOrId(ctx)).id : null;
      return { rows: await reports.list({ account, open: ctx.body?.open === true, limit: Number.isSafeInteger(ctx.body?.limit) ? Math.min(200, Math.max(1, ctx.body.limit)) : 50 }) };
    },
    'POST /api/admin/chat-recent': async ctx => {
      guard(ctx);
      if(!social) throw new HttpError(503, 'no_social', 'Chat indisponible sur ce serveur.');
      const account = ctx.body?.name ? (await byNameOrId(ctx)).id : null;
      return { rows: await social.adminRecentChat({ account, limit: Number.isSafeInteger(ctx.body?.limit) ? Math.min(200, Math.max(1, ctx.body.limit)) : 50 }) };
    },
    'POST /api/admin/chat-delete': async ctx => {
      guard(ctx);
      if(!social) throw new HttpError(503, 'no_social', 'Chat indisponible sur ce serveur.');
      const id = count(ctx.body?.id, Number.MAX_SAFE_INTEGER, 'id');
      const m = await social.adminDeleteMessage(id);
      if(!m) throw new HttpError(404, 'not_found', `Aucun message n° ${id} dans le chat global.`);
      await journal(ctx, 'message-delete', m.name, `n° ${id} : ${m.text}`);
      return { id, name: m.name, text: m.text };
    },
    'POST /api/admin/mute': async ctx => {
      guard(ctx); noMod();
      const acc = await byNameOrId(ctx);
      if(ctx.body?.off === true){ await moderation.mute(acc.id); await journal(ctx, 'unmute', label(acc)); return { account: label(acc), mutedUntil: 0 }; }
      const hours = count(ctx.body?.hours, MODERATION.muteHoursMax, 'hours');
      const r = await moderation.mute(acc.id, hours * 3600e3);
      await journal(ctx, 'mute', label(acc), `${hours} h`);
      return { account: label(acc), ...r };
    },
    'POST /api/admin/ban': async ctx => {
      guard(ctx); noMod();
      const acc = await byNameOrId(ctx);
      if(ctx.body?.off === true){ await moderation.suspend(acc.id, { lift: true }); await journal(ctx, 'unban', label(acc)); return { account: label(acc), suspended: null }; }
      const days = ctx.body?.days === undefined || ctx.body?.days === null ? null : count(ctx.body.days, MODERATION.banDaysMax, 'days');
      const reason = typeof ctx.body?.reason === 'string' ? ctx.body.reason.trim().slice(0, 200) : '';
      const r = await moderation.suspend(acc.id, { ms: days === null ? null : days * 24 * 3600e3, reason });
      await game.adminLeave?.(acc.id).catch(() => {});       // sa session en cours : comme son bouton « Quitter » ; pas de session : rien
      await journal(ctx, 'ban', label(acc), `${days === null ? 'définitif' : `${days} j`}${reason ? ` : ${reason}` : ''}`);
      return { account: label(acc), ...r };
    },
    'POST /api/admin/rename': async ctx => {
      guard(ctx);
      if(!service) throw new HttpError(503, 'no_accounts', 'Comptes indisponibles sur ce serveur.');
      const acc = await byNameOrId(ctx);
      const r = await service.adminRename(acc.id, { name: typeof ctx.body?.to === 'string' ? ctx.body.to : undefined });
      await party?.rename?.(acc.id, r.account.name);
      await journal(ctx, 'rename', r.old, `→ ${r.account.name}`);
      return { old: r.old, name: r.account.name };
    },
    /* demande de suppression reçue par mail : la même fonction que le bouton du jeu (server/accounts/erase.js) */
    'POST /api/admin/delete-account': async ctx => {
      guard(ctx);
      if(!eraser) throw new HttpError(503, 'no_eraser', 'Suppression indisponible sur ce serveur.');
      const acc = await byNameOrId(ctx), who = { account: label(acc), id: formatAccountId(acc.id), guest: !!acc.guest };
      if(ctx.body?.confirm !== true) return { ...who, deleted: false };
      await eraser.deleteAccount(acc.id, { by: adminName(ctx) });
      console.log(`Admin (${adminName(ctx)}) : compte ${who.id} supprimé`);
      return { ...who, deleted: true };
    },
    'POST /api/admin/mod-log': async ctx => {
      guard(ctx); noMod();
      return { rows: await moderation.logList(Number.isSafeInteger(ctx.body?.limit) ? Math.min(500, Math.max(1, ctx.body.limit)) : 50) };
    },
    /* lobbies (29/10/2026, Geoffrey) : déplacer un joueur dans le lobby d'un autre, le mettre prêt */
    'POST /api/admin/party-move': async ctx => {
      guard(ctx); noParty();
      const acc = await byName(ctx), host = await byName(ctx, 'to');
      const r = await party.adminMove(acc, host);
      console.log(`Admin : ${acc.name} (${acc.id}) ${r.moved ? 'mis' : 'déjà'} dans le lobby de ${host.name} (${r.party.code}) : ${members(r)}`);
      return { account: acc.name, host: host.name, ...r };
    },
    /* fin de session forcée (29/10/2026, Geoffrey) : comme son bouton « Quitter » */
    'POST /api/admin/end-session': async ctx => {
      guard(ctx);
      const acc = await byName(ctx);
      const r = await game.adminLeave(acc.id);
      console.log(`Admin : ${acc.name} (${acc.id}) sorti de sa session ${r.session} (${r.mode})${r.ended ? ', partie arrêtée (plus personne)' : ', les autres continuent'}`);
      return { account: acc.name, ...r };
    },
    /* prison forcée (01/11/2026, Geoffrey) : comme s'il l'avait lancée, seul */
    'POST /api/admin/prison': async ctx => {
      guard(ctx); noParty();
      const acc = await byName(ctx);
      const r = await party.adminPrison(acc);
      console.log(`Admin : ${acc.name} (${acc.id}) envoyé en prison${r.left ? ', retiré de son groupe' : ''}`);
      return { account: acc.name, left: r.left };
    },
    /* vitesse d'une session (01/11/2026, Geoffrey) : celle du joueur, donc de tout son lobby */
    'POST /api/admin/session-speed': async ctx => {
      guard(ctx);
      const acc = await byName(ctx);
      const r = await game.adminSpeed(acc.id, ctx.body?.speed ?? 300);
      console.log(`Admin : session ${r.session} de ${acc.name} (${acc.id}) de ×${r.from} à ×${r.speed} : ${r.players.join(', ')}`);
      return { account: acc.name, ...r };
    },
    /* lancement forcé (29/10/2026, Geoffrey) : le lobby d'un joueur part dans la mine classique */
    'POST /api/admin/party-launch': async ctx => {
      guard(ctx); noParty();
      const acc = await byName(ctx);
      const r = await party.adminLaunch(acc);
      console.log(`Admin : lobby de ${acc.name} (${acc.id}) lancé dans la mine, session ${r.session?.id} : ${r.members.join(', ')} (chef ${r.leader})`);
      return { account: acc.name, session: r.session?.id ?? null, leader: r.leader, members: r.members };
    },
    /* chef du lobby (29/10/2026, Geoffrey) */
    'POST /api/admin/party-lead': async ctx => {
      guard(ctx); noParty();
      const acc = await byName(ctx);
      const r = await party.adminPromote(acc);
      console.log(`Admin : ${acc.name} (${acc.id}) ${r.changed ? 'devient' : 'était déjà'} chef du lobby ${r.party.code} : ${members(r)}`);
      return { account: acc.name, ...r };
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
    /* modération du chat (30/10/2026, scripts/moderation.js) : action show | unban | forgive (index 1..n, absent = tous) |
       recent (derniers avertissements de tout le monde, sans name) */
    'POST /api/admin/moderation': async ctx => {
      guard(ctx);
      if(!moderation) throw new HttpError(503, 'no_moderation', 'Modération indisponible sur ce serveur.');
      const action = ctx.body?.action ?? 'show';
      if(action === 'recent'){
        const rows = await moderation.recent(Number.isSafeInteger(ctx.body?.limit) ? Math.min(200, Math.max(1, ctx.body.limit)) : 30);
        const names = new Map();
        for(const r of rows) if(!names.has(r.account)) names.set(r.account, (await accounts.getAccount?.(r.account))?.name ?? r.account);
        return { rows: rows.map(r => ({ ...r, name: names.get(r.account) })) };
      }
      const acc = await byName(ctx);
      if(action === 'show') return { account: acc.name, ...(await moderation.show(acc.id)) };
      if(action === 'unban'){ const r = await moderation.unban(acc.id); await journal(ctx, 'unban-auto', acc.name); return { account: acc.name, ...r }; }
      if(action === 'forgive'){
        const index = ctx.body?.index ?? null;
        const r = await moderation.forgive(acc.id, index);
        if(!r.ok) throw new HttpError(400, 'bad_request', `Avertissement n° ${index} introuvable (${r.count} au total).`);
        await journal(ctx, 'forgive', acc.name, `avertissement ${index ?? 'tous'}`);
        return { account: acc.name, ...r };
      }
      throw new HttpError(400, 'bad_request', 'action : show, unban, forgive ou recent.');
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
    /* raffle forcé (31/10/2026, Geoffrey) */
    'POST /api/admin/raffle': async ctx => {
      guard(ctx);
      if(!social) throw new HttpError(503, 'no_social', 'Raffle indisponible sur ce serveur.');
      const r = await social.raffleForce();
      if(!r) throw new HttpError(409, 'raffle_running', 'Un raffle est déjà en cours.');
      console.log(`Admin : raffle forcé, ${r.lot}`);
      return r;
    },
    /* tableau de bord de l'équipe : lignes de stats des mines classiques (scripts/dashboard.js) */
    'POST /api/admin/stats': async ctx => {
      guard(ctx);
      return { rows: await game.adminStats() };
    },
    /* tableau de bord de la prison : rendement par joueur (scripts/dashboard-prison.js) */
    'POST /api/admin/prison-stats': async ctx => {
      guard(ctx);
      return { rows: await game.adminPrisonStats() };
    },
    'POST /api/admin/judgment': async ctx => {
      guard(ctx);
      const r = await game.adminJudgment(ctx.body?.side, ctx.body?.count);
      console.log(`Admin : jauge ${r.side} ${r.before} → ${r.after} / ${r.cap}${r.open ? ' (tour ouverte)' : ''}`);
      return r;
    },
  };
}
