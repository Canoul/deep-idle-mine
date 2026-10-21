/* Démarrage raté : affiche l'erreur sur la page, pour qu'un joueur puisse l'envoyer en capture d'écran.
   Script classique (pas un module), chargé AVANT src/main.js : il tourne même si un fichier du jeu ne se charge pas
   (bloqueur de pubs, extension, coupure pendant un redémarrage du serveur) ou si le jeu plante au démarrage.
   Si un fichier manque, il relit les imports depuis src/main.js et dit lequel ne répond pas.
   Logique pure exposée pour les tests : DIM_BOOT.specifiers(source), DIM_BOOT.findMissing(entry, fetchText). */
(function(){
  const IMPORT = /\b(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]/g;

  /* chemins importés par un fichier (imports et ré-exports statiques) */
  function specifiers(source){
    const out = [];
    for(const m of source.matchAll(IMPORT)) out.push(m[1] ?? m[2]);
    return out;
  }

  /* parcourt les imports depuis entry ; fetchText(url) rend le texte ou lève une erreur. Rend les fichiers en échec. */
  async function findMissing(entry, fetchText){
    const seen = new Set([entry]), todo = [entry], missing = [];
    while(todo.length){
      const url = todo.shift();
      let text;
      try { text = await fetchText(url); }
      catch(e){ missing.push({ url, why: e.message }); continue; }
      for(const s of specifiers(text)){
        const next = new URL(s, url).href;
        if(!seen.has(next)){ seen.add(next); todo.push(next); }
      }
    }
    return missing;
  }

  const api = { specifiers, findMissing };
  globalThis.DIM_BOOT = api;
  if(typeof document === 'undefined') return;   // tests (Node) : pas de page

  let box = null;
  function show(title, lines){
    if(!box){
      box = document.createElement('div');
      box.id = 'bootError';
      box.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:9999;max-width:min(640px,calc(100% - 32px));'+
        'background:#2a1513;color:#eadfd3;border:1px solid #e5534b;border-radius:10px;padding:14px 18px;font:13px/1.45 system-ui,sans-serif';
      document.body.appendChild(box);
    }
    box.replaceChildren();   // le dernier message remplace le précédent (« Recherche… » → le fichier en cause)
    const p = (t, css) => { const el = document.createElement('p'); el.style.cssText = 'margin:4px 0;' + (css ?? ''); el.textContent = t; box.appendChild(el); };
    p('⚠ ' + title, 'font-weight:600;color:#ffb84d');
    for(const l of lines) p(l, 'font-family:ui-monospace,Consolas,monospace;font-size:12px;word-break:break-all');
    p('Fais une capture de ce cadre pour l\'équipe. Navigateur : ' + navigator.userAgent, 'color:#9a8b7d;font-size:11px;margin-top:8px');
  }
  const here = u => String(u ?? '').replace(location.origin, '');

  /* seulement pendant le démarrage : main.js met DIM_BOOT.started une fois le jeu lancé */
  addEventListener('error', e => {
    if(api.started) return;
    const t = e.target;
    if(t && t !== window && t.tagName !== 'SCRIPT') return;   // image (texture) manquante : le jeu démarre quand même
    if(t && t.tagName === 'SCRIPT'){                       // un fichier du jeu ne s'est pas chargé
      show('Le jeu n\'a pas pu charger tous ses fichiers.', ['Recherche du fichier en cause…']);
      const fetchText = async url => {
        const r = await fetch(url, { cache: 'no-store' });
        if(!r.ok) throw new Error('réponse ' + r.status);
        return r.text();
      };
      findMissing(new URL(t.src, location.href).href, fetchText).then(miss => {
        show(miss.length ? 'Fichier(s) bloqué(s) ou introuvable(s) :' : 'Tous les fichiers répondent : recharge la page (Ctrl+F5).',
             miss.map(m => here(m.url) + ' (' + m.why + ')'));
      });
      return;
    }
    show('Le jeu a planté au démarrage.', [e.message + (e.filename ? ' — ' + here(e.filename) + ':' + e.lineno + ':' + e.colno : '')]);
  }, true);
  addEventListener('unhandledrejection', e => {
    if(api.started) return;
    const r = e.reason;
    show('Le jeu a planté au démarrage.',[String(r && r.stack ? r.stack.split('\n').slice(0, 3).join(' ← ') : r)]);
  });
})();
