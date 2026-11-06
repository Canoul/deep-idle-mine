/* Couche appli : le seul module qui parle au téléphone, par window.Capacitor (aucun import npm dans src/). Une ancienne
   APK sans le plugin n'a ni notifications ni réglages. */
import { APP_NOTIFS } from '../config.js';
import { planNotifs, notifPrefs, setNotifPref, NOTIF_KINDS } from './notifs.js';
import { cmpVersion } from './update.js';

const ASKED = 'deepIdleMine.appNotifAsked';
const granted = async plugin => (await plugin.checkPermissions()).display === 'granted';

export const notifPlugin = win => win.Capacitor?.Plugins?.LocalNotifications ?? null;

/* la demande d'Android, une seule fois : un refus reste un refus, sauf si le joueur recoche une option (force) */
export async function askPermission(plugin, store, { force = false } = {}){
  try {
    if(await granted(plugin)) return true;
    let asked = false;
    try { asked = !!store.getItem(ASKED); store.setItem(ASKED, '1'); } catch(e){}
    if(asked && !force) return false;
    return (await plugin.requestPermissions()).display === 'granted';
  } catch(e){ console.warn(e); return false; }
}

/* à l'ouverture : ce qui reste de la fois d'avant est retiré, la liste est reprogrammée à neuf */
export async function clearPending(plugin){
  try {
    const { notifications } = await plugin.getPending();
    if(notifications.length) await plugin.cancel({ notifications:notifications.map(n => ({ id:n.id })) });
  } catch(e){ console.warn(e); }
}

/* Alarme exacte (03/11/2026, Geoffrey : la notification de la MI arrivait ≈ 15 min en retard ; ancien : toujours
   isExactNotification:false, donc une alarme « approximative » qu'Android regroupe pour la batterie). exact = Android autorise
   les alarmes exactes (permission SCHEDULE_EXACT_ALARM de l'appli 1.1.5, réglage « Alarmes et rappels ») : alors à l'heure.
   Sinon false : le plugin ouvrirait l'écran système des alarmes à chaque programmation (Android 12+). */
const toPlugin = (n, exact = false) => ({ id:n.id, title:n.title, body:n.body, extra:{ tab:n.tab }, isExactNotification:!!exact,
  schedule:{ at:new Date(n.at), allowWhileIdle:true } });

/* alarmes exactes autorisées ? Ancien plugin sans la fonction : non */
export async function exactAllowed(plugin){
  try { return typeof plugin.checkExactNotificationSetting === 'function' && (await plugin.checkExactNotificationSetting()).exact_alarm === 'granted'; }
  catch(e){ console.warn(e); return false; }
}
/* première coque qui déclare la permission (mobile/android/.../AndroidManifest.xml) : avant, Android n'affiche pas l'appli
   dans « Alarmes et rappels », la case serait inutile */
export const EXACT_SINCE = '1.1.5';

/* applique la différence entre wanted et previous (Map id → heure) ; rend ce qui est réellement programmé. Tolérance :
   l'écart serveur − téléphone est remesuré sans cesse et bouge de quelques ms avec le réseau. */
export async function syncNotifs(plugin, wanted, previous, exact = false){
  const same = (id, at) => previous.has(id) && Math.abs(previous.get(id) - at) < APP_NOTIFS.syncTolerance * 1000;
  const fresh = wanted.filter(n => n.at > Date.now()), keep = new Map(fresh.map(n => [n.id, n.at]));
  const gone = [...previous.keys()].filter(id => !keep.has(id) || !same(id, keep.get(id)));
  const add = fresh.filter(n => !same(n.id, n.at));
  const done = new Map(previous);
  try {
    if(gone.length){
      await plugin.cancel({ notifications:gone.map(id => ({ id })) });
      gone.forEach(id => done.delete(id));
    }
    if(add.length){
      await plugin.schedule({ notifications:add.map(n => toPlugin(n, exact)) });
      add.forEach(n => done.set(n.id, n.at));
    }
  } catch(e){ console.warn(e); }
  return done;
}

export function onNotifTap(plugin, fn){
  plugin.addListener('localNotificationActionPerformed', e => { const tab = e?.notification?.extra?.tab; if(tab) fn(tab); });
}

/* assemblage. data() → { now, offset, sessionEnd, furnaces, giantNext, account } ; open(tab) au toucher d'une notification */
export function startNotifs({ win, doc, data, open }){
  const plugin = notifPlugin(win);
  if(!plugin) return { options:() => [], set(){}, refresh(){} };
  const noStore = { getItem:() => null, setItem(){} };
  let store = noStore;
  try { store = win.localStorage ?? noStore; } catch(e){}
  let previous = null, running = null, again = false, asked = false, exact = null, shell = null;
  const android = win.Capacitor?.getPlatform?.() === 'android';
  /* version de la coque, une fois (case « à l'heure exacte » : seulement à partir d'EXACT_SINCE) */
  const shellVersion = async () => {
    if(shell === null){ try { shell = (await win.Capacitor?.Plugins?.App?.getInfo?.())?.version ?? ''; } catch(e){ shell = ''; } }
    return shell;
  };

  async function pass(){
    const d = data(), prefs = notifPrefs(store, d.account);
    if(!previous){ await clearPending(plugin); previous = new Map(); }
    if(prefs.all && !asked){ asked = true; await askPermission(plugin, store); }
    let allowed = false;
    try { allowed = await granted(plugin); } catch(e){ console.warn(e); }
    /* réglage des alarmes exactes changé (retour des réglages d'Android) : tout est reprogrammé avec le nouveau mode */
    const now = await exactAllowed(plugin);
    if(exact !== null && now !== exact && previous.size){
      try { await plugin.cancel({ notifications:[...previous.keys()].map(id => ({ id })) }); } catch(e){ console.warn(e); }
      previous = new Map();
    }
    exact = now;
    /* jamais schedule sans autorisation : le plugin la redemanderait à chaque fois */
    const wanted = allowed ? planNotifs({ ...d, prefs, hourOf:at => new Date(at).getHours() }) : [];
    previous = await syncNotifs(plugin, wanted, previous, exact);
    await shellVersion();
  }

  /* un seul calcul à la fois ; un appel pendant un calcul en relance un derrière */
  function refresh(){
    if(running){ again = true; return running; }
    running = (async () => {
      try { do { again = false; await pass(); } while(again); }
      catch(e){ console.warn(e); }
      running = null;
    })();
    return running;
  }

  onNotifTap(plugin, open);
  doc.addEventListener('visibilitychange', refresh);
  win.setInterval(refresh, APP_NOTIFS.syncEvery * 1000);
  if(data().account) refresh();

  return {
    refresh,
    options(){
      const account = data().account;
      if(!account) return [];
      const prefs = notifPrefs(store, account);
      /* Android, coque 1.1.5 ou plus : « à l'heure exacte » ouvre le réglage « Alarmes et rappels » d'Android */
      const exactOpt = android && prefs.all && typeof plugin.changeExactNotificationSetting === 'function' && shell && cmpVersion(shell, EXACT_SINCE) >= 0
        ? [{ key:'notif_exact', label:'Notifications à l\'heure exacte', title:'Sans ça, Android peut les retarder d\'un quart d\'heure pour économiser la batterie. Ouvre le réglage « Alarmes et rappels ».', on:!!exact }] : [];
      return [{ key:'notif_all', label:'Notifications sur ce téléphone', title:'Coupe ou rallume toutes les notifications de l\'appli.', on:prefs.all },
        ...exactOpt,
        ...NOTIF_KINDS.map(k => ({ key:`notif_${k.id}`, label:`Notification : ${k.label}`, on:prefs[k.id] }))];
    },
    async set(kind, on){
      if(kind === 'exact'){   // réglage d'Android : on l'ouvre, le retour dans l'appli (visibilitychange) reprogramme
        try { await plugin.changeExactNotificationSetting(); } catch(e){ console.warn(e); }
        return refresh();
      }
      setNotifPref(store, data().account, kind, on);
      if(on) await askPermission(plugin, store, { force:true });
      await refresh();
    },
  };
}
