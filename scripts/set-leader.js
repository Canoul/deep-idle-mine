/* Outil d'administration : donne la place de chef du lobby à un joueur, SANS redémarrer le jeu (route
   /api/admin/party-lead, server/admin/routes.js). Comme « Nommer chef » du chef actuel : le joueur doit déjà être dans
   le lobby (scripts/move-to-lobby.js) ; l'ancien chef reste dans le groupe, comme simple membre. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/set-leader.js --name crousti

   --name : pseudo du futur chef (majuscules et accents ignorés) · --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost } from './admin-client.js';

const name = arg('name');
if(!name) fail('--name : le pseudo du futur chef.');

const data = await adminPost('/api/admin/party-lead', { name });
console.log(`« ${data.account} » ${data.changed ? 'est maintenant' : 'était déjà'} chef du lobby : ${data.party.members.map(m => m.name + (m.leader ? ' (chef)' : '')).join(', ')}.`);
