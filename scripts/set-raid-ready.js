/* Outil d'administration : met un joueur « prêt » (ou plus prêt) dans son lobby de raid, SANS redémarrer le jeu (route
   /api/admin/raid-ready, server/admin/routes.js). Le joueur doit être dans un lobby de raid (scripts/move-to-raid.js) ;
   le chef du raid reste toujours prêt. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/set-raid-ready.js --name crousti                 prêt
     sudo node /opt/deep-idle-mine/scripts/set-raid-ready.js --name crousti --ready off     plus prêt

   --ready on|off (on par défaut) · --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost } from './admin-client.js';

const name = arg('name'), v = arg('ready');
if(!name) fail('--name : le pseudo du joueur.');
if(v !== undefined && v !== 'on' && v !== 'off') fail('--ready : on ou off.');

const data = await adminPost('/api/admin/raid-ready', { name, ready: v !== 'off' });
const me = data.members.find(m => m.name === data.account);
const state = me?.leader ? 'chef du raid (toujours prêt)' : me?.ready ? 'prêt' : 'pas prêt';
const waiting = data.members.filter(m => !m.leader && !m.ready).map(m => m.name);
console.log(`« ${data.account} » : ${state} dans le lobby de raid (${data.members.map(m => m.name).join(', ')}).` +
  (waiting.length ? ` Pas encore prêts : ${waiting.join(', ')}.` : ' Tout le monde est prêt.'));
