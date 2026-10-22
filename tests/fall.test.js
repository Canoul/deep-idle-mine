/* Chutes : le mineur ne se jette jamais dans un trou connu de plus de 3 cases ; une chute imprévue (vide pas
   découvert) de 3 cases ou plus l'étourdit 5 s (il ne fait plus rien). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CFG, CHEST_X } from '../src/config.js';
import { worldFrom, run } from './helpers.js';
import { fallInfo } from '../src/sim/world.js';
import { search } from '../src/sim/path.js';
import { stepDir, deepFall } from '../src/sim/actions.js';

const TICKS = s => Math.round(s / 0.1);
/* cache (pas découvert) les cases x de y0 à y1 */
const hide = (G, x, y0, y1) => { for(let y = y0; y <= y1; y++) G.seen[y][x] = 0; };
/* un puits vertical de `depth` cases vides sous le mineur, dans de la pierre (le mineur est en haut, dans le vide) */
const pit = depth => ['', '#####@####', ...Array.from({ length:depth - 1 }, () => '##### ####'), '##########', '##########'];

test('config : chute prévue max 3, étourdi 5 s à partir de 3 cases imprévues', () => {
  assert.equal(CFG.maxFall, 3); assert.equal(CFG.stunFall, 3); assert.equal(CFG.stunTime, 5);
});

test('chute imprévue de 3 cases : étourdi 5 s, il ne fait rien pendant ce temps', () => {
  const G = worldFrom(pit(4)), m = G.miners[0];       // il est en (5,1), vide en 2,3,4 : il tombe de 3
  hide(G, 5, 2, 5);
  run(G, 4);                                           // 3 cases à 8 blocs/s
  assert.equal(m.y, 4);
  assert.equal(m.action?.type, 'stun');
  assert.equal(m.stats.stuns, 1);
  assert.equal(m.status, 'Étourdi (chute)');
  const ox = m.ox, mined = m.stats.mined;
  run(G, TICKS(CFG.stunTime) - 3);
  assert.equal(m.action?.type, 'stun', 'toujours étourdi juste avant 5 s');
  assert.equal(m.stats.mined, mined); assert.deepEqual([m.x, m.y], [5, 4]);
  assert.ok(m.ox < ox, 'l\'oxygène continue de baisser');
  run(G, 5);
  assert.notEqual(m.action?.type, 'stun', 'reprend après 5 s');
  assert.equal(m.stats.stuns, 1);
});

test('chute imprévue de 2 cases : pas d\'étourdissement', () => {
  const G = worldFrom(pit(3)), m = G.miners[0];
  hide(G, 5, 2, 4);
  run(G, 10);
  assert.equal(m.stats.stuns, 0);
});

test('chute de 3 cases dans un trou connu (découvert) : pas d\'étourdissement', () => {
  const G = worldFrom(pit(4)), m = G.miners[0];
  run(G, 10);
  assert.equal(m.y, 4);
  assert.equal(m.stats.stuns, 0);
});

test('chute de plus de 3 cases dans un trou connu (jamais voulue : son appui a disparu) : étourdi aussi', () => {
  const G = worldFrom(pit(8)), m = G.miners[0];       // trou découvert de 7 cases, il n'a rien sous lui
  run(G, 10);
  assert.equal(m.y, 8);
  assert.equal(m.stats.stuns, 1);
  assert.equal(m.status, 'Étourdi (chute)');
});

test('chantier du treuil : jamais étourdi, même en tombant de plus de 3 cases dans son puits', () => {
  const G = worldFrom(pit(8)), m = G.miners[0];
  m.winchJob = { bottom:20 };
  run(G, 10);
  assert.equal(m.y, 8);
  assert.equal(m.stats.stuns, 0);
});

test('chute imprévue de plus de 3 cases : étourdi aussi', () => {
  const G = worldFrom(pit(8)), m = G.miners[0];
  hide(G, 5, 2, 9);
  run(G, 10);
  assert.equal(m.y, 8);
  assert.equal(m.stats.stuns, 1);
});

test('fallInfo : trou connu ou non (cases traversées et sol d\'arrivée)', () => {
  const G = worldFrom(pit(5));
  assert.deepEqual(fallInfo(G, 5, 1), { y:5, n:4, known:true });
  G.seen[6][5] = 0;                                   // le sol d'arrivée n'est pas découvert
  assert.equal(fallInfo(G, 5, 1).known, false);
});

test('itinéraire : jamais de chute de plus de 3 cases', () => {
  const deep = worldFrom(['', '###@#####', '#########', '### #####', '### #####', '### #####', '### #####', '#########']);
  /* sans rien creuser, la seule descente est un saut de 4 cases (lignes 3 à 6) : interdit */
  deep.tiles[2][3] = 0;
  const m = deep.miners[0];
  assert.equal(search(deep, m, m.x, m.y, false, (x, y) => y === 6), null);
  const ok = worldFrom(['', '###@#####', '#########', '### #####', '### #####', '#########']);
  ok.tiles[2][3] = 0;                                  // saut de 3 cases (lignes 2 à 4) : permis
  assert.ok(search(ok, ok.miners[0], 3, 1, false, (x, y) => y === 4));
});

test('creuser sous ses pieds au-dessus d\'un trou connu trop profond : refusé', () => {
  const G = worldFrom(['', '#####@####', '##########', '##### ####', '##### ####', '##### ####', '##### ####', '##########']);
  G.tiles[1][5] = 0;
  const m = G.miners[0];                               // debout en (5,1), sur le bloc (5,2), trou de 4 en dessous
  assert.equal(deepFall(G, m, 0, 1), true);
  assert.equal(stepDir(G, m, 0, 1), false);
  hide(G, 5, 3, 7);                                    // le même trou, pas découvert : il ne sait pas, il creuse
  assert.equal(deepFall(G, m, 0, 1), false);
  assert.equal(stepDir(G, m, 0, 1), true);
  assert.equal(m.action.type, 'mine');
});

test('sur une échelle, descendre dans un trou connu trop profond (puits d\'un autre) : refusé', () => {
  const G = worldFrom(pit(7)), m = G.miners[0];       // en (5,1), vide de 2 à 6 : un puits de 5 cases sous lui
  G.ladder[1][5] = 1;                                  // il tient sur son échelle
  assert.equal(deepFall(G, m, 0, 1), true);
  assert.equal(stepDir(G, m, 0, 1), false);
  G.ladder[4][5] = 1;                                  // une échelle plus bas : chute de 2 jusqu'à elle, permis
  assert.equal(deepFall(G, m, 0, 1), false);
  G.ladder[4][5] = 0; hide(G, 5, 2, 7);                // le même puits, pas découvert : il ne sait pas, il descend
  assert.equal(deepFall(G, m, 0, 1), false);
  assert.equal(stepDir(G, m, 0, 1), true);
});

test('marcher vers un trou connu trop profond : passerelle (ou refus sans passerelle)', () => {
  const G = worldFrom(['', '    @     ', '##########', '##########', '##########', '##########', '##########']);
  const m = G.miners[0];
  /* trou de 5 cases à droite du mineur (colonne 5, lignes 1 à 5) */
  for(let y = 1; y <= 5; y++) G.tiles[y][5] = 0;
  G.tiles[1][4] = 0; G.tiles[2][4] = 1;                // il tient sur de la terre en (4,2)
  m.x = 4; m.y = 1;
  assert.equal(deepFall(G, m, 1, 0), true);
  assert.equal(stepDir(G, m, 1, 0, { noBridge:true }), true);
  assert.equal(m.action.type, 'bridge');
  m.action = null; m.bridges = 0;
  assert.equal(stepDir(G, m, 1, 0), false);
});

test('passerelles illimitées : le mineur en a une infinité, en poser n\'en retire pas, l\'affichage reçoit null', async () => {
  const { STATS } = await import('../src/config.js');
  const G = worldFrom(['', '    @     ', '##########', '##########', '##########', '##########', '##########']);
  const m = G.miners[0];
  assert.equal(STATS.bridges, Infinity);
  assert.equal(m.bridges, Infinity);
  for(let y = 1; y <= 5; y++) G.tiles[y][5] = 0;
  G.tiles[1][4] = 0; G.tiles[2][4] = 1;
  m.x = 4; m.y = 1;
  assert.equal(stepDir(G, m, 1, 0, { noBridge:true }), true);
  run(G, 2);
  assert.equal(m.bridges, Infinity);
  assert.equal(JSON.parse(JSON.stringify({ b:m.bridges })).b, null);   // le HUD affiche « passerelles illimitées »
});

test('étourdi : un tacle ne l\'interrompt pas', () => {
  const G = worldFrom(pit(4)), m = G.miners[0];
  hide(G, 5, 2, 5);
  run(G, 4);
  assert.equal(m.action?.type, 'stun');
  G.mobs.push({ id:99, type:'bestiole', x:m.x, y:m.y, hp:1e9, maxhp:1e9, cd:5 });
  run(G, 2);
  assert.equal(m.action?.type, 'stun');
});

test('session complète : jamais bloqué, chute connue jamais au-delà de 3 cases', async () => {
  const { newSession, tick } = await import('../src/sim/session.js');
  const G = newSession(23757, { miners:1 });
  const m = G.miners[0];
  /* seules comptent les chutes qu'il provoque (pas en marchant ou en creusant) ; son appui qui disparaît sous lui n'en
     est pas une (22/10, seed 23757 avec « Plus profond » : il tue le mimic sur lequel il se tient, chute de 4) */
  let start = null, worst = 0, prev = null;
  while(!G.over){
    const falling = m.action?.data?.fall;
    if(falling && start === null) start = { y:m.y, blind:m.fall?.blind, chosen:prev === 'move' || prev === 'mine' };
    if(!falling && start !== null){ if(!start.blind && start.chosen) worst = Math.max(worst, m.y - start.y); start = null; }
    if(!falling && m.action) prev = m.action.type;
    tick(G);
  }
  assert.ok(worst <= CFG.maxFall, `chute connue de ${worst} cases`);
  assert.ok(G.stats.trips >= 5, `${G.stats.trips} allers-retours`);
  assert.ok(m.x >= 0 && CHEST_X >= 0);
});

/* 22/10 (Geoffrey) : une chute qui finit sur une échelle se fait à la vitesse de l'échelle ; et l'itinéraire ne sort
   plus du seau (ou d'une échelle) pour tomber à côté plus vite puis y revenir */
import { climbT } from '../src/sim/mineur.js';
import { firstStep } from '../src/sim/path.js';

test('chute sur une échelle : chaque case de chute dure le temps d\'une case d\'échelle', () => {
  const G = worldFrom(['', ...Array(12).fill('##########')]), m = G.miners[0];
  for(let y = 1; y <= 10; y++) G.tiles[y][5] = 0;
  for(let y = 5; y <= 10; y++) G.ladder[y][5] = 1;   // échelle sous un trou de 3
  m.x = 5; m.y = 1;
  run(G, 1);
  assert.equal(m.action.data.fall, true);
  assert.ok(Math.abs(m.action.dur - climbT(G, m)) < 1e-9, `durée ${m.action.dur}`);
  const H = worldFrom(['', ...Array(12).fill('##########')]), h = H.miners[0];
  for(let y = 1; y <= 4; y++) H.tiles[y][5] = 0;     // même trou, sol en pierre : vitesse de chute
  h.x = 5; h.y = 1; run(H, 1);
  assert.ok(Math.abs(h.action.dur - 1 / CFG.fallSpeed) < 1e-9);
});

test('treuil : pour descendre, il reste dans le seau au lieu de sauter dans le trou d\'à côté', () => {
  const G = worldFrom(['', ...Array(14).fill('##########')]), m = G.miners[0];
  for(let y = 1; y <= 12; y++) G.tiles[y][4] = 0;     // puits du treuil (colonne 4)
  for(let y = 3; y <= 5; y++) G.tiles[y][5] = 0;      // trou de 3 juste à côté, qui rejoint le puits plus bas
  G.tiles[6][5] = 2;
  G.winch = { x:4, bottom:12 };
  m.x = 4; m.y = 3;
  const r = search(G, m, m.x, m.y, false, (x, y) => x === 4 && y === 8);
  const s = firstStep(r, r.n);
  assert.deepEqual([s.dx, s.dy], [0, 1], 'il descend dans le seau');
});
