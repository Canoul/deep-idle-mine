/* Outil d'administration : rendement de la prison par joueur (server/admin/prison-dashboard.js), une page HTML autonome.
   Demande les lignes au jeu qui tourne (route /api/admin/prison-stats), sans le redémarrer. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/dashboard-prison.js --out /tmp/prison.html

   Depuis ton ordinateur, en une commande :
     ssh VPS "sudo node /opt/deep-idle-mine/scripts/dashboard-prison.js" > prison.html
   puis ouvre le fichier dans le navigateur. --env, --url : voir scripts/admin-client.js. */
import fs from 'node:fs';
import { arg, adminPost } from './admin-client.js';
import { renderPrisonDashboard } from '../server/admin/prison-dashboard.js';

const { rows } = await adminPost('/api/admin/prison-stats', {});
const html = renderPrisonDashboard(rows);
const out = arg('out');
if(out){ fs.writeFileSync(out, html); console.error(`Prison : ${rows.length} joueur(s) → ${out}`); }
else process.stdout.write(html);
