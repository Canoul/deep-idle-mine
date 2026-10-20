/* Règles partagées jeu + serveur pour les groupes : code de groupe et lien d'invitation. Logique pure.
   Le code utilise l'alphabet des ID de compte (pas de I, L, O, U) et se tape sans faire attention
   aux majuscules ni aux tirets. Lien d'invitation : https://deepmineidle.fr/#rejoindre=K7Q4P2 (SITE.url) */
import { PARTY, SITE } from '../config.js';
import { parseCode } from './account.js';

export const JOIN_HASH = 'rejoindre';

/* « k7q-4p2 » → « K7Q4P2 » ; null si ce n'est pas un code de groupe */
export const parsePartyCode = input => parseCode(input, PARTY.codeLength);

/* page en local (localhost, 127.x, réseau de la maison 192.168.x / 10.x) ? */
const LOCAL = /^https?:\/\/(localhost|127\.|192\.168\.|10\.|\[::1\])/i;
/* adresse du site pour un lien d'invitation : l'adresse officielle, sauf en local (l'adresse de la page) */
export const siteFor = pageUrl => LOCAL.test(String(pageUrl)) ? String(pageUrl).split('#')[0] : SITE.url;
/* adresse complète du lien d'invitation */
export function joinLink(pageUrl, code){
  return siteFor(pageUrl) + `#${JOIN_HASH}=${code}`;
}

/* code de groupe contenu dans un #… d'adresse (ou une adresse entière), sinon null */
export function joinCodeFromHash(hashOrUrl){
  const h = String(hashOrUrl ?? '');
  const m = h.slice(h.indexOf('#') + 1).match(new RegExp(`^${JOIN_HASH}=([^&]*)$`, 'i'));
  if(!h.includes('#') || !m) return null;
  try { return parsePartyCode(decodeURIComponent(m[1])); } catch { return null; }
}
