/* Outil d'administration (04/11/2026) : dit au jeu quelle version de l'appli est en ligne sur Google Play / l'App Store, SANS
   redémarrer ni mettre le jeu en ligne. Au prochain démarrage de l'appli, un joueur qui a une version plus ancienne voit
   « Nouvelle version de l'appli » (Mettre à jour → la fiche du store). Route /api/admin/app-latest (server/admin/routes.js),
   gardée en base. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/set-app-latest.js --platform android --version 1.1.6
     sudo node /opt/deep-idle-mine/scripts/set-app-latest.js --platform android --version ""    (retour à la config)

   ⚠️ Seulement quand la version est VRAIMENT en ligne sur le store (pas en revue) : sinon la fiche n'a pas encore le bouton
   « Mettre à jour ». --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost } from './admin-client.js';

const platform = arg('platform'), version = arg('version');
if(!['android', 'ios'].includes(platform ?? '')) fail('--platform : android ou ios.');
if(version == null || (version !== '' && !/^\d{1,4}(\.\d{1,4}){0,3}$/.test(version))) fail('--version : comme 1.1.6, ou "" pour revenir à la config.');

const data = await adminPost('/api/admin/app-latest', { platform, version });
console.log(`Appli ${data.platform} : ${data.before || '—'} → ${data.after || '—'}. Les appli plus anciennes le proposent au prochain démarrage.`);
