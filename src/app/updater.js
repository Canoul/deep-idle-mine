/* Couche appli, mises à jour à chaud (02/11/2026) : assemblage. La logique pure est dans src/app/update.js.

   Au démarrage (décision D2 de Jules, 02/11 : « hybride ») et au retour après APP_UPDATE.resumeAfter s en arrière-plan :
     1. une version déjà téléchargée attend ? on bascule tout de suite ;
     2. sinon on demande la dernière version au serveur (APP_UPDATE.checkTimeout s au plus) ;
     3. plus récente : écran « Mise à jour du jeu… », on construit son dossier (fichiers inchangés recopiés de la version qui tourne,
        les autres téléchargés, chaque empreinte vérifiée), et on bascule si c'est fini en APP_UPDATE.applyWithin s ; sinon le jeu
        démarre, le téléchargement continue et la version s'applique à la prochaine occasion. Jamais pendant que le joueur joue.
     4. coque trop ancienne (APP_UPDATE.minNative) : écran « Mets à jour l'appli ».
   Bascule = WebView.setServerBasePath (cœur de Capacitor) : la page se recharge dans la nouvelle version, sans la garder ;
   src/app/guard.js la fait garder (persistServerBasePath) une fois qu'elle a démarré, ou revient en arrière.

   Plugins : window.Capacitor.Plugins (Filesystem, WebView, App, AppLauncher), passés dans io pour les tests. */
import { APP_UPDATE } from '../config.js';
import { API_BASE } from '../net/base.js';
import { readState, writeState, startupStep, confirmTrial, failTrial, decide, fileSteps, keepDirs, storeUrl, SNAPSHOTS } from './update.js';
import { sha256 } from './sha256.js';

export const MANIFEST = 'bundle.json';
const DIR = 'LIBRARY';                  // Directory.Library de @capacitor/filesystem : Library/ (iPhone), fichiers de l'appli (Android)
const PARALLEL = 6;

/* null hors de l'appli, ou dans une coque sans ces plugins (versions 1.0.0) */
export function ioOf(win){
  const P = win.Capacitor?.Plugins ?? {};
  if(!win.DIM_APP || !P.Filesystem || !P.WebView || !P.App) return null;
  return { fetch: win.fetch.bind(win), fs: P.Filesystem, webview: P.WebView, app: P.App, launcher: P.AppLauncher ?? null,
           store: win.localStorage, platform: win.Capacitor.getPlatform?.() ?? '', api: API_BASE, now: () => Date.now() };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
/* délai sans promesse rejetée qui traîne : boot-check prendrait une erreur non gérée pour un plantage du démarrage */
const within = (p, ms) => new Promise((ok, ko) => {
  const t = setTimeout(() => ko(new Error('délai dépassé')), ms);
  p.then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); ko(e); });
});
const encodePath = p => p.split('/').map(encodeURIComponent).join('/');
const dirOf = v => `${SNAPSHOTS}/${v}`;

export async function nativeVersion(io){
  if(io.native === undefined){ try { io.native = (await io.app.getInfo()).version ?? ''; } catch(e){ io.native = ''; } }
  return io.native;
}

/* chemin absolu du dossier d'une version, recalculé à chaque fois : sur iPhone, le dossier de l'appli peut changer de place */
export async function bundleDir(io, v){
  const { uri } = await io.fs.getUri({ directory: DIR, path: dirOf(v) });
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

async function currentManifest(io){
  try { const r = await io.fetch(MANIFEST, { cache: 'no-store' }); return r.ok ? await r.json() : null; }
  catch(e){ return null; }
}

/* un retour en arrière, signalé au serveur (une ligne dans son journal) */
export function report(io, { from, to, why }){
  io.fetch(`${io.api}/api/app/rollback`, { method: 'POST', credentials: 'omit', keepalive: true, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: to ?? 'embarquée', why, platform: io.platform, native: io.native ?? '' }) }).catch(() => {});
}

/* dossiers de versions qui ne servent plus (anciennes, refusées, téléchargements interrompus) */
export async function cleanup(io, state, also = []){
  const keep = keepDirs(state, also);
  let files = [];
  try { files = (await io.fs.readdir({ directory: DIR, path: SNAPSHOTS })).files ?? []; } catch(e){ return; }
  for(const f of files){
    const name = typeof f === 'string' ? f : f.name;
    if(!keep.has(name)) await io.fs.rmdir({ directory: DIR, path: dirOf(name), recursive: true }).catch(console.warn);
  }
}

/* ---- gardien (src/app/guard.js) : chaque page de l'appli passe par ici avant le jeu ---- */
export async function guardStart(io, { boot = globalThis.DIM_BOOT, poll = 500 } = {}){
  const manifest = await currentManifest(io), current = manifest?.version ?? null;
  const { state, trial, failed } = startupStep(readState(io.store), current);
  writeState(io.store, state);
  await nativeVersion(io);
  if(failed) report(io, { from: failed, to: current, why: 'relance' });
  if(!trial) return { manifest, current, trial: false };

  /* version en essai : elle a APP_UPDATE.readyTimeout s pour démarrer (src/main.js met DIM_BOOT.started), sans erreur (boot-check) */
  const since = io.now();
  const outcome = (async () => {
    for(;;){
      if(boot?.started){
        try { await io.webview.persistServerBasePath(); }
        catch(e){ console.warn(e); return 'kept-once'; }        // gardée pour ce lancement seulement : rien n'est effacé
        const s = confirmTrial(readState(io.store));
        writeState(io.store, s);
        await cleanup(io, s);
        return 'confirmed';
      }
      if(boot?.failed || io.now() - since > APP_UPDATE.readyTimeout * 1000){
        const s = failTrial(readState(io.store));
        writeState(io.store, s);
        report(io, { from: current, to: s.good?.v, why: boot?.failed ? 'erreur' : 'délai' });
        if(s.good) await io.webview.setServerBasePath({ path: await bundleDir(io, s.good.v) });
        else await io.webview.setServerAssetPath({ path: 'public' });    // la copie embarquée dans l'appli
        return 'rolledBack';
      }
      await sleep(poll);
    }
  })();
  return { manifest, current, trial: true, outcome };
}

/* ---- construire le dossier d'une version : true si complet et vérifié ---- */
const toBase64 = bytes => {
  let s = '';
  for(let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

export async function build(io, cur, remote){
  const steps = fileSteps(cur?.version && cur.files, remote.files);
  if(!steps) throw new Error('manifeste invalide');
  const v = remote.version, base = dirOf(v), state = readState(io.store);
  await io.fs.rmdir({ directory: DIR, path: base, recursive: true }).catch(() => {});
  await io.fs.mkdir({ directory: DIR, path: SNAPSHOTS, recursive: true }).catch(() => {});
  /* la version qui tourne est un dossier téléchargé : copie native d'un bloc, puis seulement les différences */
  let todo = null;
  if(cur?.version && state.good?.v === cur.version){
    try {
      await io.fs.copy({ from: dirOf(cur.version), to: base, directory: DIR, toDirectory: DIR });
      for(const p of Object.keys(cur.files ?? {})) if(!(p in remote.files)) await io.fs.deleteFile({ directory: DIR, path: `${base}/${p}` }).catch(() => {});
      await io.fs.deleteFile({ directory: DIR, path: `${base}/${MANIFEST}` }).catch(() => {});   // écrit en dernier : marque « complet »
      todo = [...steps.fetch];
    } catch(e){
      console.warn('copie du dossier refusée, fichier par fichier :', e);
      await io.fs.rmdir({ directory: DIR, path: base, recursive: true }).catch(() => {});
    }
  }
  if(!todo){
    await io.fs.mkdir({ directory: DIR, path: base, recursive: true });
    todo = [...steps.reuse, ...steps.fetch];
  }
  const fromServer = new Set(steps.fetch);
  /* un fichier relu sur le téléphone qui n'a pas son empreinte (03/11/2026 : Capacitor modifie ce qu'il sert) : repris du serveur */
  const get = async (p, server) => {
    const r = await io.fetch(server ? `${io.api}/app-bundle/${v}/${encodePath(p)}` : encodePath(p), server ? { credentials: 'omit' } : { cache: 'no-store' });
    if(!r.ok) throw new Error(`${p} : réponse ${r.status}`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    if(await sha256(bytes) !== remote.files[p]) throw new Error(`${p} : empreinte différente`);
    return bytes;
  };
  const one = async p => {
    let bytes;
    if(fromServer.has(p)) bytes = await get(p, true);
    else { try { bytes = await get(p, false); } catch(e){ bytes = await get(p, true); } }
    await io.fs.writeFile({ directory: DIR, path: `${base}/${p}`, data: toBase64(bytes), recursive: true });
  };
  for(let i = 0; i < todo.length; i += PARALLEL) await Promise.all(todo.slice(i, i + PARALLEL).map(one));
  await io.fs.writeFile({ directory: DIR, path: `${base}/${MANIFEST}`, encoding: 'utf8', recursive: true,
    data: JSON.stringify({ version: v, minNative: remote.minNative, files: remote.files }) });
  return true;
}

async function complete(io, v){
  try { await io.fs.stat({ directory: DIR, path: `${dirOf(v)}/${MANIFEST}` }); return true; } catch(e){ return false; }
}

/* bascule : la page se recharge dans la version v (en essai, voir guardStart) */
export async function apply(io, v){
  writeState(io.store, { ...readState(io.store), trying: { v, at: io.now() } });
  await io.webview.setServerBasePath({ path: await bundleDir(io, v) });
}

/* ---- écrans ---- */
function screens(doc, io){
  let el = null;
  const box = (html, block) => {
    el ??= doc.body.appendChild(Object.assign(doc.createElement('div'), { id: 'appUpdate' }));
    el.innerHTML = html; el.hidden = false; el.classList.toggle('block', !!block);
    return el;
  };
  return {
    updating(){ box('<p>Mise à jour du jeu…</p>'); },
    hide(){ if(el) el.hidden = true; },
    tooOld(){
      const url = storeUrl(io.platform), where = io.platform === 'ios' ? 'l\'App Store (ou TestFlight)' : 'le Play Store';
      const b = box(`<p>Une nouvelle version de l'appli est nécessaire pour continuer à jouer.</p><p>Mets-la à jour sur ${where}.</p>` +
        (url ? '<button type="button">Mettre à jour</button>' : ''), true);
      b.querySelector('button')?.addEventListener('click', () => io.launcher?.openUrl({ url }).catch(console.warn));
    },
  };
}

/* une vérification complète ; rend 'continue' (le jeu démarre ou reprend), 'applying' (la page va se recharger), 'tooOld' */
export async function check(io, ui, { limits = APP_UPDATE } = {}){
  const cur = await currentManifest(io), current = cur?.version ?? null;
  const native = await nativeVersion(io);
  let state = readState(io.store);
  if(state.ready && state.ready.v !== current && !state.bad.includes(state.ready.v) && await complete(io, state.ready.v)){
    await apply(io, state.ready.v);
    return 'applying';
  }
  if(io.downloading) return 'continue';                 // un téléchargement d'avant est encore en cours
  let remote = null;
  try {
    const r = await within(io.fetch(`${io.api}/api/app/update?have=${encodeURIComponent(current ?? '')}`, { cache: 'no-store', credentials: 'omit' }), limits.checkTimeout * 1000);
    if(r.ok) remote = await r.json();
  } catch(e){ /* pas de réseau, serveur qui redémarre : on joue avec la version qui tourne */ }
  const what = decide({ current, remote, native, bad: state.bad });
  if(what === 'tooOld'){ ui.tooOld(); return 'tooOld'; }
  if(what !== 'update') return 'continue';
  await cleanup(io, state);
  ui.updating();
  io.downloading = build(io, cur, remote).then(() => {
    writeState(io.store, { ...readState(io.store), ready: { v: remote.version } });
    return true;
  }, e => { console.warn('mise à jour du jeu :', e); return false; }).finally(() => { io.downloading = null; });
  const done = await Promise.race([io.downloading, sleep(limits.applyWithin * 1000).then(() => null)]);
  if(done){ await apply(io, remote.version); return 'applying'; }
  ui.hide();
  return 'continue';
}

/* src/app/boot.js : la promesse rendue se résout quand le jeu peut démarrer (jamais si la page bascule ou si la coque est trop ancienne) */
export async function startUpdater({ doc, win, io = ioOf(win), guard = win.dimUpdateGuard, limits = APP_UPDATE, ui = io && screens(doc, io) }){
  if(!io) return;
  const g = await (guard ?? guardStart(io)).catch(() => null);
  /* au retour au premier plan après un moment : même vérification (le joueur vient de revenir, il ne joue pas encore) */
  let pausedAt = null;
  io.app.addListener('pause', () => { pausedAt = io.now(); });
  io.app.addListener('resume', () => {
    if(pausedAt === null || io.now() - pausedAt < limits.resumeAfter * 1000 || readState(io.store).trying) return;
    pausedAt = null;
    check(io, ui, { limits }).then(w => w === 'applying' && notReloaded(io, ui, limits)).catch(console.warn);
  });
  if(g?.trial) return;                                   // version en essai : on la laisse démarrer
  const what = await check(io, ui, { limits }).catch(e => { console.warn(e); return 'continue'; });
  if(what === 'tooOld') await new Promise(() => {});     // le joueur doit mettre l'appli à jour
  if(what === 'applying') await notReloaded(io, ui, limits);
}

/* la page devait se recharger dans la nouvelle version : toujours là au bout de applyWait s (dossier introuvable pour Capacitor),
   la version est refusée et le jeu démarre comme avant */
export async function notReloaded(io, ui, limits = APP_UPDATE){
  await sleep(limits.applyWait * 1000);
  writeState(io.store, failTrial(readState(io.store)));
  ui.hide();
}
