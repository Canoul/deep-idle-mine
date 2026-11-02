/* Outil d'administration (02/11/2026, Geoffrey) : donne de l'énergie à un joueur, SANS redémarrer le jeu (route
   /api/admin/give-energy, server/admin/routes.js). Plafonnée au maximum de la jauge (ENERGY.max). Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/give-energy.js --name crousti --amount 50

   --name : pseudo du compte (majuscules et accents ignorés) · --amount : 1 à 100 · --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost } from './admin-client.js';

const name = arg('name'), amount = Number(arg('amount'));
if(!name) fail('--name : le pseudo du joueur.');
if(!Number.isFinite(amount) || amount <= 0 || amount > 100) fail('--amount : un nombre de 1 à 100.');

const data = await adminPost('/api/admin/give-energy', { name, amount });
console.log(`+${data.amount} ⚡ pour « ${data.account} » (${data.before} → ${data.after} / ${data.max}). Aucun redémarrage nécessaire.`);
