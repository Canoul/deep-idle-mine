/* Shrines (28/10/2026, Geoffrey) : logique pure, partagée par le jeu (affichage) et le serveur (qui fait foi).
   Règles dans SHRINES (src/config.js) et GAME_DESIGN §6 « Shrines ».

   État d'un chef (rattaché à SON compte) : { active:{ id: sessions restantes }, paid:{ id:{ objet: quantité } },
   code: code de lobby gardé tant qu'il a un shrine, ops:[{ id, result }] }.
   - give : un membre du groupe donne des ressources du prix d'un shrine pas encore actif ; on ne prend que ce qui manque.
     Prix atteint → actif pour SHRINES.list[id].sessions mines classiques, paiement remis à zéro.
   - consume : au lancement d'une mine classique par ce chef, chaque shrine actif perd une session (retiré à 0) ;
     renvoie les shrines actifs pour cette session.
   - oreBonusComp : composition d'une area avec effect.orePoints points de terrain changés en minerais. */
import { SHRINES, BLOCKS, IDS } from '../config.js';
import { countOf, removeItem } from './inventory.js';

export const SHRINE_IDS = Object.keys(SHRINES.list);
export const shrineOf = id => (typeof id === 'string' && Object.hasOwn(SHRINES.list, id)) ? SHRINES.list[id] : null;
export const createShrines = () => ({ active:{}, paid:{}, code:null, ops:[] });
const nat = v => Number.isSafeInteger(v) && v > 0 ? v : 0;

/* relu et revérifié : shrines connus, quantités entières, jamais plus que le prix ni plus de sessions que la durée */
export function sanitizeShrines(raw){
  const st = createShrines();
  if(!raw || typeof raw !== 'object') return st;
  for(const id of SHRINE_IDS){
    const def = SHRINES.list[id];
    const left = Math.min(def.sessions, nat(raw.active?.[id]));
    if(left){ st.active[id] = left; continue; }   // actif : pas de paiement en cours
    const paid = {};
    for(const [item, max] of Object.entries(def.price)){ const q = Math.min(max, nat(raw.paid?.[id]?.[item])); if(q) paid[item] = q; }
    if(Object.keys(paid).length) st.paid[id] = paid;
  }
  if(typeof raw.code === 'string' && /^[A-Z0-9]{4,12}$/.test(raw.code)) st.code = raw.code;
  if(Array.isArray(raw.ops)) st.ops = raw.ops.filter(o => o && typeof o.id === 'string' && o.result && typeof o.result === 'object').slice(-SHRINES.opMemory);
  return st;
}

/* un shrine actif ou en cours de paiement (le chef garde alors le même code de lobby) */
export const hasShrines = st => Object.keys(st.active).length > 0 || Object.keys(st.paid).length > 0;

/* ce qui manque encore pour activer ce shrine : { objet: quantité } */
export const missingFor = (st, id) => {
  const def = shrineOf(id); if(!def || st.active[id]) return {};
  return Object.fromEntries(Object.entries(def.price).map(([item, q]) => [item, q - (st.paid[id]?.[item] ?? 0)]).filter(([, q]) => q > 0));
};

/* don de qty × item au shrine id, pris dans inv (celui qui donne). Renvoie { ok, given, activated, repeated } ou
   { error } : bad_shrine, bad_item (pas dans le prix), bad_qty, active (déjà actif), full (cet objet est déjà payé),
   not_owned (pas assez dans l'inventaire). Idempotent par opId. On ne prend que ce qui manque. */
export function give(st, inv, { shrine, item, qty, opId }){
  const prev = st.ops.find(o => o.id === opId);
  if(prev) return { ...prev.result, repeated:true };
  const def = shrineOf(shrine);
  if(!def) return { error:'bad_shrine' };
  if(typeof item !== 'string' || !Object.hasOwn(def.price, item)) return { error:'bad_item' };
  if(!Number.isSafeInteger(qty) || qty < 1 || qty > 1e6) return { error:'bad_qty' };
  if(st.active[shrine]) return { error:'active' };
  const need = missingFor(st, shrine)[item] ?? 0;
  if(!need) return { error:'full' };
  const take = Math.min(qty, need);
  if(countOf(inv, item) < take || !removeItem(inv, item, take)) return { error:'not_owned' };
  const paid = st.paid[shrine] ??= {};
  paid[item] = (paid[item] ?? 0) + take;
  let activated = false;
  if(!Object.keys(missingFor(st, shrine)).length){ st.active[shrine] = def.sessions; delete st.paid[shrine]; activated = true; }
  const result = { ok:true, given:take, activated };
  st.ops.push({ id:opId, result });
  if(st.ops.length > SHRINES.opMemory) st.ops.splice(0, st.ops.length - SHRINES.opMemory);
  return { ...result, repeated:false };
}

/* lancement d'une mine classique par ce chef : renvoie les shrines actifs (ordre de SHRINES.list) et leur retire une
   session chacun (retirés à 0) */
export function consume(st){
  const used = SHRINE_IDS.filter(id => st.active[id] > 0);
  for(const id of used) if(--st.active[id] <= 0) delete st.active[id];
  return used;
}

/* effets cumulés des shrines d'une session (liste d'ids, revérifiée) */
export function shrineEffects(ids){
  const out = { orePoints:0 };
  for(const id of Array.isArray(ids) ? new Set(ids) : []) out.orePoints += shrineOf(id)?.effect?.orePoints ?? 0;
  return out;
}

/* composition d'une area avec pts points de plus en minerais : pris sur le terrain (pierre, pierre dure, terre…, pas le
   vide) au prorata de chacun, donnés aux minerais (charbon compris) au prorata de chacun. Ex. area 6 (20 % de minerais,
   graphite 7 %) avec 5 points : graphite 7 + 7/20 × 5 = 8,75 %. Le total ne change pas. Sans minerai ou sans terrain :
   inchangée. */
export function oreBonusComp(comp, pts){
  if(!(pts > 0)) return comp;
  const kind = k => BLOCKS[IDS[k]]?.type ?? null;
  const ores = Object.keys(comp).filter(k => kind(k) === 'ore'), land = Object.keys(comp).filter(k => kind(k) === 'terrain');
  const S = ores.reduce((s, k) => s + comp[k], 0), T = land.reduce((s, k) => s + comp[k], 0);
  if(!(S > 0) || !(T > 0)) return comp;
  const p = Math.min(pts, T), out = { ...comp };
  for(const k of ores) out[k] = comp[k] + comp[k] / S * p;
  for(const k of land) out[k] = comp[k] - comp[k] / T * p;
  return out;
}

/* ce que voit le lobby : chaque shrine, son prix, ce qui est déjà donné, les sessions restantes s'il est actif */
export const publicShrines = st => SHRINE_IDS.map(id => {
  const d = SHRINES.list[id];
  return { id, name:d.name, desc:d.desc, tex:d.tex, sessions:d.sessions, price:{ ...d.price },
           paid:{ ...(st.paid[id] ?? {}) }, left: st.active[id] ?? 0 };
});
