/* Mine instantanée : ce que le serveur envoie aux navigateurs (logique pure, partagée).
   La mine est petite (51 lignes de 50) : chaque envoi contient la carte entière (une ligne = une chaîne de chiffres
   en base 36, ~2,6 Ko), les tas de plumes restants, les mineurs et le journal. Pas de lumière (tout est éclairé),
   pas de mobs. Le navigateur affiche, il ne calcule rien. */

const enc36 = v => v.toString(36);

function minerView(m){
  const a = m.action, d = a?.data || {};
  return {
    id: m.id, name: m.name, color: m.color, account: m.account, x: m.x, y: m.y, face: m.face, status: m.status,
    inv: m.inv, stats: m.stats, look: m.look || {},
    action: a ? { type: a.type, t: a.t, dur: a.dur, data: { x: d.x, y: d.y } } : null,
  };
}

/* serveur : l'envoi au tick actuel (since ignoré : toujours la carte entière) */
export function createInstantViewer(G){
  return function view(){
    return {
      mode: 'mi', tick: G.ticks, t: G.t, over: G.over, w: G.w, h: G.h,
      tiles: G.tiles.map(r => Array.from(r, enc36).join('')),
      feathers: [...G.feathers], miners: G.miners.map(minerView), stats: G.stats, log: G.log.slice(0, 50),
    };
  };
}

/* navigateur : une copie d'affichage de la partie, que le rendu lit comme une vraie */
export function applyInstantView(v){
  return {
    mode: 'mi', ticks: v.tick, t: v.t, over: v.over, w: v.w, h: v.h,
    tiles: v.tiles.map(s => Uint8Array.from(s, c => parseInt(c, 36))),
    feathers: new Map(v.feathers), miners: v.miners, stats: v.stats, log: v.log,
  };
}
