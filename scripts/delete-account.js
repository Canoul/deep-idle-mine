/* Outil d'administration : supprime un compte et toutes ses données, pour une demande reçue par mail, SANS redémarrer le jeu
   (01/11/2026). Même fonction que le bouton « Supprimer mon compte » (server/accounts/erase.js). IRRÉVERSIBLE : sans --yes, l'outil
   dit seulement quel compte serait supprimé. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/delete-account.js --name crousti              montre le compte visé
     sudo node /opt/deep-idle-mine/scripts/delete-account.js --name crousti --yes        le supprime
     sudo node /opt/deep-idle-mine/scripts/delete-account.js --id 7K3Q-9XHP --yes        par identifiant (compte invité)

   --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost, adminBy } from './admin-client.js';

const name = arg('name') ?? arg('id');
if(!name) fail('--name : le pseudo du joueur, ou --id : son identifiant de compte.');
const r = await adminPost('/api/admin/delete-account', { name, confirm: process.argv.includes('--yes'), by: adminBy() });
if(r.deleted) console.log(`Compte « ${r.account} » (${r.id}) supprimé, avec toutes ses données.`);
else console.log(`Compte visé : « ${r.account} » (${r.id})${r.guest ? ', invité' : ''}. Rien n'est supprimé : ajoute --yes pour le faire.`);
