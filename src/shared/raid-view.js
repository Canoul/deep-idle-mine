/* Raid Cerbère : ce que le serveur envoie aux navigateurs (logique pure, partagée ; 04/11/2026).
   - phases 'mine' et 'door' : l'envoi normal de la mine (src/shared/view.js) de G.mine, que le rendu de la mine sait
     dessiner, avec mode 'raid', phase et l'en-tête raid ;
   - phase 'boss' : l'arène, petite (RAID.cerbere.w × h) : chaque envoi contient tout, comme le Golbute
     (src/shared/instances-view.js), avec le même en-tête raid.
   En-tête raid : { phase, tick, t, left (blocs de terrain restants), total, timeLeft (s), doorLeft (s, porte : 'door') }. */
import { createViewer, emptyView, applyView, glide, playCopy, playTrack } from './view.js';
import { RAID, DT } from '../config.js';
import { warcryOf, bitten } from '../sim/raid/cerbere.js';
import { minerEffects } from '../sim/effects.js';

const enc36 = v => v.toString(36);
const LOG = 20;                                    // lignes du journal de l'arène envoyées
const ago = (B, tick) => tick == null ? null : Math.round((B.ticks - tick) * DT * 10) / 10;

export function raidHeader(G){
  return { phase: G.phase, tick: G.ticks, t: G.t, left: G.left, total: G.total,
           timeLeft: Math.max(0, Math.ceil(RAID.duration - G.t - 1e-9)),
           doorLeft: G.phase === 'door' ? Math.max(0, Math.ceil(G.doorAt + RAID.mine.gather - G.t - 1e-9)) : null };
}

function arenaMiner(B, m){
  const a = m.action;
  return {
    id: m.id, name: m.name, color: m.color, account: m.account, x: m.x, y: m.y, kx: m.kx || 0, ky: m.ky || 0, face: m.face,
    status: m.status, look: m.look || {}, auras: m.auras || {}, skillTree: m.skillTree,
    action: a ? { type: a.type, t: a.t, dur: a.dur, data: { x: a.data?.x, y: a.data?.y, ally: a.data?.ally } } : null,
    hop: m.hop ?? null, dead: !!m.dead, knocked: !!m.knocked,
    stone: m.stone ? { hp: Math.ceil(m.stone.hp), max: m.stone.max } : null,
    bitten: bitten(B, m) ? Math.max(0, Math.round((m.bitUntil - B.t) * 10) / 10) : 0,   // secondes de Morsure restantes
    spells: m.spells || [], spellCd: { ...(m.spellCd || {}) },
    effects: minerEffects(B, m, { foes: [], warcry: warcryOf(B, m) }),
    stats: m.stats,
  };
}

function arenaView(G){
  const B = G.boss, b = B.boss;
  return {
    mode: 'raid', phase: 'boss', tick: G.ticks, t: G.t, over: G.over, w: B.w, h: B.h, floorY: B.floorY,
    tiles: B.tiles.map(r => Array.from(r, enc36).join('')),
    boss: { name: b.name, hp: Math.ceil(b.hp), maxhp: b.maxhp, x: b.x, y: b.y, w: b.w, h: b.h, rage: b.rage,
            biteAgo: ago(B, b.biteAt), sweepAgo: ago(B, b.sweepAt), magmaAgo: ago(B, b.magmaAt), targets: [...b.targets] },
    next: { bite: Math.max(0, Math.ceil(B.next.bite - B.t)), sweep: Math.max(0, Math.ceil(B.next.sweep - B.t)), magma: Math.max(0, Math.ceil(B.next.magma - B.t)) },
    miners: B.miners.map(m => arenaMiner(B, m)), stats: B.stats, log: B.log.slice(0, LOG),
    raid: raidHeader(G),
  };
}

/* serveur : l'envoi pour un navigateur qui a déjà la partie au tick since (mine : seulement les cases changées) */
export function createRaidViewer(G){
  const mine = createViewer(G.mine);
  return function view(since){
    if(G.phase === 'boss' && G.boss) return arenaView(G);
    /* over : celui du raid (temps écoulé pendant le minage : la mine, elle, ne finit pas ; 04/11, vu au navigateur) */
    return { ...mine(since), mode: 'raid', phase: G.phase, over: G.over, raid: raidHeader(G) };
  };
}

/* navigateur : une copie d'affichage. Mine (phases 'mine' / 'door') : la copie de la mine (applyView), gardée d'un envoi à
   l'autre ; arène : une copie neuve à chaque envoi, comme une instance (prev : la précédente, pour le mouvement fluide). */
export function applyRaidView(v, prev = null, now = performance.now(), speed = 0){
  if(v.phase !== 'boss'){
    const M = prev && prev.phase !== 'boss' && prev.mode === 'raid' ? prev : emptyView();
    applyView(M, v, now, speed);
    return Object.assign(M, { mode: 'raid', phase: v.phase, raid: v.raid });
  }
  const was = prev?.phase === 'boss' ? prev : null;
  const G = { mode: 'raid', phase: 'boss', ticks: v.tick, t: v.t, over: v.over, w: v.w, h: v.h, floorY: v.floorY,
              tiles: v.tiles.map(s => Uint8Array.from(s, c => parseInt(c, 36))), boss: { ...v.boss, id: 'boss' }, next: v.next,
              miners: v.miners, stats: v.stats, log: v.log, raid: v.raid };
  const pos = m => [m.x + (m.kx || 0), m.y + (m.ky || 0)];
  if(speed > 0){ playCopy(G, was, v.tick, speed, now); playTrack(was?.miners ?? [], G.miners, pos, v.tick); }
  else if(was?._at != null) glide(was, was.miners, G.miners, pos, now);
  G._dur = was?._at == null ? 250 : Math.max(80, Math.min(1500, 0.7 * (was._dur ?? 250) + 0.3 * (now - was._at)));
  G._at = now;
  return G;
}
