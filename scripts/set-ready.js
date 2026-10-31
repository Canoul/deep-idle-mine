/* Outil d'administration : met un joueur « prêt » dans son lobby, et/ou coche « prêt tout le temps » (il reste prêt
   d'une session à l'autre, jusqu'à ce qu'on décoche), SANS redémarrer le jeu (route /api/admin/party-ready,
   server/admin/routes.js). Le joueur doit être dans un groupe (scripts/move-to-lobby.js). Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/set-ready.js --name crousti                 prêt
     sudo node /opt/deep-idle-mine/scripts/set-ready.js --name crousti --always on     prêt tout le temps
     sudo node /opt/deep-idle-mine/scripts/set-ready.js --name crousti --always off    décoche « tout le temps »
     sudo node /opt/deep-idle-mine/scripts/set-ready.js --name crousti --ready off     plus prêt

   --ready on|off (on par défaut si --always n'est pas donné) · --always on|off · --env, --url : voir
   scripts/admin-client.js. Comme ses propres cases : tant que « tout le temps » est coché, il reste prêt. */
import { arg, fail, adminPost } from './admin-client.js';

const onOff = k => { const v = arg(k); if(v === undefined) return undefined;
  if(v === 'on') return true; if(v === 'off') return false; fail(`--${k} : on ou off.`); };
const name = arg('name'), always = onOff('always');
const ready = onOff('ready') ?? (always === undefined ? true : undefined);
if(!name) fail('--name : le pseudo du joueur.');

const data = await adminPost('/api/admin/party-ready', { name, ready, always });
const me = data.party.members.find(m => m.name === data.account);
const state = me?.leader ? 'chef du groupe (lancer = prêt)' : me?.ready ? (me.always ? 'prêt tout le temps' : 'prêt') : 'pas prêt';
console.log(`« ${data.account} » : ${state}, lobby de « ${data.party.leader} » (${data.party.members.map(m => m.name).join(', ')}).`);
