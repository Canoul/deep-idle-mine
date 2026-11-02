/* Outil d'administration : signalements des joueurs (01/11/2026), SANS redémarrer le jeu. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/reports.js                    les 50 derniers
     sudo node /opt/deep-idle-mine/scripts/reports.js --open             seulement ceux pas encore traités
     sudo node /opt/deep-idle-mine/scripts/reports.js --name crousti     ceux qui le visent ou qu'il a envoyés (pseudo, ou ID d'un invité)
     sudo node /opt/deep-idle-mine/scripts/reports.js --close 12         marque le n° 12 traité
     sudo node /opt/deep-idle-mine/scripts/reports.js --log              journal des actions de modération (qui, quoi, quand)

   --limit : combien en afficher (50 par défaut) · --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost, adminBy, parisTime } from './admin-client.js';

const has = k => process.argv.includes('--' + k);
const limit = Number(arg('limit', '50'));
if(!Number.isSafeInteger(limit) || limit < 1) fail('--limit : un entier positif.');

if(has('log')){
  const { rows } = await adminPost('/api/admin/mod-log', { limit });
  console.log(rows.length ? rows.map(l => `${parisTime(l.at)} · ${l.by} · ${l.action}${l.target ? ` · ${l.target}` : ''}${l.detail ? ` · ${l.detail}` : ''}`).join('\n') : 'Journal vide.');
  process.exit(0);
}
if(has('close')){
  const id = Number(arg('close'));
  if(!Number.isSafeInteger(id) || id < 1) fail('--close : le numéro du signalement.');
  const { report } = await adminPost('/api/admin/reports', { action: 'close', id, by: adminBy() });
  console.log(`Signalement n° ${report.id} (${report.targetName}) marqué traité.`);
  process.exit(0);
}
const { rows } = await adminPost('/api/admin/reports', { name: arg('name'), open: has('open'), limit });
console.log(rows.length ? rows.map(r => [
  `#${r.id} ${parisTime(r.at)} · ${r.open ? 'À TRAITER' : `traité par ${r.closedBy}`} · ${r.reason} · ${r.source}`,
  `   par   : ${r.byName}`,
  `   visé  : ${r.targetName}`,
  ...(r.message ? [`   message n° ${r.message.id} (${r.message.channel}) : ${r.message.text}`] : []),
  ...(r.comment ? [`   commentaire : ${r.comment}`] : []),
].join('\n')).join('\n\n') : 'Aucun signalement.');
