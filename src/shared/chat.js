/* Chat de session : règle du texte d'un message, partagée par le navigateur (confort) et le serveur (qui fait foi). */
import { CHAT } from '../config.js';

/* caractères de contrôle et d'inversion du sens d'écriture (texte trompeur) : remplacés par une espace */
const BAD = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g;

/* texte d'un message : une chaîne, sans caractères de contrôle, espaces resserrés, de 1 à CHAT.maxLen caractères ;
   sinon null. Le balisage reste du texte : c'est l'affichage qui l'échappe. */
export function cleanChatText(v){
  if(typeof v !== 'string') return null;
  const t = v.replace(BAD, ' ').replace(/\s+/g, ' ').trim();
  return t && [...t].length <= CHAT.maxLen ? t : null;
}

/* messages encore assez récents (moins de CHAT.maxAgeMs à l'instant now) : les plus vieux disparaissent (30/10/2026) */
export const freshMessages = (msgs, now, maxAge = CHAT.maxAgeMs) => (msgs || []).filter(m => now - m.at < maxAge);

/* canal d'un message ; absent ou inconnu (messages d'avant le 31/10) : Général */
export const chatChannel = id => CHAT.channels.find(c => c.id === id) ?? CHAT.channels[0];

const SHORTCUTS = { '1': 'general', '2': 'lfg', c: 'commerce', gr: 'group' };
/* ce que le joueur a tapé → { channel, text, to? } ou { error } ; channel, target : canal gardé (et pseudo, pour un MP), sans raccourci.
   /1 général · /2 LFG · /c commerce · /gr groupe · /w "pseudo" message privé (guillemets facultatifs sans espace) */
export function parseChatInput(input, channel = 'general', target = null){
  const w = /^\/w(?:\s+(?:"([^"]+)"|(\S+)))?(?:\s+(.*))?$/i.exec(input);
  if(w){
    const to = w[1] ?? w[2], text = w[3];
    return to && text ? { channel: 'mp', to, text } : { error: 'Écris /w "pseudo" message.' };
  }
  const m = /^\/(1|2|c|gr)(?:\s+(.*))?$/i.exec(input);
  if(m) return m[2] ? { channel: SHORTCUTS[m[1].toLowerCase()], text: m[2] } : { error: 'Écris ton message après le raccourci.' };
  return channel === 'mp' ? { channel, to: target, text: input } : { channel, text: input };
}

/* réglages du chat d'un joueur (ns chat_prefs), relus et revérifiés : { tabs:[{ name, hidden:[canal] }], active, channel, to? } ;
   channel : canal du dernier message envoyé, gardé pour le suivant (31/10/2026) */
export function sanitizeChatPrefs(raw){
  const ids = new Set(CHAT.channels.map(c => c.id));
  const tabs = (Array.isArray(raw?.tabs) ? raw.tabs : []).filter(t => t && typeof t === 'object').slice(0, CHAT.tabsMax).map((t, i) => ({
    name: cleanChatText(t.name)?.slice(0, CHAT.tabNameMax) || `Onglet ${i + 1}`,
    hidden: [...new Set(Array.isArray(t.hidden) ? t.hidden.filter(c => ids.has(c)) : [])] }));
  if(!tabs.length) tabs.push({ name: 'Tous', hidden: [] });
  const active = Number.isSafeInteger(raw?.active) && raw.active >= 0 && raw.active < tabs.length ? raw.active : 0;
  const to = raw?.channel === 'mp' ? cleanChatText(raw.to)?.slice(0, 40) : null;   // canal gardé : un MP garde son destinataire
  const channel = ids.has(raw?.channel) && (raw.channel !== 'mp' || to) ? raw.channel : 'general';
  return { tabs, active, channel, ...(channel === 'mp' ? { to } : {}) };
}
