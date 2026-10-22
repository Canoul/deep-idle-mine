/* Limiteur de tentatives en mémoire, par fenêtre glissante : « au plus max coups par clé sur window ms ».
   Sert contre la force brute (connexion) et le spam (création de comptes). Remis à zéro au redémarrage :
   c'est un frein, pas une protection absolue. */
const SWEEP_AT = 5000;   // clés gardées avant un grand ménage (mémoire bornée face à beaucoup d'adresses)

export function createLimiter({ max, window }, clock = Date.now){
  const hits = new Map();   // clé → horodatages récents
  let sweepAt = SWEEP_AT;

  function recent(key){
    const now = clock();
    const list = (hits.get(key) ?? []).filter(t => now - t < window);
    if(list.length) hits.set(key, list); else hits.delete(key);
    return list;
  }

  return {
    /* encore autorisé ? Si non, retryAfter = secondes à attendre */
    check(key){
      const list = recent(key);
      if(list.length < max) return { ok: true };
      return { ok: false, retryAfter: Math.ceil((list[0] + window - clock()) / 1000) };
    },
    hit(key){
      const list = recent(key); list.push(clock()); hits.set(key, list);
      /* grand ménage : oublie les adresses sans coup récent ; le suivant attend que la taille ait doublé (pas de
         parcours complet à chaque tentative quand beaucoup d'adresses sont actives) */
      if(hits.size > sweepAt){ for(const k of [...hits.keys()]) recent(k); sweepAt = Math.max(SWEEP_AT, hits.size * 2); }
    },
    reset(key){ hits.delete(key); },
    size(){ return hits.size; },
  };
}
