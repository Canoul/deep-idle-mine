/* Règles partagées jeu + serveur pour les groupes : code de groupe et lien d'invitation. Logique pure.
   Le code utilise l'alphabet des ID de compte (pas de I, L, O, U) et se tape sans faire attention
   aux majuscules ni aux tirets. Lien d'invitation : https://<site>/#rejoindre=K7Q4P2 */
import { PARTY } from '../config.js';
import { parseCode } from './account.js';

export const JOIN_HASH = 'rejoindre';

/* « k7q-4p2 » → « K7Q4P2 » ; null si ce n'est pas un code de groupe */
export const parsePartyCode = input => parseCode(input, PARTY.codeLength);

/* adresse complète du lien d'invitation, depuis l'adresse de la page (sans son #…) */
export function joinLink(pageUrl, code){
  return String(pageUrl).split('#')[0] + `#${JOIN_HASH}=${code}`;
}

/* code de groupe contenu dans un #… d'adresse (ou une adresse entière), sinon null */
export function joinCodeFromHash(hashOrUrl){
  const h = String(hashOrUrl ?? '');
  const m = h.slice(h.indexOf('#') + 1).match(new RegExp(`^${JOIN_HASH}=([^&]*)$`, 'i'));
  if(!h.includes('#') || !m) return null;
  try { return parsePartyCode(decodeURIComponent(m[1])); } catch { return null; }
}
