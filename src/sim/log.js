/* Journal de la session (lu par l'UI ; la simulation ne touche jamais au DOM). */
export const LOG_MAX = 40;

export function log(G,msg){
  G.log.unshift({t:G.t, msg});
  if(G.log.length>LOG_MAX) G.log.pop();
}
