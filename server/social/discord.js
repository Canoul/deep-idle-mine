/* Annonces Discord : un message dans un salon (webhook) quand un joueur obtient quelque chose de très rare.
   - un trésor de tour de qualité ANNOUNCE.minQuality ou plus (« 🚨 Zoe a loot un trésor démoniaque R7 🚨 ») ;
   - une pièce identifiée dans cette qualité (« 🚨 Zoe a identifié Plastron en fer R7 🚨 ») ;
   - l'ouverture d'une tour du Jugement (« 🚨 La Tour du Démon est ouverte pendant 6 h ! 🚨 », 26/10) ;
   - le premier BP trouvé d'une pièce secrète du wiki (WIKI.secret), ou la pièce secrète elle-même (stuff du Roi
     Gobelin), avec ses stats (27/10).
   L'adresse du webhook est secrète (n'importe qui qui l'a peut écrire dans le salon) : DIM_DISCORD_WEBHOOK, dans
   /etc/deep-idle-mine.env sur le VPS, JAMAIS dans git. Absente : aucune annonce (local, mode dev, tests).
   L'envoi part en tâche de fond : Discord lent ou en panne ne retarde ni ne fait échouer une fin de session ou une
   identification (l'erreur est seulement écrite dans le journal du serveur). Personne n'est mentionné (@everyone
   dans un pseudo reste du texte). */
import { ANNOUNCE, ITEMS, JUDGMENT } from '../../src/config.js';
import { statLines } from '../../src/meta/stuff.js';

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

/* premier BP trouvé d'une pièce secrète : « 🚨 Zoe a découvert le plan des Doc Martins ! Résistance au recul +10,8 % ·
   Ténacité +16,25 % 🚨 » (27/10/2026) */
export function blueprintMessage(player, bp, piece){
  if(!ITEMS[piece]) return null;
  const stats = statLines(piece).join(' · ');
  return line(`${name(player)} a découvert le premier plan : ${escapeMarkdown(bp)} ! ${escapeMarkdown(piece)} : ${escapeMarkdown(stats || 'aucun effet')}`);
}

/* première fois qu'une pièce secrète est trouvée (stuff du Roi Gobelin) : « 🚨 Zoe a découvert la première Couronne du
   Roi Gobelin ! Découverte +1 · … 🚨 » (27/10/2026) */
export function discoveryMessage(player, piece){
  if(!ITEMS[piece]) return null;
  const stats = statLines(piece).join(' · ');
  return line(`${name(player)} est le premier à trouver : ${escapeMarkdown(piece)} ! ${escapeMarkdown(stats || 'aucun effet')}`);
}

/* message pour l'ouverture de la tour de ce camp ('angel' | 'demon'), ou null si le camp est inconnu */
export function towerOpenMessage(side){
  const def = Object.hasOwn(JUDGMENT.sides, side) ? JUDGMENT.sides[side] : null;
  return def ? line(`La ${def.tower} est ouverte pendant ${JUDGMENT.openHours} h !`) : null;
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
