/* Journal de la session (lu par l'UI ; la simulation ne touche jamais au DOM). */
/* lignes gardées : tout le journal d'une session se relit en faisant défiler (≈ 150 à 250 lignes par session à 3) */
export const LOG_MAX = 400;

export function log(G,msg){
  G.log.unshift({t:G.t, msg});
  if(G.log.length>LOG_MAX) G.log.pop();
}
