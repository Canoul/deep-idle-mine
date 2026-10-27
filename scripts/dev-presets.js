/* Outil du mode développeur : crée (ou remet à neuf) un compte « preset » par spécialisation, dans les données
   LOCALES (data/) seulement, pour tester sans farmer :

     node scripts/dev-presets.js                → Test_Mineur, Test_Logisticien, Test_Barbare
     options : --keys 10 (Clés d'instance I dans l'inventaire) · --password preset1234

   Chaque preset : niveau du mineur et niveau de sa spécialisation au maximum stockable (XP entière « sûre », vers le
   niveau 72 : bien plus que ce que coûtent l'arbre et les sorts), arbre de sa spé rempli, sorts de la spé équipés,
   stuff complet en acier porté (casque, plastron, jambes, bottes, pioche, épée ; non identifié, +0), et les clés.
   Un preset déjà créé est REMIS À NEUF (inventaire, stuff, skills, sorts, XP écrasés), son mot de passe est gardé.
   Le serveur garde tout en mémoire : ARRÊTE-LE avant, sinon il réécrit l'ancien état par-dessus. */
import { pathToFileURL } from 'node:url';
import { SKILLS, SPELLS, XP } from '../src/config.js';
import { nameKey } from '../src/shared/account.js';
import { createInventory, addItem, serialize } from '../src/meta/inventory.js';
import { createStuff, stuffOp, equipSlotFor } from '../src/meta/stuff.js';
import { createSkills, sanitizeSkills } from '../src/meta/skills.js';
import { createSpells } from '../src/meta/spells.js';
import { createSets } from '../src/meta/sets.js';
import { xpForLevel, levelOf, specLevelOf, createProgress } from '../src/meta/level.js';

export const PRESET = {
  names: { mineur:'Test_Mineur', logisticien:'Test_Logisticien', barbare:'Test_Barbare' },
  gear: ['Casque en acier', 'Plastron en acier', 'Jambes en acier', 'Bottes en acier', 'Pioche en acier', 'Épée en acier'],
  key: 'Clé d\'instance I',
};

/* plus haut niveau dont l'XP totale reste un entier « sûr » (sinon le serveur la remet à 0) */
export function maxStorableLevel(){
  let n = 1;
  while(n < XP.maxLevel && Number.isSafeInteger(xpForLevel(n + 1))) n++;
  return n;
}

/* tout ce qu'un preset possède, prêt à enregistrer : { progress, inventory, stuff, skills, spells, sets } */
export function buildPreset(tree, { keys = 10 } = {}){
  const t = SKILLS.trees.find(x => x.id === tree);
  if(!t) throw new Error(`Spécialisation inconnue : ${tree}`);
  if(!Number.isSafeInteger(keys) || keys < 0) throw new Error('--keys : un entier positif.');
  const level = maxStorableLevel(), xp = xpForLevel(level);
  const progress = { ...createProgress(), xp, spec: { [tree]: xp } };   // specCurve = curve (XP)
  const points = levelOf(xp).talentPoints;
  const skills = { ...createSkills(), ...sanitizeSkills({ tree, ranks: Object.fromEntries(t.nodes.map(n => [n.id, n.max])) }, points) };
  const inv = createInventory(), stuff = createStuff();
  for(const item of PRESET.gear){
    const [i] = addItem(inv, item, 1);
    const r = stuffOp(inv, stuff, { action:'equip', slot: equipSlotFor(item, stuff.worn), uid: inv.slots[i].uid, opId: 'preset-' + item });
    if(r.error) throw new Error(`${item} : ${r.error}`);
  }
  stuff.ops = [];
  if(keys) addItem(inv, PRESET.key, keys);
  const spells = createSpells();
  SPELLS.list.filter(s => s.unlock.tree === tree && specLevelOf(xp).level >= s.unlock.level)
    .slice(0, SPELLS.openSlots).forEach((s, i) => { spells.slots[i] = s.id; });
  return { level, progress, inventory: JSON.parse(serialize(inv)), stuff, skills, spells, sets: createSets() };
}

async function main(){
  if(process.env.DATABASE_URL) throw new Error('DATABASE_URL présent : ce script ne touche QUE les données locales (data/).');
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  const keys = +arg('keys', 10), password = arg('password', 'preset1234');
  const { SERVER } = await import('../server/config.js');
  const { createFileStore } = await import('../server/accounts/store.js');
  const { createFileGameStore } = await import('../server/game/store.js');
  const { createAccountService } = await import('../server/accounts/service.js');
  const accounts = await createFileStore(SERVER.dataDir), game = await createFileGameStore(SERVER.dataDir);
  const service = createAccountService({ store: accounts });
  try {
    for(const t of SKILLS.trees){
      const name = PRESET.names[t.id] ?? ('Test_' + t.id).slice(0, 16);
      let acc = await accounts.findAccountByName(nameKey(name)), created = false;
      if(!acc){ acc = (await service.register({ name, password, ip: 'dev-presets' })).account; created = true; }
      const p = buildPreset(t.id, { keys });
      await game.putProgress(acc.id, p.progress);
      await game.putLoadout(acc.id, p);
      console.log(`${created ? '+ créé' : '↻ remis à neuf'} « ${name} »${created ? ` (mot de passe : ${password})` : ''} · niveau ${p.level}, spé ${t.label} ${p.level}`
        + ` · sorts : ${p.spells.slots.filter(Boolean).join(', ') || 'aucun'} · ${keys} × ${PRESET.key}`);
    }
  } finally { await game.close?.(); await accounts.close?.(); }
  console.log(`Données locales : ${SERVER.dataDir}. Lance (ou relance) npm run dev.`);
}

if(import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(e => { console.error(e.message); process.exitCode = 1; });
