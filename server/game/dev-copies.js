/* Mode dev : copies de vrais joueurs pour les mineurs de test (29/10/2026). Chaque fichier .json du dossier (data/presets/,
   ignoré par git) est { pseudo: copie } (voir presetFromSnapshot, src/shared/dev-presets.js). Relu à chaque appel : un
   fichier ajouté compte sans redémarrer. Un fichier illisible est ignoré. */
import fs from 'node:fs';
import path from 'node:path';

export function readDevCopies(dir){
  const out = {};
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort(); } catch { return out; }
  for(const f of files){
    try {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      for(const [who, snap] of Object.entries(d ?? {})) if(snap && /^[\w-]{1,24}$/.test(who)) out[who] = snap;
    } catch { /* fichier abîmé : ignoré */ }
  }
  return out;
}
