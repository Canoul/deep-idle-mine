/* Couche appli : la page tourne-t-elle dans l'appli mobile (coque Capacitor, dossier mobile/) ?
   Logique pure, sans DOM : `win` est window (ou un objet de test).

   - 'ok'      : dans l'appli, pont natif branché (window.Capacitor, injecté par la coque) ;
   - 'blocked' : dans l'appli Android, mais le script du pont n'a pas tourné (l'objet natif androidBridge est là,
                 window.Capacitor non) : le plus probable, la politique de sécurité du serveur l'a bloqué ;
   - 'web'     : un navigateur, le site normal. */
export function nativeStatus(win){
  if(win.Capacitor?.isNativePlatform?.() === true) return 'ok';
  return win.androidBridge ? 'blocked' : 'web';
}

/* couche appli à charger : dans l'appli, ou dans un navigateur avec ?app dans l'adresse (aperçu, captures) */
export function isAppMode({ status, search }){
  return status !== 'web' || new URLSearchParams(search).has('app');
}
