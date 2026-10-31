/* Outil d'administration : lance un raffle tout de suite, à n'importe quelle heure, SANS redémarrer le jeu (route
   /api/admin/raffle, server/admin/routes.js). Lot tiré dans la table habituelle (RAFFLE.lots), et le prochain raffle est
   reprogrammé après celui-ci. Refusé si un raffle est déjà en cours. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/force-raffle.js

   --env, --url : voir scripts/admin-client.js. */
import { adminPost } from './admin-client.js';

const data = await adminPost('/api/admin/raffle', {});
console.log(`Raffle lancé : ${data.lot}, tirage dans ${data.seconds} s.`);
