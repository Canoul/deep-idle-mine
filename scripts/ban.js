/* Outil d'administration : suspend un compte, SANS redémarrer le jeu (01/11/2026). Connexion refusée avec un message, page ouverte
   renvoyée à l'écran de connexion, sortie de sa session et prison arrêtée. À ne pas confondre avec le ban automatique de 24 h
   (3 avertissements, scripts/moderation.js --unban). Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/ban.js --name crousti --days 7 --reason "Harcèlement"
     sudo node /opt/deep-idle-mine/scripts/ban.js --name crousti                                   sans durée = définitif
     sudo node /opt/deep-idle-mine/scripts/ban.js --name crousti --off

   --name : pseudo, ou ID de compte d'un invité · --reason : montré au joueur, facultatif · --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost, adminBy, parisTime } from './admin-client.js';

const name = arg('name');
if(!name) fail('--name : le pseudo du joueur.');
if(process.argv.includes('--off')){
  const r = await adminPost('/api/admin/ban', { name, off: true, by: adminBy() });
  console.log(`Suspension levée pour « ${r.account} ».`);
  process.exit(0);
}
const days = arg('days') === undefined ? undefined : Number(arg('days'));
if(days !== undefined && (!Number.isSafeInteger(days) || days < 1)) fail('--days : un nombre de jours entier (sans --days : définitif).');
const r = await adminPost('/api/admin/ban', { name, days, reason: arg('reason'), by: adminBy() });
console.log(`« ${r.account} » suspendu ${r.suspended.until === null ? 'définitivement' : `jusqu'au ${parisTime(r.suspended.until)}`}.`);
