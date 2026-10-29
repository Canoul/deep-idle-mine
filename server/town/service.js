/* Le Carreau (29/10/2026) : qui est dans la ville du spawn, et où.

   - Le navigateur donne sa place régulièrement (ping) : l'onglet ouvert (spot) et, s'il se promène (onglet Session
     sans session), sa position x. Le serveur revérifie (src/shared/town.js, cleanTownPing) et garde la dernière en
     mémoire ; sans nouvelles depuis TOWN_SERVER.presentFor, le joueur quitte la ville. Rien en base : après un
     redémarrage, tout le monde réapparaît au ping suivant.
   - La réponse : les AUTRES joueurs de la ville (moi exclu, le navigateur me dessine lui-même), sauf ceux qui sont en
     session (mine, MI, tour, instance, Bloc géant) ; avec leur pseudo, leur apparence (look, auras) et leur dernier
     message du chat global s'il date de moins de TOWN.bubbleMs (bulle au-dessus de la tête). Au plus
     TOWN_SERVER.maxPlayers, les plus récents d'abord.
   - Apparence et pseudo relus au plus toutes les TOWN_SERVER.lookFor ms par joueur ; la liste des joueurs en session
     au plus toutes les TOWN_SERVER.sessionsFor ms (une seule lecture pour tous les pings).
   Rien ici ne crée ni ne déplace de ressources. Testable seul : comptes, jeu, chat et horloge passés en paramètres. */
import { displayName, formatAccountId } from '../../src/shared/account.js';
import { cleanTownPing } from '../../src/shared/town.js';
import { TOWN } from '../../src/config.js';
import { TOWN_SERVER } from '../config.js';

export class TownError extends Error {
  constructor(code, status, message){ super(message); this.code = code; this.status = status; }
}

/* accounts : { getAccount(id) } ; game : { playersInSession(), lookFor(id), aurasFor(id) } ;
   recentChat(ms) : messages du chat global de moins de ms ([{ account, text, at }], du plus ancien au plus récent) */
export function createTownService({ accounts, game, recentChat = async () => [], clock = Date.now, config = TOWN_SERVER }){
  const here = new Map();       // compte → { spot, x, at }
  const faces = new Map();      // compte → { name, look, auras, at }
  let busy = { ids: new Set(), at: -Infinity };

  async function face(id, now){
    const f = faces.get(id);
    if(f && now - f.at < config.lookFor) return f;
    const acc = await accounts.getAccount(id);
    const n = { name: displayName(acc) || formatAccountId(id), look: await game.lookFor?.(id) ?? {},
                auras: await game.aurasFor?.(id) ?? {}, at: now };
    faces.set(id, n);
    return n;
  }
  async function inSession(now){
    if(now - busy.at >= config.sessionsFor) busy = { ids: new Set(await game.playersInSession?.() ?? []), at: now };
    return busy.ids;
  }

  return {
    /* me : compte connecté ; body : { spot, x? }. Renvoie { players: [{ id, name, spot, x, look, auras, say }], say }
       (say : mon propre dernier message, pour ma bulle). */
    async ping(me, body){
      const p = cleanTownPing(body);
      if(!p) throw new TownError('bad_request', 400, 'Place invalide.');
      const now = clock();
      here.set(me.id, { ...p, at: now });
      for(const [id, h] of here) if(now - h.at > config.presentFor) here.delete(id);
      for(const [id, f] of faces) if(!here.has(id) && now - f.at > config.lookFor) faces.delete(id);
      const playing = await inSession(now);
      const said = new Map();
      for(const m of await recentChat(TOWN.bubbleMs)) said.set(m.account, m.text);   // le plus récent l'emporte
      const others = [...here].filter(([id]) => id !== me.id && !playing.has(id))
        .sort((a, b) => b[1].at - a[1].at).slice(0, config.maxPlayers);
      const players = [];
      for(const [id, h] of others){
        const f = await face(id, now);
        players.push({ id, name: f.name, spot: h.spot, x: h.x, look: f.look, auras: f.auras, say: said.get(id) ?? null });
      }
      return { players, say: said.get(me.id) ?? null };
    },
    /* nombre de joueurs dans la ville (débogage, tests) */
    count: () => here.size,
  };
}
