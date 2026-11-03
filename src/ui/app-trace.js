/* Relevé des mises à jour de l'appli (03/11/2026, compte de l'équipe) : page HTML d'après GET /api/app/update/trace.
   Pur (testé) : renvoie le texte de la page. */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const when = ms => new Date(ms).toLocaleString('fr-FR');

export function renderAppTrace(t){
  const checks = (t.checks || []).map(c => `<tr><td>${when(c.at)}</td><td><code>${esc(c.have || '(vide)')}</code></td><td>${esc(c.answer)}</td><td>${esc(c.origin)}</td><td class="ua">${esc(c.ua)}</td></tr>`).join('')
    || '<tr><td colspan="5">Aucune demande depuis le démarrage du serveur.</td></tr>';
  const files = Object.entries(t.files || {}).map(([v, f]) => `<tr><td><code>${esc(v)}</code></td><td>${f.ok}</td><td>${f.missing}</td><td>${f.last ? when(f.last) : '—'}</td></tr>`).join('')
    || '<tr><td colspan="4">Aucun fichier téléchargé.</td></tr>';
  const rb = (t.rollbacks || []).map(r => `<tr><td>${when(r.at)}</td><td><code>${esc(r.from)}</code> → <code>${esc(r.to)}</code></td><td>${esc(r.why)}</td><td>${esc(r.platform)} · coque ${esc(r.native)}</td></tr>`).join('')
    || '<tr><td colspan="4">Aucun.</td></tr>';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mises à jour de l'appli</title>
<style>body{font:14px/1.4 system-ui,sans-serif;margin:16px;background:#191310;color:#eee}table{border-collapse:collapse;width:100%;margin:8px 0 20px}
td,th{border:1px solid #444;padding:4px 6px;text-align:left;vertical-align:top}th{background:#2a201a}code{color:#ffd27a}.ua{font-size:11px;color:#aaa}</style></head><body>
<h2>Mises à jour de l'appli</h2>
<p>Version publiée par le serveur : <code>${esc(t.version)}</code> (${t.files ?? '?'} fichiers) · coque minimale ${esc(t.minNative)} · relevé depuis le ${t.since ? when(t.since) : '—'} (remis à zéro à chaque redémarrage du serveur)</p>
<h3>Demandes de version (les plus récentes d'abord)</h3>
<p>« Version de l'appli » = celle que le téléphone annonce. Si elle est égale à la version publiée, il est à jour.</p>
<table><tr><th>Quand</th><th>Version de l'appli</th><th>Réponse</th><th>Origine</th><th>Appareil</th></tr>${checks}</table>
<h3>Fichiers téléchargés, par version</h3>
<table><tr><th>Version</th><th>Servis</th><th>Introuvables</th><th>Dernier</th></tr>${files}</table>
<h3>Retours en arrière signalés</h3>
<table><tr><th>Quand</th><th>Version</th><th>Raison</th><th>Téléphone</th></tr>${rb}</table>
</body></html>`;
}
