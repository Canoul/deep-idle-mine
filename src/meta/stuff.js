/* Stuff (onglet Stuff) : les pièces d'équipement portées par le mineur, une par case. Logique pure, partagée par
   le jeu et le serveur (qui fait foi).

   État d'un joueur : { worn: { case: pièce | null }, ops:[opId…] } ; une pièce : { item, uid, q?, lines?, plus? }
   (qualité, lignes et niveau d'amélioration : src/meta/piece.js).
   Équiper sort la pièce de l'inventaire (et y remet celle qu'elle remplace) ; retirer l'y remet. Une pièce garde
   son uid : elle n'est jamais à deux endroits à la fois, et jamais recréée.
   Anneaux (RINGS) : deux cases (anneau1, anneau2) pour le même genre d'objet, jamais deux fois le même anneau ; leur
   effet va à tout le groupe de la session (withRings), une fois par anneau différent. */
import { STUFF, ITEMS, STATS, RINGS } from '../config.js';
import { takePiece, putPiece } from './inventory.js';
import { withSkillStats, SKILL_STATS, SKILL_ADD } from './skills.js';
import { pieceBonus, pieceName, sanitizePiece, lineValue, plusMult, roundStat, runeFactor, isRing } from './piece.js';

export const SLOT_IDS = STUFF.slots.map(s => s.id);
/* genre de case où va un objet ('casque', 'anneau'…), null si ce n'est pas une pièce d'équipement */
export const slotOf = item => ITEMS[item]?.cat === 'stuff' ? ITEMS[item].slot ?? null : null;
/* cet objet va-t-il dans cette case ? (une case `fits` accepte les objets de ce genre : les deux cases d'anneau) */
const SLOT_KIND = Object.fromEntries(STUFF.slots.map(s => [s.id, s.fits ?? s.id]));
export const fits = (item, slot) => Object.hasOwn(SLOT_KIND, slot) && slotOf(item) === SLOT_KIND[slot];
/* cases où peut aller cet objet ; equipSlotFor : celle où l'équiper (bouton « Équiper » de l'inventaire) : celle qui
   porte déjà le même anneau (il le remplace), sinon la première vide, sinon la première */
export const slotsFor = item => SLOT_IDS.filter(id => fits(item, id));
export function equipSlotFor(item, worn = {}){
  const ids = slotsFor(item);
  return ids.find(id => worn[id]?.item === item) ?? ids.find(id => !worn[id]) ?? ids[0] ?? null;
}
/* le même objet est-il déjà porté dans une AUTRE case ? (anneaux : jamais deux fois le même) */
const wornElsewhere = (worn, slot, item) => SLOT_IDS.some(id => id !== slot && worn[id]?.item === item);

/* apparence d'un mineur en session : { case: objet } des pièces portées (src/skins.js). Visuel seulement.
   sanitizeLook : revérifiée (case connue, pièce qui va dans cette case) ; lookOf : depuis le stuff d'un joueur. */
export function sanitizeLook(look){
  const out = {};
  if(!look || typeof look !== 'object') return out;
  for(const slot of SLOT_IDS) if(typeof look[slot] === 'string' && fits(look[slot], slot) && !wornElsewhere(lookItems(out), slot, look[slot])) out[slot] = look[slot];
  return out;
}
const lookItems = look => Object.fromEntries(Object.entries(look).map(([k, v]) => [k, { item: v }]));
export const lookOf = st => Object.fromEntries(Object.entries(st.worn).filter(([, p]) => p).map(([slot, p]) => [slot, p.item]));
/* pièces portées pour les caractéristiques en session (qualité, lignes, niveau) : { case: pièce }.
   sanitizeGear : revérifiée (case connue, pièce qui va dans cette case, piece.js) ; gearOf : depuis le stuff d'un joueur. */
export function sanitizeGear(gear){
  const out = {};
  if(!gear || typeof gear !== 'object') return out;
  for(const slot of SLOT_IDS){ const p = sanitizePiece(gear[slot]); if(p && fits(p.item, slot) && !wornElsewhere(out, slot, p.item)) out[slot] = p; }
  return out;
}
export const gearOf = st => sanitizeGear(st.worn);

const num = v => String(v).replace('.', ',');
const unitOf = k => STUFF.statUnits?.[k] ?? '';
/* effets d'une pièce (un nom d'objet, ou une pièce avec sa qualité et son niveau), un par ligne :
   ['Oxygène +30', 'Pods +25'] ; une valeur qui remplace la base (set, ex. l'épée) : 'Dégâts 11'.
   D'abord les effets de l'objet, puis CHAQUE ligne tirée à l'identification, à part, même quand elle porte la même
   stat qu'une autre (décision du créateur, 22/10) : ['Vitesse de minage +0,1', 'Vitesse de minage +0,03', …].
   Les valeurs incluent le niveau d'amélioration. Ce que le mineur a vraiment en session : statsOf (somme, arrondie). */
export function statLines(entry){
  const p = typeof entry === 'string' ? { item: entry } : entry || {};
  if(ITEMS[p.item]?.cat === 'rune') return runeLines(p);
  if(isRing(p.item)) return ringLines(p.item);
  const b = pieceBonus({ item: p.item, plus: p.plus }), m = plusMult(p.plus | 0);
  const label = k => STUFF.statLabels[k] ?? k;
  return [
    ...Object.entries(b.set).map(([k, v]) => `${label(k)} ${num(v)}${unitOf(k)}`),
    ...Object.entries(b.stats).map(([k, v]) => `${label(k)} +${num(v)}${unitOf(k)}`),
    ...(Array.isArray(p.lines) ? p.lines : []).map(l =>
      `${label(l.stat)} +${num(roundStat(l.stat, lineValue(p.item, l) * m))}${unitOf(l.stat)}`),
    ...(Array.isArray(p.rune?.lines) ? p.rune.lines : []).map(l =>
      `${p.rune.frag ? 'Fragment' : 'Rune'} · ${label(l.stat)} +${num(roundStat(l.stat, lineValue(p.item, l, runeFactor(p.rune)) * m))}${unitOf(l.stat)}`),
  ];
}
/* une rune seule n'a pas de valeur : ses lignes valent un % de la valeur du tier de la pièce qu'elle enchantera */
export function runeLines(p){
  const label = k => STUFF.statLabels[k] ?? k;
  const f = runeFactor(p);
  return (Array.isArray(p?.lines) ? p.lines : []).map(l => l.stat === 'discoverMax' ? `${label(l.stat)} +1`
    : `${label(l.stat)} : ${num(Math.round(l.pct * f * 100) / 100)} % du tier de la pièce`);
}
/* effet de groupe d'un anneau : ['Groupe · Vitesse (marche) +3 %', …] */
export function ringLines(item){
  const d = RINGS.items[item]; if(!d) return [];
  const label = k => STUFF.statLabels[k] ?? k;
  return [
    ...Object.entries(d.mult || {}).map(([k, v]) => `Groupe · ${label(k)} +${num(v)} %`),
    ...Object.entries(d.add || {}).map(([k, v]) => `Groupe · ${label(k)} +${num(v)}${unitOf(k)}`),
    ...(d.xp ? [`XP +${num(d.xp)} % (porteur seul)`] : []),
  ];
}
/* anneaux différents parmi des pièces (noms ou pièces), triés : ceux du groupe = ringsOf de toutes ses pièces */
export const ringsOf = items => [...new Set((items || []).map(e => typeof e === 'string' ? e : e?.item).filter(isRing))].sort();
/* caractéristiques avec l'effet de ces anneaux, chacun une fois : mult = % du total, add = points (RINGS) */
export function withRings(carac, rings){
  const out = { ...carac };
  for(const r of new Set(rings || [])){
    const d = RINGS.items[r]; if(!d) continue;
    for(const [k, v] of Object.entries(d.mult || {})) if(typeof out[k] === 'number') out[k] = r2(out[k] * (1 + v / 100));
    for(const [k, v] of Object.entries(d.add || {})) out[k] = r2((out[k] || 0) + v);
  }
  return out;
}
/* multiplicateur d'XP du pot commun de la session avec ces anneaux (1 = aucun) */
/* % d'XP en plus des anneaux d'UN joueur (les siens, pas ceux du groupe) : appliqué à sa part, après le partage du pot */
export const ringXpPct = rings => [...new Set(rings || [])].reduce((s, r) => s + (RINGS.items[r]?.xp || 0), 0);

/* en une ligne : « Oxygène +30 · Pods +25 » (vide si aucun) */
export const statsText = item => statLines(item).join(' · ');
const r2 = v => Math.round(v * 100) / 100;   // 2,25 + 0,4 donne 2,65 et pas 2,6500000000000004
/* Caractéristiques du mineur avec ces pièces (noms d'objets, ou pièces avec leur qualité et leur niveau) : pour chaque stat, la base (STATS, ou la valeur `set`
   d'une pièce qui la remplace : l'épée remplace les mains nues) + la somme des bonus (`stats`). C'est ce que le
   mineur a EN SESSION (figé au lancement, src/shared/game.js) et ce qu'affiche l'onglet Stuff.
   Renvoie { stat: { base, bonus, total } }. Lu au moment de l'appel : un réglage dev des STATS est pris en compte. */
export function statsOf(items){
  const base = { ...STATS }, bonus = {};
  for(const entry of items || []){
    const b = pieceBonus(entry);
    for(const [k, v] of Object.entries(b.set)) base[k] = v;
    for(const [k, v] of Object.entries(b.stats)) bonus[k] = (bonus[k] || 0) + v;
  }
  return Object.fromEntries(Object.keys(STATS).map(k => [k, { base:base[k], bonus:r2(bonus[k] || 0), total:r2(base[k] + (bonus[k] || 0)) }]));
}
/* caractéristiques en session (src/sim/mineur.js, m.carac) : { stat: total } */
export const equippedStats = items => Object.fromEntries(Object.entries(statsOf(items)).map(([k, s]) => [k, s.total]));
/* stats du mineur avec le stuff porté et les skills, pour l'onglet Stuff : [{ key, label, base, bonus, mult, skill, total }]
   bonus = apport du stuff (ajouté), mult = multiplicateur des skills (1 = aucun), total = (base + bonus) × mult : ce qu'il a
   en session ; skill = ce que le multiplicateur ajoute (total − (base + bonus)) */
export function minerStats(worn, effects = {}){
  const pieces = Object.values(worn || {}).filter(Boolean);
  const s = statsOf(pieces);
  const withStuff = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.total]));
  const all = withSkillStats(withStuff, effects);
  const multOf = key => Object.hasOwn(SKILL_STATS, key) ? 1 + (effects[SKILL_STATS[key]] || 0) : 1;
  const addOf = key => Object.hasOwn(SKILL_ADD, key) ? (effects[SKILL_ADD[key].node] || 0) * SKILL_ADD[key].scale : 0;
  /* anneaux de ce joueur (en session, ceux du reste du groupe s'ajoutent) : ring = ce qu'ils ajoutent au total */
  const before = Object.fromEntries(STUFF.shownStats.map(k => [k, r2(all[k] + addOf(k))]));
  const after = withRings(before, ringsOf(pieces));
  return STUFF.shownStats.map(key => ({ key, label:STUFF.statLabels[key] ?? key, ...s[key],
    mult:r2(multOf(key)), add:r2(addOf(key)), skill:r2(all[key] - withStuff[key] + addOf(key)),
    ring:r2(after[key] - before[key]), total:after[key] }));
}

/* bulle d'info d'une pièce de stuff (nom d'objet ou pièce) : son nom, puis un effet par ligne (null si ce n'est pas du stuff) */
export function stuffTip(entry){
  const item = typeof entry === 'string' ? entry : entry?.item;
  if(ITEMS[item]?.cat === 'rune') return [pieceName(entry), ...statLines(entry), 'À poser sur une pièce : onglet Amélioration, Enchantement'].join('\n');
  if(ITEMS[item]?.cat !== 'stuff') return null;
  const lines = statLines(entry);
  return [pieceName(entry), ...(lines.length ? lines : ['Aucun effet'])].join('\n');
}

export function createStuff(){ return { worn: Object.fromEntries(SLOT_IDS.map(s => [s, null])), ops: [] }; }

/* pièces de l'inventaire qui vont dans cette case */
export const piecesFor = (inv, slot) => inv.slots.filter(s => s && s.uid != null && fits(s.item, slot));

/* op = { action:'equip'|'unequip', slot, uid, opId } ; modifie inv et st ensemble. Renvoie { ok, repeated } ou { error } */
export function stuffOp(inv, st, op){
  if(st.ops.includes(op.opId)) return { ok:true, repeated:true };
  if(!SLOT_IDS.includes(op.slot)) return { error:'bad_slot' };
  const cur = st.worn[op.slot];
  if(op.action === 'equip'){
    if(!Number.isSafeInteger(op.uid)) return { error:'bad_request' };
    const s = inv.slots.find(s => s && s.uid === op.uid);
    if(!s) return { error:'not_owned' };
    if(!fits(s.item, op.slot)) return { error:'wrong_slot' };
    if(wornElsewhere(st.worn, op.slot, s.item)) return { error:'same_ring' };   // jamais deux fois le même anneau
    st.worn[op.slot] = takePiece(inv, op.uid);
    if(cur) putPiece(inv, cur);                          // l'ancienne pièce revient dans l'inventaire
  } else if(op.action === 'unequip'){
    if(cur){ putPiece(inv, cur); st.worn[op.slot] = null; }
  } else return { error:'bad_request' };
  st.ops.push(op.opId);
  if(st.ops.length > STUFF.opMemory) st.ops.splice(0, st.ops.length - STUFF.opMemory);
  return { ok:true, repeated:false };
}

/* Relecture du stockage, revérifiée à chaque fois : une pièce invalide, dans la mauvaise case, en double, ou aussi
   présente dans l'inventaire (duplication) est retirée. Les uid de l'inventaire restent toujours plus grands. */
export function sanitizeStuff(raw, inv){
  const st = createStuff();
  const seen = new Set(inv.slots.filter(s => s && s.uid != null).map(s => s.uid));
  const worn = raw && typeof raw.worn === 'object' && raw.worn ? raw.worn : {};
  for(const slot of SLOT_IDS){
    const p = worn[slot];
    const piece = sanitizePiece(p);                   // qualité, lignes et niveau revérifiés
    if(!piece || !fits(piece.item, slot) || seen.has(piece.uid)) continue;
    seen.add(piece.uid);
    if(inv.nextUid <= p.uid) inv.nextUid = p.uid + 1;
    if(wornElsewhere(st.worn, slot, piece.item)){ putPiece(inv, piece); continue; }   // 2e exemplaire du même anneau : rendu à l'inventaire
    st.worn[slot] = piece;
  }
  st.ops = Array.isArray(raw?.ops) ? raw.ops.filter(o => typeof o === 'string').slice(-STUFF.opMemory) : [];
  return st;
}
