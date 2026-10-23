/* Mine instantanée : inscriptions et ouverture à l'heure (GAME_DESIGN §6 « Mine instantanée »).

   - On s'inscrit pour la prochaine ouverture (toutes les 2 h pile, heure de Paris : src/shared/instant.js), seulement
     dans les MI.signupBefore dernières secondes (11 h 30 → 12 h ; décision du 22/10), y compris pendant une session.
     La MI ne touche pas aux groupes (23/10/2026, Geoffrey ; avant : on quittait son groupe) : on s'y inscrit seul, on
     ne peut pas y inviter, et le joueur reste dans le lobby de son groupe pendant et après la mine. Lancer une
     session normale ne désinscrit pas : encore en session à l'heure, le joueur rate la mine (game.openInstant
     l'écarte) et sa session continue ; son inscription est effacée comme les autres. Mode dev : à toute heure.
   - À l'heure (tick, appelé en continu par le serveur), les inscrits sont répartis en mines d'au plus MI.maxPerMine
     joueurs, de tailles égales, et chaque mine est ouverte par le service de jeu (game.openInstant) : c'est ensuite une
     session comme une autre (partie en direct, Quitter = rien, butin versé une fois à la fin).
   - Les inscriptions sont enregistrées (store) : un redémarrage du serveur (mise à jour automatique) les retrouve.
     Une mine a un id fixé par son heure et son numéro (mi-<heure>-<n>) : rouverte après un redémarrage, elle n'est
     pas créée deux fois.
   Testable seul : on lui passe le service de jeu, celui des groupes, le stockage et une horloge. */
import { INSTANT_MINE as MI } from '../../src/config.js';
import { displayName } from '../../src/shared/account.js';
import { nextSlot, lastSlot, splitMines, signupOpen, signupOpensAt } from '../../src/shared/instant.js';

export class InstantError extends Error {
  constructor(code, status, message){ super(message); this.code = code; this.status = status; }
}
const fail = (code, status, message) => { throw new InstantError(code, status, message); };

export function createInstantService({ game, party = null, store, clock = Date.now, dev = false }){
  const signups = new Map();                 // compte → { account, name, at }
  let opened = null;                         // dernière heure d'ouverture traitée
  let opening = null;                        // ouverture en cours (promesse)

  async function load(){
    for(const s of await store.getInstantSignups())
      if(s && typeof s.account === 'string') signups.set(s.account, { account: s.account, name: String(s.name ?? ''), at: +s.at || 0 });
    opened = lastSlot(clock());              // une ouverture passée pendant l'arrêt est rattrapée par tick (voir plus bas)
    if([...signups.values()].some(s => s.at < opened)) opened = null;
  }

  async function drop(accounts){
    for(const a of accounts) if(signups.delete(a)) await store.deleteInstantSignup(a);
  }

  /* ouvre les mines de l'heure slot pour tous les inscrits du moment */
  async function open(slot){
    const list = [...signups.values()].sort((a, b) => a.at - b.at || (a.account < b.account ? -1 : 1));
    const mines = splitMines(list);
    const out = [];
    for(let i = 0; i < mines.length; i++){
      const s = await game.openInstant(`mi-${slot}-${i + 1}`, slot, mines[i].map(p => ({ account: p.account, name: p.name })));
      if(s) out.push(s);                     // chacun garde son groupe (23/10)
    }
    await drop(list.map(p => p.account));
    opened = slot;
    return out;
  }

  /* appelé en continu : l'heure est venue → on ouvre (une seule fois par heure) */
  function tick(){
    if(opening) return opening;
    const slot = lastSlot(clock());
    if(opened !== null && slot <= opened) return Promise.resolve([]);
    opening = open(slot).finally(() => { opening = null; });
    return opening;
  }

  return {
    load, tick,
    /* ce que voit le joueur : prochaine ouverture, heure du serveur, inscrit ou non, nombre d'inscrits */
    async state(me){
      const nextAt = nextSlot(clock());
      return { nextAt, now: clock(), registered: signups.has(me.id), count: signups.size,
               signupAt: signupOpensAt(nextAt), signupOpen: dev || signupOpen(clock(), nextAt),
               maxPerMine: MI.maxPerMine, notify: MI.notify, inviteAt: MI.inviteAt, duration: MI.duration, dev };
    },
    /* s'inscrire : seulement dans les 30 dernières minutes (même en session), seul, sans quitter son groupe.
       Idempotent (déjà inscrit = rien ne change). */
    async join(me){
      if(!dev && !signupOpen(clock())) fail('signup_closed', 409, `Les inscriptions ouvrent ${MI.signupBefore / 60} min avant la mine instantanée.`);
      if(!signups.has(me.id)){
        const s = { account: me.id, name: displayName(me), at: clock() };
        signups.set(me.id, s);
        await store.putInstantSignup(me.id, s);
      }
      return this.state(me);
    },
    async quit(me){ await drop([me.id]); return this.state(me); },
    /* mode dev : ouvrir tout de suite pour les inscrits (sans attendre l'heure) */
    async devOpen(me){
      if(!dev) fail('forbidden', 403, 'Réservé au mode développeur.');
      if(opening) await opening;
      const sessions = await open(clock());
      return { sessions: sessions.length, ...(await this.state(me)) };
    },
    drop,
    count: () => signups.size,
  };
}
