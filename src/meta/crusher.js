/* Concasseur (onglet Concasseur) : logique pure, partagée par le jeu (affichage) et le serveur (qui fait foi).

   8 cases d'entrée (CRUSHER.inSlots, 2 rangées de 4) pour les objets qui ont une table dans CRUSHER.loot (Terre, Pierre,
   Pierre dure ; minerai de fer depuis le 28/10/2026), 8 cases de sortie pour le butin. Chaque case contient null ou { item, qty }.

   Toutes les CRUSHER.time secondes, il concasse CRUSHER.batch blocs d'UNE case d'entrée : la première qui en a assez,
   de haut en bas puis de gauche à droite (index 0 → 7). Les blocs sont consommés à la fin du cycle (retirer une case
   pendant le cycle ne coûte rien) ; le butin (souvent rien) est tiré avec rollLoot, comme un Treasure TX.
   since = heure (ms) où le cycle en cours a commencé, null à l'arrêt.

   Le hasard : advance(c, now, rng) reçoit le hasard en paramètre. Le serveur lui passe un hasard imprévisible et
   ENREGISTRE le résultat dès qu'il a avancé (un cycle n'est tiré qu'une fois). Le navigateur n'avance jamais le
   concasseur lui-même : il affiche la barre du cycle et redemande l'état au serveur quand elle est pleine.

   État d'un joueur : { in:[…], out:[…], since, crushed (lots concassés), finds:[dernières trouvailles], ops:[opId…] } ;
   ops = dernières demandes traitées (une demande renvoyée, double clic ou rechargement, ne s'applique qu'une fois). */
import { CRUSHER, ITEMS } from '../config.js';
import { addItem, removeItem, countOf } from './inventory.js';
import { rollLoot } from './loot.js';

const validQty = q => Number.isSafeInteger(q) && q > 0;
const validIdx = (i, n) => Number.isSafeInteger(i) && i >= 0 && i < n;
export const FINDS_MEMORY = 10;

/* seuls les objets qui ont une table de butin vont dans le concasseur (blocs, minerai de fer) */
export const crushable = item => typeof item === 'string' && !!ITEMS[item] && Object.hasOwn(CRUSHER.loot, item);
/* objets que le concasseur peut sortir (pour relire le stockage) */
const OUT_ITEMS = new Set(Object.values(CRUSHER.loot).flatMap(t => [...t.always.map(a => a.item), ...t.oneOf.flatMap(f => f.items.map(i => i.item))]));

export function createCrusher(){
  return { in: Array(CRUSHER.inSlots).fill(null), out: Array(CRUSHER.outSlots).fill(null), since:null, crushed:0, finds:[], ops:[] };
}

/* case d'entrée concassée au prochain cycle (la première qui a au moins un lot), ou -1 */
export const nextSlot = c => c.in.findIndex(s => s && s.qty >= CRUSHER.batch);
/* lots encore possibles avec ce qui est posé */
export const lotsLeft = c => c.in.reduce((n, s) => n + (s ? Math.floor(s.qty / CRUSHER.batch) : 0), 0);
export const cycleMs = () => CRUSHER.time * 1000;

/* le concasseur peut-il faire un cycle ? (un lot posé et au moins une case de sortie libre) */
export const canRun = c => nextSlot(c) >= 0 && c.out.some(s => !s);

/* (re)met en marche s'il peut tourner, l'arrête sinon (un cycle déjà commencé continue) */
function kick(c, now){
  if(!canRun(c)) c.since = null;
  else if(c.since === null) c.since = now;
}

/* verse le butin dans les cases de sortie (pile existante, sinon première case libre). Tout ou rien : false si ça ne
   rentre pas (rien n'est touché). */
function putOut(c, loot){
  const out = c.out.map(s => s && { ...s });
  for(const [item, qty] of Object.entries(loot)){
    let i = out.findIndex(s => s && s.item === item);
    if(i >= 0){ if(!Number.isSafeInteger(out[i].qty + qty)) return false; out[i].qty += qty; continue; }
    i = out.findIndex(s => !s);
    if(i < 0) return false;
    out[i] = { item, qty };
  }
  c.out = out;
  return true;
}

/* avance jusqu'à now : chaque cycle fini consomme un lot et tire son butin. Renvoie le nombre de cycles faits
   (le serveur enregistre dès que c'est plus que 0). */
export function advance(c, now, rng){
  let done = 0;
  const dur = cycleMs();
  while(c.since !== null && now - c.since >= dur){
    const k = nextSlot(c);
    if(k < 0 || !c.out.some(s => !s)){ c.since = null; break; }
    const item = c.in[k].item, loot = rollLoot(CRUSHER.loot[item], rng);
    if(!putOut(c, loot)){ c.since = null; break; }   // sortie pleine : le lot n'est pas consommé, le concasseur s'arrête
    c.in[k].qty -= CRUSHER.batch;
    if(!c.in[k].qty) c.in[k] = null;
    c.crushed++; done++;
    c.since += dur;
    if(Object.keys(loot).length){
      c.finds.push({ at: c.since, from: item, loot });
      if(c.finds.length > FINDS_MEMORY) c.finds.splice(0, c.finds.length - FINDS_MEMORY);
    }
  }
  if(!canRun(c)) c.since = null;
  return done;
}

/* avancée du cycle en cours, de 0 à 1 (0 à l'arrêt) */
export function progress(c, now){
  return c.since === null ? 0 : Math.min(1, Math.max(0, (now - c.since) / cycleMs()));
}

/* ---------- actions du joueur ----------
   op = { action:'load'|'unload'|'collect', slot, item, qty, opId }.
   load : poser qty × item dans la case d'entrée slot (0-7) ; unload : vider la case d'entrée slot ;
   collect : récupérer la case de sortie slot, ou toutes les cases de sortie si slot est 'all'.
   Le serveur appelle advance juste avant (avec son hasard). Modifie inv et c ensemble ; en cas d'erreur, l'appelant
   n'enregistre rien. Renvoie { ok:true, repeated } ou { error } (code d'erreur). */
export function crusherOp(c, inv, op, now){
  if(c.ops.includes(op.opId)) return { ok:true, repeated:true };
  let r;
  if(op.action === 'load') r = load(c, inv, op);
  else if(op.action === 'unload') r = unload(c, inv, 'in', op.slot);
  else if(op.action === 'collect') r = op.slot === 'all' ? collectAll(c, inv) : unload(c, inv, 'out', op.slot);
  else r = { error:'bad_request' };
  if(r.error) return r;
  kick(c, now);
  c.ops.push(op.opId);
  if(c.ops.length > CRUSHER.opMemory) c.ops.splice(0, c.ops.length - CRUSHER.opMemory);
  return { ok:true, repeated:false };
}

/* une seule sorte de bloc par case */
function load(c, inv, { slot, item, qty }){
  if(!validIdx(slot, CRUSHER.inSlots)) return { error:'bad_slot' };
  if(!crushable(item)) return { error:'bad_item' };
  if(!validQty(qty)) return { error:'bad_qty' };
  const cur = c.in[slot];
  if(cur && cur.item !== item) return { error:'slot_busy' };
  if(cur && !Number.isSafeInteger(cur.qty + qty)) return { error:'bad_qty' };
  if(countOf(inv, item) < qty || !removeItem(inv, item, qty)) return { error:'not_enough' };
  c.in[slot] = { item, qty: (cur?.qty || 0) + qty };
  return { ok:true };
}

/* vider une case (entrée ou sortie) dans l'inventaire ; case vide : rien à faire */
function unload(c, inv, side, slot){
  if(!validIdx(slot, side === 'in' ? CRUSHER.inSlots : CRUSHER.outSlots)) return { error:'bad_slot' };
  const s = c[side][slot];
  if(!s) return { ok:true };
  if(!addItem(inv, s.item, s.qty).length) return { error:'inventory_full' };
  c[side][slot] = null;
  return { ok:true };
}
function collectAll(c, inv){
  for(let i = 0; i < CRUSHER.outSlots; i++){ const r = unload(c, inv, 'out', i); if(r.error) return r; }
  return { ok:true };
}

/* ---------- relecture du stockage : revérifié à chaque lecture (case invalide → vide) ---------- */
function cleanSlot(s, ok){
  return s && typeof s.item === 'string' && validQty(s.qty) && ok(s.item) ? { item:s.item, qty:s.qty } : null;
}
export function sanitizeCrusher(raw){
  const c = createCrusher();
  if(!raw || typeof raw !== 'object') return c;
  const arr = (a, n) => Array.from({ length:n }, (_, i) => Array.isArray(a) ? a[i] : null);
  c.in  = arr(raw.in,  CRUSHER.inSlots).map(s => cleanSlot(s, crushable));
  c.out = arr(raw.out, CRUSHER.outSlots).map(s => cleanSlot(s, i => OUT_ITEMS.has(i)));
  c.crushed = Number.isSafeInteger(raw.crushed) && raw.crushed >= 0 ? raw.crushed : 0;
  c.since = Number.isFinite(raw.since) && canRun(c) ? raw.since : null;
  c.finds = Array.isArray(raw.finds) ? raw.finds.filter(f => f && Number.isFinite(f.at) && crushable(f.from) && f.loot && typeof f.loot === 'object')
    .map(f => ({ at:f.at, from:f.from, loot:Object.fromEntries(Object.entries(f.loot).filter(([i, q]) => OUT_ITEMS.has(i) && validQty(q))) }))
    .slice(-FINDS_MEMORY) : [];
  c.ops = Array.isArray(raw.ops) ? raw.ops.filter(o => typeof o === 'string').slice(-CRUSHER.opMemory) : [];
  return c;
}

/* ce que le navigateur voit (sans la mémoire des demandes) */
export const publicCrusher = (c, now) => ({ in:c.in, out:c.out, since:c.since, crushed:c.crushed, finds:c.finds, now });

/* ---- Chances réelles, pour l'aide « ? » de l'onglet et le wiki ----
   Un lot = CRUSHER.batch blocs = un cycle de CRUSHER.time s. rollLoot fait UN tirage par famille : les chances des
   objets d'une famille s'additionnent (3 gemmes à 0,2 % = 0,6 % d'avoir une gemme, jamais deux). Pour chaque famille
   et chaque objet : la chance par lot (pas de moyenne ni de temps estimé : décision du créateur, 22/10/2026). */
export function dropOdds(block){
  const t = CRUSHER.loot[block];
  if(!t) return [];
  /* butin garanti (always, minerai de fer) : une « famille » par objet, à 100 %, avec sa fourchette (min, max) */
  return [...(t.always || []).map(a => ({ family: 'fixed', chance: 1, min: a.min, max: a.max, items: [{ item: a.item, chance: 1 }] })),
          ...t.oneOf.map(f => ({ family: f.family, chance: f.items.reduce((s, i) => s + i.chance, 0),
                                 items: f.items.map(i => ({ item: i.item, chance: i.chance })) }))];
}

