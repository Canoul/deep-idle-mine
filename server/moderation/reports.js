/* Signalements (01/11/2026, Geoffrey, exigence de Google Play et de l'App Store) : un joueur signale un message (chat global
   ou de session) ou un autre joueur (sa fiche). Stockage : ns report, clé = numéro.
   Le serveur copie lui-même l'auteur et le texte du message : rien de ce qui compte ne vient du navigateur, et le chat de
   session n'est pas gardé. On ne signale qu'un message qu'on peut lire (jamais le MP de quelqu'un d'autre).
   MODERATION.reportsPerHour par compte (compté sur les signalements enregistrés : survit à un redémarrage), un seul par
   message et par compte (le second ne fait rien : double clic). Chaque signalement part aussi sur le salon Discord privé de
   modération (DIM_DISCORD_MOD_WEBHOOK, server/main.js), en tâche de fond : Discord en panne ne le fait pas échouer.
   Outils : scripts/reports.js (server/admin/routes.js). */
import { MODERATION } from '../../src/config.js';
import { displayName, formatAccountId, parseAccountId } from '../../src/shared/account.js';
import { escapeMarkdown } from '../social/discord.js';

export class ReportError extends Error {
  constructor(code, status, message, extra = {}){ super(message); this.code = code; this.status = status; Object.assign(this, extra); }
}
const fail = (code, status, message, extra) => { throw new ReportError(code, status, message, extra); };

const HOUR = 3600e3;
const WHERE = { global: 'chat global', session: 'chat de session', player: 'fiche du joueur' };
const reasonLabel = id => MODERATION.reasons.find(r => r.id === id)?.label ?? id;

/* message du salon privé ; tout ce qu'un joueur a écrit est échappé (les mentions, elles, sont coupées par l'envoi) */
export function reportMessage(r){
  const cut = (s, n) => escapeMarkdown(String(s).slice(0, n));
  return [
    `🚩 **Signalement n° ${r.id}** : ${reasonLabel(r.reason)} (${WHERE[r.source] ?? r.source})`,
    `Par : ${cut(r.byName, 40)} · Visé : ${cut(r.targetName, 40)}`,
    ...(r.message ? [`Message n° ${r.message.id} : ${cut(r.message.text, 500)}`] : []),
    ...(r.comment ? [`Commentaire : ${cut(r.comment, 500)}`] : []),
  ].join('\n').slice(0, 1900);
}

/* social : findMessage(me, id) ; game : chatFind(me, id) ; announce(texte) : salon privé */
export function createReportService({ store, accounts, social, game, announce = async () => {}, clock = Date.now, config = MODERATION, log = console.error }){
  let chain = Promise.resolve();
  const serial = fn => { const run = chain.catch(() => {}).then(fn); chain = run.catch(() => {}); return run; };
  const nameOf = async id => displayName(await accounts.getAccount(id)) || formatAccountId(id);

  function cleanComment(raw){
    if(raw === undefined || raw === null) return '';
    if(typeof raw !== 'string') fail('bad_request', 400, 'Commentaire invalide.');
    const text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    if(text.length > config.reportCommentMax) fail('bad_request', 400, `Commentaire trop long (${config.reportCommentMax} caractères au plus).`);
    return text;
  }
  /* ce qui est visé : le message (relu au serveur) ou le joueur */
  async function subject(me, { source, message, target }){
    if(source === 'global' || source === 'session'){
      const m = source === 'global' ? await social.findMessage(me, message) : await game.chatFind?.(me, message);
      if(!m) fail('not_found', 404, "Ce message n'est plus disponible.");
      if(m.account === me.id) fail('bad_request', 400, 'Tu ne peux pas signaler ton propre message.');
      return { target: m.account, message: { id: m.id, channel: m.channel ?? source, text: m.text, at: m.at }, key: `${source}:${m.room ?? ''}:${m.id}` };
    }
    if(source !== 'player') fail('bad_request', 400, 'Signalement invalide.');
    const id = parseAccountId(typeof target === 'string' ? target : '');
    if(!id) fail('bad_request', 400, 'Joueur invalide.');
    if(id === me.id) fail('bad_request', 400, 'Tu ne peux pas te signaler toi-même.');
    if(!await accounts.getAccount(id)) fail('not_found', 404, "Ce joueur n'existe plus.");
    return { target: id, message: null, key: null };
  }

  return {
    /* body : { source: 'global' | 'session' | 'player', message (numéro) ou target (ID), reason, comment? } ;
       { ok } ou { ok, already } si ce message est déjà signalé par ce compte */
    report: (me, body = {}) => serial(async () => {
      if(!config.reasons.some(r => r.id === body.reason)) fail('bad_request', 400, 'Choisis un motif.');
      const comment = cleanComment(body.comment);
      const what = await subject(me, body);
      const all = await store.listReports(), now = clock();
      if(what.key && all.some(r => r.by === me.id && r.key === what.key)) return { ok: true, already: true };
      const recent = all.filter(r => r.by === me.id && now - r.at < HOUR);
      if(recent.length >= config.reportsPerHour)
        fail('rate_limited', 429, 'Trop de signalements envoyés. Réessaie plus tard.', { retryAfter: Math.ceil((recent[0].at + HOUR - now) / 1000) });
      const report = { id: all.length + 1, at: now, by: me.id, byName: displayName(me) || formatAccountId(me.id), target: what.target, targetName: await nameOf(what.target),
                       source: body.source, reason: body.reason, comment, message: what.message, key: what.key, open: true };
      await store.putReport(report);
      try { Promise.resolve(announce(reportMessage(report))).catch(e => log(`Signalement Discord impossible : ${e.message}`)); }
      catch(e){ log(`Signalement Discord impossible : ${e.message}`); }
      return { ok: true };
    }),

    /* ---- administration (scripts/reports.js) ---- */
    /* plus récents d'abord ; account : signalé ou signaleur ; open : pas encore traités */
    async list({ account = null, open = false, limit = 50 } = {}){
      return (await store.listReports()).filter(r => (!account || r.target === account || r.by === account) && (!open || r.open))
        .sort((a, b) => b.id - a.id).slice(0, limit);
    },
    /* marquer traité ; déjà traité : rien ne change */
    close: (id, by) => serial(async () => {
      const r = (await store.listReports()).find(x => x.id === id);
      if(!r) fail('not_found', 404, `Aucun signalement n° ${id}.`);
      if(!r.open) return r;
      const done = { ...r, open: false, closedAt: clock(), closedBy: by };
      await store.putReport(done);
      return done;
    }),
  };
}
