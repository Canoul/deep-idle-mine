/* Où est le serveur, et qui suis-je (01/11/2026, appli mobile). Sur le SITE : API_BASE vide, adresses relatives, connexion par le
   cookie HttpOnly, ce module ne fait rien de plus. Dans l'APPLI : window.DIM_APP (app-config.js, écrit par
   mobile/scripts/copy-web.js) donne l'adresse du serveur. L'appli tourne sur une autre origine (https://localhost), où le cookie
   SameSite=Strict ne passe pas : le serveur lui donne un jeton, rangé dans le stockage natif de l'appli et envoyé dans
   Authorization. Le stockage natif, et non localStorage : un compte invité n'existe que par ce jeton. */
const app = globalThis.DIM_APP ?? null;
export const API_BASE = app?.api ?? '';
export const inLocalApp = !!app;

const KEY = 'dim_token';
const prefs = () => globalThis.Capacitor?.Plugins?.Preferences ?? null;
let token = null;

async function readToken(){
  if(!app) return null;
  try {
    if(prefs()) return (await prefs().get({ key: KEY })).value ?? null;
    return globalThis.localStorage?.getItem(KEY) ?? null;      // essais dans un navigateur
  } catch(e){ console.warn(e); return null; }
}
const ready = readToken().then(t => { token = t; });

export async function setToken(t){
  token = t;
  try {
    if(prefs()) await (t ? prefs().set({ key: KEY, value: t }) : prefs().remove({ key: KEY }));
    else if(t) globalThis.localStorage?.setItem(KEY, t); else globalThis.localStorage?.removeItem(KEY);
  } catch(e){ console.warn(e); }
}

/* options de fetch communes : même chose qu'avant sur le site */
export async function authOptions(){
  await ready;
  return app ? { credentials: 'omit', headers: token ? { Authorization: `Bearer ${token}` } : {} } : { credentials: 'same-origin', headers: {} };
}
