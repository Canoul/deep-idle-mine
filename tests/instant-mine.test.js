/* Mine instantanée (MI) : réglages, objet Plume d'ange, génération, partie (bloc disputé, fuite, plumes, quitter). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { INSTANT_MINE as MI, ITEMS, TEXTURES, IDS, BLOCKS } from '../src/config.js';
import { rarityOf } from '../src/meta/rarity.js';
import { genInstantMine, spawnColumns } from '../src/sim/instant/world.js';
import { newInstant, tickInstant, runInstant, leaveInstant, endInstant, INSTANT_TICKS, instantItems } from '../src/sim/instant/session.js';
import { plan } from '../src/sim/instant/ai.js';

const players = n => Array.from({ length:n }, (_, i) => ({ name:'J'+i, account:'acc'+i }));
const count = (W, id) => W.tiles.slice(1).reduce((a, r) => a + r.filter(v => v === id).length, 0);

test('MI : composition = 100 %, que des minerais connus, plumes 1 à 5', () => {
  const total = Object.values(MI.comp).reduce((a, b) => a + b, 0) + MI.feather;
  assert.equal(total, 100);
  for(const k of Object.keys(MI.comp)) assert.ok(IDS[k] > 0, k);
  assert.ok(Number.isInteger(MI.featherMin) && MI.featherMin >= 1 && MI.featherMax >= MI.featherMin);
});

test('MI : Plume d\'ange, objet rare qui s\'empile, textures de l\'objet et du tas présentes', () => {
  const it = ITEMS[MI.featherItem];
  assert.ok(it && it.stack && it.tex === MI.featherTex);
  assert.equal(rarityOf(MI.featherItem), 'rare');
  for(const t of [MI.featherTex, MI.heapTex]){
    assert.ok(TEXTURES.includes(t), t);
    assert.ok(existsSync(new URL(`../textures/${t}.png`, import.meta.url)), t);
  }
});

/* ---------- génération ---------- */

test('MI génération : 50×50 sous une ligne de surface vide, composition exacte, plumes 1 à 5, même seed = même mine', () => {
  const A = genInstantMine(42), B = genInstantMine(42), C = genInstantMine(43);
  assert.equal(A.tiles.length, MI.h + 1);
  assert.ok(A.tiles[0].every(v => v === 0));
  assert.equal(count(A, IDS.coal), 500); assert.equal(count(A, IDS.iron), 1000); assert.equal(count(A, IDS.gold), 975);
  assert.equal(A.feathers.size, 25);
  for(const [k, n] of A.feathers){
    assert.ok(n >= 1 && n <= 5);
    const x = k % A.w, y = (k - x) / A.w;
    assert.ok(y >= 1 && A.tiles[y][x] === 0, 'un tas est une case vide');
  }
  assert.deepEqual(A.tiles, B.tiles); assert.deepEqual([...A.feathers], [...B.feathers]);
  assert.notDeepEqual(A.tiles, C.tiles);
});

test('MI départ : mineurs espacés régulièrement sur la surface', () => {
  assert.deepEqual(spawnColumns(1), [25]);
  const c = spawnColumns(20);
  assert.equal(new Set(c).size, 20);
  for(let i = 1; i < c.length; i++) assert.ok(c[i] - c[i-1] >= 2);
  const G = newInstant(1, { miners:players(3) });
  assert.deepEqual(G.miners.map(m => [m.x, m.y]), [[8, 0], [25, 0], [41, 0]]);
});

/* ---------- partie ---------- */

test('MI partie : 5 min de jeu, déterministe, chacun son butin, matière conservée, pas d\'XP ni de blocage', () => {
  const run = () => runInstant(7, { miners:players(5), id:'x' });
  const G = run(), H = run();
  assert.equal(INSTANT_TICKS, 3000); assert.equal(G.ticks, INSTANT_TICKS);
  assert.ok(G.over && G.summary);
  assert.deepEqual(G.summary, H.summary);
  const start = genInstantMine(7);
  let opened = 0;
  for(let y = 1; y <= G.h; y++) for(let x = 0; x < G.w; x++) if(start.tiles[y][x] && !G.tiles[y][x]) opened++;
  assert.equal(opened, G.stats.mined);
  assert.equal(G.summary.shares.reduce((a, s) => a + s.stats.mined, 0), G.stats.mined, 'un bloc = un seul gagnant');
  for(const s of G.summary.shares){
    const ore = Object.entries(s.bag).filter(([k]) => k !== MI.featherItem).reduce((a, [, n]) => a + n, 0);
    assert.equal(ore, s.stats.mined + s.stats.fortune);
    assert.equal(s.bag[MI.featherItem] ?? 0, s.stats.feathers);
    assert.ok(s.stats.mined > 60, `${s.miner} a miné ${s.stats.mined}`);
    assert.ok(s.stats.idle < 1, `${s.miner} inactif ${s.stats.idle} s`);
  }
  assert.deepEqual(instantItems(G), [], 'tout ce qui sort du MI existe au catalogue');
  assert.equal(G.summary.xp, undefined);
});

test('MI : la vitesse de minage du stuff compte (plus de blocs)', () => {
  const base = runInstant(3, { miners:[{ account:'a' }] }).summary.shares[0].stats.mined;
  const fast = runInstant(3, { miners:[{ account:'a', carac:{ mineSpeed:1.5 } }] }).summary.shares[0].stats.mined;
  assert.ok(fast > base * 1.3, `${base} → ${fast}`);
});

test('MI : 20 mineurs se dispersent (peu de blocs disputés, butins proches)', () => {
  const G = runInstant(11, { miners:players(20) });
  const per = G.summary.shares.map(s => s.stats.mined);
  assert.ok(G.stats.mined > 0.7 * 2500, `minés ${G.stats.mined}`);
  assert.ok(G.stats.contested < 50, `disputés ${G.stats.contested}`);
  assert.ok(Math.min(...per) > 0.8 * Math.max(...per), per.join(','));
});

/* ---------- bloc disputé ---------- */

/* deux mineurs sur le même bloc (sous eux) : a finit dans ce tick, b aurait fini aussi mais un peu plus tard */
function duel(aListedFirst){
  const G = newInstant(5, { miners:players(2) });
  const [a, b] = G.miners;
  for(const m of [a, b]){ m.x = 10; m.y = 0; m.target = { x:10, y:1 }; m.path = []; }
  const dur = BLOCKS[G.tiles[1][10]].hard;
  a.action = { type:'mine', dur, t:dur - 0.05, data:{ x:10, y:1 } };
  b.action = { type:'mine', dur, t:dur - 0.08, data:{ x:10, y:1 } };
  if(!aListedFirst) G.miners.reverse();
  tickInstant(G);
  return { G, a, b };
}

test('MI bloc disputé : celui qui finit en premier gagne, l\'autre perd son travail (quel que soit l\'ordre)', () => {
  for(const order of [true, false]){
    const { G, a, b } = duel(order);
    assert.equal(a.stats.mined, 1); assert.equal(b.stats.mined, 0);
    assert.equal(b.stats.lost, 1); assert.equal(G.stats.contested, 1);
    assert.equal(G.tiles[1][10], 0);
    assert.ok(!(b.action?.type === 'mine' && b.action.data.x === 10 && b.action.data.y === 1));
  }
});

test('MI : 3 blocs perdus d\'affilée → il change de zone (ne vise plus rien à moins de fleeDist)', () => {
  const G = newInstant(5, { miners:players(2) });
  const [a, b] = G.miners;
  for(let i = 0; i < MI.interruptMax; i++){
    const x = 28 + i, dur = BLOCKS[G.tiles[1][x]].hard;
    a.x = x; a.y = 0; a.target = { x, y:1 }; a.path = [];
    a.action = { type:'mine', dur, t:dur - 0.01, data:{ x, y:1 } };
    b.x = x; b.y = 0; b.target = { x, y:1 }; b.path = [];
    b.action = { type:'mine', dur, t:dur - 0.2, data:{ x, y:1 } };
    tickInstant(G);
    if(i < MI.interruptMax - 1) assert.equal(b.flee, null);
  }
  assert.ok(b.flee && b.flee.until > G.t, 'zone à fuir posée');
  assert.equal(b.interrupts, 0);
  b.action = null; b.target = null; b.path = [];
  plan(G, b);
  assert.ok(Math.abs(b.target.x - b.flee.x) + Math.abs(b.target.y - b.flee.y) >= MI.fleeDist, JSON.stringify(b.target));
});

test('MI : un bloc fini sans dispute remet à zéro le compte des blocs perdus', () => {
  const G = newInstant(5, { miners:players(1) });
  const [a] = G.miners;
  a.interrupts = 2; a.x = 10; a.y = 0; a.target = { x:10, y:1 }; a.path = [];
  const dur = BLOCKS[G.tiles[1][10]].hard;
  a.action = { type:'mine', dur, t:dur - 0.05, data:{ x:10, y:1 } };
  tickInstant(G);
  assert.equal(a.interrupts, 0);
});

/* ---------- plumes ---------- */

test('MI plumes : le premier qui arrive sur la case ramasse tout le tas, qui disparaît', () => {
  const G = newInstant(5, { miners:players(2) });
  const [a, b] = G.miners;
  G.feathers.clear(); G.feathers.set(0*G.w + 11, 4);
  for(const m of [a, b]){ m.x = 10; m.y = 0; }
  a.action = { type:'move', dur:0.3, t:0.25, data:{ x:11, y:0 } };
  b.action = { type:'move', dur:0.3, t:0.22, data:{ x:11, y:0 } };
  tickInstant(G);
  assert.equal(a.inv[MI.featherItem], 4); assert.equal(b.inv[MI.featherItem], undefined);
  assert.equal(G.feathers.size, 0);
  tickInstant(G);
  assert.equal(b.inv[MI.featherItem], undefined, 'le tas ne se ramasse qu\'une fois');
});

/* ---------- quitter, fin ---------- */

test('MI quitter : son butin est perdu, idempotent ; tout le monde parti = fin ; fin idempotente', () => {
  const G = newInstant(9, { miners:players(2) });
  for(let i = 0; i < 300; i++) tickInstant(G);
  const [a, b] = G.miners;
  assert.ok(Object.keys(a.inv).length);
  assert.equal(leaveInstant(G, 'acc0'), true);
  assert.equal(leaveInstant(G, 'acc0'), false);
  assert.equal(leaveInstant(G, 'inconnu'), false);
  assert.equal(G.miners.length, 1);
  for(let i = 0; i < 100; i++) tickInstant(G);
  assert.equal(leaveInstant(G, b), true);
  assert.ok(G.over);
  const s = G.summary;
  assert.deepEqual(s.shares.map(x => [x.left, Object.keys(x.bag).length]), [[true, 0], [true, 0]]);
  endInstant(G); assert.equal(G.summary, s);
  tickInstant(G); assert.equal(G.ticks, 400);
});

test('MI : celui qui reste jusqu\'au bout garde son sac', () => {
  const G = newInstant(9, { miners:players(2) });
  for(let i = 0; i < 300; i++) tickInstant(G);
  leaveInstant(G, 'acc1');
  while(!G.over) tickInstant(G);
  const [s0, s1] = G.summary.shares;
  assert.ok(!s0.left && Object.keys(s0.bag).length > 0);
  assert.ok(s1.left && Object.keys(s1.bag).length === 0);
  assert.equal(G.ticks, INSTANT_TICKS);
});
