/* Tout ce qui touche au hasard et aux secrets : ID de compte, codes de secours, jetons de connexion,
   hachage des mots de passe. Uniquement le module crypto intégré à Node. */
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { CODE_ALPHABET } from '../../src/shared/account.js';
import { SCRYPT } from '../config.js';

const scrypt = promisify(crypto.scrypt);

/* Code aléatoire dans l'alphabet de Crockford (ID de compte, code de secours). */
export function randomCode(length){
  let s = '';
  for(let i = 0; i < length; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return s;
}

/* Jeton de connexion : 256 bits, envoyé au navigateur dans un cookie. Le serveur n'en garde que l'empreinte. */
export const newToken = () => crypto.randomBytes(32).toString('base64url');
export const tokenHash = token => crypto.createHash('sha256').update(String(token)).digest('base64url');

/* Hachage d'un mot de passe (ou d'un code de secours). Format stocké, autoporteur :
   scrypt$N$r$p$sel$empreinte  → on peut durcir les réglages plus tard sans casser les anciens comptes. */
export async function hashSecret(secret, params=SCRYPT){
  const { N, r, p, keyLen, saltLen } = params;
  const salt = crypto.randomBytes(saltLen);
  const key = await scrypt(String(secret).normalize('NFC'), salt, keyLen, { N, r, p, maxmem: 256 * N * r });
  return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifySecret(secret, stored){
  const parts = String(stored ?? '').split('$');
  if(parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64url');
  const key = await scrypt(String(secret).normalize('NFC'), Buffer.from(saltB64, 'base64url'), expected.length,
                           { N:+N, r:+r, p:+p, maxmem: 256 * N * r });
  return crypto.timingSafeEqual(key, expected);
}

/* Empreinte factice : on la vérifie quand le pseudo n'existe pas, pour que la réponse prenne le même temps
   (sinon on pourrait deviner quels pseudos existent en chronométrant le serveur). */
let dummy = null;
export async function dummyVerify(params=SCRYPT){
  dummy ??= await hashSecret('pas-un-vrai-mot-de-passe', params);
  await verifySecret('x', dummy);
  return false;
}
