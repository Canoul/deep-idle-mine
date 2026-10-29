/* Outil d'administration : met un joueur dans le lobby d'un autre joueur, SANS redémarrer le jeu (route
   /api/admin/party-move, server/admin/routes.js). Comme « Rejoindre » depuis l'onglet Social, sans amitié ni code :
   le joueur quitte son groupe actuel ; l'autre n'a pas de groupe → il en devient le chef. Refusé si l'un des deux est
   en session ou si le lobby est complet. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/move-to-lobby.js --name crousti --to canoul

   --name : pseudo du joueur à déplacer · --to : pseudo du joueur qui l'accueille (majuscules et accents ignorés) ·
   --env, --url : voir scripts/admin-client.js. Pour le mettre prêt ensuite : scripts/set-ready.js. */
import { arg, fail, adminPost } from './admin-client.js';

const name = arg('name'), to = arg('to');
if(!name) fail('--name : le pseudo du joueur à déplacer.');
if(!to) fail('--to : le pseudo du joueur dont il rejoint le lobby.');

const data = await adminPost('/api/admin/party-move', { name, to });
const who = data.party.members.map(m => m.name + (m.leader ? ' (chef)' : m.ready ? ' (prêt)' : '')).join(', ');
console.log(`${data.moved ? `« ${data.account} » est maintenant` : `« ${data.account} » était déjà`} dans le lobby de « ${data.host} » : ${who}.`);
