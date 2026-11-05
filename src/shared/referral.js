/* Parrainage (05/11/2026, Geoffrey ; REFERRAL en config) : règles partagées par le jeu (affichage) et le serveur (qui fait foi).
   Le code d'un joueur est son ID de compte (8 caractères, affiché « XXXX-XXXX ») ; son lien : <site>/?ref=<code>.
   Fiche de parrainage d'un compte : { by : compte du parrain, at, legacy? (affilié d'office, comptes d'avant), done?, doneAt?,
   paid? (le parrain a reçu sa part) }. Logique pure. */
import { ACCOUNT, REFERRAL } from '../config.js';
import { formatAccountId } from './account.js';

/* code saisi ou lu dans un lien → ID de compte (majuscules, sans tiret ni espace), ou null s'il n'a pas la bonne forme */
export function parseReferralCode(raw){
  if(typeof raw !== 'string') return null;
  const c = raw.toUpperCase().replace(/[\s-]/g, '');
  return c.length === ACCOUNT.idLength && /^[A-Z0-9]+$/.test(c) ? c : null;
}
export const referralCode = accountId => formatAccountId(accountId);
export const referralLink = (origin, accountId) => `${String(origin || '').replace(/\/+$/, '')}/?ref=${accountId}`;

/* pourquoi ce joueur ne peut pas entrer ce code (null = possible) : rec = sa fiche, level = son niveau, target = compte du
   code (null s'il n'existe pas), targetRec = la fiche du parrain visé */
export function referralRefusal({ me, rec, level, code, target, targetRec }){
  if(!code) return 'bad_code';
  if(rec?.by) return 'already';
  if(level >= REFERRAL.level) return 'too_late';
  if(code === me) return 'self';
  if(!target) return 'unknown_code';
  if(targetRec?.by === me) return 'cycle';
  return null;
}
export const REFERRAL_ERRORS = {
  bad_code: 'Code invalide : 8 lettres ou chiffres (par exemple ABCD-1234).',
  already: 'Tu as déjà un parrain.',
  too_late: `Trop tard : le code d'un parrain s'entre avant le niveau ${REFERRAL.level}.`,
  self: 'Ce code est le tien.',
  unknown_code: 'Aucun joueur n\'a ce code.',
  cycle: 'Ce joueur est déjà ton filleul.',
};
