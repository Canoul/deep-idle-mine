/* Outil d'administration : tableau de bord des joueurs (server/admin/dashboard.js), une page HTML autonome.
   Le script demande les lignes au jeu qui tourne (route /api/admin/stats), sans le redémarrer. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/dashboard.js --out /tmp/tableau-de-bord.html

   Sans --out, la page sort sur la console : depuis ton ordinateur, en une commande,
     ssh VPS "sudo node /opt/deep-idle-mine/scripts/dashboard.js" > tableau-de-bord.html
   puis ouvre le fichier dans le navigateur. --env, --url : voir scripts/admin-client.js.
   Les courbes se remplissent avec les mines classiques terminées depuis la mise en ligne du 26/10/2026. */
import fs from 'node:fs';
import { arg, adminPost } from './admin-client.js';
import { renderDashboard } from '../server/admin/dashboard.js';

const { rows } = await adminPost('/api/admin/stats', {});
const html = renderDashboard(rows);
const out = arg('out');
if(out){ fs.writeFileSync(out, html); console.error(`Tableau de bord : ${rows.length} lignes → ${out}`); }
else process.stdout.write(html);
