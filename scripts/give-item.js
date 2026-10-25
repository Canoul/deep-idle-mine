/* Outil d'administration : donne un objet du jeu à un joueur (ex. un Treasure T3), SANS redémarrer le jeu.
   Le script demande au serveur qui tourne de le faire (route /api/admin/give, server/admin/routes.js) : le joueur le
   voit tout de suite, même en pleine session. Réservé aux créateurs du jeu, sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/give-item.js --name crousti --item "Treasure T3" --qty 1

   --name : pseudo du compte (majuscules et accents ignorés) · --item : nom exact d'un objet du jeu ·
   --qty : 1 à 1000 (1 par défaut) · --quality : 1 à 7, facultatif (pièce de stuff déjà identifiée dans cette
   qualité, ex. --item "Plastron en fer" --quality 5) · --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost } from './admin-client.js';

const name = arg('name'), item = arg('item'), qty = Number(arg('qty', '1'));
const quality = arg('quality') === undefined ? undefined : Number(arg('quality'));
if(!name) fail('--name : le pseudo du joueur.');
if(!item) fail('--item : le nom exact de l\'objet (ex. "Treasure T3").');
if(!Number.isSafeInteger(qty) || qty < 1 || qty > 1000) fail('--qty : un entier de 1 à 1000.');
if(quality !== undefined && (!Number.isSafeInteger(quality) || quality < 1 || quality > 7)) fail('--quality : un entier de 1 à 7.');

const data = await adminPost('/api/admin/give', { name, item, qty, quality });
console.log(`+${data.qty} ${data.item}${data.quality ? ` R${data.quality}` : ''} pour « ${data.account} » (${data.before} → ${data.after}). Aucun redémarrage nécessaire.`);
