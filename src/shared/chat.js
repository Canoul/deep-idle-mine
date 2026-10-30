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
