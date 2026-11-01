/* Outil d'administration : supprime un message du chat global pour tout le monde, bulles du Carreau comprises, SANS redémarrer le
   jeu (01/11/2026). Le texte supprimé reste dans le journal (scripts/reports.js --log) et dans le signalement. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/delete-message.js --list [--name crousti]   derniers messages et leur numéro
     sudo node /opt/deep-idle-mine/scripts/delete-message.js --id 42                   supprime le message n° 42

   Le numéro est aussi dans le signalement (scripts/reports.js). Le chat de session n'est pas concerné : il n'est pas gardé.
   --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost, adminBy, parisTime } from './admin-client.js';

if(process.argv.includes('--list')){
  const { rows } = await adminPost('/api/admin/chat-recent', { name: arg('name') });
  console.log(rows.length ? rows.map(m => `#${m.id} ${parisTime(m.at)} · [${m.channel ?? 'general'}] ${m.name} : ${m.text}`).join('\n') : 'Aucun message.');
  process.exit(0);
}
const id = Number(arg('id'));
if(!Number.isSafeInteger(id) || id < 1) fail('--id : le numéro du message (voir --list), ou --list.');
const r = await adminPost('/api/admin/chat-delete', { id, by: adminBy() });
console.log(`Message n° ${r.id} de ${r.name} supprimé : ${r.text}`);
