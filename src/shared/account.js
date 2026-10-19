/* Règles des comptes, partagées par le jeu (vérification avant envoi) et le serveur (qui fait foi).
   Logique pure : aucun accès au DOM, au réseau ni au disque. */
import { ACCOUNT } from '../config.js';

/* Alphabet de Crockford : 32 caractères sans I, L, O ni U (pas de confusion 1/I/L, 0/O, ni de mot gênant).
   Sert aux ID de compte et aux codes de secours. */
export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/* ---------- pseudo ---------- */

/* Pseudo tel qu'il sera affiché : espaces autour retirés, accents en forme canonique. */
export function cleanName(name){
  return String(name ?? '').trim().normalize('NFC');
}

/* Clé d'unicité d'un pseudo : sans majuscules ni accents. « Éric » et « eric » sont le même pseudo,
   pour qu'on ne puisse pas se faire passer pour quelqu'un d'autre. */
export function nameKey(name){
  return cleanName(name).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/* Renvoie null si le pseudo est valable, sinon le message d'erreur à afficher. */
export function checkName(name){
  const n = cleanName(name);
  if(n.length < ACCOUNT.nameMin) return `Le pseudo doit faire au moins ${ACCOUNT.nameMin} caractères.`;
  if(n.length > ACCOUNT.nameMax) return `Le pseudo doit faire au plus ${ACCOUNT.nameMax} caractères.`;
  if(!/^[\p{L}\p{N}_-]+$/u.test(n)) return 'Le pseudo ne peut contenir que des lettres, des chiffres, « - » et « _ ».';
  if(!/\p{L}/u.test(n)) return 'Le pseudo doit contenir au moins une lettre.';
  if(ACCOUNT.reservedNames.includes(nameKey(n))) return 'Ce pseudo est réservé.';
  return null;
}

/* ---------- mot de passe ---------- */

/* Renvoie null si le mot de passe est valable, sinon le message d'erreur. Il n'est jamais rogné. */
export function checkPassword(password, name=''){
  const p = String(password ?? '');
  if(p.length < ACCOUNT.passMin) return `Le mot de passe doit faire au moins ${ACCOUNT.passMin} caractères.`;
  if(p.length > ACCOUNT.passMax) return `Le mot de passe doit faire au plus ${ACCOUNT.passMax} caractères.`;
  if(name && nameKey(p) === nameKey(name)) return 'Le mot de passe ne peut pas être ton pseudo.';
  return null;
}

/* ---------- ID de compte et code de secours ---------- */

/* Regroupe un code par paquets de 4 : « 7K3Q9XHP » → « 7K3Q-9XHP ». */
export function formatCode(code){
  return String(code).match(/.{1,4}/g)?.join('-') ?? '';
}

/* Remet en forme un code tapé par un joueur : majuscules, sans tirets ni espaces,
   et corrige les confusions habituelles (I/L → 1, O → 0). Renvoie null si ce n'est pas un code de cette longueur. */
export function parseCode(input, length){
  const c = String(input ?? '').toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  if(c.length !== length) return null;
  for(const ch of c) if(!CODE_ALPHABET.includes(ch)) return null;
  return c;
}

export const formatAccountId = id => formatCode(id);
export const parseAccountId = input => parseCode(input, ACCOUNT.idLength);
export const parseRecoveryCode = input => parseCode(input, ACCOUNT.recoveryLength);

/* Nom affiché d'un compte : son pseudo, ou « Invité 7K3Q » tant que le compte invité n'est pas sécurisé. */
export function displayName(account){
  if(!account) return '';
  return account.name || `Invité ${String(account.id).slice(0, 4)}`;
}
