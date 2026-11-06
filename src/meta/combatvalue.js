/* xc, la valeur de combat d'un objet (06/11/2026, Geoffrey : « un x différent pour les stats offensives »).
   1 xc = +1 % de DPS sur le mineur de référence du tier de la pièce (UPGRADE.xc) : un % de dégâts, de double attaque ou
   de critique vaut ainsi toujours à peu près la même chose, quel que soit le tier ; ce sont les stats fixes (dégâts) qui
   valent plus tôt dans le jeu. Sert à lire le poids d'un objet à côté du x (mine) et du GS : ne change aucune valeur.
   Comptent : les stats de l'objet, ses lignes (identification, rune, fragment) et son amélioration (pieceBonus). */
import { STATS, ITEMS, UPGRADE, CFG } from '../config.js';
import { pieceBonus, tierOf, isRing } from './piece.js';

const X = UPGRADE.xc;

/* DPS d'un jeu de stats (coups par seconde × dégâts moyens d'un coup) */
export function dps(c){
  const dmg = (c.damage ?? STATS.damage) * (1 + (c.damagePct || 0) / 100);
  const rate = (c.attackSpeed ?? STATS.attackSpeed) / 100 / CFG.attackInterval;
  const crit = Math.min(100, c.crit || 0) / 100;
  return dmg * rate * (1 + crit * (X.critMul - 1)) * (1 + (c.doubleAttack || 0) / 100);
}

/* stats du mineur de référence d'un tier ; bare : sans l'épée (pour mesurer une arme) */
export function refStats(tier, { bare = false } = {}){
  const c = { ...STATS };
  const w = X.refWeapon[tier] ?? X.refWeapon[1];
  if(!bare) Object.assign(c, ITEMS[w]?.set || {});
  return c;
}

/* ajoute ce que porte une pièce (stats en plus, valeurs `set` qui remplacent) */
function wear(c, b){
  const o = { ...c };
  for(const [k, v] of Object.entries(b.set || {})) if(Number.isFinite(v)) o[k] = v;
  for(const [k, v] of Object.entries(b.stats || {})) if(Number.isFinite(v)) o[k] = (o[k] || 0) + v;
  return o;
}

/* xc d'une pièce (nom d'objet ou pièce avec lignes, rune, niveau) : % de DPS ajouté au mineur de référence de son tier
   (une arme : aux mains nues du mineur de référence). tier : forcer un tier (objet sans tier : tier 1). Arrondi au dixième. */
export function pieceXC(entry, { tier = null } = {}){
  const item = typeof entry === 'string' ? entry : entry?.item;
  if(!item || !ITEMS[item] || isRing(item)) return 0;
  const t = tier ?? tierOf(item) ?? 1, b = pieceBonus(entry);
  const weapon = ITEMS[item].slot === 'epee';
  const ref = refStats(t, { bare: weapon });
  const base = dps(ref);
  return Math.round((dps(wear(ref, b)) / base - 1) * 1000) / 10;
}
