/* Instances : ce que le serveur envoie aux navigateurs (logique pure, partagée). La salle est petite (20 × 21 cases) :
   chaque envoi contient tout (cases en base 36, échelles, spawners, gobelins, roi, mineurs, journal). Le navigateur
   affiche, en faisant glisser chaque mineur, gobelin et le roi de sa position affichée vers la nouvelle. */
import { glide } from './view.js';

const enc36 = v => v.toString(36);
const ladderList = G => { const out = []; G.ladder.forEach((r, y) => r.forEach((v, x) => { if(v) out.push(y * G.w + x); })); return out; };

function minerView(m){
  const a = m.action, d = a?.data || {};
  return {
    id: m.id, name: m.name, color: m.color, account: m.account, x: m.x, y: m.y, kx: m.kx || 0, ky: m.ky || 0, face: m.face, status: m.status,
    stats: m.stats, look: m.look || {}, auras: m.auras || {}, skillTree: m.skillTree,
    action: a ? { type: a.type, t: a.t, dur: a.dur, data: { x: d.x, y: d.y } } : null,
    hop: m.hop ?? null, boosted: m.boosted ?? null,
  };
}
const minerPos = m => {
  const a = m.action, x0 = m.x + (m.kx || 0), y0 = m.y + (m.ky || 0);
  if(a?.type === 'move' && Number.isFinite(a.data?.x)){
    const p = Math.min(1, a.dur > 0 ? a.t / a.dur : 1);
    return [x0 + (a.data.x - x0) * p, y0 + (a.data.y - y0) * p];
  }
  return [x0, y0];
};

/* serveur : l'envoi au tick actuel */
export function createInstanceViewer(G){
  return function view(){
    const b = G.boss;
    return {
      mode: 'instance', instance: G.instance, tick: G.ticks, t: G.t, over: G.over, w: G.w, h: G.h, floorY: G.floorY,
      plat: G.plat, ledges: G.ledges,
      tiles: G.tiles.map(r => Array.from(r, enc36).join('')), ladders: ladderList(G),
      spawners: G.spawners.map(s => ({ id: s.id, x: s.x, y: s.y, hp: Math.ceil(s.hp), maxhp: s.maxhp, alive: s.alive, side: s.side, level: s.level })),
      goblins: G.goblins.filter(o => o.hp > 0).map(o => ({ id: o.id, x: o.x, y: o.y, kx: o.kx || 0, face: o.face || 1, hp: Math.ceil(o.hp), maxhp: o.maxhp,
                                                         grab: o.grab, stun: o.stunUntil != null && G.t < o.stunUntil })),
      boss: { name: b.name, hp: Math.ceil(b.hp), maxhp: b.maxhp, x: b.x, kx: b.kx || 0, y: b.y, w: b.w, h: b.h, state: b.state, focus: b.focus,
              rage: b.hp < b.maxhp * 0.33 },
      target: G.target, inspire: G.inspire && G.t < G.inspire.until ? Math.ceil(G.inspire.until - G.t) : 0,
      miners: G.miners.map(minerView), stats: G.stats, log: G.log.slice(0, 50),
    };
  };
}

/* navigateur : une copie d'affichage (prev : la précédente, pour le mouvement fluide ; now : heure de la page) */
export function applyInstanceView(v, prev = null, now = performance.now()){
  const ladder = Array.from({ length: v.h + 1 }, () => new Uint8Array(v.w));
  for(const k of v.ladders || []){ const x = k % v.w, y = (k - x) / v.w; if(ladder[y]) ladder[y][x] = 1; }
  const G = {
    mode: 'instance', instance: v.instance, ticks: v.tick, t: v.t, over: v.over, w: v.w, h: v.h, floorY: v.floorY,
    plat: v.plat, ledges: v.ledges || [],
    tiles: v.tiles.map(s => Uint8Array.from(s, c => parseInt(c, 36))), ladder,
    spawners: v.spawners || [], goblins: v.goblins || [], boss: v.boss, target: v.target, inspire: v.inspire || 0,
    miners: v.miners, stats: v.stats, log: v.log,
  };
  if(G.boss) G.boss.id = 'boss';
  if(prev?._at != null){
    glide(prev, prev.miners, G.miners, minerPos, now);
    glide(prev, prev.goblins, G.goblins, o => [o.x + (o.kx || 0), o.y], now);
    if(G.boss && prev.boss) glide(prev, [prev.boss], [G.boss], b => [b.x + (b.kx || 0), b.y], now);
    const was = new Map(prev.miners.map(m => [m.id, m]));
    for(const m of G.miners){ const p = was.get(m.id); m._hopAt = m.hop == null ? null : p?.hop === m.hop ? p._hopAt : now; }
  } else for(const m of G.miners) m._hopAt = m.hop == null ? null : now;
  G._dur = prev?._at == null ? 250 : Math.max(80, Math.min(1500, 0.7 * (prev._dur ?? 250) + 0.3 * (now - prev._at)));
  G._at = now;
  return G;
}
