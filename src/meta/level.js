/* Niveau du mineur : progression hors session, logique pure (partagée par le jeu et le serveur).
   Le compte ne stocke que son XP totale ; niveau, avancement et points de talent s'en déduisent. */
import { XP, SKILLS, GUILD } from '../config.js';

/* XP à gagner pour passer du niveau n au niveau n+1 (n ≥ 1) ; curve : XP.curve (mineur) ou XP.specCurve (spécialisation) */
const toNext = (n, curve) => Math.round(curve.first * curve.factor ** (n - 1));
export const xpToNext = n => toNext(n, XP.curve);

/* niveau atteint avec xp au total : { level, into (XP dans le niveau), need (XP pour le suivant) } */
function curveLevel(xp, curve){
  let level = 1, rest = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  while(level < XP.maxLevel && rest >= toNext(level, curve)){ rest -= toNext(level, curve); level++; }
  return { level, into: rest, need: level < XP.maxLevel ? toNext(level, curve) : 0 };
}
/* niveau du mineur, avec ses points de talent */
export function levelOf(xp){
  const l = curveLevel(xp, XP.curve);
  return { ...l, talentPoints: (l.level - 1) * XP.talentPerLevel };
}
/* niveau d'une spécialisation (XP.specCurve) */
export const specLevelOf = xp => curveLevel(xp, XP.specCurve);
/* XP de spécialisation gagnée avec une part d'XP de session (XP.specPct %, arrondi vers le bas) */
export const specXpOf = xp => Number.isSafeInteger(xp) && xp > 0 ? Math.floor(xp * XP.specPct / 100) : 0;
/* niveaux de spécialisation d'une progression : { arbre: { xp, level, into, need } } pour chaque arbre */
export const specLevels = progress => Object.fromEntries(SKILLS.trees.map(t => {
  const xp = progress?.spec?.[t.id] ?? 0;
  return [t.id, { xp, ...specLevelOf(xp) }];
}));

/* guilde : rawXp = XP brute des membres ; GUILD.xpPct % sur le total, pour ne pas perdre les petits gains (un run de prison) */
export const guildXpOf = rawXp => Number.isSafeInteger(rawXp) && rawXp > 0 ? Math.floor(rawXp * GUILD.xpPct / 100) : 0;
export const guildLevelOf = rawXp => curveLevel(guildXpOf(rawXp), XP.curve);

/* XP totale nécessaire pour atteindre le niveau n */
export function xpForLevel(n){ let t = 0; for(let k = 1; k < n; k++) t += xpToNext(k); return t; }

/* part de chacun : pot partagé à parts égales entre n joueurs, arrondi vers le bas (jamais plus d'XP versée que gagnée) */
export const xpShare = (pot, n) => n > 0 && Number.isSafeInteger(pot) && pot > 0 ? Math.floor(pot / n) : 0;

/* Progression d'un compte : { xp, spec:{ arbre: XP de spécialisation }, credited:[id de session] }. Versement
   idempotent : une session n'est comptée qu'une fois. Renvoie true si l'XP a été ajoutée. */
const CREDIT_MEMORY = 200;
const isTree = id => typeof id === 'string' && SKILLS.trees.some(t => t.id === id);
export function createProgress(){ return { xp: 0, spec: {}, credited: [], areaMax: 0 }; }
export function sanitizeProgress(p){
  const out = createProgress();
  if(p && Number.isSafeInteger(p.xp) && p.xp >= 0) out.xp = p.xp;
  for(const t of SKILLS.trees){ const v = p?.spec?.[t.id]; if(Number.isSafeInteger(v) && v > 0) out.spec[t.id] = v; }
  if(p && Number.isSafeInteger(p.areaMax) && p.areaMax > 0) out.areaMax = p.areaMax;
  if(Array.isArray(p?.credited)) out.credited = p.credited.filter(id => typeof id === 'string').slice(-CREDIT_MEMORY);
  return out;
}
/* areaMax : index de la plus profonde area débloquée en mine classique (0 = aucune, ou pas encore connue : le serveur
   la rattrape alors depuis l'historique). On ne garde que le maximum : rejouer une fin de session ne change rien.
   Renvoie true si la valeur a monté. */
export function raiseAreaMax(progress, k){
  if(!Number.isSafeInteger(k) || k <= progress.areaMax) return false;
  progress.areaMax = k;
  return true;
}
/* spec (facultatif) : { tree, xp } XP de spécialisation de la même session, versée dans le même geste (même
   idempotence) ; un arbre inconnu ou une quantité invalide ne versent pas d'XP de spécialisation */
export function creditXp(progress, sessionId, xp, spec = null){
  if(!sessionId || typeof sessionId !== 'string' || progress.credited.includes(sessionId)) return false;
  if(!Number.isSafeInteger(xp) || xp < 0) return false;
  progress.credited.push(sessionId);
  if(progress.credited.length > CREDIT_MEMORY) progress.credited.splice(0, progress.credited.length - CREDIT_MEMORY);
  progress.xp += xp;
  if(spec && isTree(spec.tree) && Number.isSafeInteger(spec.xp) && spec.xp > 0)
    progress.spec[spec.tree] = (progress.spec[spec.tree] || 0) + spec.xp;
  return true;
}
