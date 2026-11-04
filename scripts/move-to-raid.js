/* Outil d'administration : met un joueur dans le lobby de raid où se trouve un autre joueur, SANS redémarrer le jeu
   (route /api/admin/raid-move, server/admin/routes.js). Il quitte son autre lobby de raid s'il en avait un. Hors de la
   guilde de ce lobby, il y entre comme un invité (prêt) ; de la guilde, comme « Rejoindre ». Refusé si l'autre n'est dans
   aucun lobby de raid, si le joueur est en session, ou si le raid est complet ou en cours de lancement. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/move-to-raid.js --name crousti --to canoul

   --name : pseudo du joueur à déplacer · --to : pseudo d'un joueur du lobby de raid (majuscules et accents ignorés) ·
   --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost } from './admin-client.js';

const name = arg('name'), to = arg('to');
if(!name) fail('--name : le pseudo du joueur à déplacer.');
if(!to) fail('--to : le pseudo d\'un joueur du lobby de raid.');

const data = await adminPost('/api/admin/raid-move', { name, to });
const who = data.members.map(m => m.name + (m.leader ? ' (chef)' : m.invited ? ' (invité)' : m.ready ? ' (prêt)' : '') + ` [groupe ${m.group}]`).join(', ');
console.log(`${data.moved ? `« ${data.account} » est maintenant` : `« ${data.account} » était déjà`} dans le lobby de raid de « ${data.host} » : ${who}.`);
