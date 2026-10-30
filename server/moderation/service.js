/* Modération du chat (30/10/2026, Geoffrey) : avertissements, bans, et ce que voient les créateurs (scripts/moderation.js).
   Un message qui contient un mot interdit (server/moderation/filter.js) est publié masqué ; son auteur reçoit un
   avertissement avec un motif (et le texte d'origine, gardé pour vérifier à la main). MODERATION.warnings
   avertissements depuis le dernier ban → ban de MODERATION.banMs : le serveur refuse alors toute action de jeu (server/app.js,
   routes POST), et onBan(compte) arrête ce qui tourne pour lui (sa prison).
   Fiche d'un compte (ns moderation) : { warnings, bans, bannedUntil, countFrom } ; countFrom = heure du dernier ban
   (ou du pardon) : seuls les avertissements d'après comptent pour le prochain ban. */
import { MODERATION } from '../../src/config.js';

const blank = () => ({ warnings: [], bans: [], bannedUntil: 0, countFrom: 0 });
function sanitize(raw){
  const m = blank();
  if(!raw || typeof raw !== 'object') return m;
  m.warnings = (Array.isArray(raw.warnings) ? raw.warnings : []).filter(w => w && Number.isFinite(w.at)).slice(-MODERATION.keep);
  m.bans = (Array.isArray(raw.bans) ? raw.bans : []).filter(b => b && Number.isFinite(b.at) && Number.isFinite(b.until)).slice(-MODERATION.keep);
  m.bannedUntil = Number.isFinite(raw.bannedUntil) ? raw.bannedUntil : 0;
  m.countFrom = Number.isFinite(raw.countFrom) ? raw.countFrom : 0;
  return m;
}
/* avertissements qui comptent pour le prochain ban */
const counted = m => m.warnings.filter(w => w.at > m.countFrom && !w.forgiven).length;

export function createModerationService({ store, clock = Date.now, config = MODERATION, onBan = () => {} }){
  let chain = Promise.resolve();
  const serial = fn => { const run = chain.catch(() => {}).then(fn); chain = run.catch(() => {}); return run; };
  const load = async id => sanitize(await store.getModeration(id));

  /* ce que voit le joueur : { warnings (comptés), max, bannedUntil (0 si pas banni), motif (du dernier avertissement) } */
  const status = (m, now) => ({ warnings: counted(m), max: config.warnings, bannedUntil: m.bannedUntil > now ? m.bannedUntil : 0,
                                motif: m.warnings.at(-1)?.motif ?? null });

  const api = {
    /* heure de fin du ban de ce compte, ou 0 */
    async bannedUntil(id){ const m = await load(id); return m.bannedUntil > clock() ? m.bannedUntil : 0; },
    async status(id){ return status(await load(id), clock()); },

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

    /* ---- administration (scripts/moderation.js) ---- */
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
