/* Vers de terre (MOBS.ver, 31/10/2026, Geoffrey) : il traverse les blocs sans les casser, en une file de MOBS.ver.len cases
   (w.x, w.y = sa tête, w.trail = son corps). Toutes les chargeEvery s, il charge le mineur le plus proche à reach cases
   au plus, le traverse, va un peu plus loin, puis tourne sur lui-même en attendant la charge suivante. Un mineur traversé
   est étourdi et prend un stack de bleed (la Ténacité tire chacun à part).
   Inciblable tant qu'il navigue : rangé dans G.worms, hors de G.mobs, aucun coup, sort ni skill ne le voit. À la fin d'une
   charge, il a stuckChance de se coincer : il passe dans G.mobs pour stuckFor s, sur un bloc qui touche le vide (seule sa
   queue dépasse), frappable comme un mob normal, puis il replonge avec ses PV. Logique pure, sans DOM. */
import { W, DT, MOBS, BLOCKS, BARRIER } from '../config.js';
import { maxRow, isAir, tileAt } from './world.js';
import { dungeonAt } from './dungeon.js';
import { log } from './log.js';
import { addBleed } from './bleed.js';

const C = MOBS.ver, DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/* case où il peut passer : dans la mine, ni donjon, ni barrière, ni bloc incassable */
const passable = (G, x, y) => x >= 0 && x < W && y >= 1 && y <= maxRow(G) && !dungeonAt(G, x, y)
  && tileAt(G, x, y) !== BARRIER && !BLOCKS[tileAt(G, x, y)]?.unbreakable;
const inRock = (G, x, y) => passable(G, x, y) && !isAir(G, x, y);

/* naissance : une case de roche à distance d'apparition du mineur m, au hasard « live » (G.rng), ou null */
export function wormSpot(G, m){
  const out = [];
  for(let y = Math.max(1, m.y - MOBS.spawnMax); y <= Math.min(maxRow(G), m.y + MOBS.spawnMax); y++)
    for(let x = 0; x < W; x++){
      const d = Math.abs(x - m.x) + Math.abs(y - m.y);
      if(d >= MOBS.spawnMin && d <= MOBS.spawnMax && inRock(G, x, y)) out.push({ x, y });
    }
  return out.length ? out[Math.floor(G.rng() * out.length)] : null;
}
export function addWorm(G, id, x, y, hp){
  (G.worms ??= []).push({ id, type: 'ver', x, y, hp, maxhp: hp, trail: [], cd: C.chargeEvery, dir: 0, step: C.roamStep, turn: 0, charge: null });
}

/* la tête avance d'une case, le corps suit */
function advance(w, x, y){
  w.trail.unshift([w.x, w.y]);
  if(w.trail.length > C.len - 1) w.trail.pop();
  w.x = x; w.y = y;
}
/* mineur le plus proche à max cases au plus, sous terre, ou null */
function nearest(G, w, max){
  let best = null, bd = max + 1;
  for(const m of G.miners) if(m.y > 0){ const d = manhattan(w, m); if(d < bd){ bd = d; best = m; } }
  return best;
}

/* il tourne sur lui-même : un quart de tour toutes les turnEvery cases, un autre si le passage est fermé */
function roam(G, w){
  w.step -= DT;
  if(w.step > 1e-9) return;
  w.step += C.roamStep;
  if(++w.turn >= C.turnEvery){ w.turn = 0; w.dir = (w.dir + 1) % 4; }
  for(let i = 0; i < 4; i++){
    const [dx, dy] = DIRS[w.dir];
    if(passable(G, w.x + dx, w.y + dy)){ advance(w, w.x + dx, w.y + dy); return; }
    w.dir = (w.dir + 1) % 4;
  }
}

/* mineurs touchés par la tête : stun et bleed tirés à part contre la Ténacité, une fois par charge */
function hitMiners(G, w, resists){
  for(const m of G.miners){
    if(m.y <= 0 || manhattan(w, m) > C.hitDist || w.charge.hit.includes(m.id)) continue;
    w.charge.hit.push(m.id);
    if(resists(G, m)) log(G, `💪 ${m.name} résiste à la charge du vers de terre`);
    else { m.wormUntil = G.t + C.stun; log(G, `🪱 Le vers de terre traverse ${m.name} (étourdi ${C.stun} s)`); }
    if(!resists(G, m)) addBleed(G, m);
  }
}

/* un pas de charge : vers le mineur visé, puis overshoot cases tout droit après l'avoir atteint. true : charge finie */
function chargeStep(G, w, resists){
  const c = w.charge, t = G.miners.find(m => m.id === c.target);
  if(!c.past && (!t || t.y <= 0 || manhattan(w, t) === 0 || --c.fuel <= 0)) c.past = C.overshoot;
  if(!c.past){
    const dx = t.x - w.x, dy = t.y - w.y;
    w.dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
  }
  const [dx, dy] = DIRS[w.dir];
  if(!passable(G, w.x + dx, w.y + dy)) return true;
  advance(w, w.x + dx, w.y + dy);
  hitMiners(G, w, resists);
  return c.past > 0 && --c.past <= 0;
}

/* où sa queue dépasse : un bloc qui touche le vide, le plus récent de son corps, sinon le plus proche de sa tête */
function stuckSpot(G, w){
  const touches = (x, y) => inRock(G, x, y) && DIRS.some(([dx, dy]) => isAir(G, x + dx, y + dy) && y + dy > 0);
  for(const [x, y] of [[w.x, w.y], ...w.trail]) if(touches(x, y)) return { x, y };
  for(let r = 1; r <= C.stuckScan; r++)
    for(let dy = -r; dy <= r; dy++){
      const left = r - Math.abs(dy);
      for(const dx of left ? [-left, left] : [0]) if(touches(w.x + dx, w.y + dy)) return { x: w.x + dx, y: w.y + dy };
    }
  return null;
}
function endCharge(G, w){
  w.charge = null; w.turn = 0;
  if(G.rng() >= C.stuckChance) return;
  const at = stuckSpot(G, w); if(!at) return;
  G.worms = G.worms.filter(o => o !== w);
  G.mobs.push({ id: w.id, type: 'ver', x: at.x, y: at.y, hp: w.hp, maxhp: w.maxhp, cd: w.cd, left: C.stuckFor, knockRes: 100 });
  log(G, '🪱 Un vers de terre se coince : sa queue dépasse !');
}

/* tous les vers qui naviguent */
export function updateWorms(G, resists){
  for(const w of [...(G.worms ?? [])]){
    w.cd -= DT;
    if(w.charge){
      w.charge.step -= DT;
      let done = false;
      while(w.charge.step <= 1e-9 && !done){ w.charge.step += C.chargeStep; done = chargeStep(G, w, resists); }
      if(done) endCharge(G, w);
      continue;
    }
    if(!nearest(G, w, C.leash)){ G.worms = G.worms.filter(o => o !== w); continue; }   // plus personne autour : il s'en va
    const p = w.cd <= 1e-9 ? nearest(G, w, C.reach) : null;
    if(p){ w.cd = C.chargeEvery; w.charge = { target: p.id, step: C.chargeStep, hit: [], past: 0, fuel: C.chargeFuel }; }
    else roam(G, w);
  }
}

/* coincé (dans G.mobs) : compte à rebours ; true quand il replonge */
export function updateStuck(o){
  o.cd -= DT; o.left -= DT;
  return o.left <= 1e-9;
}
/* il replonge avec ses PV */
export function release(G, o){
  (G.worms ??= []).push({ id: o.id, type: 'ver', x: o.x, y: o.y, hp: o.hp, maxhp: o.maxhp, trail: [], cd: o.cd, dir: 0, step: C.roamStep, turn: 0, charge: null });
}
