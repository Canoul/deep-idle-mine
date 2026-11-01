/* Outil d'administration : change la vitesse de la session d'un joueur, donc de tout son lobby, SANS redémarrer le jeu (route
   /api/admin/session-speed, server/admin/routes.js). La partie continue au même endroit et finit normalement, butin compris.
   Refusé en mine instantanée, commune à tous ses inscrits. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/session-speed.js --name crousti
     sudo node /opt/deep-idle-mine/scripts/session-speed.js --name crousti --speed 2     (retour à la vitesse normale)

   --name : pseudo d'un joueur de la session · --speed : 1, 2, 5, 20, 60 ou 300 (GAME.devSpeeds, défaut 300) ·
   --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost } from './admin-client.js';

const name = arg('name'), speed = Number(arg('speed', 300));
if(!name) fail('--name : le pseudo du joueur.');

const data = await adminPost('/api/admin/session-speed', { name, speed });
console.log(`Session de ${data.players.join(', ')} : ×${data.from} → ×${data.speed}, fin dans ${Math.ceil(data.leftMs / 1000)} s.`);
