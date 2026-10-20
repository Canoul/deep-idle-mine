/* Une partie en direct, sur le serveur : LA partie de la session, la seule copie (les navigateurs ne font que
   l'afficher). Elle avance jusqu'au tick demandé ; les choix des joueurs (quitter, focus) s'appliquent au tick où
   ils arrivent. Chaque choix est noté avec ce tick dans l'enregistrement de la session : rejouer la seed et les
   choix enregistrés reconstruit exactement la même partie (seulement après un redémarrage du serveur).

   Les réglages dev (valeurs globales STATS/CFG) ne sont appliqués que pendant les calculs de cette partie. */
import { buildSession, applyOverrides, applyDueEvents } from '../../src/shared/game.js';
import { tick, endSession } from '../../src/sim/session.js';
import { createViewer } from '../../src/shared/view.js';

export function createLiveGame(record){
  const rec = { ...record, leaves: [...(record.leaves || [])], focus: [...(record.focus || [])] };
  const withOverrides = fn => { applyOverrides(rec.overrides); try { return fn(); } finally { applyOverrides(null); } };
  const G = withOverrides(() => buildSession(rec));
  const step = target => { while(!G.over && G.ticks < target){ applyDueEvents(G, rec); tick(G); } };
  const viewer = createViewer(G);   // ce que reçoivent les navigateurs (src/shared/view.js)
  /* un choix prend effet maintenant (avant le prochain tick) ; renvoie le tick à enregistrer */
  const now = (list, ev) => { list.push({ ...ev, tick: G.ticks }); withOverrides(() => applyDueEvents(G, rec)); return G.ticks; };

  return {
    G,
    get tick(){ return G.ticks; },
    get over(){ return G.over; },
    get summary(){ return G.summary; },
    advance(target){ withOverrides(() => step(target)); },
    leave(account){ return now(rec.leaves, { account }); },
    focus(account, focus){ return now(rec.focus, { account, focus }); },
    /* l'affichage pour un navigateur qui a déjà la partie au tick since */
    view(since){ return viewer(since); },
    /* fin immédiate (mode dev : « fin libre ») : la partie est jouée jusqu'au bout */
    finish(){ withOverrides(() => { step(Infinity); if(!G.over) endSession(G); }); },
  };
}
