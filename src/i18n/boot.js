/* Langue au démarrage de la page (03/11/2026) : importé EN PREMIER par src/main.js, avant les écrans, pour que les textes
   calculés au chargement des modules soient déjà dans la bonne langue. La langue retenue sur l'appareil (choisie sur le
   compte : src/main.js la recopie ici et recharge la page si elle change), sinon celle du navigateur si l'anglais est
   ouvert aux joueurs. */
import { setLang, getLang, guessLang, isLang } from './index.js';

export const LANG_KEY = 'dim.lang';
export function storedLang(){ try { const l = localStorage.getItem(LANG_KEY); return isLang(l) ? l : null; } catch { return null; } }
export function storeLang(l){ try { localStorage.setItem(LANG_KEY, l); } catch {} }

setLang(storedLang() ?? guessLang(globalThis.navigator?.language));
if(globalThis.document) document.documentElement.lang = getLang();
