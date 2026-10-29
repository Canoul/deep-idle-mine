/* Outil d'administration : force la fin de la session d'un joueur, SANS redémarrer le jeu (route
   /api/admin/end-session, server/admin/routes.js). Comme son bouton « Quitter » : il ne reçoit RIEN de cette session
   et redevient libre tout de suite (lobby, nouvelle session). En groupe, les autres continuent ; s'il était le dernier,
   la partie s'arrête et personne ne reçoit rien. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/end-session.js --name crousti

   --name : pseudo du joueur (majuscules et accents ignorés) · --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost } from './admin-client.js';

const name = arg('name');
if(!name) fail('--name : le pseudo du joueur.');

const data = await adminPost('/api/admin/end-session', { name });
console.log(`« ${data.account} » est sorti de sa session (${data.mode}), sans butin. ` +
  (data.ended ? 'Il était le dernier : la partie est arrêtée.' : 'Les autres joueurs continuent.'));
