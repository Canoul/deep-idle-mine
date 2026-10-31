/* Instances : ce que le serveur envoie aux navigateurs (logique pure, partagée). La salle est petite (20 × 21 cases) :
   chaque envoi contient tout (cases en base 36, échelles, spawners, gobelins, roi, mineurs, journal). Le navigateur
   affiche, en faisant glisser chaque mineur, gobelin et le roi de sa position affichée vers la nouvelle. */
import { glide, playCopy, playTrack } from './view.js';
import { INSTANCE } from '../config.js';
import { warcryOf } from '../sim/instance/session.js';
import { warcryOf as golWarcry, golTackler } from '../sim/instance/golbute.js';
import { minerEffects, sessionBonuses } from '../sim/effects.js';

const enc36 = v => v.toString(36);
const ladderList = G => { const out = []; G.ladder.forEach((r, y) => r.forEach((v, x) => { if(v) out.push(y * G.w + x); })); return out; };

function minerView(G, m){
  const a = m.action, d = a?.data || {}, gol = G.instance === 'instance_2';
  return {
    id: m.id, name: m.name, color: m.color, account: m.account, x: m.x, y: m.y, kx: m.kx || 0, ky: m.ky || 0, face: m.face, status: m.status,
    stats: m.stats, look: m.look || {}, auras: m.auras || {}, skillTree: m.skillTree,
    action: a ? { type: a.type, t: a.t, dur: a.dur, data: { x: d.x, y: d.y } } : null,
    hop: m.hop ?? null, boosted: m.boosted ?? null,
    spells: m.spells || [], spellCd: { ...(m.spellCd || {}) },       // sorts (animation au lancement)
    effects: minerEffects(G, m, gol ? { foes: G.golems.filter(o => golTackler(G, m) === o), warcry: golWarcry(G, m) } : { foes: G.goblins, warcry: warcryOf(G, m) }),   // états (28/10, src/sim/effects.js)
    ...(gol ? { dead: !!m.dead, dazed: m.dazed && G.t <= m.dazedUntil ? m.dazed : 0 } : {}),
    bonus: sessionBonuses(G, m),
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

/* Instance II, le Golbute (30/10/2026) : arène, boss (état, cristal, rage, dernier coup au sol), golems, rochers de
   l'avalanche, prochaines avalanche et Division */
function golbuteView(G){
  const b = G.boss;
  return {
    mode: 'instance', instance: G.instance, level: 1, tick: G.ticks, t: G.t, over: G.over, w: G.w, h: G.h, floorY: G.floorY,
    plat: null, ledges: [], tiles: G.tiles.map(r => Array.from(r, enc36).join('')), ladders: [], spawners: [], goblins: [],
    golems: G.golems.filter(o => o.hp > 0).map(o => ({ id: o.id, x: o.x, y: o.y, kx: 0, face: o.face || 1, hp: Math.ceil(o.hp), maxhp: o.maxhp,
                                                    grab: o.grab, stun: o.stunUntil != null && G.t < o.stunUntil, taunt: o.taunt != null })),
    boss: { name: b.name, hp: Math.ceil(b.hp), maxhp: b.maxhp, x: b.x, kx: 0, y: b.y, w: b.w, h: b.h, state: b.state, phase: b.phase, rage: b.rage,
            crystal: b.crystal ? { hp: Math.ceil(b.crystal.hp), max: b.crystal.max } : null, slamAt: b.slamAt, focus: null, taunt: false,
            at: INSTANCE.golbute.crystal.at },
    rocks: G.rocks.filter(r => G.ticks - r.at < 15),
    next: { avalanche: Number.isFinite(G.next.avalanche) ? Math.max(0, Math.ceil(G.next.avalanche - G.t)) : null,
            split: Number.isFinite(G.next.split) ? Math.max(0, Math.ceil(G.next.split - G.t)) : null },
    target: null, inspire: G.inspire && G.t < G.inspire.until ? Math.ceil(G.inspire.until - G.t) : 0,
    miners: G.miners.map(m => minerView(G, m)), stats: G.stats, log: G.log.slice(0, 50),
  };
}

/* serveur : l'envoi au tick actuel */
export function createInstanceViewer(G){
  if(G.instance === 'instance_2') return () => golbuteView(G);
  return function view(){
    const b = G.boss;
    return {
      mode: 'instance', instance: G.instance, level: G.level ?? 1, tick: G.ticks, t: G.t, over: G.over, w: G.w, h: G.h, floorY: G.floorY,
      plat: G.plat, ledges: G.ledges,
      tiles: G.tiles.map(r => Array.from(r, enc36).join('')), ladders: ladderList(G),
      spawners: G.spawners.map(s => ({ id: s.id, x: s.x, y: s.y, hp: Math.ceil(s.hp), maxhp: s.maxhp, alive: s.alive, side: s.side, level: s.level })),
      goblins: G.goblins.filter(o => o.hp > 0).map(o => ({ id: o.id, x: o.x, y: o.y, kx: o.kx || 0, face: o.face || 1, hp: Math.ceil(o.hp), maxhp: o.maxhp,
                                                         grab: o.grab, stun: o.stunUntil != null && G.t < o.stunUntil, taunt: o.taunt != null })),
      boss: { name: b.name, hp: Math.ceil(b.hp), maxhp: b.maxhp, x: b.x, kx: b.kx || 0, y: b.y, w: b.w, h: b.h, state: b.state, focus: b.focus,
              rage: b.hp > 0 && b.hp < b.maxhp * (G.cfg?.boss ?? INSTANCE.boss).rageBelow,   // seuil du niveau (29/10)
              taunt: b.taunt != null },
      target: G.target, inspire: G.inspire && G.t < G.inspire.until ? Math.ceil(G.inspire.until - G.t) : 0,
      miners: G.miners.map(m => minerView(G, m)), stats: G.stats, log: G.log.slice(0, 50),
    };
  };
}

/* navigateur : une copie d'affichage (prev : la précédente, pour le mouvement fluide ; now : heure de la page) */
export function applyInstanceView(v, prev = null, now = performance.now(), speed = 0){
  const ladder = Array.from({ length: v.h + 1 }, () => new Uint8Array(v.w));
  for(const k of v.ladders || []){ const x = k % v.w, y = (k - x) / v.w; if(ladder[y]) ladder[y][x] = 1; }
  const G = {
    mode: 'instance', instance: v.instance, level: v.level ?? 1, ticks: v.tick, t: v.t, over: v.over, w: v.w, h: v.h, floorY: v.floorY,
    plat: v.plat, ledges: v.ledges || [],
    tiles: v.tiles.map(s => Uint8Array.from(s, c => parseInt(c, 36))), ladder,
    spawners: v.spawners || [], goblins: v.goblins || [], boss: v.boss, target: v.target, inspire: v.inspire || 0,
    golems: v.golems || [], rocks: v.rocks || [], next: v.next || null,   // Instance II (30/10)
    miners: v.miners, stats: v.stats, log: v.log,
  };
  if(G.boss) G.boss.id = 'boss';
  if(speed > 0){                                      // lecture en différé (src/shared/view.js)
    playCopy(G, prev, v.tick, speed, now);
    playTrack(prev?.miners ?? [], G.miners, minerPos, v.tick);
    playTrack(prev?.goblins ?? [], G.goblins, o => [o.x + (o.kx || 0), o.y], v.tick);
    playTrack(prev?.golems ?? [], G.golems, o => [o.x, o.y], v.tick);
    if(G.boss) playTrack(prev?.boss ? [prev.boss] : [], [G.boss], b => [b.x + (b.kx || 0), b.y], v.tick);
  }
  if(prev?._at != null){
    if(!(speed > 0)){
      glide(prev, prev.miners, G.miners, minerPos, now);
      glide(prev, prev.goblins, G.goblins, o => [o.x + (o.kx || 0), o.y], now);
      glide(prev, prev.golems || [], G.golems, o => [o.x, o.y], now);
      if(G.boss && prev.boss) glide(prev, [prev.boss], [G.boss], b => [b.x + (b.kx || 0), b.y], now);
    }
    const was = new Map(prev.miners.map(m => [m.id, m]));
    for(const m of G.miners){ const p = was.get(m.id); m._hopAt = m.hop == null ? null : p?.hop === m.hop ? p._hopAt : now; }
  } else for(const m of G.miners) m._hopAt = m.hop == null ? null : now;
  G._dur = prev?._at == null ? 250 : Math.max(80, Math.min(1500, 0.7 * (prev._dur ?? 250) + 0.3 * (now - prev._at)));
  G._at = now;
  return G;
}
