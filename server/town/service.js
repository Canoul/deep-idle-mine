/* Le Carreau (29/10/2026) : qui est dans la ville du spawn, et où.

   - Le navigateur donne sa place régulièrement (ping) : l'onglet ouvert (spot) et, s'il se promène (onglet Session
     sans session), sa position x. Le serveur revérifie (src/shared/town.js, cleanTownPing) et garde la dernière en
     mémoire ; sans nouvelles depuis TOWN_SERVER.presentFor, le joueur quitte la ville. Rien en base : après un
     redémarrage, tout le monde réapparaît au ping suivant.
   - La réponse : les AUTRES joueurs de la ville (moi exclu, le navigateur me dessine lui-même), sauf ceux qui sont en
     session (mine, MI, tour, instance, Bloc géant) ; avec leur pseudo, leur apparence (look, auras), leur fiche (niveau,
     spécialisation, gear score), leur dernier message du chat global s'il date de moins de TOWN.bubbleMs (bulle), leur
     émote de moins de TOWN.emoteMs, leur groupe et s'ils cherchent un groupe. Au plus TOWN_SERVER.maxPlayers, les plus
     récents d'abord. Plus, pour moi : ma bulle et mon groupe ; et la statue du n°1 du classement TOWN.statueBoard.
   - Groupe : jamais le code du lobby (il sert à le rejoindre) ; un repère (nombre) donné par ce service, le même pour
     tous les membres tant que le groupe existe, avec sa taille.
   - Émotes (29/10 après-midi) : emote(me, id), id de TOWN.emotes, une toutes les TOWN.emoteGapMs au plus.
   - Apparence et fiche relues au plus toutes les TOWN_SERVER.lookFor ms par joueur ; la liste des joueurs en session au
     plus toutes les TOWN_SERVER.sessionsFor ms ; la statue au plus toutes les TOWN_SERVER.statueFor ms.
   Rien ici ne crée ni ne déplace de ressources. Testable seul : comptes, jeu, groupes, chat et horloge en paramètres. */
import { displayName, formatAccountId, nameKey } from '../../src/shared/account.js';
import { cleanTownPing, emoteOf } from '../../src/shared/town.js';
import { rankBoard } from '../../src/meta/leaderboard.js';
import { TOWN, LEADERBOARD } from '../../src/config.js';
import { TOWN_SERVER } from '../config.js';

export class TownError extends Error {
  constructor(code, status, message){ super(message); this.code = code; this.status = status; }
}

/* accounts : { getAccount(id), findAccountByName?(clé) } ;
   game : { playersInSession(), lookFor(id), aurasFor(id), levelFor(id), skillTreeOf(id), gsFor(id), leaderboardData() } ;
   party : { groupOf(id) → { code, size, max } | null, searching(id) } ;
   recentChat(ms) : messages du chat global de moins de ms ([{ account, text, at }], du plus ancien au plus récent) */
export function createTownService({ accounts, game, party = null, recentChat = async () => [], clock = Date.now, config = TOWN_SERVER }){
  const here = new Map();       // compte → { spot, x, at }
  const faces = new Map();      // compte → { name, look, auras, level, tree, gs, at }
  const emotes = new Map();     // compte → { id, at }
  const tags = new Map();       // code de lobby → repère (nombre)
  let nextTag = 1;
  let busy = { ids: new Set(), at: -Infinity };
  let statue = { value: null, at: -Infinity };

  async function face(id, now){
    const f = faces.get(id);
    if(f && now - f.at < config.lookFor) return f;
    const acc = await accounts.getAccount(id);
    const n = { name: displayName(acc) || formatAccountId(id), look: await game.lookFor?.(id) ?? {},
                auras: await game.aurasFor?.(id) ?? {}, level: await game.levelFor?.(id) ?? null,
                tree: await game.skillTreeOf?.(id) ?? null, gs: await game.gsFor?.(id) ?? null, at: now };
    faces.set(id, n);
    return n;
  }
  async function inSession(now){
    if(now - busy.at >= config.sessionsFor) busy = { ids: new Set(await game.playersInSession?.() ?? []), at: now };
    return busy.ids;
  }
  /* groupe d'un joueur : { tag, size, max } (seul dans son groupe : null, il n'y a rien à montrer) */
  function groupOf(id){
    const g = party?.groupOf?.(id);
    if(!g || g.size < 2) return null;
    if(!tags.has(g.code)) tags.set(g.code, nextTag++);
    return { tag: tags.get(g.code), size: g.size, max: g.max };
  }
  /* statue : le n°1 du classement (comptes cachés exclus), relu au plus toutes les statueFor ms */
  async function statueOf(now){
    if(now - statue.at < config.statueFor) return statue.value;
    statue.at = now;
    try {
      const data = await game.leaderboardData?.();
      const hidden = new Set((await Promise.all(LEADERBOARD.hidden.map(n => accounts.findAccountByName?.(nameKey(n)))))
        .filter(Boolean).map(a => a.id));
      const top = data ? rankBoard(TOWN.statueBoard, (data[TOWN.statueBoard] ?? []).filter(e => !hidden.has(e.id)), null, 1).rows[0] : null;
      if(!top){ statue.value = null; return null; }
      const f = await face(top.id, now);
      statue.value = { id: top.id, name: f.name, look: f.look, auras: f.auras, value: top.value };
    } catch(e){ console.error(e); }
    return statue.value;
  }

  return {
    /* me : compte connecté ; body : { spot, x? }. Renvoie { players: [{ id, name, spot, x, look, auras, level, tree,
       gs, say, emote, group, lfg }], say, group, statue } (say / group : les miens). */
    async ping(me, body){
      const p = cleanTownPing(body);
      if(!p) throw new TownError('bad_request', 400, 'Place invalide.');
      const now = clock();
      here.set(me.id, { ...p, at: now });
      for(const [id, h] of here) if(now - h.at > config.presentFor) here.delete(id);
      for(const [id, f] of faces) if(!here.has(id) && now - f.at > config.lookFor) faces.delete(id);
      for(const [id, e] of emotes) if(now - e.at > TOWN.emoteMs) emotes.delete(id);
      const playing = await inSession(now);
      const said = new Map();
      for(const m of await recentChat(TOWN.bubbleMs)) said.set(m.account, m.text);   // le plus récent l'emporte
      const others = [...here].filter(([id]) => id !== me.id && !playing.has(id))
        .sort((a, b) => b[1].at - a[1].at).slice(0, config.maxPlayers);
      const players = [];
      for(const [id, h] of others){
        const f = await face(id, now);
        players.push({ id, name: f.name, spot: h.spot, x: h.x, look: f.look, auras: f.auras, level: f.level, tree: f.tree,
                       gs: f.gs, say: said.get(id) ?? null, emote: emotes.get(id)?.id ?? null, group: groupOf(id),
                       lfg: !!party?.searching?.(id) });
      }
      /* repères des groupes disparus : oubliés (la Map ne grossit pas) */
      if(party?.groupOf){ const live = new Set([...here.keys()].map(id => party.groupOf(id)?.code).filter(Boolean));
        for(const code of tags.keys()) if(!live.has(code)) tags.delete(code); }
      return { players, say: said.get(me.id) ?? null, group: groupOf(me.id), statue: await statueOf(now) };
    },
    /* émote : id de TOWN.emotes ; trop tôt après la précédente : 429 */
    emote(me, id){
      const e = emoteOf(id);
      if(!e) throw new TownError('bad_request', 400, 'Émote inconnue.');
      const now = clock(), last = emotes.get(me.id);
      if(last && now - last.at < TOWN.emoteGapMs) throw new TownError('too_many', 429, 'Doucement avec les émotes.');
      emotes.set(me.id, { id: e.id, at: now });
      return { emote: e.id };
    },
    /* nombre de joueurs dans la ville (débogage, tests) */
    count: () => here.size,
  };
}
