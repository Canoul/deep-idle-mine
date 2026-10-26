/* Outil d'administration : retire un objet du jeu à un joueur (ex. un glyphe donné par erreur), SANS redémarrer le jeu.
   Le script demande au serveur qui tourne de le faire (route /api/admin/take, server/admin/routes.js) : d'abord dans
   l'inventaire ; un glyphe posé sur son skill est retiré de la case s'il n'en a plus dans l'inventaire. Tout ou rien :
   s'il en a moins que --qty, rien ne change. Réservé aux créateurs du jeu, sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/take-item.js --name crousti --item "Glyphe Ruée" --qty 1

   --name : pseudo du compte (majuscules et accents ignorés) · --item : nom exact d'un objet du jeu ·
   --qty : 1 à 1000 (1 par défaut) · --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost } from './admin-client.js';

const name = arg('name'), item = arg('item'), qty = Number(arg('qty', '1'));
if(!name) fail('--name : le pseudo du joueur.');
if(!item) fail('--item : le nom exact de l\'objet (ex. "Glyphe Ruée").');
if(!Number.isSafeInteger(qty) || qty < 1 || qty > 1000) fail('--qty : un entier de 1 à 1000.');

const data = await adminPost('/api/admin/take', { name, item, qty });
const where = [data.fromInventory && `${data.fromInventory} de l'inventaire`, data.fromSkill && `${data.fromSkill} posé sur son skill`].filter(Boolean).join(', ');
console.log(`-${data.qty} ${data.item} pour « ${data.account} » (${where} ; ${data.before} → ${data.after}). Aucun redémarrage nécessaire.`);
