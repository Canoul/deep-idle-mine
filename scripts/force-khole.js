/* Outil d'administration : ouvre un k hole dans la session en cours d'un joueur, SANS redémarrer le jeu.
   Le script demande au serveur qui tourne de le faire (route /api/admin/khole, server/admin/routes.js) : le k hole
   s'ouvre sous les pieds d'un mineur du groupe (« Un k hole s'ouvre… »), et le groupe est aspiré quelques secondes plus
   tard. C'est enregistré dans la session : après un redémarrage, la partie se rejoue à l'identique. Mine classique
   seulement. Réservé aux créateurs du jeu, sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/force-khole.js --name PSEUDO --map 2

   --name : pseudo du joueur · --map : 0 = carte tirée au hasard (défaut), 1 à N = cette carte (KHOLE.maps : 1 Filons,
   2 Arène des minotaures, 3 Salle au trésor, 4 Vagues) · --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost } from './admin-client.js';
import { KHOLE } from '../src/config.js';

const name = arg('name'), map = Number(arg('map', '0'));
if(!name) fail('--name : le pseudo du joueur.');
if(!Number.isSafeInteger(map) || map < 0 || map > KHOLE.maps.length)
  fail(`--map : 0 (au hasard) ou ${KHOLE.maps.map((m, i) => `${i + 1} (${m.label})`).join(', ')}.`);

const data = await adminPost('/api/admin/khole', { name, map });
console.log(`K hole (${data.map}) ouvert dans la session de ${data.account} (${data.players.join(', ')}), au tick ${data.tick}. Aucun redémarrage nécessaire.`);
