/* Modération du chat (30/10/2026, Geoffrey) : avertissements, bans, et ce que voient les créateurs (scripts/moderation.js).
   Un message qui contient un mot interdit (server/moderation/filter.js) est publié masqué ; son auteur reçoit un
   avertissement avec un motif (et le texte d'origine, gardé pour vérifier à la main). MODERATION.warnings
   avertissements depuis le dernier ban → ban de MODERATION.banMs : le serveur refuse alors toute action de jeu (server/app.js,
   routes POST), et onBan(compte) arrête ce qui tourne pour lui (sa prison).
   Fiche d'un compte (ns moderation) : { warnings, bans, bannedUntil, countFrom, mutedUntil, suspended } ; countFrom = heure du
   dernier ban (ou du pardon) : seuls les avertissements d'après comptent pour le prochain ban.
   Décidés par les créateurs (01/11/2026, exigence des stores ; scripts/mute.js, scripts/ban.js) : mutedUntil = plus de chat ;
   suspended = { at, until (null : définitif), reason } : connexion refusée, à ne pas confondre avec le ban automatique, où
   le joueur voit encore le jeu. Toute action des créateurs passe dans le journal (log, ns mod_log).
   notices (04/11/2026, scripts/warn.js) : messages de l'équipe [{ id, at, by, title, text, seenAt }] ; le navigateur montre en
   pop-up ceux pas encore lus (état social, relu toutes les quelques secondes), puis dit qu'ils sont lus (seenAt). */
import { MODERATION, RULES } from '../../src/config.js';

/* « 31/10 à 14:05 », heure de Paris */
export const parisDate = t => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  .format(new Date(t)).replace(' ', ' à ');

const blank = () => ({ warnings: [], bans: [], bannedUntil: 0, countFrom: 0, mutedUntil: 0, suspended: null, notices: [] });
function sanitize(raw){
  const m = blank();
  if(!raw || typeof raw !== 'object') return m;
  m.warnings = (Array.isArray(raw.warnings) ? raw.warnings : []).filter(w => w && Number.isFinite(w.at)).slice(-MODERATION.keep);
  m.bans = (Array.isArray(raw.bans) ? raw.bans : []).filter(b => b && Number.isFinite(b.at) && Number.isFinite(b.until)).slice(-MODERATION.keep);
  m.bannedUntil = Number.isFinite(raw.bannedUntil) ? raw.bannedUntil : 0;
  m.countFrom = Number.isFinite(raw.countFrom) ? raw.countFrom : 0;
  m.mutedUntil = Number.isFinite(raw.mutedUntil) ? raw.mutedUntil : 0;
  const s = raw.suspended;
  if(s && Number.isFinite(s.at) && (s.until === null || Number.isFinite(s.until))) m.suspended = { at: s.at, until: s.until, reason: typeof s.reason === 'string' ? s.reason : '' };
  m.notices = (Array.isArray(raw.notices) ? raw.notices : []).filter(n => n && Number.isSafeInteger(n.id) && typeof n.title === 'string' && typeof n.text === 'string').slice(-MODERATION.keep);
  return m;
}
/* avertissements qui comptent pour le prochain ban */
const counted = m => m.warnings.filter(w => w.at > m.countFrom && !w.forgiven).length;
const suspendedNow = (m, now) => m.suspended && (m.suspended.until === null || m.suspended.until > now);

export function createModerationService({ store, clock = Date.now, config = MODERATION, onBan = () => {} }){
  let chain = Promise.resolve();
  const serial = fn => { const run = chain.catch(() => {}).then(fn); chain = run.catch(() => {}); return run; };
  const load = async id => sanitize(await store.getModeration(id));

  /* ce que voit le joueur : { warnings (comptés), max, bannedUntil (0 si pas banni), motif (du dernier avertissement) } */
  const status = (m, now) => ({ warnings: counted(m), max: config.warnings, bannedUntil: m.bannedUntil > now ? m.bannedUntil : 0,
                                motif: m.warnings.at(-1)?.motif ?? null, mutedUntil: m.mutedUntil > now ? m.mutedUntil : 0 });

  const api = {
    /* heure de fin du ban de ce compte, ou 0 */
    async bannedUntil(id){ const m = await load(id); return m.bannedUntil > clock() ? m.bannedUntil : 0; },
    async status(id){ return status(await load(id), clock()); },

    /* pourquoi ce compte (l'objet compte : sa version des règles) ne peut pas écrire : { code, status, message } ou null */
    async chatRefusal(me){
      const m = await load(me.id);
      if(m.mutedUntil > clock()) return { code: 'muted', status: 403, message: `Tu ne peux plus écrire dans le chat jusqu'au ${parisDate(m.mutedUntil)}.` };
      if(me.rulesVersion !== RULES.version) return { code: 'rules_required', status: 403, message: "Accepte les conditions d'utilisation pour écrire dans le chat." };
      return null;
    },
    /* texte montré à un compte suspendu, ou null */
    async suspendedText(id){
      const m = await load(id);
      if(!suspendedNow(m, clock())) return null;
      const why = m.suspended.reason ? ` Motif : ${m.suspended.reason}.` : '';
      return m.suspended.until === null ? `Ton compte est suspendu de façon définitive.${why}` : `Ton compte est suspendu jusqu'au ${parisDate(m.suspended.until)}.${why}`;
    },

    /* avertit un joueur pour un message ; renvoie ce qu'il doit voir : { warnings, max, banned, bannedUntil, motif } */
    warn: (id, { channel, text, masked, hits }) => serial(async () => {
      const now = clock(), m = await load(id);
      const motifs = [...new Set(hits.map(h => h.motif))];
      const withWho = hits.flatMap(h => h.with || []).filter(w => w.account !== id);
      m.warnings.push({ at: now, channel, motif: motifs.join(', '), words: [...new Set(hits.map(h => h.word))], text, masked,
                        ...(withWho.length ? { with: withWho.map(w => ({ account: w.account, name: w.name })) } : {}) });
      if(m.warnings.length > config.keep) m.warnings.splice(0, m.warnings.length - config.keep);
      let banned = false;
      if(counted(m) >= config.warnings && !(m.bannedUntil > now)){
        m.bannedUntil = now + config.banMs; m.countFrom = now; banned = true;
        m.bans.push({ at: now, until: m.bannedUntil, motif: `${config.warnings} avertissements (dernier : ${motifs.join(', ')})` });
        if(m.bans.length > config.keep) m.bans.shift();
      }
      await store.putModeration(id, m);
      if(banned) Promise.resolve().then(() => onBan(id)).catch(console.error);
      return { ...status(m, now), warnings: banned ? config.warnings : counted(m), banned, motif: motifs.join(', ') };
    }),

    /* ---- administration (scripts/moderation.js, mute.js, ban.js) ---- */
    /* muet pendant ms ; ms absent : lever */
    mute: (id, ms = null) => serial(async () => {
      const m = await load(id);
      m.mutedUntil = ms === null ? 0 : clock() + ms;
      await store.putModeration(id, m);
      return { mutedUntil: m.mutedUntil };
    }),
    /* suspendre (ms null : définitif) ; lift : lever */
    suspend: (id, { ms = null, reason = '', lift = false } = {}) => serial(async () => {
      const m = await load(id), now = clock();
      m.suspended = lift ? null : { at: now, until: ms === null ? null : now + ms, reason };
      await store.putModeration(id, m);
      if(!lift) Promise.resolve().then(() => onBan(id)).catch(console.error);
      return { suspended: m.suspended };
    }),
    /* message de l'équipe (pop-up) : { id } ; title et text déjà vérifiés par la route */
    notice: (id, { title, text, by = 'admin' }) => serial(async () => {
      const m = await load(id), n = { id: Math.max(0, ...m.notices.map(x => x.id)) + 1, at: clock(), by, title, text, seenAt: 0 };
      m.notices.push(n);
      if(m.notices.length > config.keep) m.notices.splice(0, m.notices.length - config.keep);
      await store.putModeration(id, m);
      return { id: n.id, at: n.at };
    }),
    /* messages pas encore lus, les plus anciens d'abord : [{ id, at, title, text }] */
    async unseenNotices(id){ return (await load(id)).notices.filter(n => !n.seenAt).map(({ id, at, title, text }) => ({ id, at, title, text })); },
    /* le joueur l'a fermé : lu (une seconde fois ne change rien) ; false si ce message n'existe pas */
    noticeSeen: (id, noticeId) => serial(async () => {
      const m = await load(id), n = m.notices.find(x => x.id === noticeId);
      if(!n) return false;
      if(!n.seenAt){ n.seenAt = clock(); await store.putModeration(id, m); }
      return true;
    }),
    /* journal des actions des créateurs : qui, quoi, sur qui, quand */
    log: ({ by, action, target = null, detail = '' }) => store.addModLog({ at: clock(), by, action, target, detail }),
    async logList(limit = 50){ return (await store.listModLog()).slice(-limit).reverse(); },
    /* fiche complète */
    show: async id => ({ ...(await load(id)), counted: counted(await load(id)), now: clock() }),
    /* lever le ban (les avertissements restent dans l'historique, le compteur repart de zéro) */
    unban: id => serial(async () => {
      const m = await load(id), now = clock();
      m.bannedUntil = 0; m.countFrom = now;
      if(m.bans.length && m.bans.at(-1).until > now) m.bans.at(-1).liftedAt = now;
      await store.putModeration(id, m);
      return { ok: true };
    }),
    /* retirer un avertissement (numéro de 1 à n dans la fiche) ou tous (index absent) : ils ne comptent plus */
    forgive: (id, index = null) => serial(async () => {
      const m = await load(id);
      if(index === null) m.warnings.forEach(w => { w.forgiven = true; });
      else {
        if(!Number.isSafeInteger(index) || index < 1 || index > m.warnings.length) return { ok: false, count: m.warnings.length };
        m.warnings[index - 1].forgiven = true;
      }
      await store.putModeration(id, m);
      return { ok: true, counted: counted(m) };
    }),
    /* derniers avertissements de tout le monde (plus récents d'abord) */
    async recent(limit = 30){
      const rows = [];
      for(const { account, value } of await store.listModerations())
        for(const w of sanitize(value).warnings) rows.push({ account, ...w });
      return rows.sort((a, b) => b.at - a.at).slice(0, limit);
    },
  };
  return api;
}
