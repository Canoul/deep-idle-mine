/* Focus minerai : le joueur choisit, pendant la session, les minerais que son mineur doit viser (GAME_DESIGN §3).
   m.prefs.focus = { <clé de minerai>: 'target' | 'only' } (clé absente = none). Ne concerne que les blocs de type ore.
   - target : le minerai pèse plus lourd que le plus gros minerai dans le choix de l'IA ;
   - only   : l'IA ne vise QUE les minerais « only » (les « target » sont alors ignorés aussi) ;
   - une area où il reste moins de FOCUS.minLeft du nombre initial d'un minerai est épuisée pour lui : le mineur part
     vers l'area débloquée la plus proche qui en a encore ; s'il n'y en a plus nulle part, ce focus saute.
   Focus d'area : m.prefs.focus.area = numéro d'area (absent = toujours plus profond). Le mineur rejoint cette area et
   y reste (il n'en vise que les cibles) ; il l'emporte sur le focus minerai, qui ne cherche alors que dans cette area.
   « Plus profond » (pas de focus d'area, pas de focus minerai) : pareil, avec l'area la plus profonde débloquée, qui
   suit chaque déblocage (deepArea). */
import { FOCUS, BLOCKS, IDS } from '../config.js';
import { isOre, oreKey, areaOf } from './world.js';
import { log } from './log.js';

export const ORE_KEYS = Object.keys(IDS).filter(n => isOre(IDS[n]));
const MAX_VAL = Math.max(...ORE_KEYS.map(n => BLOCKS[IDS[n]].val));
export const FOCUS_VAL = FOCUS.valFactor * MAX_VAL;

/* ne garde que les minerais connus avec un mode permis (none = absent), et l'area visée si c'est un numéro valide
   (absente = toujours plus profond) ; toujours un nouvel objet */
export function sanitizeFocus(input){
  const out = {};
  if(!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for(const k of ORE_KEYS)
    if(Object.hasOwn(input, k) && input[k] !== 'none' && FOCUS.modes.includes(input[k])) out[k] = input[k];
  if(Object.hasOwn(input, 'area') && Number.isSafeInteger(input.area) && input.area >= 0 && input.area <= FOCUS.maxArea)
    out.area = input.area;
  return out;
}

/* Focus d'area : l'area où le mineur doit travailler, ou null (= toujours plus profond, le comportement de base).
   Une area pas encore débloquée ne compte pas. */
export function focusArea(G,m){
  const a = m.prefs.focus?.area;
  return Number.isSafeInteger(a) && a < G.unlockedAreas && !G.khole ? a : null;   // pas de focus d'area dans le k hole
}
/* « Plus profond » : l'area la plus profonde débloquée, où il travaille comme avec un focus d'area (il ne finit plus
   les filons des areas du dessus). null quand il ne s'applique pas : focus d'area choisi, focus minerai (l'area la
   plus proche qui a ses minerais), ou area vidée (comportement d'avant : il descend, prend ce qu'il trouve). En fin
   de session, l'area la plus profonde qu'il peut encore atteindre (profondeur max du trajet, m.tripCap). */
export function deepArea(G,m){
  if(focusArea(G,m) !== null || activeOres(m.prefs.focus).length) return null;
  const k = Math.max(0, Math.min(G.unlockedAreas-1, areaOf(m.tripCap ?? Infinity)));
  return areaDepleted(G,k) ? null : k;
}
/* area où il doit travailler : son focus d'area, sinon « Plus profond », sinon null (pas d'area imposée) */
export const workArea = (G,m) => focusArea(G,m) ?? deepArea(G,m);

/* areas où le focus minerai cherche ses minerais : l'area visée seule, sinon toutes les areas débloquées */
const focusAreas = (G,m) => { const A = focusArea(G,m); return A !== null ? [A] : [...Array(G.unlockedAreas).keys()]; };

/* minerais visés : les « only » s'il y en a, sinon les « target » */
export function activeOres(focus){
  const ks = Object.keys(focus || {});
  const only = ks.filter(k => focus[k] === 'only');
  return only.length ? only : ks.filter(k => focus[k] === 'target');
}
export const onlyMode = focus => Object.values(focus || {}).includes('only');

/* poids d'un bloc visé pour l'IA : null = ignoré (mode only), sinon sa valeur (augmentée s'il est visé).
   Les treasures et autres cibles non-ore gardent leur valeur. */
export function targetVal(m,t){
  const v = BLOCKS[t].val;
  if(!isOre(t)) return v;
  const f = m.prefs.focus, act = activeOres(f), k = oreKey(t);
  if(act.includes(k)) return FOCUS_VAL;
  return onlyMode(f) ? null : v;
}

/* l'area k est-elle épuisée pour le minerai key ? (absent de l'area = épuisée) */
export function depleted(G,k,key){
  const o = G.areas[k]?.ores[key];
  return !o || o.total === 0 || o.left < FOCUS.minLeft * o.total;
}
/* l'area k a-t-elle encore au moins un des minerais visés ? */
export const areaGood = (G,k,act) => act.some(key => !depleted(G,k,key));

/* minerais présents dans les areas débloquées (ce que le panneau propose), avec restant / initial cumulés */
export function focusOptions(G){
  const out = [];
  for(const key of ORE_KEYS){
    let total = 0, left = 0;
    for(let k=0;k<G.unlockedAreas;k++){ const o=G.areas[k].ores[key]; if(o){ total+=o.total; left+=o.left; } }
    if(total > 0) out.push({ key, name:BLOCKS[IDS[key]].name, total, left });
  }
  return out;
}

/* nouveau focus choisi par le joueur (appliqué au tick enregistré par le serveur) */
export function setFocus(G,m,focus){
  m.prefs = { ...m.prefs, focus:sanitizeFocus(focus) };
  m.exploring = false; m.skipRows.clear(); m.target = null;   // il revoit ses plans
}

/* minerais restants / initiaux de l'area k, tous minerais confondus */
export function areaOreLeft(G,k){
  let total = 0, left = 0;
  for(const o of Object.values(G.areas[k]?.ores || {})){ total += o.total; left += o.left; }
  return { total, left };
}
/* l'area k est-elle vidée pour le focus d'area ? (moins de FOCUS.minLeft de ses minerais, ou aucun minerai) */
export function areaDepleted(G,k){
  const { total, left } = areaOreLeft(G,k);
  return total === 0 || left < FOCUS.minLeft * total;
}

/* retire le focus d'area si son area est vidée (retour à « toujours plus profond »), puis les minerais visés épuisés
   dans les areas où il cherche ; prévient le joueur (m.focusNotice) */
export function dropDepleted(G,m){
  const A = focusArea(G,m);
  if(A !== null && areaDepleted(G,A)){
    const focus = { ...m.prefs.focus };
    delete focus.area;
    m.prefs = { ...m.prefs, focus };
    m.focusNotice = { t:G.t, kind:'area', msg:`Focus area abandonné : l'area ${A} n'a plus assez de minerais (< ${Math.round(FOCUS.minLeft*100)} %). Retour à « Plus profond ».` };
    log(G, `🎯 ${m.name} : ${m.focusNotice.msg}`);
    m.exploring = false; m.skipRows.clear(); m.target = null;
  }
  for(;;){
    const act = activeOres(m.prefs.focus);
    const areas = focusAreas(G,m);
    const dead = act.filter(key => areas.every(k => depleted(G,k,key)));
    if(!dead.length) return;
    const where = focusArea(G,m) !== null ? `l'area ${focusArea(G,m)}` : 'les areas débloquées';
    const focus = { ...m.prefs.focus };
    for(const key of dead) delete focus[key];
    m.prefs = { ...m.prefs, focus };
    const names = dead.map(key => BLOCKS[IDS[key]].name).join(', ');
    m.focusNotice = { t:G.t, msg:`Focus abandonné : plus assez de ${names} dans ${where} (< ${Math.round(FOCUS.minLeft*100)} %).` };
    log(G, `🎯 ${m.name} : ${m.focusNotice.msg}`);
    m.exploring = false; m.skipRows.clear();
  }
}

/* area où le mineur doit aller pour son focus (ou « Plus profond »), ou null s'il est déjà au bon endroit (ou sans focus).
   La plus proche des areas débloquées qui a encore un minerai visé ; à égalité, celle du dessous. */
export function focusGoal(G,m){
  const A = workArea(G,m);
  if(A !== null) return Math.max(0, areaOf(m.y)) === A ? null : A;   // focus d'area (ou « Plus profond ») : il l'emporte
  const act = activeOres(m.prefs.focus);
  if(!act.length) return null;
  const cur = Math.max(0, Math.min(G.unlockedAreas-1, areaOf(m.y)));
  if(areaGood(G,cur,act)) return null;
  for(let d=1; d<G.unlockedAreas; d++){
    if(cur+d < G.unlockedAreas && areaGood(G,cur+d,act)) return cur+d;
    if(cur-d >= 0 && areaGood(G,cur-d,act)) return cur-d;
  }
  return null;   // n'arrive pas : dropDepleted a déjà retiré les minerais épuisés partout
}
