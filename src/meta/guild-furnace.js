/* Fours de guilde (07/11/2026, Geoffrey ; GUILD.furnace) : logique pure, partagée par le serveur (server/guild/service.js) et
   le jeu (affichage). Ce sont les fours du joueur (src/meta/furnace.js), mêmes règles et même moteur, sauf que :
   - leur inventaire est la banque de guilde : on y prend les ingrédients et le combustible, on y rend ce qu'on retire, et la
     case de sortie se vide dans la banque (« Récupérer ») ;
   - GUILD.furnace.count fours, tous du tier GUILD.furnace.tier (vitesse × 2), ouverts d'office (pas d'objet à utiliser) ;
   - toutes les recettes de fonte sont ouvertes (pas de recette à apprendre, comme le craft de guilde).
   Seuls le chef et les officiers s'en servent (vérifié par le serveur). L'état est rangé dans la banque : bank.furnaces. */
import { GUILD, FURNACE } from '../config.js';
import { newFurnace, sanitizeFurnaces, furnaceOp, advance, allRecipes, recipeMax, furnaceRecipeName } from './furnace.js';
import { sortInventory } from './inventory.js';

/* actions permises (pas d'« unlock » : les fours de guilde sont ouverts d'office) */
export const GUILD_FURNACE_ACTIONS = ['recipe', 'collect', 'empty', 'emptyAll', 'unload', 'load', 'mode'];

const guildFurnace = () => ({ ...newFurnace(), tier:GUILD.furnace.tier });
export const createGuildFurnaces = () => ({ list:Array.from({ length:GUILD.furnace.count }, guildFurnace), ops:[] });

/* relit l'état enregistré : mêmes vérifications que les fours d'un joueur, puis exactement count fours du tier de guilde */
export function sanitizeGuildFurnaces(raw){
  const st = sanitizeFurnaces(raw && Array.isArray(raw.list) ? raw : { list:[] });
  const list = st.list.slice(0, GUILD.furnace.count).map(f => ({ ...f, tier:GUILD.furnace.tier }));
  while(list.length < GUILD.furnace.count) list.push(guildFurnace());
  return { list, ops:st.ops };
}

/* toutes les recettes de fonte ouvertes : l'inventaire prêté au moteur les « connaît » toutes */
const ALL_KNOWN = Object.entries(FURNACE.recipes).filter(([, r]) => r.unlock).map(([item]) => furnaceRecipeName(item));
const lend = bank => ({ slots:bank.slots, unlocked:ALL_KNOWN });

/* une action sur un four de guilde ; modifie la banque et ses fours ensemble (tout ou rien, comme furnaceOp).
   Renvoie { ok, repeated } ou { error } */
export function guildFurnaceOp(bank, op, now){
  if(!op || !GUILD_FURNACE_ACTIONS.includes(op.action)) return { error:'bad_request' };
  bank.furnaces ??= createGuildFurnaces();
  const inv = lend(bank);
  const r = furnaceOp(bank.furnaces, inv, op, now);
  if(r.error) return r;
  bank.slots = inv.slots;
  sortInventory(bank);
  return r;
}

/* vue des fours à l'heure now (sur une copie : rien n'est modifié) ; recipes : chaque recette et le plus de fournées que la
   banque permet d'ajouter dans ce four */
export function guildFurnacesView(bank, now){
  const st = structuredClone(bank.furnaces ?? createGuildFurnaces()), inv = structuredClone(lend(bank));
  return st.list.map(f => {
    advance(f, now);
    return { ...f, recipes:allRecipes().map(r => ({ out:r.out, mode:r.mode, max:recipeMax(f, inv, r.out) })) };
  });
}
