/* Limiteur de tentatives en mémoire, par fenêtre glissante : « au plus max coups par clé sur window ms ».
   Sert contre la force brute (connexion) et le spam (création de comptes). Remis à zéro au redémarrage :
   c'est un frein, pas une protection absolue. */
export function createLimiter({ max, window }, clock = Date.now){
  const hits = new Map();   // clé → horodatages récents

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
    hit(key){ const list = recent(key); list.push(clock()); hits.set(key, list); },
    reset(key){ hits.delete(key); },
    size(){ return hits.size; },
  };
}
