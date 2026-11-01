/* Outil d'administration : force un nouveau pseudo, SANS redémarrer le jeu (01/11/2026). Mêmes règles qu'un pseudo choisi ; le joueur
   garde son compte et son ID. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/rename.js --name crousti --to NouveauPseudo

   --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost, adminBy } from './admin-client.js';

const name = arg('name'), to = arg('to');
if(!name) fail('--name : le pseudo actuel du joueur.');
if(!to) fail('--to : le nouveau pseudo.');
const r = await adminPost('/api/admin/rename', { name, to, by: adminBy() });
console.log(`« ${r.old} » s'appelle maintenant « ${r.name} ».`);
