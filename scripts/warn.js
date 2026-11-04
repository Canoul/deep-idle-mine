/* Outil d'administration : envoie un message de l'équipe à un joueur, en pop-up (titre + texte), SANS redémarrer le jeu (04/11/2026).
   S'il est en ligne, la fenêtre s'ouvre dans les secondes qui suivent ; sinon à sa prochaine visite. Il la ferme : elle ne revient
   plus. Ce n'est pas un avertissement du chat (il ne compte pas pour le ban automatique, scripts/moderation.js). Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/warn.js --name crousti --title "Avertissement" --text "Merci de rester poli dans le chat."

   --name : pseudo, ou ID de compte d'un invité · --title : 80 caractères au plus · --text : 1000 au plus ; « \n » = à la ligne ·
   --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost, adminBy } from './admin-client.js';
import { MODERATION } from '../src/config.js';

const name = arg('name'), title = arg('title')?.trim(), text = arg('text')?.replace(/\\n/g, '\n').trim();
if(!name) fail('--name : le pseudo du joueur.');
if(!title || title.length > MODERATION.noticeTitleMax) fail(`--title : le titre de la fenêtre, 1 à ${MODERATION.noticeTitleMax} caractères.`);
if(!text || text.length > MODERATION.noticeTextMax) fail(`--text : le message, 1 à ${MODERATION.noticeTextMax} caractères.`);

const r = await adminPost('/api/admin/notice', { name, title, text, by: adminBy() });
console.log(`Message n° ${r.id} envoyé à « ${r.account} » : il s'affiche dès qu'il est en ligne. Aucun redémarrage nécessaire.`);
