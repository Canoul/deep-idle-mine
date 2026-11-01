/* Outil d'administration : modération du chat (30/10/2026), SANS redémarrer le jeu. Sur le VPS :

     sudo node /opt/deep-idle-mine/scripts/moderation.js --name crousti            fiche : avertissements (date, salon,
                                                                                   motif, mots repérés, message tel qu'écrit,
                                                                                   message publié) et bans
     sudo node /opt/deep-idle-mine/scripts/moderation.js --recent [--limit 50]      derniers avertissements de tout le monde
     sudo node /opt/deep-idle-mine/scripts/moderation.js --name crousti --unban    lève son ban (son compteur repart de 0)
     sudo node /opt/deep-idle-mine/scripts/moderation.js --name crousti --forgive 2  retire l'avertissement n° 2 (il ne compte plus)
     sudo node /opt/deep-idle-mine/scripts/moderation.js --name crousti --forgive all  retire tous ses avertissements

   Un avertissement retiré reste dans la fiche (marqué « retiré ») : on garde la trace de ce qui s'est passé.
   --env, --url : voir scripts/admin-client.js. */
import { arg, fail, adminPost } from './admin-client.js';

const has = k => process.argv.includes('--' + k);
const date = t => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(t));
const CH = { global: 'chat global', session: 'chat de session' };
const line = (w, i) => [
  `${i !== undefined ? `#${i + 1} ` : ''}${date(w.at)} · ${CH[w.channel] ?? w.channel}${w.name ? ` · ${w.name}` : ''}${w.forgiven ? ' · RETIRÉ' : ''}`,
  `   motif   : ${w.motif}   (mots repérés : ${(w.words || []).join(', ')})`,
  `   écrit   : ${w.text}`,
  `   publié  : ${w.masked}`,
  ...(w.with?.length ? [`   complète un message de : ${w.with.map(p => p.name || p.account).join(', ')} (mot coupé sur plusieurs messages)`] : []),
].join('\n');

if(has('recent')){
  const limit = Number(arg('limit', '30'));
  const { rows } = await adminPost('/api/admin/moderation', { action: 'recent', limit: Number.isSafeInteger(limit) ? limit : 30 });
  console.log(rows.length ? rows.map(r => line(r)).join('\n\n') : 'Aucun avertissement.');
  process.exit(0);
}
const name = arg('name');
if(!name) fail('--name : le pseudo du joueur (ou --recent).');
if(has('unban')){
  await adminPost('/api/admin/moderation', { name, action: 'unban' });
  console.log(`Ban levé pour « ${name} ». Son compteur d'avertissements repart de 0.`);
  process.exit(0);
}
if(has('forgive')){
  const v = arg('forgive');
  const index = v === 'all' ? null : Number(v);
  if(index !== null && !Number.isSafeInteger(index)) fail('--forgive : un numéro (voir la fiche) ou « all ».');
  const r = await adminPost('/api/admin/moderation', { name, action: 'forgive', index });
  console.log(`${index === null ? 'Tous les avertissements retirés' : `Avertissement n° ${index} retiré`} pour « ${name} ». Avertissements qui comptent : ${r.counted}.`);
  process.exit(0);
}
const m = await adminPost('/api/admin/moderation', { name, action: 'show' });
console.log(`« ${m.account} » : ${m.counted} avertissement(s) qui compte(nt) pour le prochain ban.` +
  (m.bannedUntil > m.now ? ` BANNI jusqu'au ${date(m.bannedUntil)}.` : ' Pas banni.'));
if(m.warnings.length) console.log('\nAvertissements :\n' + m.warnings.map(line).join('\n\n'));
if(m.bans.length) console.log('\nBans :\n' + m.bans.map(b => `- ${date(b.at)} → ${date(b.until)} : ${b.motif}${b.liftedAt ? ` (levé le ${date(b.liftedAt)})` : ''}`).join('\n'));
