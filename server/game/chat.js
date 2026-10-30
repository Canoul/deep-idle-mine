/* Salons de chat en mémoire. Chat de session : un salon par session, rien en base, perdu au redémarrage du serveur.
   Chat global du lobby (28/10) : un seul salon, avec sa propre cadence, enregistré par server/social/service.js
   (room / restore) pour survivre aux redémarrages.
   Le service vérifie qui écrit ; ici : texte, cadence, messages gardés. */
import { CHAT } from '../../src/config.js';
import { cleanChatText, freshMessages } from '../../src/shared/chat.js';
import { MODERATION } from '../../src/config.js';
import { moderate } from '../moderation/filter.js';

/* gapMs : délai entre deux messages d'un même joueur ; ttlMs : un salon sans message depuis ce temps est oublié */
export function createChat({ clock = Date.now, gapMs = CHAT.gapMs, ttlMs = CHAT.ttlMs } = {}){
  const rooms = new Map();    // id de salon → { next, msgs, at (dernier message) }
  const lastBy = new Map();   // compte → heure de son dernier message

  /* oublie les salons sans message depuis ttlMs, les messages de CHAT.maxAgeMs ou plus (30/10), et les cadences échues */
  function prune(now){
    for(const [id, r] of rooms) if(now - r.at > ttlMs) rooms.delete(id); else r.msgs = freshMessages(r.msgs, now);
    for(const [a, t] of lastBy) if(now - t >= gapMs) lastBy.delete(a);
  }

  return {
    /* { msg, hits, original } ou { error: 'bad_text' | 'too_fast' } ; name : donné par le serveur.
       Modération (30/10/2026) : le texte publié a ses mots interdits masqués, y compris un mot commencé dans les messages
       précédents du salon (MODERATION.joinMessages, moins de joinWindowMs) ; hits : ce qui a été trouvé (pour l'avertir),
       original : le texte tel qu'écrit (gardé seulement dans sa fiche de modération). */
    post(roomId, account, name, text){
      const now = clock();
      prune(now);
      const t = cleanChatText(text);
      if(t === null) return { error: 'bad_text' };
      if(lastBy.has(account)) return { error: 'too_fast' };
      let r = rooms.get(roomId);
      if(!r) rooms.set(roomId, r = { next: 1, msgs: [], at: now });
      const prev = r.msgs.filter(m => now - m.at <= MODERATION.joinWindowMs);
      const mod = moderate(t, prev);
      const msg = { id: r.next++, at: now, account, name, text: mod.text };
      r.msgs.push(msg);
      if(r.msgs.length > CHAT.keep) r.msgs.shift();
      r.at = now; lastBy.set(account, now);
      return { msg, hits: mod.hits, original: t };
    },
    /* messages après le numéro after (0 : tous ceux gardés) */
    since: (roomId, after) => freshMessages(rooms.get(roomId)?.msgs, clock()).filter(m => m.id > after),
    drop: roomId => { rooms.delete(roomId); },
    /* ce qu'il faut enregistrer d'un salon (null : aucun message) */
    room(roomId){
      const r = rooms.get(roomId);
      return r ? { next: r.next, msgs: freshMessages(r.msgs, clock()).map(m => ({ ...m })) } : null;
    },
    /* reprend un salon enregistré, revérifié message par message (numéros croissants, texte valide) */
    restore(roomId, raw){
      if(!raw || typeof raw !== 'object' || !Array.isArray(raw.msgs)) return;
      let last = 0;
      const msgs = [];
      for(const m of raw.msgs){
        if(!m || !Number.isSafeInteger(m.id) || m.id <= last || !Number.isFinite(m.at)) continue;
        if(typeof m.account !== 'string' || typeof m.name !== 'string' || cleanChatText(m.text) !== m.text) continue;
        msgs.push({ id: m.id, at: m.at, account: m.account, name: m.name, text: m.text });
        last = m.id;
      }
      const next = Math.max(last + 1, Number.isSafeInteger(raw.next) ? raw.next : 1);
      rooms.set(roomId, { next, msgs: freshMessages(msgs, clock()).slice(-CHAT.keep), at: msgs.at(-1)?.at ?? clock() });
    },
  };
}
