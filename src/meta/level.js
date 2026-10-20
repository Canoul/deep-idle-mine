/* Niveau du mineur : progression hors session, logique pure (partagée par le jeu et le serveur).
   Le compte ne stocke que son XP totale ; niveau, avancement et points de talent s'en déduisent. */
import { XP } from '../config.js';

/* XP à gagner pour passer du niveau n au niveau n+1 (n ≥ 1) */
export const xpToNext = n => Math.round(XP.curve.first * XP.curve.factor ** (n - 1));

/* niveau atteint avec xp au total : { level, into (XP dans le niveau), need (XP pour le suivant), talentPoints } */
export function levelOf(xp){
  let level = 1, rest = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  while(level < XP.maxLevel && rest >= xpToNext(level)){ rest -= xpToNext(level); level++; }
  return { level, into: rest, need: level < XP.maxLevel ? xpToNext(level) : 0, talentPoints: (level - 1) * XP.talentPerLevel };
}

/* XP totale nécessaire pour atteindre le niveau n */
export function xpForLevel(n){ let t = 0; for(let k = 1; k < n; k++) t += xpToNext(k); return t; }

/* part de chacun : pot partagé à parts égales entre n joueurs, arrondi vers le bas (jamais plus d'XP versée que gagnée) */
export const xpShare = (pot, n) => n > 0 && Number.isSafeInteger(pot) && pot > 0 ? Math.floor(pot / n) : 0;

/* Progression d'un compte : { xp, credited:[id de session] }. Versement idempotent : une session n'est comptée qu'une fois.
   Renvoie true si l'XP a été ajoutée. */
const CREDIT_MEMORY = 200;
export function createProgress(){ return { xp: 0, credited: [] }; }
export function sanitizeProgress(p){
  const out = createProgress();
  if(p && Number.isSafeInteger(p.xp) && p.xp >= 0) out.xp = p.xp;
  if(Array.isArray(p?.credited)) out.credited = p.credited.filter(id => typeof id === 'string').slice(-CREDIT_MEMORY);
  return out;
}
export function creditXp(progress, sessionId, xp){
  if(!sessionId || typeof sessionId !== 'string' || progress.credited.includes(sessionId)) return false;
  if(!Number.isSafeInteger(xp) || xp < 0) return false;
  progress.credited.push(sessionId);
  if(progress.credited.length > CREDIT_MEMORY) progress.credited.splice(0, progress.credited.length - CREDIT_MEMORY);
  progress.xp += xp;
  return true;
}
