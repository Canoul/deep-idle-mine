/* Outil du mode développeur : crée (ou remet à neuf) un compte « preset » par spécialisation, dans les données
   LOCALES (data/) seulement, pour tester sans farmer :

     node scripts/dev-presets.js                → Test_Mineur, Test_Logisticien, Test_Barbare
     options : --keys 10 (Clés d'instance I dans l'inventaire) · --password preset1234
     node scripts/dev-presets.js --from data/presets/canoul-mus.json   → Test_Canoul, Test_Mus (copies de vrais joueurs)

   --from (29/10/2026) : un fichier JSON { pseudo: copie } où chaque copie est ce que le jeu en ligne renvoie (stuff porté,
   skills, sorts, progression ; voir presetFromSnapshot dans src/shared/dev-presets.js). Le compte local « Test_<Pseudo> »
   reçoit ce personnage à l'identique (niveau et XP réels, pas le maximum), plus les clés. Range ces fichiers dans data/
   (ignoré par git) : c'est le stuff de vrais joueurs.

   Chaque preset : niveau du mineur et niveau de sa spécialisation au maximum stockable (XP entière « sûre », vers le
   niveau 72 : bien plus que ce que coûtent l'arbre et les sorts), arbre de sa spé rempli avec tous ses glyphes posés,
   sorts de la spé équipés, stuff complet en acier porté (casque, plastron, jambes, bottes, pioche, épée ; non identifié, +0), et les clés.
   Un preset déjà créé est REMIS À NEUF (inventaire, stuff, skills, sorts, XP écrasés), son mot de passe est gardé.
   Le serveur garde tout en mémoire : ARRÊTE-LE avant, sinon il réécrit l'ancien état par-dessus. */
import { pathToFileURL } from 'node:url';
import { SKILLS, DEV_PRESETS } from '../src/config.js';
import { nameKey } from '../src/shared/account.js';
import fs from 'node:fs';
import { buildPreset, presetName, presetFromSnapshot } from '../src/shared/dev-presets.js';

async function main(){
  if(process.env.DATABASE_URL) throw new Error('DATABASE_URL présent : ce script ne touche QUE les données locales (data/).');
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  const keys = +arg('keys', DEV_PRESETS.keys), password = arg('password', 'preset1234');
  const { SERVER } = await import('../server/config.js');
  const { createFileStore } = await import('../server/accounts/store.js');
  const { createFileGameStore } = await import('../server/game/store.js');
  const { createAccountService } = await import('../server/accounts/service.js');
  const accounts = await createFileStore(SERVER.dataDir), game = await createFileGameStore(SERVER.dataDir);
  const service = createAccountService({ store: accounts });
  try {
    const from = arg('from');
    if(from){
      const copies = JSON.parse(fs.readFileSync(from, 'utf8'));
      for(const [who, snap] of Object.entries(copies)){
        if(!snap) { console.log(`- « ${who} » : vide, ignoré`); continue; }
        const name = ('Test_' + who[0].toUpperCase() + who.slice(1).toLowerCase()).slice(0, 16);
        let acc = await accounts.findAccountByName(nameKey(name)), created = false;
        if(!acc){ acc = (await service.register({ name, password, ip: 'dev-presets' })).account; created = true; }
        const p = presetFromSnapshot(snap, { keys });
        await game.putProgress(acc.id, p.progress);
        await game.putLoadout(acc.id, p);
        console.log(`${created ? '+ créé' : '↻ remis à neuf'} « ${name} »${created ? ` (mot de passe : ${password})` : ''} · copie de ${snap.name ?? who} · niveau ${p.level}, spé ${p.skills.tree}`
          + ` · ${Object.values(p.stuff.worn).filter(Boolean).length} pièces portées · sorts : ${p.spells.slots.filter(Boolean).join(', ') || 'aucun'} · ${keys} × ${DEV_PRESETS.key}`);
      }
      return;
    }
    for(const t of SKILLS.trees){
      const name = presetName(t.id);
      let acc = await accounts.findAccountByName(nameKey(name)), created = false;
      if(!acc){ acc = (await service.register({ name, password, ip: 'dev-presets' })).account; created = true; }
      const p = buildPreset(t.id, { keys });
      await game.putProgress(acc.id, p.progress);
      await game.putLoadout(acc.id, p);
      console.log(`${created ? '+ créé' : '↻ remis à neuf'} « ${name} »${created ? ` (mot de passe : ${password})` : ''} · niveau ${p.level}, spé ${t.label} ${p.level}`
        + ` · sorts : ${p.spells.slots.filter(Boolean).join(', ') || 'aucun'} · glyphes : ${Object.keys(p.skills.glyphs).length} · ${keys} × ${DEV_PRESETS.key}`);
    }
  } finally { await game.close?.(); await accounts.close?.(); }
  console.log(`Données locales : ${SERVER.dataDir}. Lance (ou relance) npm run dev.`);
}

if(import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(e => { console.error(e.message); process.exitCode = 1; });
