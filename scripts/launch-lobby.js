/* Outil d'administration : lance le lobby d'un joueur dans la mine classique, SANS redémarrer le jeu (route
   /api/admin/party-launch, server/admin/routes.js). On donne le pseudo de N'IMPORTE QUEL membre du lobby : la session
   part pour tout le groupe, comme si le chef cliquait « Lancer », même si tout le monde n'est pas prêt. Seul : sa
   session solo. Refusé si un membre est encore dans une session. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/launch-lobby.js --name crousti

   --name : pseudo d'un membre du lobby (majuscules et accents ignorés) · --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost } from './admin-client.js';

const name = arg('name');
if(!name) fail('--name : le pseudo d\'un joueur du lobby.');

const data = await adminPost('/api/admin/party-launch', { name });
console.log(`Lobby de « ${data.leader} » lancé dans la mine : ${data.members.join(', ')}.`);
