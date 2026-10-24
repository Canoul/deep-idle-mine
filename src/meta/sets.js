/* Sets (onglets Stuff, Skills et Sorts) : logique pure, partagée par le jeu (affichage) et le serveur (qui fait foi).
   Règles dans SETS (src/config.js) et GAME_DESIGN §6 « Sets ».

   Un set enregistre l'équipement complet du moment : le stuff porté (l'uid de la pièce de chaque case), les skills
   (arbre et rangs) et les sorts (emplacements). Une seule liste, la même dans les trois onglets.
   État d'un joueur : { list:[{ id, name, stuff:{case: uid}, skills:{ tree, ranks }, spells:[id | null] }], nextId, ops:[] }.
   - create : nouveau set, avec l'équipement actuel ; save : le remplace ; rename ; delete ;
   - équiper (applySet) : tout le stuff porté revient à l'inventaire puis chaque pièce du set retourne dans sa case (une
     pièce introuvable laisse sa case vide) ; reset des skills puis les rangs du set (revérifiés avec les points) ; les
     sorts du set encore équipables avec ces skills. Refusé pendant une session (vérifié par le serveur). */
import { SETS, SPELLS } from '../config.js';
import { SLOT_IDS, fits } from './stuff.js';
import { takePiece, putPiece } from './inventory.js';
import { sanitizeSkills, skillRanks } from './skills.js';
import { spellOf, equipBlocked } from './spells.js';

export const createSets = () => ({ list:[], nextId:1, ops:[] });
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

/* op = { action:'create' } | { action:'save', id } | { action:'rename', id, name } | { action:'delete', id }, avec opId ;
   current : snapshot de l'équipement actuel (create, save). Renvoie { ok, repeated, id? } ou { error }. */
export function setOp(sets, op, current){
  if(sets.ops.includes(op.opId)) return { ok:true, repeated:true };
  let id = op.id;
  if(op.action === 'create'){
    if(sets.list.length >= SETS.max) return { error:'too_many' };
    id = sets.nextId++;
    sets.list.push({ id, name:freeName(sets), ...structuredClone(current) });
  } else {
    const s = setOf(sets, op.id);
    if(!s) return { error: ['save', 'rename', 'delete'].includes(op.action) ? 'unknown' : 'bad_request' };
    if(op.action === 'save') Object.assign(s, structuredClone(current));
    else if(op.action === 'rename'){ const n = cleanName(op.name); if(!n) return { error:'bad_name' }; s.name = n; }
    else if(op.action === 'delete') sets.list = sets.list.filter(x => x !== s);
  }
  remember(sets, op.opId);
  return { ok:true, repeated:false, id };
}

/* Équipe le set id : modifie inv, stuff, skills et spells sur place. points : points de skill du niveau ; spec : niveaux
   de spécialisation { arbre: niveau } (déblocage des sorts). Idempotent par opId (sets.ops).
   Renvoie { ok, repeated, missing } (missing : pièces du set introuvables) ou { error }. */
export function applySet(sets, op, { inv, stuff, skills, spells, points, spec }){
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
  const ctx = { tree:sk.tree, spec };
  spells.slots = Array.from({ length:SPELLS.openSlots }, (_, i) => {
    const id = set.spells[i];
    return id && !equipBlocked(spells, id, ctx) && set.spells.indexOf(id) === i ? id : null;
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
    const spells = Array.from({ length:SPELLS.openSlots }, (_, i) => spellOf(s.spells?.[i]) ? s.spells[i] : null);
    out.list.push({ id:s.id, name:cleanName(s.name) ?? 'Set ' + s.id, stuff, skills:skillRanks(sanitizeSkills(s.skills)), spells });
  }
  out.nextId = Math.max(Number.isSafeInteger(raw?.nextId) ? raw.nextId : 1, ...out.list.map(s => s.id + 1), 1);
  out.ops = Array.isArray(raw?.ops) ? raw.ops.filter(o => typeof o === 'string').slice(-SETS.opMemory) : [];
  return out;
}

/* ce que le navigateur voit : la liste (sans les ops) */
export const publicSets = sets => ({ list: sets.list.map(s => structuredClone(s)), max: SETS.max });
