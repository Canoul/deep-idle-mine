/* Couche appli, mises à jour à chaud (02/11/2026) : logique pure, sans DOM ni plugin (testée). L'assemblage est dans
   src/app/updater.js (téléchargement, bascule) et src/app/guard.js (une nouvelle version démarre-t-elle ?).

   Une version du jeu = un paquet (server/app-update/bundle.js), identifié par l'empreinte de son contenu. L'appli les range dans
   des dossiers du téléphone et dit à Capacitor lequel charger. État gardé dans le stockage de la page (le même pour toutes les
   versions : même origine) :
     good   : { v } dernière version téléchargée qui a démarré ; Capacitor la recharge à chaque lancement (persistServerBasePath).
              null = la copie embarquée dans l'appli ;
     trying : { v, at } version en essai : chargée, pas encore confirmée. Jamais gardée par Capacitor tant qu'elle n'a pas démarré :
              si elle plante, le lancement suivant repart de good tout seul ;
     ready  : { v } version téléchargée et complète, pas encore appliquée (téléchargement trop long au démarrage) ;
     bad    : versions qui n'ont pas démarré, jamais réessayées. */
import { APP_UPDATE } from '../config.js';

export const STATE_KEY = 'deepIdleMine.appUpdate';
export const SNAPSHOTS = 'NoCloud/ionic_built_snapshots';   // imposé par Capacitor sur iPhone (Library/…), même chemin sur Android

const EMPTY = () => ({ good: null, trying: null, ready: null, bad: [] });
const VERSION = /^[0-9a-f]{16}$/;
const okVersion = v => typeof v === 'string' && VERSION.test(v);

export function readState(store){
  let s = null;
  try { s = JSON.parse(store.getItem(STATE_KEY)); } catch(e){}
  if(!s || typeof s !== 'object') return EMPTY();
  const slot = x => x && okVersion(x.v) ? { ...x } : null;
  return { good: slot(s.good), trying: slot(s.trying), ready: slot(s.ready), bad: Array.isArray(s.bad) ? s.bad.filter(okVersion) : [] };
}
export function writeState(store, s){ try { store.setItem(STATE_KEY, JSON.stringify(s)); } catch(e){ console.warn(e); } }

/* « 1.10.0 » > « 1.9.2 » ; morceaux manquants = 0 */
export function cmpVersion(a, b){
  const pa = String(a ?? '').split('.').map(n => parseInt(n, 10) || 0), pb = String(b ?? '').split('.').map(n => parseInt(n, 10) || 0);
  for(let i = 0; i < Math.max(pa.length, pb.length); i++){
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if(d) return Math.sign(d);
  }
  return 0;
}

const addBad = (bad, v) => [...bad.filter(x => x !== v), v].slice(-APP_UPDATE.keepBad);

/* au démarrage d'une page de l'appli, current = version qui tourne (son bundle.json).
   → { state, trial : cette page est une version en essai, failed : version en essai d'un lancement précédent, jamais confirmée } */
export function startupStep(state, current){
  const s = { ...state, bad: [...state.bad] };
  let trial = false, failed = null;
  if(s.trying){
    if(s.trying.v === current) trial = true;
    else { failed = s.trying.v; s.bad = addBad(s.bad, failed); s.trying = null; }
  }
  /* ce qui tourne n'est pas la version gardée : nouvelle version de l'appli installée (Capacitor repart de la copie embarquée) */
  if(!trial && s.good && s.good.v !== current) s.good = null;
  if(s.ready && (s.ready.v === current || s.bad.includes(s.ready.v))) s.ready = null;
  return { state: s, trial, failed };
}

/* la version en essai a démarré : Capacitor la garde (persistServerBasePath), elle devient la bonne */
export function confirmTrial(state){
  if(!state.trying) return state;
  return { ...state, good: { v: state.trying.v }, trying: null, ready: state.ready?.v === state.trying.v ? null : state.ready };
}

/* la version en essai n'a pas démarré : refusée pour toujours ; on revient à good (ou à la copie embarquée si null) */
export function failTrial(state){
  if(!state.trying) return state;
  return { ...state, trying: null, bad: addBad(state.bad, state.trying.v), ready: state.ready?.v === state.trying.v ? null : state.ready };
}

/* réponse du serveur → que faire ? 'tooOld' (coque trop ancienne) | 'same' | 'bad' (déjà refusée) | 'update' */
export function decide({ current, remote, native, bad }){
  if(remote?.minNative && cmpVersion(native, remote.minNative) < 0) return 'tooOld';
  if(!okVersion(remote?.version) || remote.version === current) return 'same';
  if(bad.includes(remote.version)) return 'bad';
  return remote.files && typeof remote.files === 'object' ? 'update' : 'same';
}

/* chemins sûrs seulement : un manifeste ne peut pas écrire hors du dossier de sa version */
export const safePath = p => typeof p === 'string' && p.length > 0 && p.length < 300 && /^[\w@][\w@ .\-/]*$/.test(p) &&
  !p.split('/').some(s => s === '' || s === '.' || s === '..');

/* ce qu'il faut pour construire le dossier de la nouvelle version : reuse = même empreinte dans la version qui tourne (recopiés
   sans réseau), fetch = à télécharger. null si le manifeste est invalide. */
/* les .html ne sont jamais réutilisés (03/11/2026) : Capacitor les modifie quand il les sert (script du pont), relus sur le
   téléphone ils n'ont plus leur empreinte */
export function fileSteps(currentFiles, remoteFiles){
  const reuse = [], fetch = [];
  for(const [p, h] of Object.entries(remoteFiles ?? {})){
    if(!safePath(p) || typeof h !== 'string' || !/^[0-9a-f]{64}$/.test(h)) return null;
    (currentFiles?.[p] === h && !/\.html?$/i.test(p) ? reuse : fetch).push(p);
  }
  return reuse.length + fetch.length ? { reuse, fetch } : null;
}

/* dossiers à garder : la version gardée par Capacitor, celle en essai, celle prête */
export const keepDirs = (state, also = []) => new Set([state.good?.v, state.trying?.v, state.ready?.v, ...also].filter(Boolean));

/* fiche du store (vide : pas encore de fiche, le message suffit) */
export const storeUrl = platform => APP_UPDATE.store[platform] ?? '';
