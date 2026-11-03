/* Nouvelle appli sur le store (03/11/2026, Geoffrey ; APP_UPDATE.latest) : au démarrage de l'appli, si la coque est plus
   ancienne que la dernière version publiée sur le Play Store / l'App Store, une fenêtre le dit : « Mettre à jour » ouvre la
   fiche du store, « Plus tard » ferme (reproposé au plus une fois par APP_UPDATE.nudgeEvery). Rien sur le site ni avec ?app
   sans le pont natif. Le jeu lui-même se met à jour tout seul (mises à jour à chaud) : ceci ne concerne que la coque. */
import { storeNudge, storeUrl } from './update.js';
import { ask } from '../ui/dialog.js';

const KEY = 'dim.storeNudge';   // { v, at } : dernière fenêtre montrée
const read = win => { try { return JSON.parse(win.localStorage.getItem(KEY)) ?? null; } catch(e){ return null; } };
const write = (win, v) => { try { win.localStorage.setItem(KEY, JSON.stringify(v)); } catch(e){} };

export async function startStoreNudge({ win, delay = 2000 }){
  const P = win.Capacitor?.Plugins ?? {}, platform = win.Capacitor?.getPlatform?.() ?? '';
  if(!P.App || !P.AppLauncher) return;
  let native = '';
  try { native = (await P.App.getInfo()).version ?? ''; } catch(e){ return; }
  const want = storeNudge({ native, platform, seen: read(win), now: Date.now() });
  if(!want) return;
  await new Promise(r => win.setTimeout(r, delay));   // par-dessus le jeu déjà affiché
  write(win, { v: want, at: Date.now() });
  const where = platform === 'ios' ? 'l\'App Store' : 'le Play Store';
  if(await ask(`Nouvelle version de l'appli : ${want} (tu as la ${native}).\nMets-la à jour sur ${where} pour en profiter.`,
               { ok: 'Mettre à jour', cancel: 'Plus tard' }))
    P.AppLauncher.openUrl({ url: storeUrl(platform) }).catch(console.warn);
}
