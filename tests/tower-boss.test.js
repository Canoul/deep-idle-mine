/* Tour céleste (25/10, Geoffrey) : boss qui focus et suit sa cible, la traverse des autres, recul 0,5 avec arc,
   projection de 5 cases à 25 / 10 % (rage 35 / 20 %), saut à chaque tranche de 25 % de PV (intouchable, atterrissage qui étourdit
   et projette ceux qui sont dessous), étages de blocs à vider entièrement, mobs qui partagent une case, affichage fluide. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWER, DT } from '../src/config.js';
import { newTower, tickTower, contactCells, sealedFloor, blockCells } from '../src/sim/tower/session.js';
import { floorCeil, gateCols } from '../src/sim/tower/world.js';
import { createTowerViewer, applyTowerView } from '../src/shared/tower-view.js';

const B = TOWER.boss;
const team = n => Array.from({ length: n }, (_, i) => ({ name: 'M' + i, account: 'A' + i }));
const hold = m => { m.action = { type: 'stun', dur: 1e9, t: 0, data: {} }; };
const ticks = s => Math.round(s / DT);
/* toit prêt : mobs morts, étages de blocs vidés, boss engagé */
function roof(n = 2, seed = 5, side = 'angel', miners = team(n)){
  const G = newTower(seed, { side, miners });
  for(const o of G.mobs) o.hp = 0;
  G.blocksLeft = G.blocksLeft.map(() => 0);
  G.boss.engaged = true;
  return G;
}

test('focus : le premier arrivé à son contact ; il ignore les autres et suit son focus quand il le repousse', () => {
  const G = roof(2), [a, b] = G.miners, y = G.roof - 1;
  Object.assign(a, { x: G.boss.x - 1, y }); hold(a);
  Object.assign(b, { x: G.boss.x + B.w, y }); hold(b);
  G.arrivals = [a.id, b.id]; G.fightRng = () => 0.99; G.boss.cd = 0.05;
  tickTower(G); tickTower(G);
  assert.equal(G.boss.focus, a.id);
  assert.equal(Math.abs(a.kx), B.push, 'repoussé de 0,5');
  assert.notEqual(a.hop, undefined, 'petit arc à l\'affichage');
  assert.equal(b.kx ?? 0, 0, 'b est ignoré');
  a.x -= 3; a.kx = 0;   // repoussé loin
  const x0 = G.boss.x;
  for(let i = 0; i < ticks(2); i++) tickTower(G);
  assert.ok(G.boss.x < x0, 'il avance vers son focus');
  assert.equal(G.boss.x - 1, a.x, 'jusqu\'au contact');
});

test('focus : la provocation du barbare le fait changer de cible', () => {
  const G = roof(2, 5, 'angel', [{ name: 'M', account: 'M' }, { name: 'B', account: 'B', skillTree: 'barbare', skills: { taunt: 1 } }]);
  const [m, bar] = G.miners, y = G.roof - 1;
  Object.assign(m, { x: G.boss.x - 1, y }); hold(m);
  Object.assign(bar, { x: G.boss.x + B.w, y, action: { type: 'attack', dur: 0.05, t: 0, data: { boss: true } } });
  G.arrivals = [m.id, bar.id];
  tickTower(G);
  assert.equal(G.boss.taunt, bar.id);
  tickTower(G);
  assert.equal(G.boss.focus, bar.id, 'il focus le barbare');
});

test('focus tombé du toit : il en prend un autre ; plus personne sur le toit : il retourne au centre', () => {
  const G = roof(1), [a] = G.miners;
  G.boss.x = G.bx + 3;
  Object.assign(a, { x: G.boss.x - 1, y: G.floor }); hold(a);   // au pied de la tour
  for(let i = 0; i < ticks(3); i++) tickTower(G);
  assert.equal(G.boss.x, G.bx, 'revenu au centre');
});

test('il traverse les mineurs ; ceux qui se retrouvent sur lui restent où ils sont (25/10)', () => {
  const G = roof(2), [a, b] = G.miners, y = G.roof - 1;
  G.boss.x = G.bx;
  Object.assign(a, { x: G.boss.x - 4, y }); hold(a);              // son focus, à gauche
  Object.assign(b, { x: G.boss.x - 2, y }); hold(b);              // sur son chemin
  G.boss.focus = a.id; G.arrivals = [a.id, b.id];
  const bx = b.x;
  for(let i = 0; i < ticks(3); i++) tickTower(G);
  assert.equal(G.boss.x - 1, a.x, 'arrivé au contact de son focus');
  assert.equal(b.x, bx, 'b n\'a pas bougé');
  assert.ok(b.x >= G.boss.x && b.x < G.boss.x + B.w, 'b est dans le boss, et y reste');
});

test('un mineur dans le boss peut le frapper', () => {
  const G = roof(1), [a] = G.miners;
  Object.assign(a, { x: G.boss.x + 1, y: G.roof - 1, action: null });
  G.boss.cd = 1e9;   // il ne frappe pas
  const hp = G.boss.hp, x0 = a.x;
  for(let i = 0; i < ticks(3); i++) tickTower(G);
  assert.ok(G.boss.hp < hp, 'il l\'a frappé');
  assert.equal(a.x, x0, 'sans bouger (son focus : ses coups repoussent le boss)');
});

test('recul du boss : seul son focus le repousse (25 % de résistance) ; les coups des autres, non', () => {
  assert.equal(B.knockRes, 25);
  const G = roof(2), [a, b] = G.miners, y = G.roof - 1;
  Object.assign(a, { x: G.boss.x - 1, y }); Object.assign(b, { x: G.boss.x + B.w, y });
  G.boss.focus = a.id; G.boss.cd = 1e9; G.boss.moveCd = 1e9;
  const hit = m => { m.action = { type: 'attack', dur: 0.05, t: 0, data: { boss: true } }; tickTower(G); hold(m); };
  hold(a); hold(b);
  hit(b);
  assert.equal(G.boss.kx ?? 0, 0, 'b n\'est pas son focus : rien');
  hit(a);
  assert.ok(Math.abs(G.boss.kx - 0.25 * 0.75) < 1e-9, 'repoussé de 0,25 × 75 %, loin de a');
  for(let i = 0; i < 3; i++) hit(a);
  assert.equal(G.boss.x, G.bx + 1, 'au-delà d\'une demi-case, il passe sur la case suivante');
});

test('rage : chances de projection 35 % (au lieu de 25 %)', () => {
  for(const [hp, r, want] of [[3500, 0.3, 'push'], [1000, 0.3, 'knock']]){
    const G = roof(1), [a] = G.miners;
    G.boss.hp = hp; G.boss.phase = 3;   // pas de saut
    Object.assign(a, { x: G.boss.x - 1, y: G.roof - 1 }); hold(a);
    G.arrivals = [a.id]; G.fightRng = () => r; G.boss.cd = 0.05;
    tickTower(G); tickTower(G);
    assert.equal(a.stats.knocked > 0 ? 'knock' : 'push', want, `${hp} PV, tirage ${r}`);
  }
});

test('saut à 75 % : au centre, 3 s en l\'air, intouchable, ne frappe plus ; atterrissage : tous projetés de 3, étourdis 3 s', () => {
  const G = roof(3), [a, b, c] = G.miners, y = G.roof - 1;
  G.boss.x = G.bx + 2;
  Object.assign(a, { x: G.boss.x - 1, y }); hold(a);
  Object.assign(b, { x: G.bx + 1, y }); hold(b);                   // sous la zone d'atterrissage (et il ne bouge pas)
  Object.assign(c, { x: G.x1 - 1, y }); hold(c);
  c.carac.tenacity = 100;
  G.boss.hp = B.hp * 0.74;
  tickTower(G);
  assert.ok(G.boss.air, 'il s\'envole');
  for(let i = 0; i < ticks(B.jumpFly) + 1; i++) tickTower(G);
  assert.equal(G.boss.x, G.bx, 'au centre'); assert.equal(G.boss.lift, B.jumpHigh, '5 blocs en l\'air');
  const hp = G.boss.hp;
  a.x = G.boss.x - 1;
  a.action = { type: 'attack', dur: 0.05, t: 0, data: { boss: true } };
  const hits = G.stats.hits;
  for(let i = 0; i < 5; i++) tickTower(G);
  assert.equal(G.boss.hp, hp, 'intouchable'); assert.equal(G.stats.hits, hits, 'il ne frappe plus');
  hold(a); hold(b);
  b.x = G.bx + 1;
  for(let i = 0; i < ticks(B.jumpHover + B.jumpFall) + 2 && G.boss.air; i++) tickTower(G);
  assert.equal(G.boss.air, null, 'atterri'); assert.equal(G.boss.lift, 0);
  assert.equal(B.jumpHover, 3); assert.equal(B.jumpKnock, 3);
  assert.equal(b.stats.knocked, 1, 'b était dessous : projeté');
  assert.equal(b.x, G.bx + 1 + B.jumpKnock); assert.ok(b.x >= G.bx + B.w, 'hors du boss');
  assert.equal(a.stats.knocked, 1, 'a aussi (tous les mineurs du toit)'); assert.equal(a.x, G.bx - 1 - B.jumpKnock);
  assert.equal(c.stats.knocked, 1, 'c aussi : poussé hors du toit, il tombe');
  assert.equal(a.action?.type, 'stun'); assert.equal(a.action.dur, B.jumpStun);
  assert.notEqual(c.action?.data?.hex, true); assert.equal(c.stats.stunned ?? 0, 0, 'ténacité 100 % : il résiste');
  assert.equal(G.boss.phase, 1);
});

test('un seul saut même si un coup fait passer deux tranches ; trois sauts au plus', () => {
  const G = roof(1);
  G.boss.hp = B.hp * 0.40;   // 75 % et 50 % passés d'un coup
  tickTower(G);
  assert.ok(G.boss.air); assert.equal(G.boss.phase, 2);
  G.boss.air = null; G.boss.hp = 1;
  tickTower(G); assert.equal(G.boss.phase, 3);
  G.boss.air = null; tickTower(G); assert.equal(G.boss.air, null, 'pas de 4e saut');
});

test('IA : pendant le saut, les mineurs s\'écartent de la zone d\'atterrissage', () => {
  const G = roof(1), [a] = G.miners, y = G.roof - 1;
  Object.assign(a, { x: G.bx + 1, y, action: null });
  G.boss.x = G.x1 - B.w; G.boss.hp = B.hp * 0.74;
  for(let i = 0; i < ticks(B.jumpFly + 3); i++) tickTower(G);
  assert.ok(a.x < G.bx || a.x >= G.bx + B.w, `sorti de la zone (x ${a.x})`);
});

test('étage de blocs : la porte du plafond reste scellée tant qu\'il reste un bloc ; l\'IA vide l\'étage', () => {
  const G = newTower(3, { side: 'angel', miners: team(3) });
  const k = G.kinds.indexOf('blocks');
  assert.ok(G.blocksLeft[k] > 0); assert.equal(G.blocksLeft[k], blockCells(G, k).length);
  assert.equal(sealedFloor(G, k), true);
  let guard = 0;
  while(G.blocksLeft[k] > 0 && guard++ < ticks(400)) tickTower(G);
  assert.equal(G.blocksLeft[k], 0, 'étage vidé');
  assert.equal(blockCells(G, k).length, 0);
  assert.equal(sealedFloor(G, k), false, 'porte ouverte');
  for(let i = 0; i < ticks(60); i++) tickTower(G);
  assert.ok(gateCols(G, k).some(x => G.tiles[floorCeil(G, k)][x] === 0), 'ils passent la porte');
  assert.equal(G.stats.blocked, 0);
});

test('les mobs s\'empilent : ils peuvent être sur la même case', () => {
  const G = newTower(3, { side: 'angel', miners: team(1) });
  const k = G.kinds.indexOf('mobs'), m = G.miners[0];
  const [o, q] = G.mobs.filter(x => x.floor === k);
  for(const x of G.mobs) x.awake = false;
  o.awake = q.awake = true; o.x = G.x0 + 3; q.x = G.x0 + 5; o.cd = 1e9;
  Object.assign(m, { x: G.x0 + 2, y: o.y }); hold(m);
  for(let i = 0; i < ticks(2.5); i++) tickTower(G);   // (ensuite, leurs coups repoussent le mineur et ils le suivent)
  assert.equal(q.x, o.x, 'q a rejoint la case de o');
});

test('affichage : les mineurs, les mobs et le boss glissent entre deux envois', () => {
  const G = roof(1), [a] = G.miners, view = createTowerViewer(G);
  Object.assign(a, { x: G.boss.x - 3, y: G.roof - 1, action: null });
  const first = applyTowerView(view(), null, 0);
  a.x += 1; G.boss.x -= 1;
  const next = applyTowerView(view(), first, 250);
  const m = next.miners[0];
  assert.deepEqual(m._from, [a.x - 1, a.y]); assert.deepEqual(m._to, [a.x, a.y]);
  assert.deepEqual(next.boss._from, [G.boss.x + 1, G.boss.y]); assert.deepEqual(next.boss._to, [G.boss.x, G.boss.y]);
});

test('étage de blocs : deux mineurs ne visent jamais le même bloc (chacun réserve le sien)', () => {
  const G = newTower(3, { side: 'angel', miners: team(3) });
  const k = G.kinds.indexOf('blocks');
  let guard = 0, shared = 0;
  while(G.blocksLeft[k] > 0 && guard++ < ticks(400)){
    tickTower(G);
    const goals = G.miners.map(m => m.blockGoal).filter(g => g != null);
    shared += goals.length - new Set(goals).size;
  }
  assert.equal(G.blocksLeft[k], 0);
  assert.equal(shared, 0, 'jamais deux mineurs sur le même bloc visé');
});
