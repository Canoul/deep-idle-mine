/* Une pièce de stuff et ce qu'elle porte (onglet Amélioration) : qualité R1 à R7, lignes de stats tirées à
   l'identification, niveau d'amélioration (+1 à +3). Logique pure, partagée par le jeu et le serveur (qui fait foi).

   Une pièce : { item, uid, q?, lines?, plus? }
   - sans q : pas encore identifiée (c'est le cas de toutes les pièces fabriquées) ;
   - q (1 à 7) et lines [{ stat, pct }] : tirées par le serveur à l'identification, définitives. Une ligne garde son %
     tiré (de la valeur de l'objet), pas sa valeur : la valeur se recalcule depuis la config, donc un rééquilibrage
     (prix, valeur d'un objet) s'applique aux pièces déjà tirées sans les rendre invalides. Ligne Découverte : { stat } ;
   - plus (0 à UPGRADE.levels.length) : niveau d'amélioration.
   Les nombres viennent de UPGRADE (config) : qualités, prix des stats en x, pas d'arrondi, paliers. */
import { UPGRADE, ITEMS, STATS } from '../config.js';

const QUALITY = new Map(UPGRADE.qualities.map(d => [d.q, d]));
/* { q, label, color, chance, min, max, lines } de cette qualité, ou null */
export const qualityDef = q => QUALITY.get(q) ?? null;
export const MAX_PLUS = UPGRADE.levels.length;
export const isStuff = item => ITEMS[item]?.cat === 'stuff';
export const isIdentified = p => !!p && QUALITY.has(p.q);

/* arrondi au pas de la stat (0,001 pour la vitesse de minage, 1 pour les pods…), sans les restes de virgule flottante */
const stepOf = k => UPGRADE.steps[k] ?? 0.01;
const decimals = s => Math.max(0, -Math.floor(Math.log10(s) + 1e-9));
export const roundStat = (k, v) => +(Math.round(v / stepOf(k)) * stepOf(k)).toFixed(decimals(stepOf(k)));

/* valeur de l'objet en x : ses bonus (stats) et ce que ses valeurs `set` apportent en plus de la base (l'épée en fer :
   11 dégâts au lieu de 5 → 6 × 40 = 240 x). Une stat sans prix ne compte pas. */
export function itemValue(item){
  const d = ITEMS[item]; if(!d) return 0;
  let x = 0;
  for(const [k, v] of Object.entries(d.stats || {})) x += v * (UPGRADE.prices[k] ?? 0);
  for(const [k, v] of Object.entries(d.set || {})) x += (v - STATS[k]) * (UPGRADE.prices[k] ?? 0);
  return Math.max(0, x);
}

/* points d'une ligne de `pct` % de la valeur de l'objet, sur cette stat (au moins un pas) */
export const linePoints = (item, stat, pct) => Math.max(stepOf(stat), roundStat(stat, itemValue(item) * pct / 100 / UPGRADE.prices[stat]));

/* qualité tirée selon les chances (rnd : hasard dans [0, 1[) */
export function rollQuality(rnd){
  let r = rnd();
  for(const d of UPGRADE.qualities){ if(r < d.chance) return d.q; r -= d.chance; }
  return UPGRADE.qualities[0].q;          // reste d'arrondi des chances : la qualité la plus commune
}

/* % tiré, arrondi au dixième (c'est ce qui est enregistré) */
const pct1 = v => Math.round(v * 10) / 10;
/* valeur d'une ligne sur cet objet, en points de sa stat */
export const lineValue = (item, l) => l.stat === 'discoverMax' ? UPGRADE.discover.value : linePoints(item, l.stat, l.pct);

/* identification : { q, lines } tirés pour cet objet */
export function rollIdentity(item, rnd){
  const d = qualityDef(rollQuality(rnd)), D = UPGRADE.discover, lines = [];
  let discover = false;
  for(let i = 0; i < d.lines; i++){
    if(!discover && D.qualities.includes(d.q) && rnd() < D.chance){ discover = true; lines.push({ stat:'discoverMax' }); continue; }
    const stat = UPGRADE.pool[Math.floor(rnd() * UPGRADE.pool.length)];
    lines.push({ stat, pct: pct1(d.min + rnd() * (d.max - d.min)) });
  }
  return { q: d.q, lines };
}

/* multiplicateur d'amélioration : +3 → ×1,07 (bonus total du palier) */
export const plusMult = plus => 1 + (plus > 0 ? UPGRADE.levels[plus - 1].pct : 0) / 100;

/* ce qu'apporte une pièce (ou un simple nom d'objet) : { stats:{ k: bonus }, set:{ k: valeur qui remplace la base } }.
   Bonus = stats de l'objet + lignes identifiées, × multiplicateur d'amélioration ; set : la base + ce que la valeur
   apporte en plus, × le multiplicateur (l'épée en fer +3 : 5 + 6 × 1,07 = 11,4). */
export function pieceBonus(entry){
  const p = typeof entry === 'string' ? { item: entry } : entry || {};
  const d = ITEMS[p.item]; if(!d) return { stats:{}, set:{} };
  const m = plusMult(p.plus | 0), stats = { ...(d.stats || {}) }, set = {};
  for(const l of p.lines || []) stats[l.stat] = (stats[l.stat] || 0) + lineValue(p.item, l);
  for(const k in stats) stats[k] = m === 1 ? roundStat(k, stats[k]) : roundStat(k, stats[k] * m);
  for(const [k, v] of Object.entries(d.set || {})) set[k] = m === 1 ? v : roundStat(k, STATS[k] + (v - STATS[k]) * m);
  return { stats, set };
}

/* nom affiché : « Excellent : Pioche en pierre +2 » ; couleur : celle de la qualité (null = celle de la rareté du type) */
export function pieceName(p){
  if(!p) return '';
  if(typeof p === 'string') return p;
  const d = qualityDef(p.q);
  return (d ? `${d.label} : ` : '') + p.item + (p.plus > 0 ? ` +${p.plus}` : '');
}
export const pieceColor = p => qualityDef(p?.q)?.color ?? null;

/* lignes plausibles pour cette qualité : le bon nombre, des stats connues, un % dans la fourchette, une Découverte au plus */
function validLines(q, lines){
  const d = qualityDef(q);
  if(!d || !Array.isArray(lines) || lines.length !== d.lines) return false;
  let discover = 0;
  for(const l of lines){
    if(!l || typeof l.stat !== 'string') return false;
    if(l.stat === 'discoverMax'){ if(!UPGRADE.discover.qualities.includes(q) || ++discover > 1) return false; continue; }
    if(!UPGRADE.pool.includes(l.stat) || typeof l.pct !== 'number' || !Number.isFinite(l.pct) || l.pct < d.min || l.pct > d.max) return false;
  }
  return true;
}

/* Relecture d'une pièce (inventaire ou case équipée), revérifiée à chaque fois : renvoie { item, uid, q?, lines?, plus? }
   ou null (pas du stuff, uid invalide). Une identification impossible (qualité inconnue, lignes trafiquées) est retirée :
   la pièce redevient non identifiée ; un niveau impossible retombe à 0. */
export function sanitizePiece(raw){
  if(!raw || typeof raw.item !== 'string' || !isStuff(raw.item) || !Number.isSafeInteger(raw.uid)) return null;
  const p = { item: raw.item, uid: raw.uid };
  if(validLines(raw.q, raw.lines)) { p.q = raw.q; p.lines = raw.lines.map(l => l.stat === 'discoverMax' ? { stat: l.stat } : { stat: l.stat, pct: l.pct }); }
  if(Number.isSafeInteger(raw.plus) && raw.plus > 0 && raw.plus <= MAX_PLUS) p.plus = raw.plus;
  return p;
}
