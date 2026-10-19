/* Partage du coffre commun en fin de session (GAME_DESIGN §7, « Partage du coffre »). Logique pure.

   - Chaque joueur de la session (un par mineur, jusqu'à 3) reçoit une part égale de chaque ressource.
   - Le reste d'une division qui ne tombe pas juste est donné au hasard, une unité par joueur au plus :
     100 charbons à 3 → 33, 33, 33 + 1 au hasard. Le tirage dépend de la seed (même partie = même partage).
   - Les objets de SHARE.copyToAll (les Treasure TX) ne se partagent pas : chaque joueur en reçoit la quantité entière.
   - Un joueur qui quitte la session avant la fin ne reçoit rien : on ne partage qu'entre les joueurs présents.
   Garanties anti-duplication (tests/anticheat) : la somme des parts = le coffre (hors copyToAll), jamais plus. */
import { SHARE } from '../config.js';
import { mulberry32, hash, shuffle } from '../core/rng.js';

const SALT = 0x5a4e;   // tirage du partage indépendant du reste de la partie

/* chest : { nom: quantité } ; players : nombre de joueurs ; seed : seed de la session.
   Renvoie un tableau de sacs { nom: quantité }, un par joueur, dans l'ordre des joueurs. */
export function shareChest(chest, players, seed){
  const n = players|0;
  if(n <= 0) return [];                                    // plus personne : le coffre n'est versé à personne
  const bags = Array.from({ length:n }, () => ({}));
  const rng = mulberry32(hash(seed|0, SALT));
  const give = (i, k, q) => { if(q > 0) bags[i][k] = (bags[i][k] || 0) + q; };

  /* 1) tirage du reste, ressource par ressource dans un ordre fixe : il ne dépend pas de l'ordre des dépôts */
  const parts = {};
  for(const k of Object.keys(chest || {}).sort()){
    const q = chest[k];
    if(!Number.isSafeInteger(q) || q <= 0) continue;        // quantité invalide (Infinity, NaN, décimale…) : ignorée
    if(SHARE.copyToAll.includes(k)){ parts[k] = Array(n).fill(q); continue; }
    const base = Math.floor(q / n), rest = q % n;
    const order = [...Array(n).keys()];
    if(rest) shuffle(order, rng);
    parts[k] = Array(n).fill(base);
    for(let j=0; j<rest; j++) parts[k][order[j]]++;
  }
  /* 2) remplissage dans l'ordre du coffre : l'inventaire garde l'ordre d'arrivée des objets */
  for(const k in chest || {}) if(parts[k]) parts[k].forEach((q, i) => give(i, k, q));
  return bags;
}

/* index de la part d'un compte dans summary.shares ; sans compte (ou compte absent de la session) : le mineur 0,
   celui du joueur local */
export function shareIndexFor(shares, accountId){
  const i = accountId ? shares.findIndex(s => s.account === accountId) : -1;
  return i >= 0 ? i : 0;
}
