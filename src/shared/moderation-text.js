/* Textes de la modération du chat montrés au joueur (30/10/2026), partagés navigateur / tests. */

/* « 31/10 à 14:05 » (heure locale du navigateur) */
export const banDateText = t => {
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} à ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/* fenêtre après un message averti : w = { warnings, max, banned, bannedUntil, motif } */
export function warningText(w){
  if(!w) return '';
  if(w.banned) return `⛔ Avertissement ${w.max}/${w.max} : ${w.motif}.\nTon message a été censuré et tu es banni du jeu jusqu'au ${banDateText(w.bannedUntil)}.`;
  return `⚠ Avertissement ${w.warnings}/${w.max} : ${w.motif}.\nTon message a été censuré. Au bout de ${w.max} avertissements, tu es banni du jeu pendant 24 h.`;
}

/* bandeau du joueur banni : s = { bannedUntil } (0 = pas banni → '') */
export const banBarText = s => s?.bannedUntil ? `⛔ Tu es banni du jeu jusqu'au ${banDateText(s.bannedUntil)} (langage interdit dans le chat). Tu peux encore regarder, mais plus jouer.` : '';
