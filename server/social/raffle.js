/* Raffle (31/10/2026, Geoffrey) : RAFFLE.everyMin à everyMax après le précédent, un lot est annoncé dans le chat global, les
   joueurs avec un pseudo tapent !join (réponse visible par eux seuls), et un inscrit le gagne au bout de joinMs.
   L'état est enregistré à chaque étape (ns raffle) : un raffle reprend après un redémarrage du serveur, le gagnant est gardé
   avant d'être payé, et give est idempotent (id du raffle) : relancer la fin ne paie jamais deux fois.
   give(compte, id, lot) : crédit ; announce(texte) : message public ; tick() : appelé par la boucle du serveur. */
import { RAFFLE } from '../../src/config.js';
import { nextRaffleAt, raffleOpen, rollLot, lotLabel, lotPlural, sanitizeRaffle } from '../../src/shared/raffle.js';

export function createRaffle({ store, give, announce, clock = Date.now, random }){
  let state = null, chain = Promise.resolve();
  /* une étape à la fois : un !join ne se croise jamais avec le tirage */
  const serial = fn => { const run = chain.catch(() => {}).then(fn); chain = run.catch(() => {}); return run; };
  const load = async () => state ??= sanitizeRaffle(await store.getRaffle?.());
  const save = () => store.putRaffle?.(state);

  async function start(now){
    const lot = rollLot(random);
    state.current = { id: `raffle:${now}`, lot, endsAt: now + RAFFLE.joinMs, players: [] };
    state.nextAt = null;
    await save();
    await announce(`[${RAFFLE.name}] ${lotLabel(lot)} ${lotPlural(lot) ? 'seront attribués' : 'sera attribué'} aléatoirement à quelqu'un dans le chat dans ${RAFFLE.joinMs / 1000} s`);
    await announce(`${RAFFLE.command} pour participer`);
  }
  async function draw(now){
    const c = state.current;
    if(!c.winner && c.players.length){ c.winner = c.players[Math.floor(random() * c.players.length)]; await save(); }
    if(c.winner) await give(c.winner.id, c.id, c.lot);
    await announce(c.winner ? `[${RAFFLE.name}] ${c.winner.name} a gagné ${lotLabel(c.lot)}` : `[${RAFFLE.name}] Personne n'a participé, le lot est perdu`);
    state.current = null;
    state.nextAt = nextRaffleAt(now, random);
    await save();
  }

  return {
    tick: () => serial(async () => {
      await load();
      const now = clock();
      if(state.current){ if(now >= state.current.endsAt) await draw(now); return; }
      if(state.nextAt !== null && now < state.nextAt) return;
      if(state.nextAt !== null && raffleOpen(now)) return start(now);
      state.nextAt = nextRaffleAt(now, random);   // premier démarrage, ou serveur rallumé dans le créneau fermé
      await save();
    }),
    /* !join : le texte de la réponse, pour ce joueur seul */
    join: me => serial(async () => {
      await load();
      const c = state.current;
      if(!c || clock() >= c.endsAt) return `[${RAFFLE.name}] Il n'y a pas de raffle en cours`;
      if(me.guest || !me.name) return `[${RAFFLE.name}] Il faut un compte avec un pseudo pour participer`;
      if(c.players.some(p => p.id === me.id)) return `[${RAFFLE.name}] Tu participes déjà`;
      c.players.push({ id: me.id, name: me.name });
      await save();
      return `[${RAFFLE.name}] Tu participes au raffle, bonne chance !`;
    }),
  };
}
