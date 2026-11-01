/* Suppression d'un compte (01/11/2026, Geoffrey, exigence de Google Play et de l'App Store) : une seule fonction, deleteAccount,
   appelée par le joueur (Mon compte) et par les créateurs (scripts/delete-account.js).

   1. Chaque service en mémoire fait sortir le joueur (eraseAccount) : session quittée, prison arrêtée, groupe (le suivant devient
      chef), inscriptions, guilde, raffle, messages du chat, présence, Carreau.
   2. Puis tout le stockage en une seule écriture (une transaction sur PostgreSQL) : server/game/store.js efface ses lignes et
      nettoie les données communes, server/accounts/store.js le compte et ses connexions. Une panne au milieu ne laisse donc
      pas un compte à moitié supprimé ; on peut relancer : l'étape 1 ne fait rien de plus.

   Gardés : les signalements qui le visent (avec le texte) et la ligne « compte <id> supprimé le <date> » du journal.
   Une session encore en cours avec d'autres joueurs n'est nettoyée qu'à sa fin (le moteur la lit encore) : server/game/service.js. */
import crypto from 'node:crypto';
import { displayName, formatAccountId } from '../../src/shared/account.js';
import { DELETED_NAME } from '../game/store.js';

export { DELETED_NAME };

/* date lisible de la ligne de journal, heure de Paris */
const dayOf = t => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(new Date(t));

/* services : chacun a eraseAccount(id, who) ; giants : Bloc géant et He's coming. Tous facultatifs sauf les deux stockages. */
export function createAccountEraser({ accounts, gameStore, game, party, instant, social, guild, giants = [], town, clock = Date.now, log = console.error }){
  const running = new Set();    // comptes en cours de suppression : un double clic ne lance rien de plus
  const leave = async (name, fn) => { try { await fn(); } catch(e){ log(`Suppression de compte, ${name} : ${e.message}`); throw e; } };

  async function erase(acc, by){
    const id = acc.id;
    /* who : ce qui le désigne ailleurs ; anon : un seul faux compte pour toutes ses lignes (le tableau de bord reste juste), sans lien avec lui */
    const who = { id, names: [acc.name, displayName(acc), formatAccountId(id)].filter(Boolean), anon: `anon-${crypto.randomBytes(6).toString('hex')}` };
    for(const [name, s] of Object.entries({ game, instant, party, giant: giants[0], hescoming: giants[1], guild, town, social }))
      if(s?.eraseAccount) await leave(name, () => s.eraseAccount(id, who));
    const now = clock(), shown = formatAccountId(id);
    const line = { at: now, by, action: 'account-delete', target: shown, detail: `compte ${shown} supprimé le ${dayOf(now)}` };
    const write = async () => {
      const changes = [...gameStore.eraseAccount(who, line), ...accounts.eraseAccount(id)];
      await gameStore.changed(changes);
      if(!gameStore.db || gameStore.db !== accounts.db) await accounts.changed(changes);      // même base : déjà écrit, tout ensemble
    };
    /* pas de demande d'ami ou de message en même temps que l'écriture */
    await (social?.exclusive ? social.exclusive(write) : write());
  }

  return {
    /* { deleted: true } ; compte inconnu (déjà supprimé) : { deleted: false } */
    async deleteAccount(id, { by = 'joueur' } = {}){
      const acc = await accounts.getAccount(id);
      if(!acc || running.has(id)) return { deleted: false };
      running.add(id);
      try { await erase(acc, by); return { deleted: true, account: displayName(acc) || formatAccountId(id) }; }
      finally { running.delete(id); }
    },
  };
}
