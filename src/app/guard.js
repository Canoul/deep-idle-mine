/* Couche appli, gardien des mises à jour à chaud (02/11/2026). Seulement dans la page de l'appli (ajouté par
   server/app-update/bundle.js, appIndex), après src/boot-check.js et avant src/main.js : un module à part, pour tourner même si le
   jeu ne se charge pas.

   Si cette page est une nouvelle version en essai : confirmée quand le jeu a démarré (DIM_BOOT.started), sinon (erreur relevée par
   boot-check, ou APP_UPDATE.readyTimeout s sans démarrer) retour à la version d'avant. Voir src/app/updater.js. */
import { ioOf, guardStart } from './updater.js';

const io = ioOf(window);
window.dimUpdateGuard = io ? guardStart(io).catch(e => { console.warn(e); return null; }) : null;
