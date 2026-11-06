/* Sets (onglets Stuff, Skills et Sorts) : logique pure, partagée par le jeu (affichage) et le serveur (qui fait foi).
   Règles dans SETS (src/config.js) et GAME_DESIGN §6 « Sets ».

   Un set enregistre l'équipement complet du moment : le stuff porté (l'uid de la pièce de chaque case), les skills
   (arbre et rangs) et les sorts (emplacements). Une seule liste, la même dans les trois onglets.
   État d'un joueur : { list:[{ id, name, stuff:{case: uid}, skills:{ tree, ranks }, spells:[id | null] }], nextId, ops:[] }.
   - create : nouveau set, avec l'équipement actuel ; save : le remplace ; rename ; delete ;
   - équiper (applySet) : tout le stuff porté revient à l'inventaire puis chaque pièce du set retourne dans sa case (une
     pièce introuvable laisse sa case vide) ; reset des skills puis les rangs du set (revérifiés avec les points) ; les
     sorts du set encore équipables avec ces skills. Permis pendant une session (28/10/2026) : la session en cours garde
     l'équipement figé à son lancement, le set compte dès la suivante. Créer et enregistrer : hors session (serveur).
   - edit (Aperçu set, 06/11/2026) : écrit un brouillon composé pièce par pièce (checkDraft le revérifie), sans rien
     équiper ; id null = nouveau set. */
import { SETS, SPELLS, SKILLS } from '../config.js';
import { SLOT_IDS, fits } from './stuff.js';
import { takePiece, putPiece } from './inventory.js';
import { sanitizeSkills, skillRanks } from './skills.js';
import { spellOf, equipBlocked, openSlotsOf } from './spells.js';

export const createSets = () => ({ list:[], nextId:1, ops:[], byActivity:{} });

/* Set par activité (03/11/2026) : l'activité d'un mode de lancement (MINE_MODES), ou null. Les instances partagent un
   set, les deux tours aussi. */
const ACTIVITY_IDS = SETS.activities.map(a => a.id);
export function setActivity(mode){
  if(typeof mode !== 'string') return null;
  if(mode.startsWith('instance_')) return 'instances';
  if(mode.startsWith('tower_')) return 'towers';
  return ACTIVITY_IDS.includes(mode) ? mode : null;
}
/* associer (id) ou dissocier (null) un set d'une activité ; op = { action:'assign', activity, id, opId } */
function assign(sets, op){
  if(!ACTIVITY_IDS.includes(op.activity)) return { error:'bad_request' };
  if(op.id === null){ delete sets.byActivity[op.activity]; return { ok:true }; }
  if(!setOf(sets, op.id)) return { error:'unknown' };
  sets.byActivity[op.activity] = op.id;
  return { ok:true };
}
/* le set associé à l'activité de ce mode, ou null */
export const setForMode = (sets, mode) => { const a = setActivity(mode), id = a ? sets.byActivity?.[a] : null; return id ? setOf(sets, id) : null; };
/* cette pièce (uid) est-elle enregistrée dans un set ? (elle ne se recycle pas) */
export const inSomeSet = (sets, uid) => sets.list.some(s => Object.values(s.stuff ?? {}).includes(uid));
const setOf = (sets, id) => Number.isSafeInteger(id) ? sets.list.find(s => s.id === id) ?? null : null;
/* nom proposé pour un nouveau set : « Set n », n = le plus petit numéro libre */
const freeName = sets => { let n = 1; while(sets.list.some(s => s.name === 'Set ' + n)) n++; return 'Set ' + n; };
/* nom saisi par le joueur : texte, espaces resserrés, 1 à SETS.nameMax caractères ; null sinon */
export function cleanName(name){
  if(typeof name !== 'string') return null;
  const n = name.replace(/\s+/g, ' ').trim();
  return n && n.length <= SETS.nameMax ? n : null;
}

/* ce qu'un set retient de l'équipement actuel (stuff : { worn }, skills, spells : états relus) */
export function snapshot(stuff, skills, spells){
  return { stuff: Object.fromEntries(SLOT_IDS.filter(k => stuff.worn[k]).map(k => [k, stuff.worn[k].uid])),
           skills: skillRanks(skills), spells: [...spells.slots] };
}

/* set actuellement équipé (29/10/2026) : celui dont le stuff (uid par case), les skills (arbre et rangs) et les sorts sont
   exactement l'équipement actuel ; null si aucun (rien d'enregistré, ou équipement changé depuis). worn : { case: pièce } ;
   skills : { tree, ranks } ; spellSlots : [id | null]. Plusieurs sets identiques : le premier. */
export function equippedSet(list, worn, skills, spellSlots){
  if(!skills || !Array.isArray(spellSlots)) return null;
  const ranks = r => Object.entries(r ?? {}).filter(([, v]) => v > 0).sort(([a], [b]) => a < b ? -1 : 1).join(';');
  const mine = ranks(skills.ranks);
  return (list ?? []).find(s =>
    SLOT_IDS.every(k => (s.stuff?.[k] ?? null) === (worn?.[k]?.uid ?? null)) &&
    (s.skills?.tree ?? null) === (skills.tree ?? null) && ranks(s.skills?.ranks) === mine &&
    Array.from({ length:SPELLS.slots }, (_, i) => (s.spells?.[i] ?? null) === (spellSlots[i] ?? null)).every(Boolean)
  ) ?? null;
}

/* Brouillon d'un set (onglet Stuff, « Aperçu set », 06/11/2026, Geoffrey) : ce que le joueur a composé, revérifié comme
   le serveur doit le faire. raw = { stuff:{ case: uid }, skills:{ tree, ranks }, spells:[id | null] } ; own = { inv,
   worn : { case: pièce } (stuff porté), spells : état des sorts (appris), points : points de skill du niveau, spec,
   level }. Les pièces : celles du joueur (inventaire ou portées), dans une case où elles vont, jamais deux fois le même
   objet (anneaux) ; une pièce peut être dans plusieurs sets. Les skills sont rejoués avec les points d'aujourd'hui (le
   surplus est rendu) ; les sorts gardés : ceux équipables avec cette spé, dans un emplacement ouvert, chacun une fois.
   Renvoie { stuff, skills, spells } (ce que le set retient) ou { error } (bad_request, not_owned, wrong_slot, same_ring). */
export function checkDraft(raw, { inv, worn = {}, spells, points = 0, spec = {}, level } = {}){
  if(!raw || typeof raw !== 'object') return { error:'bad_request' };
  const rs = raw.stuff ?? {}, rk = raw.skills ?? {}, rp = raw.spells ?? [];
  if(typeof rs !== 'object' || Array.isArray(rs) || typeof rk !== 'object' || Array.isArray(rk) || !Array.isArray(rp) || rp.length > SPELLS.slots)
    return { error:'bad_request' };
  /* stuff : cases connues, uid entiers, pièces à soi, bonne case, jamais deux fois le même objet */
  const owned = new Map([...(inv?.slots ?? []).filter(s => s && s.uid != null).map(s => [s.uid, s.item]),
                         ...Object.values(worn ?? {}).filter(p => p && p.uid != null).map(p => [p.uid, p.item])]);
  const stuff = {}, items = [];
  for(const [k, uid] of Object.entries(rs)){
    if(!SLOT_IDS.includes(k)) return { error:'bad_request' };
    if(uid == null) continue;
    if(!Number.isSafeInteger(uid) || uid < 0) return { error:'bad_request' };
    const item = owned.get(uid);
    if(!item) return { error:'not_owned' };
    if(!fits(item, k)) return { error:'wrong_slot' };
    if(items.includes(item)) return { error:'same_ring' };
    items.push(item); stuff[k] = uid;
  }
  /* skills : arbre connu (ou aucun), rangs rejoués avec les points du niveau */
  if(rk.tree != null && !SKILLS.trees.some(t => t.id === rk.tree)) return { error:'bad_request' };
  if(rk.ranks != null && (typeof rk.ranks !== 'object' || Array.isArray(rk.ranks))) return { error:'bad_request' };
  const sk = sanitizeSkills({ tree:rk.tree ?? null, ranks:rk.ranks ?? {} }, points);
  /* sorts : ids connus ; seulement ceux qu'on peut équiper avec cette spé, dans un emplacement ouvert */
  if(rp.some(id => id != null && !spellOf(id))) return { error:'bad_request' };
  const ctx = { tree:sk.tree, spec, level }, open = openSlotsOf(ctx), st = spells ?? { learned:[] };
  const out = Array.from({ length:SPELLS.slots }, (_, i) => {
    const id = rp[i] ?? null;
    return i < open && id && !equipBlocked(st, id, ctx) && rp.indexOf(id) === i ? id : null;
  });
  return { stuff, skills:skillRanks(sk), spells:out };
}

/* op = { action:'create' } | { action:'save', id } | { action:'rename', id, name } | { action:'delete', id } |
   { action:'edit', id | null, name? }, avec opId ; current : snapshot de l'équipement actuel (create, save), ou le
   brouillon revérifié par checkDraft (edit). Renvoie { ok, repeated, id? } ou { error }. */
export function setOp(sets, op, current){
  if(sets.ops.includes(op.opId)) return { ok:true, repeated:true };
  let id = op.id;
  if(op.action === 'assign'){ const r = assign(sets, op); if(r.error) return r; }
  else if(op.action === 'edit'){
    const name = op.name == null ? null : cleanName(op.name);
    if(op.name != null && !name) return { error:'bad_name' };
    if(op.id == null){
      if(sets.list.length >= SETS.max) return { error:'too_many' };
      id = sets.nextId++;
      sets.list.push({ id, name:name ?? freeName(sets), ...structuredClone(current) });
    } else {
      const s = setOf(sets, op.id);
      if(!s) return { error:'unknown' };
      Object.assign(s, structuredClone(current));
      if(name) s.name = name;
    }
  }
  else if(op.action === 'create'){
    if(sets.list.length >= SETS.max) return { error:'too_many' };
    id = sets.nextId++;
    sets.list.push({ id, name:freeName(sets), ...structuredClone(current) });
  } else {
    const s = setOf(sets, op.id);
    if(!s) return { error: ['save', 'rename', 'delete'].includes(op.action) ? 'unknown' : 'bad_request' };
    if(op.action === 'save') Object.assign(s, structuredClone(current));
    else if(op.action === 'rename'){ const n = cleanName(op.name); if(!n) return { error:'bad_name' }; s.name = n; }
    else if(op.action === 'delete'){
      sets.list = sets.list.filter(x => x !== s);
      for(const [a, sid] of Object.entries(sets.byActivity)) if(sid === s.id) delete sets.byActivity[a];   // plus associé
    }
  }
  remember(sets, op.opId);
  return { ok:true, repeated:false, id };
}

/* Équipe le set id : modifie inv, stuff, skills et spells sur place. points : points de skill du niveau ; spec : niveaux
   de spécialisation { arbre: niveau } (déblocage des sorts). Idempotent par opId (sets.ops).
   Renvoie { ok, repeated, missing } (missing : pièces du set introuvables) ou { error }. */
export function applySet(sets, op, { inv, stuff, skills, spells, points, spec, level }){
  if(sets.ops.includes(op.opId)) return { ok:true, repeated:true, missing:0 };
  const set = setOf(sets, op.id);
  if(!set) return { error:'unknown' };
  /* stuff : tout revient à l'inventaire, puis les pièces du set (même uid, bonne case, jamais deux fois un anneau) */
  for(const k of SLOT_IDS) if(stuff.worn[k]){ putPiece(inv, stuff.worn[k]); stuff.worn[k] = null; }
  let missing = 0;
  for(const k of SLOT_IDS){
    const uid = set.stuff[k];
    if(uid == null) continue;
    const s = inv.slots.find(x => x && x.uid === uid);
    const twice = s && SLOT_IDS.some(o => o !== k && stuff.worn[o]?.item === s.item);
    if(!s || !fits(s.item, k) || twice){ missing++; continue; }
    stuff.worn[k] = takePiece(inv, uid);
  }
  /* skills : reset gratuit puis les rangs du set, rejoués étape par étape avec les points d'aujourd'hui */
  const sk = sanitizeSkills(set.skills, points);
  skills.tree = sk.tree; skills.ranks = sk.ranks;
  /* sorts : ceux du set encore équipables (débloqués, spécialisation du set), chacun une fois */
  const ctx = { tree:sk.tree, spec, level }, open = openSlotsOf(ctx);   // emplacements ouverts au niveau du mineur (05/11)
  spells.slots = Array.from({ length:SPELLS.slots }, (_, i) => {
    const id = set.spells[i];
    return i < open && id && !equipBlocked(spells, id, ctx) && set.spells.indexOf(id) === i ? id : null;
  });
  remember(sets, op.opId);
  return { ok:true, repeated:false, missing };
}

function remember(sets, opId){
  sets.ops.push(opId);
  if(sets.ops.length > SETS.opMemory) sets.ops.splice(0, sets.ops.length - SETS.opMemory);
}

/* Relecture (stockage) : au plus SETS.max sets, id uniques, noms valides, cases connues avec un uid entier, skills
   relus (sans limite de points : ils sont revérifiés en équipant), sorts connus. */
export function sanitizeSets(raw){
  const out = createSets();
  const ids = new Set();
  for(const s of Array.isArray(raw?.list) ? raw.list : []){
    if(out.list.length >= SETS.max || !s || !Number.isSafeInteger(s.id) || s.id < 1 || ids.has(s.id)) continue;
    ids.add(s.id);
    const stuff = {};
    for(const k of SLOT_IDS){ const u = s.stuff?.[k]; if(Number.isSafeInteger(u) && u >= 0) stuff[k] = u; }
    const spells = Array.from({ length:SPELLS.slots }, (_, i) => spellOf(s.spells?.[i]) ? s.spells[i] : null);
    out.list.push({ id:s.id, name:cleanName(s.name) ?? 'Set ' + s.id, stuff, skills:skillRanks(sanitizeSkills(s.skills)), spells });
  }
  out.nextId = Math.max(Number.isSafeInteger(raw?.nextId) ? raw.nextId : 1, ...out.list.map(s => s.id + 1), 1);
  out.ops = Array.isArray(raw?.ops) ? raw.ops.filter(o => typeof o === 'string').slice(-SETS.opMemory) : [];
  /* set par activité : activités connues, sets qui existent */
  for(const a of ACTIVITY_IDS){ const id = raw?.byActivity?.[a]; if(ids.has(id)) out.byActivity[a] = id; }
  return out;
}

/* ce que le navigateur voit : la liste (sans les ops) */
export const publicSets = sets => ({ list: sets.list.map(s => structuredClone(s)), max: SETS.max, byActivity: { ...sets.byActivity } });
