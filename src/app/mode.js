/* Couche appli : la page tourne-t-elle dans l'appli mobile (coque Capacitor, dossier mobile/) ?
   Logique pure, sans DOM : `win` est window (ou un objet de test).

   - 'ok'      : dans l'appli, pont natif branché (window.Capacitor, injecté par la coque) ;
   - 'blocked' : dans NOTRE appli (sa marque APP_UA dans l'agent utilisateur), mais le script du pont n'a pas tourné
                 (le canal natif est là, window.Capacitor non : androidBridge sur Android,
                 webkit.messageHandlers.bridge sur iPhone) : le plus probable, la politique de sécurité du serveur l'a
                 bloqué ;
   - 'web'     : un navigateur, le site normal (aussi le navigateur intégré d'une autre appli, même avec un canal natif
                 à elle : sans notre marque, le site ne change pas). */

/* marque ajoutée par la coque à l'agent utilisateur (mobile/capacitor.config.json, appendUserAgent) */
export const APP_UA = 'DeepMineIdleApp';

export function nativeStatus(win){
  if(win.Capacitor?.isNativePlatform?.() === true) return 'ok';
  const channel = win.androidBridge || win.webkit?.messageHandlers?.bridge;
  return channel && win.navigator?.userAgent?.includes(APP_UA) ? 'blocked' : 'web';
}

/* couche appli à charger : dans l'appli, ou dans un navigateur avec ?app dans l'adresse (aperçu, captures) */
export function isAppMode({ status, search }){
  return status !== 'web' || new URLSearchParams(search).has('app');
}
