/* Focus minerai : le joueur choisit, pendant la session, les minerais que son mineur doit viser (GAME_DESIGN §3).
   m.prefs.focus = { <clé de minerai>: 'target' | 'only' } (clé absente = none). Ne concerne que les blocs de type ore.
   - target : le minerai pèse plus lourd que le plus gros minerai dans le choix de l'IA ;
   - only   : l'IA ne vise QUE les minerais « only » (les « target » sont alors ignorés aussi) ;
   - une area où il reste moins de FOCUS.minLeft du nombre initial d'un minerai est épuisée pour lui : le mineur part
     vers l'area débloquée la plus proche qui en a encore ; s'il n'y en a plus nulle part, ce focus saute. */
import { FOCUS, BLOCKS, IDS } from '../config.js';
import { isOre, oreKey, areaOf } from './world.js';
import { log } from './log.js';

export const ORE_KEYS = Object.keys(IDS).filter(n => isOre(IDS[n]));
const MAX_VAL = Math.max(...ORE_KEYS.map(n => BLOCKS[IDS[n]].val));
export const FOCUS_VAL = FOCUS.valFactor * MAX_VAL;

/* ne garde que les minerais connus avec un mode permis (none = absent) ; toujours un nouvel objet */
export function sanitizeFocus(input){
  const out = {};
  if(!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for(const k of ORE_KEYS)
    if(Object.hasOwn(input, k) && input[k] !== 'none' && FOCUS.modes.includes(input[k])) out[k] = input[k];
  return out;
}

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

/* retire les minerais visés épuisés dans TOUTES les areas débloquées ; prévient le joueur (m.focusNotice) */
export function dropDepleted(G,m){
  for(;;){
    const act = activeOres(m.prefs.focus);
    const dead = act.filter(key => { for(let k=0;k<G.unlockedAreas;k++) if(!depleted(G,k,key)) return false; return true; });
    if(!dead.length) return;
    const focus = { ...m.prefs.focus };
    for(const key of dead) delete focus[key];
    m.prefs = { ...m.prefs, focus };
    const names = dead.map(key => BLOCKS[IDS[key]].name).join(', ');
    m.focusNotice = { t:G.t, msg:`Focus abandonné : plus assez de ${names} dans les areas débloquées (< ${Math.round(FOCUS.minLeft*100)} %).` };
    log(G, `🎯 ${m.name} : ${m.focusNotice.msg}`);
    m.exploring = false; m.skipRows.clear();
  }
}

/* area où le mineur doit aller pour son focus, ou null s'il est déjà au bon endroit (ou sans focus).
   La plus proche des areas débloquées qui a encore un minerai visé ; à égalité, celle du dessous. */
export function focusGoal(G,m){
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
