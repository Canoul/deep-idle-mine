/* Mine instantanée : ce que le serveur envoie aux navigateurs (logique pure, partagée).
   La mine est petite (51 lignes de 50) : chaque envoi contient la carte entière (une ligne = une chaîne de chiffres
   en base 36, ~2,6 Ko) et ce qui est découvert (une ligne = 0 et 1), les tas de plumes restants, les mineurs et le
   journal. Pas de lumière (tout est éclairé), pas de mobs. Une case pas encore découverte part comme vide (0) avec
   seen 0 : le navigateur ne connaît jamais le contenu caché de la mine. Le navigateur affiche, il ne calcule rien. */

import { minerEffects, sessionBonuses } from '../sim/effects.js';
import { glide, pace } from './view.js';

const enc36 = v => v.toString(36);
/* échelles : liste des cases (y × w + x), peu nombreuses ; reconstruites en lignes côté navigateur (comme G.ladder) */
const ladderList = G => { const out = []; G.ladder.forEach((r, y) => r.forEach((v, x) => { if(v) out.push(y*G.w + x); })); return out; };
function ladderRows(v){
  const rows = Array.from({ length: v.h + 1 }, () => new Uint8Array(v.w));
  for(const k of v.ladders || []){ const x = k % v.w, y = (k - x) / v.w; if(rows[y]) rows[y][x] = 1; }
  return rows;
}

function minerView(G, m){
  const a = m.action, d = a?.data || {};
  return {
    id: m.id, name: m.name, color: m.color, account: m.account, x: m.x, y: m.y, face: m.face, status: m.status,
    inv: m.inv, stats: m.stats, look: m.look || {}, auras: m.auras || {},
    action: a ? { type: a.type, t: a.t, dur: a.dur, data: { x: d.x, y: d.y } } : null,
    effects: minerEffects(G, m), bonus: sessionBonuses(G, m),       // états (28/10, src/sim/effects.js) : Ruée, anneaux
  };
}

/* serveur : l'envoi au tick actuel (since ignoré : toujours la carte entière) */
export function createInstantViewer(G){
  return function view(){
    return {
      mode: 'mi', tick: G.ticks, t: G.t, over: G.over, w: G.w, h: G.h,
      tiles: G.tiles.map((r, y) => Array.from(r, (v, x) => G.seen[y][x] ? enc36(v) : '0').join('')),
      seen: G.seen.map(r => r.join('')),
      feathers: [...G.feathers].filter(([k]) => G.seen[Math.floor(k / G.w)][k % G.w]), heapsLeft: G.feathers.size, ladders: ladderList(G), miners: G.miners.map(m => minerView(G, m)), stats: G.stats, log: G.log.slice(0, 50),
    };
  };
}

/* position exacte d'un mineur au moment de l'envoi : un pas en cours compte pour sa part faite */
export function instantPos(m){
  const a = m.action;
  if(a?.type === 'move' && a.data && Number.isFinite(a.data.x)){
    const p = Math.min(1, a.dur > 0 ? a.t / a.dur : 1), x0 = m.x + (m.kx || 0), y0 = m.y + (m.ky || 0);
    return [x0 + (a.data.x - x0) * p, y0 + (a.data.y - y0) * p];
  }
  return [m.x + (m.kx || 0), m.y + (m.ky || 0)];
}

/* navigateur : une copie d'affichage de la partie, que le rendu lit comme une vraie.
   prev : la copie d'avant ; les mineurs glissent de leur position affichée vers la nouvelle, sur la durée réelle entre deux
   envois (29/10/2026 : avant, ils avançaient par petits bonds à chaque envoi) */
export function applyInstantView(v, prev = null, now = (globalThis.performance?.now() ?? 0)){
  const G = {
    mode: 'mi', ticks: v.tick, t: v.t, over: v.over, w: v.w, h: v.h,
    tiles: v.tiles.map(s => Uint8Array.from(s, c => parseInt(c, 36))),
    seen: (v.seen ?? v.tiles.map(s => '1'.repeat(s.length))).map(s => Uint8Array.from(s, c => c === '1' ? 1 : 0)),
    feathers: new Map(v.feathers), heapsLeft: v.heapsLeft ?? v.feathers.length, ladder: ladderRows(v), miners: v.miners, stats: v.stats, log: v.log,
  };
  if(prev?._at != null) glide(prev, prev.miners, G.miners, instantPos, now);
  return pace(G, prev, now);
}
