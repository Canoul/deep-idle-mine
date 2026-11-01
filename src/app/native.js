/* Couche appli : le seul module qui parle au téléphone, par window.Capacitor (aucun import npm dans src/). Une ancienne
   APK sans le plugin n'a ni notifications ni réglages. */
import { APP_NOTIFS } from '../config.js';
import { planNotifs, notifPrefs, setNotifPref, NOTIF_KINDS } from './notifs.js';

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

/* isExactNotification:false : sans ça, le plugin ouvre l'écran système des alarmes à chaque appel, sur Android 12+ */
const toPlugin = n => ({ id:n.id, title:n.title, body:n.body, extra:{ tab:n.tab }, isExactNotification:false,
  schedule:{ at:new Date(n.at), allowWhileIdle:true } });

/* applique la différence entre wanted et previous (Map id → heure) ; rend ce qui est réellement programmé. Tolérance :
   l'écart serveur − téléphone est remesuré sans cesse et bouge de quelques ms avec le réseau. */
export async function syncNotifs(plugin, wanted, previous){
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
      await plugin.schedule({ notifications:add.map(toPlugin) });
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
  let previous = null, running = null, again = false, asked = false;

  async function pass(){
    const d = data(), prefs = notifPrefs(store, d.account);
    if(!previous){ await clearPending(plugin); previous = new Map(); }
    if(prefs.all && !asked){ asked = true; await askPermission(plugin, store); }
    let allowed = false;
    try { allowed = await granted(plugin); } catch(e){ console.warn(e); }
    /* jamais schedule sans autorisation : le plugin la redemanderait à chaque fois */
    const wanted = allowed ? planNotifs({ ...d, prefs, hourOf:at => new Date(at).getHours() }) : [];
    previous = await syncNotifs(plugin, wanted, previous);
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
      return [{ key:'notif_all', label:'Notifications sur ce téléphone', title:'Coupe ou rallume toutes les notifications de l\'appli.', on:prefs.all },
        ...NOTIF_KINDS.map(k => ({ key:`notif_${k.id}`, label:`Notification : ${k.label}`, on:prefs[k.id] }))];
    },
    async set(kind, on){
      setNotifPref(store, data().account, kind, on);
      if(on) await askPermission(plugin, store, { force:true });
      await refresh();
    },
  };
}
