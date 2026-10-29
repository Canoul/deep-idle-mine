/* Une pièce de stuff et ce qu'elle porte (onglet Amélioration) : qualité R1 à R7, lignes de stats tirées à
   l'identification, niveau d'amélioration (+1 à +9). Logique pure, partagée par le jeu et le serveur (qui fait foi).

   Une pièce : { item, uid, q?, lines?, s?, plus?, rune? }  (s = barème des fourchettes, UPGRADE.scale ; absent = 1)
   - rune : { q, lines, s } posée par l'Enchantement (une seule, définitive) ; ses lignes comptent comme celles de
     l'identification (% de la valeur de cette pièce), niveau compris.
   Une Rune (RUNE.item) est elle-même une pièce : { item:'Rune', uid, q, lines, s }, jamais sans qualité, sans niveau.
   - sans q : pas encore identifiée (c'est le cas de toutes les pièces fabriquées) ;
   - q (1 à 7) : tirée par le serveur à l'identification, définitive. Depuis le 22/10/2026 (décision du créateur),
     l'identification ne donne QUE la qualité : plus de lignes de stats (une pièce identifiée depuis : { q }, sans lines).
   - lines [{ stat, pct }] : seulement sur les pièces identifiées AVANT le 22/10 (elles les gardent, revérifiées).
     Une ligne garde son %
     tiré (de la valeur du tier de l'objet, UPGRADE.tiers, depuis le 25/10 ; avant : de la valeur de l'objet), pas sa valeur : la valeur se recalcule depuis la config, donc un rééquilibrage
     (prix, valeur d'un objet) s'applique aux pièces déjà tirées sans les rendre invalides. Ligne Découverte : { stat } ;
   - plus (0 à UPGRADE.levels.length) : niveau d'amélioration.
   Les nombres viennent de UPGRADE (config) : qualités, prix des stats en x, pas d'arrondi, paliers. */
import { UPGRADE, ITEMS, STATS, RUNE, RINGS, GOBLIN_KING, STUFF } from '../config.js';

const QUALITY = new Map(UPGRADE.qualities.map(d => [d.q, d]));
/* { q, label, color, chance, min, max, lines } de cette qualité, ou null */
export const qualityDef = q => QUALITY.get(q) ?? null;
export const MAX_PLUS = UPGRADE.levels.length;
export const isStuff = item => ITEMS[item]?.cat === 'stuff';
export const isRune = item => ITEMS[item]?.cat === 'rune';
/* anneau (RINGS) : du stuff qu'on n'identifie ni n'enchante jamais ; il s'améliore avec un doublon (27/10/2026) */
export const isRing = item => typeof item === 'string' && Object.hasOwn(RINGS.items, item);
/* boussole, torche (UPGRADE.plainSlots, 27/10/2026) : ni identification, ni amélioration, ni enchantement */
export const isPlain = item => UPGRADE.plainSlots.includes(STUFF.items[item]?.slot);
/* la pièce passe-t-elle par l'Identification / l'Enchantement (les deux suivent la qualité) ? par l'Amélioration ? */
export const canIdentify = item => isStuff(item) && !isRing(item) && !isPlain(item);
export const canUpgrade = item => isStuff(item) && !isPlain(item);
/* fragment de rune (rune retirée d'une pièce, RUNE.fragment) : ses % ne comptent que pour RUNE.fragment.factor */
export const isFragment = item => ITEMS[item]?.fragment === true;
/* part des % d'une rune posée (rune:{ …, frag:true } = un fragment) ou d'un objet rune / fragment */
export const runeFactor = r => (r?.frag || isFragment(r?.item)) ? RUNE.fragment.factor : 1;
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

/* tier de l'objet (1 à 4, UPGRADE.tiers), null s'il n'en a pas */
const TIER_OF = new Map(Object.entries(UPGRADE.tiers).flatMap(([t, d]) => d.items.map(i => [i, +t])));
export const tierOf = item => TIER_OF.get(item) ?? null;
/* base d'une ligne en x : la valeur du tier de l'objet (25/10/2026) ; sans tier, sa propre valeur (ancien calcul) */
export const lineBase = item => { const t = tierOf(item); return t ? UPGRADE.tiers[t].x : itemValue(item); };

/* points d'une ligne de `pct` % de la valeur du tier de l'objet, sur cette stat (au moins un pas) */
export const linePoints = (item, stat, pct) => Math.max(stepOf(stat), roundStat(stat, lineBase(item) * pct / 100 / UPGRADE.prices[stat]));

/* qualité tirée selon les chances (rnd : hasard dans [0, 1[) */
export function rollQuality(rnd){
  let r = rnd();
  for(const d of UPGRADE.qualities){ if(r < d.chance) return d.q; r -= d.chance; }
  return UPGRADE.qualities[0].q;          // reste d'arrondi des chances : la qualité la plus commune
}

/* % tiré, arrondi au dixième (c'est ce qui est enregistré) */
const pct1 = v => Math.round(v * 10) / 10;
/* valeur d'une ligne sur cet objet, en points de sa stat */
export const lineValue = (item, l, f = 1) => l.stat === 'discoverMax' ? UPGRADE.discover.value : linePoints(item, l.stat, l.pct * f);

/* lignes d'une qualité : nombre de lignes, stat et % tirés. Découverte : en R6/R7, une au plus, tirée comme une stat de
   plus de la banque (même chance que les autres, 25/10/2026 ; avant : 25 % par ligne) */
function rollLines(d, rnd){
  const D = UPGRADE.discover, lines = [];
  let discover = false;
  for(let i = 0; i < d.lines; i++){
    const pool = !discover && D.qualities.includes(d.q) ? [...UPGRADE.pool, 'discoverMax'] : UPGRADE.pool;
    const stat = pool[Math.floor(rnd() * pool.length)];
    if(stat === 'discoverMax'){ discover = true; lines.push({ stat }); continue; }
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
/* rune fabriquée au craft (29/10/2026) : sa qualité, avec les chances RUNE.craftChances */
export function rollCraftedRuneQuality(rnd){
  let r = rnd();
  for(const d of UPGRADE.qualities){ const c = RUNE.craftChances[d.q] ?? 0; if(r < c) return d.q; r -= c; }
  return UPGRADE.qualities[0].q;          // reste d'arrondi des chances : la qualité la plus basse
}
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
/* extra : multiplicateur en plus de l'amélioration (maîtrise des skills, 28/10/2026 ; 1 = aucun), appliqué pareil */
export function pieceBonus(entry, extra = 1){
  const p = typeof entry === 'string' ? { item: entry } : entry || {};
  const d = ITEMS[p.item]; if(!d) return { stats:{}, set:{} };
  const m = plusMult(p.plus | 0) * (extra > 0 ? extra : 1), stats = { ...(d.stats || {}) }, set = {};
  for(const l of p.lines || []) stats[l.stat] = (stats[l.stat] || 0) + lineValue(p.item, l);
  for(const l of p.rune?.lines || []) stats[l.stat] = (stats[l.stat] || 0) + lineValue(p.item, l, runeFactor(p.rune));
  for(const k in stats) stats[k] = m === 1 || stats[k] < 0 ? roundStat(k, stats[k]) : roundStat(k, stats[k] * m);   // un malus n'empire pas (Lance, 25/10)
  for(const [k, v] of Object.entries(d.set || {})) set[k] = m === 1 ? v : roundStat(k, STATS[k] + (v - STATS[k]) * m);
  return { stats, set };
}

/* trésor d'une tour (RUNE.treasures) ou coffre du Roi Gobelin (side 'goblin') : { side, q }, ou null pour tout autre objet */
export const treasureOf = item => ITEMS[item]?.treasure ? ITEMS[item].chest : null;
/* nom affiché d'un objet : « Antique Trésor démoniaque » pour un trésor (nom interne « Trésor démoniaque R5 »), le nom
   tel quel sinon ; couleur du nom : celle de la qualité d'un trésor, null sinon (celle de la rareté) */
export function itemName(item){
  const t = treasureOf(item);
  return t ? `${qualityDef(t.q).label} ${(RUNE.treasures[t.side] ?? GOBLIN_KING.chest).name}` : item;
}
export const itemColor = item => { const t = treasureOf(item); return t ? qualityDef(t.q).color : null; };

/* nom affiché : « Excellent : Pioche en pierre +2 » ; couleur : celle de la qualité (null = celle de la rareté du type) */
export function pieceName(p){
  if(!p) return '';
  if(typeof p === 'string') return itemName(p);
  const d = qualityDef(p.q);
  return (d ? `${d.label} : ` : '') + itemName(p.item) + (p.plus > 0 ? ` +${p.plus}` : '');
}
export const pieceColor = p => typeof p === 'string' ? itemColor(p) : qualityDef(p?.q)?.color ?? itemColor(p?.item);

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
  if(treasureOf(raw.item)) return { item: raw.item, uid: raw.uid };   // un trésor : sa qualité est dans son nom
  if(!isStuff(raw.item)) return null;
  const plus = Number.isSafeInteger(raw.plus) && raw.plus > 0 && raw.plus <= MAX_PLUS ? { plus: raw.plus } : {};
  if(isRing(raw.item)) return { item: raw.item, uid: raw.uid, ...plus };   // un anneau : ni qualité, ni rune ; un niveau (27/10)
  if(isPlain(raw.item)) return { item: raw.item, uid: raw.uid };      // boussole, torche : remises à zéro (27/10/2026)
  const p = { item: raw.item, uid: raw.uid };
  const id = sanitizeLines(raw);            // ancien barème (avant le 22/10/2026) → ramené dans les fourchettes actuelles
  if(id) Object.assign(p, id);
  else if(qualityDef(raw.q) && (raw.lines === undefined || (Array.isArray(raw.lines) && raw.lines.length === 0))) p.q = raw.q;   // identifiée depuis le 22/10 : qualité seule
  if(raw.rune && typeof raw.rune === 'object'){ const r = sanitizeLines(raw.rune); if(r) p.rune = raw.rune.frag === true ? { ...r, frag: true } : r; }
  return { ...p, ...plus };
}

/* { q, lines, s } relus et revérifiés (identification d'une pièce, rune) ; null si impossible */
function sanitizeLines(raw){
  const lines = currentLines(raw);
  if(!validLines(raw.q, lines)) return null;
  return { q: raw.q, lines: lines.map(l => l.stat === 'discoverMax' ? { stat: l.stat } : { stat: l.stat, pct: l.pct }), s: UPGRADE.scale };
}
