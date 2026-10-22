/* Recherche de groupe (LFG, mine classique) : qui va avec qui. Logique pure, partagée jeu + serveur.

   La file contient des solos (size 1) et des groupes de 2 (size 2, représentés par leur chef), dans l'ordre d'arrivée.
   Un lobby se forme d'un coup, jamais une place à la fois (décision du 22/10/2026, Geoffrey) :
   1. le groupe le plus ancien prend les solos les plus anciens qu'il lui faut, même arrivés avant lui ;
   2. sinon, les `max` solos les plus anciens : les autres rejoignent le lobby du premier arrivé.
   Deux groupes ne se combinent jamais (2 + 2 = 4). */

/* queue : [{ account, size, at }] ; renvoie { host, guests } (host : l'entrée dont le lobby reçoit les autres) ou null */
export function matchLfg(queue, max){
  const byAge = [...queue].sort((a, b) => a.at - b.at);
  const solos = byAge.filter(e => e.size === 1);
  for(const g of byAge.filter(e => e.size > 1 && e.size < max)){
    const need = max - g.size;
    if(solos.length >= need) return { host: g, guests: solos.slice(0, need) };
  }
  if(solos.length >= max) return { host: solos[0], guests: solos.slice(1, max) };
  return null;
}

/* temps de queue lisible : 102 000 ms → « 1:42 » */
export function queueTime(ms){
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
