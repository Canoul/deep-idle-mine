/* Chat de session : règle du texte d'un message, partagée par le navigateur (confort) et le serveur (qui fait foi). */
import { CHAT, MINE_MODES } from '../config.js';

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

/* messages déjà affichés + nouveaux : triés par numéro, sans doublon */
export function mergeMessages(msgs, list){
  const ids = new Set(msgs.map(m => m.id));
  return msgs.concat(list.filter(m => !ids.has(m.id))).sort((a, b) => a.id - b.id);
}

/* canal d'un message ; absent ou inconnu (messages d'avant le 31/10, ancien canal Commerce) : Général */
export const chatChannel = id => CHAT.channels.find(c => c.id === id) ?? CHAT.channels[0];

/* lien de lobby dans le chat (31/10/2026, Geoffrey) : ce mot, dans un message, devient un lien vers le groupe de son auteur */
export const LOBBY_TAG = '%lobby';
/* activité annoncée par le lien : une activité de groupe, sinon la mine ; niveau 1 à 9. Le navigateur la donne, elle ne
   sert qu'à l'affichage : c'est le chef qui choisit au lancement */
export function lobbyLink(mode, level){
  const def = MINE_MODES.find(m => m.id === mode);
  const ok = def?.ready && !def.solo && !def.giant && !def.scheduled;
  return { mode: ok ? def.id : MINE_MODES[0].id, level: Number.isSafeInteger(level) && level >= 1 && level <= 9 ? level : 1 };
}
/* « Instance I 2/3 », « Tour de l'Ange niv. 2 1/3 » ; mode null : le chef n'a pas encore ouvert d'activité */
export function lobbyLabel({ mode, level, size, max }){
  const name = mode === null ? 'Activité à choisir' : MINE_MODES.find(m => m.id === mode)?.label ?? MINE_MODES[0].label;
  return `${name}${level > 1 ? ` niv. ${level}` : ''} ${size}/${max}`;
}

const SHORTCUTS = { '1': 'general', '2': 'lfg', lfg: 'lfg', gr: 'group' };
/* ce que le joueur a tapé → { channel, text, to? } ou { error } ; channel, target : canal gardé (et pseudo, pour un MP), sans raccourci.
   /1 général · /2 ou /lfg LFG · /gr groupe · /w "pseudo" message privé (guillemets facultatifs sans espace) ; lobby : true si le texte
   contient LOBBY_TAG */
export function parseChatInput(input, channel = 'general', target = null){
  const msg = parseLine(input, channel, target);
  return msg.text?.includes(LOBBY_TAG) ? { ...msg, lobby: true } : msg;
}
function parseLine(input, channel, target){
  const w = /^\/w(?:\s+(?:"([^"]+)"|(\S+)))?(?:\s+(.*))?$/i.exec(input);
  if(w){
    const to = w[1] ?? w[2], text = w[3];
    return to && text ? { channel: 'mp', to, text } : { error: 'Écris /w "pseudo" message.' };
  }
  const m = /^\/(1|2|lfg|gr)(?:\s+(.*))?$/i.exec(input);
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
