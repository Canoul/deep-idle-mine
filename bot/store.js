/* Base du bot : un fichier JSON, écrit par un fichier temporaire puis renommé (une coupure ne laisse jamais un fichier à
   moitié écrit). Fichier absent = base vide ; fichier illisible = erreur au démarrage, pour ne jamais effacer des sujets. */
import fs from 'node:fs';

export function loadState(file){
  if(!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function saveState(file, state){
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 1));
  fs.renameSync(tmp, file);
}
