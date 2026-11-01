/* Outil d'administration : envoie un joueur en prison, SANS redémarrer le jeu (route /api/admin/prison,
   server/admin/routes.js). Comme s'il l'avait lancée lui-même : composition actuelle, et il sort quand il veut. La prison se
   joue seul : il quitte son groupe. Refusé s'il est en session (scripts/end-session.js d'abord) ou déjà en prison. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/send-to-prison.js --name crousti

   --name : pseudo du joueur (majuscules et accents ignorés) · --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost } from './admin-client.js';

const name = arg('name');
if(!name) fail('--name : le pseudo du joueur.');

const data = await adminPost('/api/admin/prison', { name });
console.log(`« ${data.account} » est en prison.${data.left ? ' Il a quitté son groupe.' : ''}`);
