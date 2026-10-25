/* Outil d'administration : règle une jauge du Jugement (Ange ou Démon), SANS redémarrer le jeu.
   Le script demande au serveur qui tourne de le faire (route /api/admin/judgment, server/admin/routes.js) : les
   joueurs le voient au prochain affichage du lobby. Réservé aux créateurs du jeu, sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/set-judgment.js --side demon --count 175

   --side : angel ou demon · --count : 0 à JUDGMENT.cap (jauge pleine = la tour s'ouvre, comme en jeu ; si l'autre
   tour est ouverte, elle attend sa fermeture) · --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost } from './admin-client.js';
import { JUDGMENT } from '../src/config.js';

const side = arg('side'), count = Number(arg('count'));
if(!Object.hasOwn(JUDGMENT.sides, side ?? '')) fail(`--side : ${Object.keys(JUDGMENT.sides).join(' ou ')}.`);
if(!Number.isSafeInteger(count) || count < 0 || count > JUDGMENT.cap) fail(`--count : un entier de 0 à ${JUDGMENT.cap}.`);

const data = await adminPost('/api/admin/judgment', { side, count });
console.log(`Jauge ${JUDGMENT.sides[data.side].label} : ${data.before} → ${data.after} / ${data.cap}${data.open ? ' · tour ouverte' : ''}. Aucun redémarrage nécessaire.`);
