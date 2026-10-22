/* Tours : ce que le serveur envoie aux navigateurs (logique pure, partagée). La tour est petite (~31 × 43 cases) :
   chaque envoi contient la carte entière (une ligne = une chaîne en base 36), ce qui est découvert (0/1), les
   échelles, le boss, les mineurs et le journal. Le navigateur affiche, il ne calcule rien. */

const enc36 = v => v.toString(36);
const ladderList = G => { const out = []; G.ladder.forEach((r, y) => r.forEach((v, x) => { if(v) out.push(y * G.w + x); })); return out; };

function minerView(m){
  const a = m.action, d = a?.data || {};
  return {
    id: m.id, name: m.name, color: m.color, account: m.account, x: m.x, y: m.y, face: m.face, status: m.status,
    stats: m.stats, look: m.look || {}, skillTree: m.skillTree,
    action: a ? { type: a.type, t: a.t, dur: a.dur, data: { x: d.x, y: d.y } } : null,
  };
}

/* serveur : l'envoi au tick actuel (toujours la carte entière) */
export function createTowerViewer(G){
  return function view(){
    return {
      mode: 'tower', side: G.side, tick: G.ticks, t: G.t, over: G.over, w: G.w, h: G.h,
      x0: G.x0, x1: G.x1, roof: G.roof, floor: G.floor, bx: G.bx, by: G.by,
      tiles: G.tiles.map(r => Array.from(r, enc36).join('')), ladders: ladderList(G),
      seen: G.seen.map(r => r.join('')),
      boss: { name: G.boss.name, hp: Math.ceil(G.boss.hp), maxhp: G.boss.maxhp, target: G.boss.target },
      miners: G.miners.map(minerView), stats: G.stats, log: G.log.slice(0, 50),
    };
  };
}

/* navigateur : une copie d'affichage de la partie */
export function applyTowerView(v){
  const ladder = Array.from({ length: v.h + 1 }, () => new Uint8Array(v.w));
  for(const k of v.ladders || []){ const x = k % v.w, y = (k - x) / v.w; if(ladder[y]) ladder[y][x] = 1; }
  return {
    mode: 'tower', side: v.side, ticks: v.tick, t: v.t, over: v.over, w: v.w, h: v.h,
    x0: v.x0, x1: v.x1, roof: v.roof, floor: v.floor, bx: v.bx, by: v.by,
    tiles: v.tiles.map(s => Uint8Array.from(s, c => parseInt(c, 36))), ladder,
    seen: (v.seen || []).map(s => Uint8Array.from(s, c => +c)),
    boss: v.boss, miners: v.miners, stats: v.stats, log: v.log,
  };
}
