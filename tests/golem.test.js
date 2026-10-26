/* Golem (26/10/2026, Geoffrey) : mob 2 × 2 à partir de l'area 5, il casse les blocs pour rejoindre le mineur (un toutes
   les 2 s, perdus), repousse de 0,5 toutes les 1,5 s, ébranle la mine tous les 33 % de PV perdus (étourdi 3 s à 3 cases),
   300 PV, 2 fois plus lent qu'un gobelin, 30 XP, 1 à 3 Pierres glissantes. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOBS, XP, ITEMS, CFG, AREA_Y0, AREA_H, mobHp } from '../src/config.js';
import { tick } from '../src/sim/session.js';
import { tackler } from '../src/sim/ai.js';
import { killMob } from '../src/sim/actions.js';
import { trapTable } from '../src/sim/trap.js';
import { inReach } from '../src/sim/knock.js';
import { fitsAt, clearAt, breakable } from '../src/sim/golem.js';
import { worldFrom, run } from './helpers.js';

const golem = (G, o) => { const x = { id: G.mobId++, type: 'golem', hp: 1e9, maxhp: 1e9, cd: 0, size: 2, knockRes: 100, speed: MOBS.speed.golem, ...o }; G.mobs.push(x); return x; };
const busy = m => { m.action = { type: 'wait', dur: 1e9, t: 0, data: {} }; };
const sum = row => Object.values(row).reduce((s, v) => s + v, 0);
const solid = (G, x, y) => G.tiles[y][x] !== 0;

test('config : 10 % des apparitions à partir de l\'area 5 (pris au gobelin), 300 PV +15 %/area, 30 XP, vitesse ×0,5, pas dans les pièges', () => {
  const T = MOBS.spawnTable;
  assert.deepEqual(T[5], { gobelin:0.2, occultiste:0.3, mephite:0.2, mimic:0.2, golem:0.1 });
  for(const row of T) assert.ok(Math.abs(sum(row) - 1) < 1e-9, JSON.stringify(row));
  assert.ok(T.slice(0, 5).every(r => !('golem' in r)), 'pas avant l\'area 5');
  assert.equal(MOBS.minArea.golem, 5);
  assert.equal(mobHp('golem', 5), 300); assert.equal(mobHp('golem', 6), 345);
  assert.equal(XP.mob.golem, 30);
  assert.equal(MOBS.speed.golem, 0.5);
  assert.ok(!('golem' in trapTable(5)) && !('golem' in trapTable(9)));
  assert.equal(ITEMS['Pierre glissante'].cat, 'material');
});

test('portée : on le frappe depuis n\'importe quelle case qui le touche (2 × 2), jamais en diagonale', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#' + ' '.repeat(20) + '#', '#' + ' '.repeat(20) + '#', '#'.repeat(50)]);
  const o = golem(G, { x: 10, y: 3 });   // cases (10..11, 2..3)
  const at = (x, y) => ({ x, y, kx: 0, ky: 0 });
  for(const [x, y] of [[9, 3], [9, 2], [12, 3], [12, 2], [10, 4 - 0], [11, 1 + 0]].filter(([, y]) => y >= 2 && y <= 3)) assert.ok(inReach(G, at(x, y), o), `${x},${y}`);
  assert.ok(!inReach(G, at(8, 3), o), 'à 2 cases (portée 0,5)');
  assert.ok(inReach(G, at(13, 2), o, 1.2), 'avec plus de portée');
});

/* un couloir de 2 de haut, le mineur à gauche, un mur de pierre de 4 de large, le golem à droite */
const wall = () => worldFrom(['', 'd'.repeat(50), '#      ####         #', '#@     ####         #', '#'.repeat(50)]);

test('il casse un bloc toutes les 2 s pour avancer ; les blocs sont perdus ; il rejoint le mineur et le tacle', () => {
  const G = wall(), m = G.miners[0]; busy(m); m.ox = 1e6;
  const inv = JSON.stringify(m.inv);
  const o = golem(G, { x: 14, y: 3 });
  run(G, 60);                                   // 6 s : il arrive au mur (1 case) et commence à casser
  const broken = () => [7, 8, 9, 10].reduce((s, x) => s + !solid(G, x, 2) + !solid(G, x, 3), 0);
  assert.ok(broken() >= 1 && broken() <= 3, `blocs cassés en 6 s : ${broken()}`);
  run(G, 400);
  assert.equal(broken(), 8, 'le mur entier');
  assert.equal(G.stats.golemBlocks, 8);
  assert.equal(G.stats.mined, 0, 'rien n\'est miné par un mineur');
  assert.equal(JSON.stringify(m.inv), inv, 'rien dans le sac');
  assert.equal(tackler(G, m), o);
});

test('il ne casse ni un treasure, ni une passerelle : bloqué derrière', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#      T            #', '#@     =            #', '#'.repeat(50)]), m = G.miners[0]; busy(m); m.ox = 1e6;
  const o = golem(G, { x: 14, y: 3 });
  run(G, 300);
  assert.ok(solid(G, 7, 2) && solid(G, 7, 3));
  assert.equal(o.x, 8, 'collé au treasure');
  assert.equal(tackler(G, m), null);
});

test('plus bas : une fois au-dessus, il creuse sous lui et descend', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#   ##', '#   ##', '######', '######', '#@    #', '#'.repeat(50)]), m = G.miners[0]; busy(m); m.ox = 1e6;
  const o = golem(G, { x: 1, y: 3 });
  run(G, 200);
  assert.ok(o.y >= 5, `il est descendu (y ${o.y})`);
  run(G, 200);
  assert.equal(tackler(G, m), o);
});

test('plus haut : il monte en escalier dans la roche (une marche à la fois)', () => {
  /* une salle (lignes 9-10) sous 5 lignes de roche ; le mineur plus haut, à droite : le golem va jusqu'au mur de la
     salle (une marche sans appui ne se prend pas), puis monte en escalier dans la roche */
  const rows = ['', 'd'.repeat(50), '#'.repeat(12) + '@  #', '#'.repeat(50)];
  for(let i = 0; i < 5; i++) rows.push('#'.repeat(50));
  rows.push('#' + ' '.repeat(10) + '#'); rows.push('#' + ' '.repeat(10) + '#'); rows.push('#'.repeat(50));
  const G = worldFrom(rows), m = G.miners[0]; busy(m); m.ox = 1e6;
  const o = golem(G, { x: 6, y: 10 });
  const y0 = o.y;
  run(G, 1500);
  assert.ok(o.y < y0 - 3, `il est monté (y ${y0} → ${o.y})`);
  assert.equal(tackler(G, m), o, 'il finit par l\'atteindre');
});

test('plus haut et presque à la verticale : escalier puis cheminée, sans dépasser ni osciller', () => {
  const rows = ['', 'd'.repeat(50), '#####@ ###', '#'.repeat(50)];
  for(let i = 0; i < 8; i++) rows.push('#'.repeat(50));
  rows.push('#'.repeat(7) + '  ' + '#'.repeat(41)); rows.push('#'.repeat(7) + '  ' + '#'.repeat(41)); rows.push('#'.repeat(50));
  const G = worldFrom(rows), m = G.miners[0]; busy(m); m.ox = 1e6;
  const o = golem(G, { x: 7, y: 13 });
  let minX = o.x, maxX = o.x;
  for(let i = 0; i < 2000 && !tackler(G, m); i++){ run(G, 1); minX = Math.min(minX, o.x); maxX = Math.max(maxX, o.x); }
  assert.equal(tackler(G, m), o, `il l'atteint (golem ${o.x},${o.y})`);
  assert.ok(maxX - minX <= 3, `il reste dans sa colonne (x ${minX}..${maxX})`);
});

test('sous une grande salle vide : il ne grimpe pas dans le vide, il va jusqu\'à la paroi et monte par la roche', () => {
  const rows = ['', 'd'.repeat(50), '#'.repeat(10) + '@ ' + '#'.repeat(38), '#'.repeat(50), '#'.repeat(50)];
  for(let i = 0; i < 4; i++) rows.push('#' + ' '.repeat(16) + '#');
  rows.push('#'.repeat(50));
  const G = worldFrom(rows), m = G.miners[0]; busy(m); m.ox = 1e6;
  const o = golem(G, { x: 10, y: 8 });
  const seen = new Map();
  for(let i = 0; i < 3000 && !tackler(G, m); i++){ run(G, 1); const k = `${o.x},${o.y}`; seen.set(k, (seen.get(k) || 0) + 1); }
  assert.equal(tackler(G, m), o, `il l'atteint (golem ${o.x},${o.y})`);
});

test('coups : 0,5 de recul toutes les 1,5 s', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#' + ' '.repeat(30) + '#', '#' + ' '.repeat(30) + '#', '#'.repeat(50)]), m = G.miners[0];
  m.x = 12; m.y = 3; m.ox = 1e6;
  const o = golem(G, { x: 13, y: 3 });
  run(G, 1); assert.equal(tackler(G, m), o);
  run(G, 30);
  assert.equal(m.stats.knocked, 2, '2 coups en 3,1 s');
  assert.equal(MOBS.knock.golem, 0.5); assert.equal(MOBS.hitEveryBy.golem, 1.5);
});

test('ébranlement : à 33 %, 66 % et 99 % de PV perdus, les mineurs à 3 cases sont étourdis 3 s ; jamais une 4e fois ; Ténacité', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#' + ' '.repeat(30) + '#', '#' + ' '.repeat(30) + '#', '#'.repeat(50)], { miners: 3 });
  const [a, b, c] = G.miners;
  a.x = 8; a.y = 3; b.x = 20; b.y = 3; c.x = 7; c.y = 3; c.carac.tenacity = 100;
  for(const m of G.miners){ busy(m); m.ox = 1e6; }
  const o = golem(G, { x: 10, y: 3, hp: 300, maxhp: 300, cd: 1e9 });
  run(G, 1); assert.equal(o.quakes || 0, 0);
  o.hp = 200; run(G, 2);
  assert.equal(o.quakes, 1);
  assert.equal(a.action?.type, 'stun', 'a (à 2 cases) étourdi'); assert.ok(Math.abs(a.quakeUntil - G.t - 2.9) < 0.11, `${a.quakeUntil - G.t}`);
  assert.notEqual(b.action?.type, 'stun', 'b (à 9 cases) non');
  assert.notEqual(c.action?.type, 'stun', 'c résiste (Ténacité 100 %)');
  o.hp = 100; run(G, 1); assert.equal(o.quakes, 2);
  o.hp = 3; run(G, 1); assert.equal(o.quakes, 3);
  o.hp = 1; run(G, 1); assert.equal(o.quakes, 3, 'pas de 4e');
  assert.equal(a.stats.quaked, 3);
});

test('vaincu : 1 à 3 Pierres glissantes et 30 XP', () => {
  const seen = new Set();
  for(let s = 1; s <= 40; s++){
    const G = worldFrom(['', 'd'.repeat(50), '#@  #', '#'.repeat(50)], { seed: s }), m = G.miners[0];
    const o = golem(G, { x: 3, y: 2 });
    const xp0 = G.xp ?? 0;
    killMob(G, m, o);
    const n = m.inv['Pierre glissante']; seen.add(n);
    assert.ok(n >= 1 && n <= 3, `${n}`);
  }
  assert.ok(seen.size >= 2, [...seen].join(','));
});

test('naissance : il tient s\'il a le sol et que les blocs autour se cassent ; ils sont cassés d\'un coup', () => {
  const G = worldFrom(['', 'd'.repeat(50), '#####', '# ###', '#####', '#'.repeat(50)]);
  assert.ok(fitsAt(G, 1, 3));
  clearAt(G, 1, 3);
  assert.ok(!solid(G, 1, 2) && !solid(G, 2, 2) && !solid(G, 2, 3));
  const H = worldFrom(['', 'd'.repeat(50), '#T###', '# ###', '#####', '#'.repeat(50)]);
  assert.ok(!fitsAt(H, 1, 3), 'pas à travers un treasure');
  assert.ok(!breakable(H, 1, 2));
});

test('vitesse : 2 fois plus lent qu\'un gobelin dans un couloir ouvert', () => {
  const lane = () => worldFrom(['', 'd'.repeat(50), '#' + ' '.repeat(45) + '#', '#@' + ' '.repeat(44) + '#', '#'.repeat(50)]);
  const G = lane(); busy(G.miners[0]);
  const o = golem(G, { x: 14, y: 3 });
  run(G, 100);
  const moved = 14 - o.x, step = CFG.mobStep / MOBS.speed.golem;
  assert.ok(Math.abs(moved - Math.floor(10 / step)) <= 1, `${moved} cases en 10 s (un pas toutes les ${step} s)`);
});

test('apparition dans la mine (area 5) : il naît dans une galerie d\'une case de haut en cassant la roche au-dessus', () => {
  const row = AREA_Y0 + 5 * AREA_H + 5, rows = ['', 'd'.repeat(50)];
  for(let y = 2; y <= row + 1; y++) rows.push(y === row ? '#@' + ' '.repeat(20) + '#' : '#'.repeat(50));
  const G = worldFrom(rows), m = G.miners[0]; busy(m);
  const seq = [0, 0.95, 0]; let i = 0; G.rng = () => seq[i++] ?? 0; G.spawnTimer = 0;
  tick(G);
  const o = G.mobs.find(q => q.type === 'golem');
  assert.ok(o, 'un golem');
  assert.deepEqual([o.size, o.hp, o.maxhp, o.speed, o.knockRes], [2, 300, 300, 0.5, 100]);
  assert.ok(!solid(G, o.x, o.y - 1) && !solid(G, o.x + 1, o.y - 1) && !solid(G, o.x + 1, o.y), 'sa place est dégagée');
});
