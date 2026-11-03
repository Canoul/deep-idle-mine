/* Couche appli : quelles notifications programmer sur le téléphone, et les réglages du joueur. Logique pure, sans DOM ni
   plugin (native.js applique le résultat). Les heures du jeu sont celles du serveur, at celle du téléphone. */
import { APP_NOTIFS } from '../config.js';
import { nextSlot } from '../shared/instant.js';
import { advance, batches, ingotMs } from '../meta/furnace.js';

export const NOTIF_KINDS = [
  { id:'session', label:'Session terminée' },
  { id:'mi',      label:'Mine instantanée dans 5 min' },
  { id:'giant',   label:'Bloc géant accessible' },
  { id:'hescoming', label:'He\'s coming accessible' },   // 03/11/2026 (Geoffrey)
  { id:'four',    label:'Four terminé' },
];

const TEXTS = {
  session: { id:1, title:'Session terminée', body:'Ton mineur est remonté : viens voir le butin.', tab:'session' },
  four:    { id:2, title:'Four terminé', body:'Tes lingots sont prêts.', tab:'four' },
  giant:   { id:3, title:'Bloc géant accessible', body:'Tu peux y retourner.', tab:'lobby' },
  hescoming: { id:4, title:'He\'s coming accessible', body:'Lucifer t\'attend : tu peux y retourner.', tab:'lobby' },
  mi:      { title:'Mine instantanée dans 5 min', body:'Inscris-toi avant l\'ouverture.', tab:'lobby' },
};
/* lié à l'heure du créneau, pas à son rang : quand un créneau passe, les suivants gardent leur identifiant */
const miId = slot => 1000 + Math.floor(slot / 3600e3) % 1e6;

/* fin du dernier four en marche (heure du serveur), ou null. Le serveur n'avance un four que quand on y touche. */
export function furnaceEnd(list, now){
  const ends = (list ?? []).map(f => advance(structuredClone(f), now)).filter(f => f.since !== null).map(f => f.since + batches(f) * ingotMs(f));
  return ends.length ? Math.max(...ends) : null;
}

const quiet = hour => hour >= APP_NOTIFS.quietFrom || hour < APP_NOTIFS.quietTo;

function miNotifs(now, offset, hourOf){
  const out = [];
  for(let i = 0, slot = now; i < APP_NOTIFS.miAhead; i++){
    slot = nextSlot(slot);
    const at = slot - APP_NOTIFS.miBefore * 1000;
    if(at > now && !quiet(hourOf(at - offset))) out.push({ ...TEXTS.mi, id:miId(slot), kind:'mi', at:at - offset });
  }
  return out;
}

/* now, sessionEnd, giantNext, hcNext (He's coming) : heure du serveur ; offset : serveur − téléphone ; hourOf(at) : heure locale du téléphone */
export function planNotifs({ now, offset, sessionEnd, furnaces, giantNext, hcNext = null, prefs, hourOf }){
  if(!prefs.all) return [];
  const one = (kind, end) => prefs[kind] && end > now ? [{ ...TEXTS[kind], kind, at:end - offset }] : [];
  return [
    ...one('session', sessionEnd),
    ...one('four', furnaceEnd(furnaces, now)),
    ...one('giant', giantNext),
    ...one('hescoming', hcNext),
    ...(prefs.mi ? miNotifs(now, offset, hourOf) : []),
  ];
}

/* ---------- réglages, par compte, sur ce téléphone ---------- */

const PREF_KEYS = ['all', ...NOTIF_KINDS.map(k => k.id)];
const prefKey = account => `deepIdleMine.appNotifs.${account}`;
export const ALL_OFF = Object.fromEntries(PREF_KEYS.map(k => [k, false]));

function savedPrefs(store, account){
  try { return JSON.parse(store.getItem(prefKey(account))) ?? {}; } catch(e){ return {}; }
}

/* tout est activé par défaut ; sans compte, rien */
export function notifPrefs(store, account){
  if(!account) return ALL_OFF;
  const saved = savedPrefs(store, account);
  return Object.fromEntries(PREF_KEYS.map(k => [k, saved[k] !== false]));
}

export function setNotifPref(store, account, kind, on){
  if(!account || !PREF_KEYS.includes(kind)) return;
  try { store.setItem(prefKey(account), JSON.stringify({ ...savedPrefs(store, account), [kind]:!!on })); } catch(e){}
}
