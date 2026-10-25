/* Annonces Discord : un message dans un salon (webhook) quand un joueur obtient quelque chose de très rare.
   - un trésor de tour de qualité ANNOUNCE.minQuality ou plus (« 🚨 Zoe a loot un trésor démoniaque R7 🚨 ») ;
   - une pièce identifiée dans cette qualité (« 🚨 Zoe a identifié Plastron en fer R7 🚨 »).
   L'adresse du webhook est secrète (n'importe qui qui l'a peut écrire dans le salon) : DIM_DISCORD_WEBHOOK, dans
   /etc/deep-idle-mine.env sur le VPS, JAMAIS dans git. Absente : aucune annonce (local, mode dev, tests).
   L'envoi part en tâche de fond : Discord lent ou en panne ne retarde ni ne fait échouer une fin de session ou une
   identification (l'erreur est seulement écrite dans le journal du serveur). Personne n'est mentionné (@everyone
   dans un pseudo reste du texte). */
import { ANNOUNCE, ITEMS } from '../../src/config.js';

/* pseudo affiché tel quel : on neutralise la mise en forme Discord (*gras*, _italique_, `code`, ||spoiler||…) */
export const escapeMarkdown = s => String(s ?? '').replace(/[\\*_~`|>[\]]/g, '\\$&');
const name = player => escapeMarkdown(player) || 'Un joueur';
const line = text => `${ANNOUNCE.emoji} ${text} ${ANNOUNCE.emoji}`;

/* message pour un objet reçu en fin de session, ou null s'il ne mérite pas d'annonce (pas un trésor de tour, qualité
   trop basse). « Trésor démoniaque R7 » → « trésor démoniaque R7 ». */
export function treasureMessage(player, item){
  const q = ITEMS[item]?.treasure ? ITEMS[item].chest?.q : undefined;
  if(!(q >= ANNOUNCE.minQuality)) return null;
  return line(`${name(player)} a loot un ${item[0].toLowerCase()}${item.slice(1)}`);
}

/* message pour une pièce qu'on vient d'identifier ({ item, q }), ou null si sa qualité est trop basse */
export function identifyMessage(player, piece){
  if(!(piece?.q >= ANNOUNCE.minQuality)) return null;
  return line(`${name(player)} a identifié ${piece.item} R${piece.q}`);
}

/* announce(texte) : envoie le message au webhook, sans jamais lever d'erreur ; renvoie la promesse de l'envoi (pour
   les tests ; le jeu ne l'attend pas). fetch et log remplaçables pour les tests. */
export function createDiscordAnnouncer({ url, fetch = globalThis.fetch, log = console.error, timeoutMs = ANNOUNCE.timeoutMs } = {}){
  return async function announce(text){
    if(!url || !text) return;
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, allowed_mentions: { parse: [] } }), signal: AbortSignal.timeout(timeoutMs) });
      if(!res.ok) log(`Annonce Discord refusée : ${res.status}`);
    } catch(e){ log(`Annonce Discord impossible : ${e.message}`); }
  };
}
