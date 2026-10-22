/* Une pièce de stuff et ce qu'elle porte (onglet Amélioration) : qualité R1 à R7, lignes de stats tirées à
   l'identification, niveau d'amélioration (+1 à +3). Logique pure, partagée par le jeu et le serveur (qui fait foi).

   Une pièce : { item, uid, q?, lines?, s?, plus?, rune? }  (s = barème des fourchettes, UPGRADE.scale ; absent = 1)
   - rune : { q, lines, s } posée par l'Enchantement (une seule, définitive) ; ses lignes comptent comme celles de
     l'identification (% de la valeur de cette pièce), niveau compris.
   Une Rune (RUNE.item) est elle-même une pièce : { item:'Rune', uid, q, lines, s }, jamais sans qualité, sans niveau.
   - sans q : pas encore identifiée (c'est le cas de toutes les pièces fabriquées) ;
   - q (1 à 7) : tirée par le serveur à l'identification, définitive. Depuis le 22/10/2026 (décision du créateur),
     l'identification ne donne QUE la qualité : plus de lignes de stats (une pièce identifiée depuis : { q }, sans lines).
   - lines [{ stat, pct }] : seulement sur les pièces identifiées AVANT le 22/10 (elles les gardent, revérifiées).
     Une ligne garde son %
     tiré (de la valeur de l'objet), pas sa valeur : la valeur se recalcule depuis la config, donc un rééquilibrage
     (prix, valeur d'un objet) s'applique aux pièces déjà tirées sans les rendre invalides. Ligne Découverte : { stat } ;
   - plus (0 à UPGRADE.levels.length) : niveau d'amélioration.
   Les nombres viennent de UPGRADE (config) : qualités, prix des stats en x, pas d'arrondi, paliers. */
import { UPGRADE, ITEMS, STATS, RUNE } from '../config.js';

const QUALITY = new Map(UPGRADE.qualities.map(d => [d.q, d]));
/* { q, label, color, chance, min, max, lines } de cette qualité, ou null */
export const qualityDef = q => QUALITY.get(q) ?? null;
export const MAX_PLUS = UPGRADE.levels.length;
export const isStuff = item => ITEMS[item]?.cat === 'stuff';
export const isRune = item => ITEMS[item]?.cat === 'rune';
export const isIdentified = p => !!p && QUALITY.has(p.q);

/* arrondi au pas de la stat (0,001 pour la vitesse de minage, 1 pour les pods…), sans les restes de virgule flottante */
const stepOf = k => UPGRADE.steps[k] ?? 0.01;
const decimals = s => Math.max(0, -Math.floor(Math.log10(s) + 1e-9));
export const roundStat = (k, v) => +(Math.round(v / stepOf(k)) * stepOf(k)).toFixed(decimals(stepOf(k)));

/* valeur de l'objet en x (UPGRADE.worth, catalogue mesuré) : ses bonus (stats) et ce que ses valeurs `set` apportent en
   plus de la base (l'épée en fer : 11 dégâts au lieu de 5 → 6 × 40 = 240 x). Une stat sans valeur ne compte pas.
   À ne pas confondre avec UPGRADE.prices, qui convertit une ligne (un % de cette valeur) en points de stat. */
export function itemValue(item){
  const d = ITEMS[item]; if(!d) return 0;
  let x = 0;
  for(const [k, v] of Object.entries(d.stats || {})) x += v * (UPGRADE.worth[k] ?? 0);
  for(const [k, v] of Object.entries(d.set || {})) x += (v - STATS[k]) * (UPGRADE.worth[k] ?? 0);
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

/* lignes d'une qualité : nombre de lignes, stat et % tirés (Découverte possible en R6/R7, une au plus) */
function rollLines(d, rnd){
  const D = UPGRADE.discover, lines = [];
  let discover = false;
  for(let i = 0; i < d.lines; i++){
    if(!discover && D.qualities.includes(d.q) && rnd() < D.chance){ discover = true; lines.push({ stat:'discoverMax' }); continue; }
    const stat = UPGRADE.pool[Math.floor(rnd() * UPGRADE.pool.length)];
    lines.push({ stat, pct: pct1(d.min + rnd() * (d.max - d.min)) });
  }
  return lines;
}

/* identification : { q } tirée pour cet objet. Seulement la qualité (22/10/2026) : plus de lignes de stats.
   (Les lignes ne se tirent plus que pour les runes.) */
export function rollIdentity(item, rnd){
  return { q: rollQuality(rnd) };
}

/* coffre de tour : sa qualité, avec les chances de l'identification (RUNE) */
export const rollChestQuality = rnd => rollQuality(rnd);
/* rune de qualité q : { q, lines, s }, lignes tirées comme une identification de cette qualité */
export function rollRune(q, rnd){
  const d = qualityDef(q);
  return { q: d.q, lines: rollLines(d, rnd), s: UPGRADE.scale };
}

/* ligne d'un ancien barème → même place dans la fourchette actuelle (arrondie au dixième, bornée) ; null si la ligne
   n'était pas valide dans son propre barème */
function rescaleLine(q, l, scale){
  const old = UPGRADE.oldScales?.[scale]?.[q], d = qualityDef(q);
  if(!old || !d || typeof l.pct !== 'number' || !Number.isFinite(l.pct) || l.pct < old[0] || l.pct > old[1]) return null;
  const t = old[1] > old[0] ? (l.pct - old[0]) / (old[1] - old[0]) : 1;
  return { stat: l.stat, pct: Math.min(d.max, Math.max(d.min, pct1(d.min + t * (d.max - d.min)))) };
}
/* lignes de la pièce dans le barème actuel (inchangées si elle y est déjà ; null si un ancien barème est inconnu) */
function currentLines(raw){
  const scale = raw.s ?? 1;
  if(scale === UPGRADE.scale || !Array.isArray(raw.lines)) return raw.lines;
  const out = [];
  for(const l of raw.lines){
    if(l && l.stat === 'discoverMax'){ out.push(l); continue; }
    const r = l && typeof l.stat === 'string' ? rescaleLine(raw.q, l, scale) : null;
    if(!r) return null;
    out.push(r);
  }
  return out;
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
  for(const l of [...(p.lines || []), ...(p.rune?.lines || [])]) stats[l.stat] = (stats[l.stat] || 0) + lineValue(p.item, l);
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
  if(!raw || typeof raw.item !== 'string' || !Number.isSafeInteger(raw.uid)) return null;
  if(isRune(raw.item)){                     // une rune : toujours tirée (qualité et lignes valides), sans niveau
    const r = sanitizeLines(raw);
    return r ? { item: raw.item, uid: raw.uid, ...r } : null;
  }
  if(!isStuff(raw.item)) return null;
  const p = { item: raw.item, uid: raw.uid };
  const id = sanitizeLines(raw);            // ancien barème (avant le 22/10/2026) → ramené dans les fourchettes actuelles
  if(id) Object.assign(p, id);
  else if(qualityDef(raw.q) && (raw.lines === undefined || (Array.isArray(raw.lines) && raw.lines.length === 0))) p.q = raw.q;   // identifiée depuis le 22/10 : qualité seule
  if(raw.rune && typeof raw.rune === 'object'){ const r = sanitizeLines(raw.rune); if(r) p.rune = r; }
  if(Number.isSafeInteger(raw.plus) && raw.plus > 0 && raw.plus <= MAX_PLUS) p.plus = raw.plus;
  return p;
}

/* { q, lines, s } relus et revérifiés (identification d'une pièce, rune) ; null si impossible */
function sanitizeLines(raw){
  const lines = currentLines(raw);
  if(!validLines(raw.q, lines)) return null;
  return { q: raw.q, lines: lines.map(l => l.stat === 'discoverMax' ? { stat: l.stat } : { stat: l.stat, pct: l.pct }), s: UPGRADE.scale };
}
