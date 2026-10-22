/* Chat de session : un salon par session, en mémoire seulement (rien en base, perdu au redémarrage du serveur).
   Le service vérifie qui écrit (un joueur de la session encore là) ; ici : texte, cadence, messages gardés. */
import { CHAT } from '../../src/config.js';
import { cleanChatText } from '../../src/shared/chat.js';

export function createChat({ clock = Date.now } = {}){
  const rooms = new Map();    // id de session → { next, msgs, at (dernier message) }
  const lastBy = new Map();   // compte → heure de son dernier message

  /* oublie les salons sans message depuis CHAT.ttlMs, et les cadences échues */
  function prune(now){
    for(const [id, r] of rooms) if(now - r.at > CHAT.ttlMs) rooms.delete(id);
    for(const [a, t] of lastBy) if(now - t >= CHAT.gapMs) lastBy.delete(a);
  }

  return {
    /* { msg } ou { error: 'bad_text' | 'too_fast' } ; name : donné par le serveur */
    post(sessionId, account, name, text){
      const now = clock();
      prune(now);
      const t = cleanChatText(text);
      if(t === null) return { error: 'bad_text' };
      if(lastBy.has(account)) return { error: 'too_fast' };
      let r = rooms.get(sessionId);
      if(!r) rooms.set(sessionId, r = { next: 1, msgs: [], at: now });
      const msg = { id: r.next++, at: now, account, name, text: t };
      r.msgs.push(msg);
      if(r.msgs.length > CHAT.keep) r.msgs.shift();
      r.at = now; lastBy.set(account, now);
      return { msg };
    },
    /* messages après le numéro after (0 : tous ceux gardés) */
    since: (sessionId, after) => (rooms.get(sessionId)?.msgs ?? []).filter(m => m.id > after),
    drop: sessionId => { rooms.delete(sessionId); },
  };
}
