/* Outil d'administration : empêche un joueur d'écrire dans tous les chats, SANS redémarrer le jeu (01/11/2026). Le reste du jeu
   marche ; il voit un message clair quand il essaie. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/mute.js --name crousti --hours 24
     sudo node /opt/deep-idle-mine/scripts/mute.js --name crousti --off

   --name : pseudo, ou ID de compte d'un invité · --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost, adminBy, parisTime } from './admin-client.js';

const name = arg('name');
if(!name) fail('--name : le pseudo du joueur.');
if(process.argv.includes('--off')){
  const r = await adminPost('/api/admin/mute', { name, off: true, by: adminBy() });
  console.log(`« ${r.account} » peut de nouveau écrire dans le chat.`);
  process.exit(0);
}
const hours = Number(arg('hours'));
if(!Number.isSafeInteger(hours) || hours < 1) fail('--hours : un nombre d\'heures entier (ou --off pour lever).');
const r = await adminPost('/api/admin/mute', { name, hours, by: adminBy() });
console.log(`« ${r.account} » ne peut plus écrire dans le chat jusqu'au ${parisTime(r.mutedUntil)}.`);
